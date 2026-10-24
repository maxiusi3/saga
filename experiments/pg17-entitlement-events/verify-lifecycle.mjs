import { fork, execFileSync } from 'node:child_process'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { root, bin, digest, exists, failure } from '../pg17-routines/runtime.mjs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const env = { ...process.env }
for (const k of Object.keys(env)) if (/^PG/i.test(k) || k === 'DATABASE_URL') delete env[k]
const hostile = {
  PGHOST: 'invalid.example.invalid',
  PGHOSTADDR: '203.0.113.1',
  PGPORT: '1',
  PGUSER: 'invalid',
  PGDATABASE: 'invalid',
  PGPASSWORD: 'synthetic-invalid',
  PGSERVICE: 'invalid',
  PGSERVICEFILE: '/synthetic/no-service',
  PGSYSCONFDIR: '/synthetic/no-dir',
  PGPASSFILE: '/synthetic/no-pass',
  PGOPTIONS: '-c search_path=invalid -c statement_timeout=1',
  PGSSLMODE: 'require',
  PGSSLROOTCERT: '/synthetic/no-ca',
  DATABASE_URL: 'postgres://invalid@invalid.example.invalid/invalid',
}
const cases = [
  { name: 'hostile_pg_environment', args: [], env: hostile, exit: 0 },
  { name: 'SIGTERM_after_fixture_ready', args: ['--test-signal-ready'], exit: 143 },
  { name: 'invalid_actual_server_start', args: ['--test-fail-start'], exit: 1 },
  { name: 'failed_client_connect_cleanup', args: ['--test-client-failure'], exit: 1 },
]
const output = join(
  root,
  'docs/research/evidence/2026-10-20-trusted-entitlement-events',
  `entitlement-lifecycle-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`
)
const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  cases: [],
  observerSourceSha256: digest(await readFile(new URL(import.meta.url))),
}
const eq = (a, b, label) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw failure('OBSERVER_ASSERT', label)
}
const alive = pid => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    if (e.code === 'ESRCH') return false
    throw e
  }
}
async function rescue(path) {
  if (!path || !(await exists(path))) return { needed: false }
  if (!/^\/tmp\/saga-pg17-[A-Za-z0-9]+$/.test(path))
    return { needed: true, preserved: true, reason: 'UNKNOWN_ALLOCATION' }
  const pins = JSON.parse(await readFile(join(root, 'experiments/pg17-routines/runtime-pins.json')))
  eq(digest(await readFile(join(bin, 'pg_ctl'))), pins.pg_ctl, 'rescue executable pin')
  const run = args =>
    execFileSync(join(bin, 'pg_ctl'), args, { env, timeout: 15000, stdio: 'pipe' })
  try {
    run(['-D', join(path, 'data'), '-m', 'immediate', '-w', '-t', '10', 'stop'])
  } catch {
    try {
      run(['-D', join(path, 'data'), 'status'])
      return { needed: true, preserved: true }
    } catch (e) {
      if (e.status !== 3) return { needed: true, preserved: true }
    }
  }
  await rm(path, { recursive: true, force: true })
  return { needed: true, removed: !(await exists(path)) }
}
for (const test of cases) {
  const r = { name: test.name, status: 'running', events: [] }
  report.cases.push(r)
  let allocation,
    evidence,
    serverPid,
    stdout = '',
    stderr = '',
    killTimer
  const child = fork(join(here, 'verify.mjs'), test.args, {
    cwd: root,
    env: { ...env, ...test.env },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  child.stdout.on('data', x => {
    stdout += x
  })
  child.stderr.on('data', x => {
    stderr += x
  })
  child.on('message', m => {
    r.events.push(m.type)
    if (m.type === 'allocation') allocation = m.path
    if (m.type === 'evidence') evidence = m.path
    if (m.type === 'server-started') serverPid = m.pid
    if (m.type === 'fixture-ready') child.kill('SIGTERM')
  })
  const timeout = setTimeout(() => {
    r.timedOut = true
    child.kill('SIGTERM')
    killTimer = setTimeout(() => child.kill('SIGKILL'), 15000)
  }, 180000)
  try {
    r.exit = await new Promise((res, rej) => {
      child.once('error', rej)
      child.once('close', (code, signal) => res({ code, signal }))
    })
    clearTimeout(timeout)
    clearTimeout(killTimer)
    eq(r.exit, { code: test.exit, signal: null }, 'child completes its cleanup path')
    if (
      !evidence?.startsWith(
        join(root, 'docs/research/evidence/2026-10-20-trusted-entitlement-events/entitlement-run-')
      )
    )
      throw failure('OBSERVER_ASSERT', 'scoped evidence path')
    const bytes = await readFile(evidence),
      data = JSON.parse(bytes)
    r.evidence = evidence.slice(root.length + 1)
    r.evidenceSha256 = digest(bytes)
    r.cleanup = data.cleanup
    eq(
      data.cleanup,
      { clusterStopped: true, tempDirectoryRemoved: true, clientsRemaining: 0, errors: [] },
      'complete cleanup'
    )
    eq(await exists(allocation), false, 'observer confirms allocation removed')
    eq(stderr, '', 'no raw stderr')
    r.stderrEmpty = true
    r.stdoutSafeJSONOnly = stdout
      .trim()
      .split('\n')
      .every(x => {
        try {
          const o = JSON.parse(x)
          return !Object.hasOwn(o, 'message') && Object.hasOwn(o, 'evidence')
        } catch {
          return false
        }
      })
    eq(r.stdoutSafeJSONOnly, true, 'only safe output summary')
    if (serverPid) {
      r.serverPid = serverPid
      r.serverAbsent = !alive(serverPid)
      eq(r.serverAbsent, true, 'observer confirms postmaster no longer alive')
    }
    if (test.env) {
      eq(data.status, 'passed', 'hostile environment still passes')
      for (const k of Object.keys(test.env))
        eq(data.runtime.scrubbedEnvironmentKeys.includes(k), true, 'hostile key scrubbed')
      r.scrubbedKeys = data.runtime.scrubbedEnvironmentKeys
    } else if (test.exit === 143) {
      eq(data.status, 'interrupted', 'SIGTERM status')
      eq(data.signal, 'SIGTERM', 'real termination signal')
      eq(r.events.includes('fixture-ready'), true, 'signal after full fixture ready')
    } else if (test.args.includes('--test-fail-start')) {
      eq(data.error.code, 'SUBPROCESS_FAILED', 'real startup failure')
      eq(data.runtime.clusterStartAttempted, true, 'server startup attempted')
    } else {
      eq(data.error.code, '28000', 'real missing-role connection failure')
      eq(data.phase, 'client_connection_failure', 'connection-failure fixture reached')
    }
    r.status = 'passed'
  } catch (e) {
    r.status = 'failed'
    r.error = { code: e.code ?? 'OBSERVER_FAILED', label: e.label }
  } finally {
    clearTimeout(timeout)
    clearTimeout(killTimer)
    r.rescue = await rescue(allocation)
  }
}
report.status = report.cases.every(r => r.status === 'passed' && !r.rescue.needed)
  ? 'passed'
  : 'failed'
report.finishedAt = new Date().toISOString()
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
console.log(
  JSON.stringify({
    status: report.status,
    evidence: output.slice(root.length + 1),
    cases: report.cases.map(x => ({
      name: x.name,
      status: x.status,
      exit: x.exit,
      error: x.error,
      rescue: x.rescue,
    })),
  })
)
process.exitCode = report.status === 'passed' ? 0 : 1
