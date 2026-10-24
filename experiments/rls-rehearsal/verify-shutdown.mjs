import assert from 'node:assert/strict'
import { fork, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const evidenceDir = join(root, 'docs/research/evidence/2026-10-17-rls-rehearsal')
const output = join(evidenceDir, `shutdown-regression-${Date.now()}-${process.pid}.json`)
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('PG') && key !== 'DATABASE_URL')
)
const cases = [
  { name: 'allocation_sigterm', args: ['--test-pause-before-allocation-return'], signal: 'SIGTERM', exit: 143 },
  { name: 'allocation_sigint', args: ['--test-pause-before-allocation-return'], signal: 'SIGINT', exit: 130 },
  { name: 'allocation_deadline', args: ['--test-pause-before-allocation-return', '--test-deadline-during-allocation'], signal: 'deadline', exit: 143 },
  { name: 'stable_fixture_sigterm', args: ['--signal-after-setup'], signal: 'SIGTERM', exit: 143 },
  { name: 'allocation_exception', args: ['--test-fail-after-allocation'], exit: 1 },
  { name: 'fixture_exception', args: ['--test-fail-after-setup'], exit: 1 },
]
const only = process.argv.find(arg => arg.startsWith('--case='))?.slice(7)
assert.ok(!only || cases.some(test => test.name === only), 'unknown shutdown test case')
const report = {
  startedAt: new Date().toISOString(),
  scope: 'real local directories/PG14; explicit IPC scheduling injection; no remote services',
  sources: {},
  cases: [],
  status: 'running',
}
for (const file of (await readdir(here)).filter(name => /\.(mjs|sql|md)$/.test(name)).sort())
  report.sources[`experiments/rls-rehearsal/${file}`] = createHash('sha256')
    .update(await readFile(join(here, file))).digest('hex')

const exists = path => access(path).then(() => true, () => false)

// Rescue only this child's recorded real allocation if the regression fails.
// These results are separate from the child's cleanup claim.
async function rescue(path) {
  assert.match(path, /^\/tmp\/saga-rls-[A-Za-z0-9]+$/)
  if (!await exists(path)) return { needed: false }
  const data = join(path, 'data')
  if (await exists(join(data, 'postmaster.pid'))) {
    try {
      execFileSync('pg_ctl', ['-D', data, '-m', 'immediate', '-w', '-t', '10', 'stop'], {
        env, timeout: 15000, stdio: 'pipe',
      })
    } catch (error) {
      try {
        execFileSync('pg_ctl', ['-D', data, 'status'], { env, timeout: 5000, stdio: 'pipe' })
        throw error
      } catch (status) {
        if (status.status !== 3) throw status
      }
    }
  }
  await rm(path, { recursive: true, force: true })
  return { needed: true, directoryRemoved: !await exists(path) }
}

for (const test of cases.filter(test => !only || test.name === only)) {
  const result = { name: test.name, args: test.args, status: 'running', events: [] }
  report.cases.push(result)
  let childReportPath, allocation, childReport
  let stdout = '', stderr = ''
  const child = fork(join(here, 'verify.mjs'), test.args, {
    cwd: root, env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  child.stdout.on('data', data => { stdout += data.toString() })
  child.stderr.on('data', data => { stderr += data.toString() })
  child.on('message', message => {
    result.events.push(message.type)
    if (message.type === 'evidence') childReportPath = message.path
    if (message.type === 'allocation-pending') {
      allocation = message.path
      if (test.signal !== 'deadline') child.kill(test.signal)
    }
    if (message.type === 'shutdown-requested' && allocation)
      child.send({ type: 'release-allocation' })
  })
  let forceStop
  const timeout = setTimeout(() => {
    result.timedOut = true
    child.kill('SIGTERM')
    forceStop = setTimeout(() => child.kill('SIGKILL'), 5000)
  }, 45000)
  try {
    const exit = await new Promise((resolveExit, reject) => {
      child.once('error', reject)
      child.once('close', (code, signal) => resolveExit({ code, signal }))
    })
    clearTimeout(timeout)
    clearTimeout(forceStop)
    result.exit = exit
    assert.ok(childReportPath?.startsWith(evidenceDir + '/'), 'child evidence is scoped locally')
    result.evidence = childReportPath.slice(root.length + 1)
    if (allocation) {
      result.allocation = allocation
      result.directoryExistsAfterExit = await exists(allocation)
      assert.equal(result.directoryExistsAfterExit, false, 'every real allocation must be removed')
    }
    childReport = JSON.parse(await readFile(childReportPath, 'utf8'))
    result.cleanup = childReport.cleanup
    result.signal = childReport.signal
    allocation ??= childReport.scratch
    result.allocation = allocation
    result.directoryExistsAfterExit = allocation ? await exists(allocation) : false
    assert.equal(result.timedOut, undefined, 'child must finish within its deadline')
    assert.deepEqual(exit, { code: test.exit, signal: null })
    assert.equal(childReport.status, test.signal ? 'interrupted' : 'failed')
    if (test.signal) assert.equal(childReport.signal, test.signal)
    else assert.equal(childReport.error?.code, 'TEST_SETUP_FAILURE')
    assert.equal(childReport.cleanup?.clusterStopped, true)
    assert.equal(childReport.cleanup?.tempDirectoryRemoved, true)
    assert.equal(childReport.cleanup?.clientsRemaining, 0)
    assert.deepEqual(childReport.cleanup?.errors, [])
    assert.equal(result.directoryExistsAfterExit, false, 'every real allocation must be removed')
    if (test.name.startsWith('allocation_') && test.signal)
      assert.equal(childReport.runtime?.clusterStartAttempted, undefined, 'cancelled allocation must not start PostgreSQL')
    if (test.name === 'stable_fixture_sigterm' || test.name === 'fixture_exception')
      assert.equal(childReport.runtime?.clusterStartAttempted, true, 'fixture case must observe a real PostgreSQL start')
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'
    result.error = error.message
    result.stdout = stdout.slice(-4000)
    result.stderr = stderr.slice(-4000)
  } finally {
    clearTimeout(timeout)
    clearTimeout(forceStop)
    if (allocation) {
      try { result.rescue = await rescue(allocation) }
      catch (error) { result.status = 'failed'; result.rescueError = error.message }
    }
  }
}
report.status = report.cases.every(test => test.status === 'passed') ? 'passed' : 'failed'
report.finishedAt = new Date().toISOString()
await mkdir(evidenceDir, { recursive: true })
await writeFile(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ status: report.status, evidence: output.slice(root.length + 1), cases: report.cases.map(({ name, status, error }) => ({ name, status, error })) }))
process.exitCode = report.status === 'passed' ? 0 : 1
