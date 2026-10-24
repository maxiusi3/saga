import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtempSync } from 'node:fs'
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seed, baseline, verifyCandidate } from './scenarios.mjs'

// node-postgres snapshots some defaults at require-time: sanitize first.
const scrubbedKeys = Object.keys(process.env).filter(k => /^PG/i.test(k) || k === 'DATABASE_URL')
for (const key of scrubbedKeys) delete process.env[key]
const env = { ...process.env }
const require = createRequire(import.meta.url)
const { Client } = require('../t05-durable-worker/node_modules/pg')
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const bin = '/usr/local/opt/postgresql@16/bin'
const args = process.argv.slice(2)
assert.ok(args.every(a => ['--red', '--test-signal-ready', '--test-fail-start'].includes(a)), 'unsupported argument')
const red = args.includes('--red')
const evidenceDir = join(root, 'docs/research/evidence/2026-10-17-routine-audit')
const evidence = join(evidenceDir, `notification-${red ? 'red' : 'run'}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`)
process.send?.({ type: 'evidence', path: evidence })
const capturePath = 'docs/research/evidence/2026-10-17-routine-audit/capture-2026-10-17T13-06-48-036Z-944080d1-0721-4174-a482-dd4e812eab1e.json'
const captureHash = 'feb2b22a900d372f6bcc24a912e1636789de16208d0c5975ece5d77998041c8f'
const privateHash = 'f2f37cf33860c4bc6ba22ccec90e0cc0f6d44f311e6be9c6f2e15707d2a2bedc'
const pins = [
  { id: 'F05', name: 'get_unread_notification_count', args: 'user_id uuid', md5: '0b7d901de660b8805848cc9951a3a8fc', sha256: 'e02ae936f2f179a8a7beae8cd92eb41cd43fcce568c56133b42ef2cdf2e7460a', calls: ['count'], language: 'sql' },
  { id: 'F07', name: 'mark_notifications_as_read', args: 'user_id uuid, notification_ids uuid[]', md5: '38d9f9ae6c7efc989c81a1802eff4a65', sha256: 'ee583da55c990eb98b93afbe8fdade646ec504f2387bc59b0f030a3474663ed4', calls: ['any', 'coalesce', 'now'], language: 'plpgsql' },
]
const report = {
  startedAt: new Date().toISOString(), status: 'running', mode: red ? 'red' : 'candidate',
  scope: 'exact two private captured definitions; reduced synthetic local database; no remote access',
  runtime: { node: process.version, pg: require('../t05-durable-worker/node_modules/pg/package.json').version, bin, scrubbedEnvironmentKeys: scrubbedKeys.sort(), postgres17Verified: false },
  sources: {}, scenarios: [], assertions: 0, actorConnections: [],
}
const clients = new Set()
let scratch, config, db, clusterMayExist = false, signal, finishing = false
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex')
const exists = path => access(path).then(() => true, () => false)
function checkpoint() {
  if (signal) throw Object.assign(new Error('Rehearsal interrupted'), { code: 'REHEARSAL_INTERRUPTED' })
}
function command(name, parameters, timeout = 30000) {
  if (!finishing) checkpoint()
  return execFileSync(join(bin, name), parameters, { env, timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function eq(actual, expected, label) { checkpoint(); assert.deepEqual(actual, expected, label); report.assertions++ }
function ok(value, label) { checkpoint(); assert.ok(value, label); report.assertions++ }
async function scenario(name, fn) {
  checkpoint()
  const before = report.assertions
  try {
    await fn()
    report.scenarios.push({ name, status: 'passed', assertions: report.assertions - before })
  } catch (error) {
    report.scenarios.push({ name, status: 'failed', assertions: report.assertions - before, code: error.code ?? 'ERROR', assertion: error.code === 'ERR_ASSERTION' ? error.message : undefined })
    throw error
  }
}
async function close(c) {
  let timer
  try {
    await Promise.race([c.end(), new Promise((_, reject) => {
      timer = setTimeout(() => { c.connection?.stream?.destroy(); reject(Object.assign(new Error('Client close timed out'), { code: 'CLOSE_TIMEOUT' })) }, 2000)
    })])
  } finally { clearTimeout(timer) }
}
async function client(user = 'notification_admin', database = 'saga_notification_rehearsal') {
  checkpoint()
  const c = new Client({ ...config, user, database })
  clients.add(c)
  c.on('error', () => {})
  c.once('end', () => clients.delete(c))
  await c.connect()
  checkpoint()
  const query = c.query.bind(c)
  c.query = async (...params) => { checkpoint(); const r = await query(...params); checkpoint(); return r }
  return c
}
async function actor(role, user, sql, values = [], claimRole = role) {
  assert.ok(['anon', 'authenticated', 'metadata_reader', 'service_role'].includes(role))
  const c = await client(role)
  try {
    const identity = (await c.query('SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user')).rows[0]
    eq(identity, { current_user: role, session_user: role, rolsuper: false, rolbypassrls: false }, 'actor uses real unprivileged direct connection')
    if (!report.actorConnections.some(x => x.current_user === role)) report.actorConnections.push(identity)
    await c.query("SELECT pg_catalog.set_config('request.jwt.claim.sub',$1,false),pg_catalog.set_config('request.jwt.claim.role',$2,false)", [user ?? '', claimRole])
    try {
      let r = await c.query(sql, values)
      if (Array.isArray(r)) r = r.at(-1)
      return { rows: r.rows, rowCount: r.rowCount }
    } catch (error) {
      checkpoint()
      return { error: error.code ?? 'QUERY_FAILED' }
    }
  } finally { await close(c) }
}
function interrupt(requested) {
  if (!finishing && !signal) {
    signal = requested
    process.send?.({ type: 'shutdown-requested', signal }, () => {})
  }
}
for (const name of ['SIGINT', 'SIGTERM']) process.once(name, () => interrupt(name))
const deadline = setTimeout(() => interrupt('deadline'), 120000)

async function cleanup() {
  const errors = []
  for (const c of [...clients]) try { await close(c) } catch (error) { errors.push(error.code ?? 'CLIENT_CLOSE_FAILED') }
  if (scratch && clusterMayExist) {
    try {
      command('pg_ctl', ['-D', join(scratch, 'data'), '-m', 'immediate', '-w', '-t', '10', 'stop'], 15000)
      clusterMayExist = false
    } catch {
      try {
        command('pg_ctl', ['-D', join(scratch, 'data'), 'status'], 5000)
        errors.push('SERVER_STILL_RUNNING')
      } catch (status) {
        // Only pg_ctl's documented not-running exit is evidence of no server.
        if (status.status === 3) clusterMayExist = false
        else errors.push('SERVER_STOP_UNCONFIRMED')
      }
    }
  }
  let tempDirectoryRemoved = !scratch
  if (scratch && !clusterMayExist) {
    try { await rm(scratch, { recursive: true, force: true }); tempDirectoryRemoved = !await exists(scratch) }
    catch { errors.push('TEMP_DIRECTORY_REMOVE_FAILED') }
  }
  report.cleanup = { clusterStopped: !clusterMayExist, tempDirectoryRemoved, clientsRemaining: clients.size, errors }
  if (errors.length || clusterMayExist || clients.size || !tempDirectoryRemoved) report.status = 'failed'
}

async function reviewedDefinitions() {
  const bytes = await readFile(join(root, capturePath))
  eq(digest(bytes), captureHash, 'public capture is the exact reviewed artifact')
  const capture = JSON.parse(bytes)
  eq(capture.status, 'captured', 'capture succeeded')
  eq(capture.targets.length, 12, 'capture had twelve targets')
  ok(capture.targets.every(t => t.status === 'matched'), 'every pinned target matched')
  eq(capture.privateCapture.sha256, privateHash, 'private hash bound by public capture')
  eq(capture.privateCapture.relativePath, 'supabase/.temp/routine-audit/capture-2026-10-17T13-06-48-036Z-944080d1-0721-4174-a482-dd4e812eab1e.json', 'private path pinned')
  const privatePath = join(root, capture.privateCapture.relativePath)
  eq((await stat(privatePath)).mode & 0o777, 0o600, 'raw capture remains private')
  eq((await stat(dirname(privatePath))).mode & 0o777, 0o700, 'raw capture directory remains private')
  const raw = await readFile(privatePath)
  eq(digest(raw), privateHash, 'private capture bytes verified before replay')
  const snapshotBytes = await readFile(join(root, capture.snapshotPath))
  eq(digest(snapshotBytes), capture.snapshotSha256, 'metadata snapshot verified')
  const snapshot = JSON.parse(snapshotBytes)
  const table = snapshot.sections.tables.rows.find(t => t.schema_name === 'public' && t.table_name === 'notifications')
  eq({ owner: table.owner, rls: table.rls_enabled, forced: table.rls_forced }, { owner: 'postgres', rls: true, forced: false }, 'reviewed owner/RLS assumptions')
  eq(snapshot.sections.triggers.rows.filter(t => t.table_name === 'notifications' && t.schema_name === 'public').length, 0, 'no captured noninternal notification triggers')
  const needed = { id: 'uuid', recipient_id: 'uuid', is_read: 'boolean', read_at: 'timestamp with time zone', updated_at: 'timestamp with time zone' }
  for (const [name, type] of Object.entries(needed))
    eq(snapshot.sections.columns.rows.find(c => c.schema_name === 'public' && c.table_name === 'notifications' && c.column_name === name)?.data_type, type, 'required notification column exists with expected type')
  const privateData = JSON.parse(raw)
  const definitions = pins.map(pin => {
    const found = privateData.definitions.filter(d => d.schema_name === 'public' && d.function_name === pin.name && d.identity_arguments === pin.args)
    eq(found.length, 1, 'one private definition for exact identity')
    const definition = found[0]
    eq(digest(definition.definition, 'md5'), pin.md5, 'audited MD5 unchanged')
    eq(digest(definition.definition), pin.sha256, 'audited SHA256 unchanged')
    eq(definition.return_type, 'integer', 'captured result verified')
    eq(definition.language, pin.language, 'captured language verified')
    eq(definition.security_definer, true, 'captured SECURITY DEFINER verified')
    eq(definition.public_execute, true, 'captured public execution verified')
    const body = definition.definition.match(/AS \$([^$]*)\$([\s\S]*)\$\1\$/i)?.[2]
    ok(body, 'one complete body found in cryptographically pinned definition')
    ok(!/'|\b(EXECUTE|PERFORM|CALL|COPY|INSERT|DELETE|TRUNCATE|ALTER|DROP|CREATE|DO)\b/i.test(body), 'reviewed bodies have no literals, dynamic SQL or additional statement effects')
    const calls = [...new Set([...body.matchAll(/\b([a-z_][a-z0-9_]*)\s*\(/gi)].map(x => x[1].toLowerCase()))].sort()
    eq(calls, pin.calls, 'only independently reviewed builtin calls and SQL ANY')
    const relations = [...new Set([...body.matchAll(/\b(?:FROM|UPDATE|JOIN)\s+([\w.]+)/gi)].map(x => x[1].toLowerCase()))]
    eq(relations, ['public.notifications'], 'only qualified local notification table accessed')
    return definition
  })
  report.capture = { publicPath: capturePath, publicSha256: captureHash, privatePath: capture.privateCapture.relativePath, privateSha256: privateHash, snapshotPath: capture.snapshotPath, snapshotSha256: capture.snapshotSha256, allTwelveMd5: capture.targets.map(t => ({ name: t.function_name, identityArguments: t.identity_arguments, md5: t.actualDefinitionMd5 })) }
  report.replay = pins.map(p => ({ id: p.id, name: p.name, identityArguments: p.args, md5: p.md5, sha256: p.sha256, approvedRelations: ['public.notifications'], approvedCalls: p.calls }))
  report.dependencyVerification = 'Exact audited hashes plus complete-body builtin/relation allowlists; matching snapshot column types; no noninternal notification triggers; synthetic builtin defaults only.'
  return definitions
}

try {
  for (const file of (await readdir(here)).filter(f => /\.(mjs|sql|md)$/.test(f)).sort())
    report.sources[`experiments/routine-notifications/${file}`] = digest(await readFile(join(here, file)))
  report.runtime.nodeExecutableSha256 = digest(await readFile(process.execPath))
  report.runtime.pgEntrySha256 = digest(await readFile(require.resolve('../t05-durable-worker/node_modules/pg')))
  report.runtime.postgres = command('postgres', ['--version'])
  ok(/^postgres \(PostgreSQL\) 16\./.test(report.runtime.postgres), 'explicit PostgreSQL 16 binary')
  report.runtime.binarySha256 = {}
  for (const name of ['postgres', 'pg_ctl', 'initdb']) report.runtime.binarySha256[name] = digest(await readFile(join(bin, name)))
  const definitions = await reviewedDefinitions()
  checkpoint()
  // Synchronous allocation and assignment ensure cleanup ownership has no await gap.
  scratch = mkdtempSync('/tmp/saga-notification-')
  report.scratch = scratch
  process.send?.({ type: 'allocation', path: scratch })
  checkpoint()
  await mkdir(join(scratch, 'socket'), { mode: 0o700 })
  command('initdb', ['-D', join(scratch, 'data'), '-U', 'notification_admin', '-A', 'trust', '--no-locale', '-E', 'UTF8'])
  clusterMayExist = true
  report.runtime.clusterStartAttempted = true
  if (args.includes('--test-fail-start')) report.testInjection = 'real pg_ctl start with an unrecognized server setting'
  command('pg_ctl', ['-D', join(scratch, 'data'), '-l', join(scratch, 'postgres.log'), '-w', '-t', '20', '-o', `-k ${join(scratch, 'socket')} -p 5432 -c listen_addresses='' -c unix_socket_permissions=0700${args.includes('--test-fail-start') ? ' -c notification_invalid_setting=1' : ''}`, 'start'])
  config = { host: join(scratch, 'socket'), port: 5432, ssl: false, password: 'synthetic-local-unused', connectionTimeoutMillis: 5000, query_timeout: 6000, options: '-c statement_timeout=5000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=10000' }
  const admin = await client('notification_admin', 'postgres')
  await admin.query('CREATE DATABASE saga_notification_rehearsal')
  await close(admin)
  db = await client()
  eq((await db.query('SHOW listen_addresses')).rows[0].listen_addresses, '', 'TCP disabled')
  eq((await db.query('SELECT inet_server_addr() AS addr')).rows[0].addr, null, 'connection uses Unix socket')
  report.runtime.connection = { host: config.host, port: config.port, ssl: false, transport: 'unix_socket', database: 'saga_notification_rehearsal', boundedConnectMs: 5000, boundedQueryMs: 6000 }
  await db.query(await readFile(join(here, 'fixture.sql'), 'utf8'))
  await db.query('SET ROLE fixture_owner')
  for (const definition of definitions) await db.query(definition.definition)
  await db.query('RESET ROLE')
  // pg_get_functiondef omits ACLs. Recreate the captured effective PUBLIC execution.
  await db.query('GRANT EXECUTE ON FUNCTION public.get_unread_notification_count(uuid), public.mark_notifications_as_read(uuid,uuid[]) TO PUBLIC, anon, authenticated, metadata_reader, service_role')
  report.runtime.replayedDefinitions = definitions.length
  await seed(db)
  if (args.includes('--test-signal-ready')) {
    assert.ok(process.send, 'signal-ready gate requires IPC controller')
    report.phase = 'fixture_ready'
    process.send({ type: 'fixture-ready', path: scratch })
    const limit = Date.now() + 15000
    while (!signal && Date.now() < limit) await new Promise(resolveWait => setTimeout(resolveWait, 25))
    checkpoint()
    throw Object.assign(new Error('Signal controller did not respond'), { code: 'SIGNAL_GATE_TIMEOUT' })
  }
  const h = { db, actor, eq, ok, scenario, report }
  await baseline(h)
  if (!red) {
    const candidate = await readFile(join(here, 'candidate.sql'), 'utf8')
    const inventory = "SELECT p.proname,pg_catalog.pg_get_functiondef(p.oid) AS definition,p.proacl::text AS acl FROM pg_catalog.pg_proc p WHERE p.oid IN ('public.get_unread_notification_count(uuid)'::regprocedure,'public.mark_notifications_as_read(uuid,uuid[])'::regprocedure) ORDER BY p.proname"
    // Compare hashes rather than embedding captured definitions in assertion output.
    const state = async () => digest(JSON.stringify((await db.query(inventory)).rows))
    await scenario('candidate_marker_guard_rolls_back_without_change', async () => {
      const before = await state()
      let code
      try { await db.query(candidate) } catch (error) { code = error.code } finally { await db.query('ROLLBACK') }
      eq(code, '42501', 'missing local marker rejected')
      eq(await state(), before, 'no definition or ACL changed')
    })
    await db.query("SET saga.notification_rehearsal='only_synthetic_local'")
    await scenario('candidate_failure_rolls_back_definitions_and_acls_atomically', async () => {
      const before = await state()
      let code
      try { await db.query(candidate.replace(/COMMIT;\s*$/, 'SELECT 1/0; COMMIT;')) } catch (error) { code = error.code } finally { await db.query('ROLLBACK') }
      eq(code, '22012', 'controlled failure occurs after candidate DDL')
      eq(await state(), before, 'entire candidate transaction rolled back')
    })
    await db.query(candidate)
    await scenario('candidate_repeat_application_preserves_definition_and_acl_state', async () => {
      const before = await state()
      await db.query(candidate)
      eq(await state(), before, 'reapplication is stable')
    })
  }
  await verifyCandidate(h)
  report.status = 'passed'
} catch (error) {
  report.status = signal ? 'interrupted' : 'failed'
  if (signal) report.signal = signal
  else report.error = { code: error.code ?? (Number.isInteger(error.status) ? 'SUBPROCESS_FAILED' : 'ERROR'), assertion: error.code === 'ERR_ASSERTION' ? error.message : undefined, subprocessExit: Number.isInteger(error.status) ? error.status : undefined }
} finally {
  clearTimeout(deadline)
  finishing = true
  try { await cleanup() } catch { report.status = 'failed'; report.cleanupError = 'UNEXPECTED_CLEANUP_ERROR' }
  report.finishedAt = new Date().toISOString()
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(evidence, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o644 })
  console.log(JSON.stringify({ status: report.status, evidence: evidence.slice(root.length + 1), scenarios: report.scenarios.length, assertions: report.assertions, error: report.error, cleanup: report.cleanup }))
  process.exitCode = report.status === 'passed' ? 0 : report.status === 'interrupted' ? signal === 'SIGINT' ? 130 : 143 : 1
  process.disconnect?.()
}
