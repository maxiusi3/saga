import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seed, characterize, verifyCandidate } from './scenarios.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const require = createRequire(import.meta.url)
const { Client } = require('../t05-durable-worker/node_modules/pg')
const args = process.argv.slice(2)
const red = args.includes('--red')
const snapshotPath = join(
  root,
  'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T02-45-52-407Z.json'
)
const evidence = join(
  root,
  'docs/research/evidence/2026-10-17-rls-rehearsal',
  `${red ? 'red' : 'run'}-${Date.now()}-${process.pid}.json`
)
process.send?.({ type: 'evidence', path: evidence })
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('PG') && k !== 'DATABASE_URL')
)
const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  scope: 'isolated synthetic PostgreSQL RLS replay; no remote access',
  runtime: { node: process.version },
  sources: {},
  observations: [],
  scenarios: [],
  assertions: 0,
}
let scratch,
  config,
  db,
  clusterMayExist = false,
  finished = false,
  cleaning,
  requestedSignal
const clients = new Set()
const allocations = new Set()
function checkpoint() {
  if (requestedSignal) throw Object.assign(new Error('Rehearsal interrupted'), { code: 'REHEARSAL_INTERRUPTED' })
}
const command = (bin, params) => {
  if (!finished) checkpoint()
  return execFileSync(bin, params, {
    env,
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const qid = value => `"${value.replaceAll('"', '""')}"`
function eq(actual, expected, label) {
  checkpoint()
  assert.deepEqual(actual, expected, label)
  report.assertions++
}
function ok(value, label) {
  checkpoint()
  assert.ok(value, label)
  report.assertions++
}
async function save() {
  await mkdir(dirname(evidence), { recursive: true })
  await writeFile(evidence, JSON.stringify(report, null, 2) + '\n')
}
// Explicit test-only scheduling point around a real filesystem allocation.
// The caller has not received the directory yet when the controller signals us.
async function allocateScratch() {
  checkpoint()
  if (args.includes('--test-pause-before-allocation-return') && !process.send)
    throw new Error('allocation pause requires an IPC test controller')
  const allocated = await mkdtemp('/tmp/saga-rls-')
  // This allocation remains owned even if the test gate rejects before return.
  allocations.add(allocated)
  if (args.includes('--test-pause-before-allocation-return')) {
    report.testInjection = 'pause before real mkdtemp result reaches caller'
    await new Promise((resolvePause, reject) => {
      const timer = setTimeout(() => {
        process.off('message', release)
        reject(new Error('allocation test controller timed out'))
      }, 20000)
      function release(message) {
        if (message?.type !== 'release-allocation') return
        clearTimeout(timer)
        process.off('message', release)
        resolvePause()
      }
      process.on('message', release)
      process.send({ type: 'allocation-pending', path: allocated })
      if (args.includes('--test-deadline-during-allocation'))
        setTimeout(() => { void emergency('deadline') }, 20)
    })
  }
  return allocated
}
async function scenario(name, fn) {
  checkpoint()
  const before = report.assertions
  try {
    await fn()
    report.scenarios.push({ name, status: 'passed', assertions: report.assertions - before })
  } catch (error) {
    report.scenarios.push({
      name,
      status: 'failed',
      assertions: report.assertions - before,
      error: error.message,
    })
    throw error
  }
}
async function observe(name, fn) {
  checkpoint()
  report.observations.push({ name, ...(await fn()) })
}
async function client(database = 'saga_rls_rehearsal') {
  checkpoint()
  const c = new Client({ ...config, database })
  clients.add(c)
  c.on('error', () => {})
  c.once('end', () => clients.delete(c))
  await c.connect()
  checkpoint()
  const query = c.query.bind(c)
  c.query = async (...params) => {
    checkpoint()
    const result = await query(...params)
    checkpoint()
    return result
  }
  return c
}
async function actor(role, user, sql, values = []) {
  assert.ok(['anon', 'authenticated'].includes(role))
  const c = await client()
  try {
    await c.query('BEGIN')
    await c.query(`SET LOCAL ROLE ${role}`)
    await c.query(
      "SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",
      [user ?? '', role]
    )
    const identity = (
      await c.query(
        'SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user'
      )
    ).rows[0]
    assert.equal(identity.current_user, role)
    assert.equal(identity.rolsuper, false)
    assert.equal(identity.rolbypassrls, false)
    try {
      const r = await c.query(sql, values)
      return { rows: r.rows, rowCount: r.rowCount }
    } catch (error) {
      return { error: error.code }
    }
  } finally {
    await c.query('ROLLBACK').catch(() => {})
    await c.end()
  }
}
async function cleanup() {
  if (cleaning) return cleaning
  cleaning = (async () => {
    const errors = []
    for (const c of [...clients]) {
      let timer
      try {
        await Promise.race([
          c.end(),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              c.connection.stream.destroy()
              reject(new Error('client close timeout'))
            }, 2000)
          }),
        ])
      } catch (error) {
        errors.push(error.message)
      } finally {
        clearTimeout(timer)
      }
    }
    if (scratch && clusterMayExist) {
      try {
        command('pg_ctl', [
          '-D',
          join(scratch, 'data'),
          '-m',
          'immediate',
          '-w',
          '-t',
          '10',
          'stop',
        ])
        clusterMayExist = false
      } catch (error) {
        try {
          command('pg_ctl', ['-D', join(scratch, 'data'), 'status'])
          errors.push('cluster still running')
        } catch (status) {
          if (status.status === 3) clusterMayExist = false
          else errors.push('cluster stop not confirmed')
        }
      }
    }
    let removed = false
    if (!clusterMayExist && allocations.size) {
      removed = true
      for (const allocated of allocations) {
        await rm(allocated, { recursive: true, force: true })
        removed = (await access(allocated).then(() => false, () => true)) && removed
      }
    }
    report.cleanup = {
      clusterStopped: !clusterMayExist,
      tempDirectoryRemoved: removed,
      clientsRemaining: clients.size,
      errors,
    }
    if (errors.length || clusterMayExist || clients.size) report.status = 'failed'
  })()
  return cleaning
}
function emergency(signal) {
  if (finished || requestedSignal) return
  requestedSignal = signal
  if (process.connected) process.send?.({ type: 'shutdown-requested', signal }, () => {})
  // Do not clean while filesystem/database acquisition is still in flight.
  // Bounded operations settle, checkpoint aborts the main path, finally owns cleanup.
}
for (const signal of ['SIGTERM', 'SIGINT'])
  process.once(signal, () => {
    void emergency(signal)
  })
