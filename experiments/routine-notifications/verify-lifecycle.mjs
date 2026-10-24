import assert from 'node:assert/strict'
import { fork, execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { access, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const evidenceDir = join(root, 'docs/research/evidence/2026-10-17-routine-audit')
const output = join(evidenceDir, `notification-lifecycle-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`)
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key) && key !== 'DATABASE_URL'))
const exists = p => access(p).then(() => true, () => false)
const report = { startedAt: new Date().toISOString(), status: 'running', sources: {}, cases: [] }
for (const file of (await readdir(here)).filter(f => /\.(mjs|sql|md)$/.test(f)).sort())
  report.sources[`experiments/routine-notifications/${file}`] = createHash('sha256').update(await readFile(join(here, file))).digest('hex')
const cases = [
  { name: 'hostile_pg_environment', args: [], exit: 0, env: { PGHOST: 'unreachable.invalid', PGHOSTADDR: '203.0.113.9', PGPORT: '1', PGDATABASE: 'forbidden', PGUSER: 'forbidden', PGPASSWORD: 'synthetic-poison', PGSSLMODE: 'require', PGOPTIONS: '-c default_transaction_read_only=on', PGPASSFILE: '/nonexistent/poison', DATABASE_URL: 'postgres://synthetic:poison@unreachable.invalid/forbidden' } },
  { name: 'real_sigterm_after_fixture', args: ['--test-signal-ready'], exit: 143 },
  { name: 'real_failed_start_without_server', args: ['--test-fail-start'], exit: 1 },
]
// Rescue only the exact allocation announced by this child. Unknown server status
// preserves evidence rather than deleting a possibly live cluster.
async function rescue(path) {
  if (!path || !await exists(path)) return { needed: false }
  assert.match(path, /^\/tmp\/saga-notification-[A-Za-z0-9]+$/)
  const data = join(path, 'data')
  if (await exists(join(data, 'postmaster.pid'))) {
    const run = parameters => execFileSync('/usr/local/opt/postgresql@16/bin/pg_ctl', parameters, { env: cleanEnv, timeout: 15000, stdio: 'pipe' })
    try { run(['-D', data, '-m', 'immediate', '-w', '-t', '10', 'stop']) }
    catch { try { run(['-D', data, 'status']); return { needed: true, preserved: true } } catch (e) { if (e.status !== 3) return { needed: true, preserved: true } } }
  }
  await rm(path, { recursive: true, force: true })
  return { needed: true, removed: !await exists(path) }
}

for (const test of cases) {
  const result = { name: test.name, status: 'running', events: [] }
  report.cases.push(result)
  let evidence, allocation, stdout = '', stderr = '', killTimer
  const child = fork(join(here, 'verify.mjs'), test.args, { cwd: root, env: { ...cleanEnv, ...test.env }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  child.stdout.on('data', data => { stdout += data })
  child.stderr.on('data', data => { stderr += data })
  child.on('message', message => {
    result.events.push(message.type)
    if (message.type === 'evidence') evidence = message.path
    if (message.type === 'allocation') allocation = message.path
    if (message.type === 'fixture-ready') child.kill('SIGTERM')
  })
  const timeout = setTimeout(() => { result.timedOut = true; child.kill('SIGTERM'); killTimer = setTimeout(() => child.kill('SIGKILL'), 15000) }, 60000)
  try {
    result.exit = await new Promise((resolveExit, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolveExit({ code, signal })) })
    clearTimeout(timeout); clearTimeout(killTimer)
    assert.equal(result.exit.code, test.exit, 'actual exit matches lifecycle contract')
    assert.equal(result.exit.signal, null, 'child completed its own cleanup path')
    assert.ok(evidence?.startsWith(evidenceDir + '/notification-'), 'child report is scoped evidence')
    const bytes = await readFile(evidence)
    const childReport = JSON.parse(bytes)
    result.evidence = evidence.slice(root.length + 1)
    result.evidenceSha256 = createHash('sha256').update(bytes).digest('hex')
    result.cleanup = childReport.cleanup
    assert.deepEqual(childReport.cleanup, { clusterStopped: true, tempDirectoryRemoved: true, clientsRemaining: 0, errors: [] })
    assert.equal(await exists(allocation), false, 'controller independently confirms directory removal')
    assert.equal(stderr, '', 'no raw exception output')
    if (test.env) {
      assert.equal(childReport.status, 'passed')
      for (const key of Object.keys(test.env)) assert.ok(childReport.runtime.scrubbedEnvironmentKeys.includes(key), 'hostile key scrubbed before pg load')
      assert.equal(childReport.runtime.connection.transport, 'unix_socket')
      result.scrubbedKeys = childReport.runtime.scrubbedEnvironmentKeys
    } else if (test.exit === 143) {
      assert.equal(childReport.signal, 'SIGTERM')
      assert.equal(childReport.status, 'interrupted')
      assert.ok(result.events.includes('fixture-ready'), 'real server was ready before signal')
    } else {
      assert.equal(childReport.status, 'failed')
      assert.equal(childReport.error.code, 'SUBPROCESS_FAILED')
      assert.equal(childReport.runtime.clusterStartAttempted, true)
    }
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'
    result.error = error.message
    result.stdout = stdout.slice(0, 4000)
    result.stderr = stderr.slice(0, 4000)
  } finally {
    clearTimeout(timeout); clearTimeout(killTimer)
    result.rescue = await rescue(allocation)
  }
}
report.status = report.cases.every(c => c.status === 'passed' && !c.rescue.needed) ? 'passed' : 'failed'
report.finishedAt = new Date().toISOString()
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ status: report.status, evidence: output.slice(root.length + 1), cases: report.cases.map(c => ({ name: c.name, status: c.status, exit: c.exit, rescue: c.rescue })) }))
process.exitCode = report.status === 'passed' ? 0 : 1