const deadline = setTimeout(() => {
  void emergency('deadline')
}, 120000)

try {
  for (const name of [
    'README.md',
    'fixture.sql',
    'scenarios.mjs',
    'verify.mjs',
    'verify-shutdown.mjs',
    ...(red ? [] : ['candidate.sql']),
  ])
    report.sources[`experiments/rls-rehearsal/${name}`] = digest(await readFile(join(here, name)))
  const raw = await readFile(snapshotPath)
  report.snapshot = {
    path: snapshotPath.slice(root.length + 1),
    sha256: digest(raw),
    captureTime: '2026-10-17T02:45:52.407Z',
  }
  assert.equal(
    digest(raw),
    'bb808a1ce050947d21963ca91ec49c3adfa0ab80fe24f24f653f8c18bc6e6a4f',
    'only the reviewed immutable snapshot may be replayed'
  )
  const snapshot = JSON.parse(raw)
  assert.equal(snapshot.sections.policies.status, 'ok')
  report.runtime.postgres = command('postgres', ['--version'])
  report.runtime.pg = require('../t05-durable-worker/node_modules/pg/package.json').version
  scratch = await allocateScratch()
  report.scratch = scratch
  checkpoint()
  if (args.includes('--test-fail-after-allocation'))
    throw Object.assign(new Error('Injected setup failure after allocation'), { code: 'TEST_SETUP_FAILURE' })
  await save()
  checkpoint()
  await mkdir(join(scratch, 'socket'), { mode: 0o700 })
  checkpoint()
  command('initdb', [
    '-D',
    join(scratch, 'data'),
    '-U',
    'saga_rls_admin',
    '-A',
    'trust',
    '--no-locale',
    '-E',
    'UTF8',
  ])
  clusterMayExist = true
  checkpoint()
  report.runtime.clusterStartAttempted = true
  command('pg_ctl', [
    '-D',
    join(scratch, 'data'),
    '-l',
    join(scratch, 'postgres.log'),
    '-w',
    '-t',
    '20',
    '-o',
    `-k ${join(scratch, 'socket')} -p 5432 -c listen_addresses='' -c unix_socket_permissions=0700`,
    'start',
  ])
  config = {
    host: join(scratch, 'socket'),
    port: 5432,
    user: 'saga_rls_admin',
    ssl: false,
    password: 'synthetic-local-unused',
    connectionTimeoutMillis: 5000,
    options:
      '-c statement_timeout=5000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=10000',
  }
  const admin = await client('postgres')
  await admin.query('CREATE DATABASE saga_rls_rehearsal')
  await admin.end()
  db = await client()
  eq((await db.query('SHOW listen_addresses')).rows[0].listen_addresses, '', 'TCP disabled')
  await db.query(await readFile(join(here, 'fixture.sql'), 'utf8'))
  const selected = new Set([
    'public.projects',
    'public.project_roles',
    'public.project_members',
    'public.stories',
    'storage.objects',
  ])
  const policies = snapshot.sections.policies.rows.filter(p =>
    selected.has(`${p.schemaname}.${p.tablename}`)
  )
  eq(policies.length, 32, 'all saved predicates in the tested dependency graph')
  for (const p of policies) {
    assert.ok(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'].includes(p.cmd))
    assert.ok(['PERMISSIVE', 'RESTRICTIVE'].includes(p.permissive))
    const roles = p.roles.map(r => (r === 'public' ? 'PUBLIC' : qid(r))).join(',')
    await db.query(
      `CREATE POLICY ${qid(p.policyname)} ON ${qid(p.schemaname)}.${qid(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${roles}${p.qual ? ` USING (${p.qual})` : ''}${p.with_check ? ` WITH CHECK (${p.with_check})` : ''}`
    )
  }
  report.replayedPolicies = policies.map(p => ({
    schema: p.schemaname,
    table: p.tablename,
    name: p.policyname,
  }))
  await seed(db)
  if (args.includes('--test-fail-after-setup'))
    throw Object.assign(new Error('Injected setup failure after fixture'), { code: 'TEST_SETUP_FAILURE' })
  if (args.includes('--signal-after-setup')) {
    report.phase = 'synthetic_fixture_ready'
    await save()
    process.kill(process.pid, 'SIGTERM')
    await new Promise(resolve => setImmediate(resolve))
    checkpoint()
  }
  const h = { db, client, actor, eq, ok, observe, scenario }
  await characterize(h)
  if (!red) {
    for (const table of ['projects', 'project_roles', 'project_members', 'stories'])
      await db.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
    await db.query("SET saga.rls_rehearsal='only_synthetic_local'")
    const sql = await readFile(join(here, 'candidate.sql'), 'utf8')
    await scenario('candidate_rejects_wrong_marker_without_mutation', async () => {
      const before = (await db.query('SELECT count(*)::int AS n FROM pg_policies')).rows[0].n
      await db.query("SET saga.rls_rehearsal='wrong'")
      let code
      try {
        await db.query(sql)
      } catch (error) {
        code = error.code
      } finally {
        await db.query('ROLLBACK')
        await db.query("SET saga.rls_rehearsal='only_synthetic_local'")
      }
      eq(code, '42501', 'local-only guard rejects wrong marker')
      eq(
        (await db.query('SELECT count(*)::int AS n FROM pg_policies')).rows[0].n,
        before,
        'failed candidate leaves policies unchanged'
      )
    })
    await scenario('failed_candidate_rolls_back_all_ddl', async () => {
      const inventory =
        'SELECT schemaname,tablename,policyname,qual,with_check FROM pg_policies ORDER BY 1,2,3'
      const before = (await db.query(inventory)).rows
      let code
      try {
        await db.query(sql.replace(/COMMIT;\s*$/, 'SELECT 1/0; COMMIT;'))
      } catch (error) {
        code = error.code
      } finally {
        await db.query('ROLLBACK')
      }
      eq(code, '22012', 'controlled failure after candidate DDL')
      eq((await db.query(inventory)).rows, before, 'all policy changes rolled back')
      eq(
        (await db.query("SELECT to_regnamespace('saga_rls_guard') AS ns")).rows[0].ns,
        null,
        'helper schema creation rolled back'
      )
    })
    await db.query(sql)
    await scenario('candidate_can_be_applied_twice', async () => {
      const inventory =
        'SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies ORDER BY 1,2,3'
      const before = (await db.query(inventory)).rows
      await db.query(sql)
      eq((await db.query(inventory)).rows, before, 'reapplication preserves policy state')
    })
  }
  await verifyCandidate(h)
  report.status = 'passed'
} catch (error) {
  report.status = requestedSignal ? 'interrupted' : 'failed'
  if (requestedSignal) report.signal = requestedSignal
  else report.error = { message: error.message, code: error.code }
} finally {
  clearTimeout(deadline)
  if (!finished) {
    finished = true
    try {
      await cleanup()
    } catch (error) {
      report.status = 'failed'
      report.cleanupError = error.message
    }
    report.finishedAt = new Date().toISOString()
    await save()
    console.log(
      JSON.stringify({
        status: report.status,
        evidence: evidence.slice(root.length + 1),
        observations: report.observations,
        scenarios: report.scenarios.length,
        assertions: report.assertions,
        error: report.error,
        cleanup: report.cleanup,
      })
    )
    process.exitCode = report.status === 'passed' ? 0
      : report.status === 'interrupted' ? requestedSignal === 'SIGINT' ? 130 : 143 : 1
  }
}
