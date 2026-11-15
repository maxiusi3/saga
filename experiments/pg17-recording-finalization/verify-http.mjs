import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { gzipSync } from 'node:zlib'
import { Harness, root, digest, exists } from '../pg17-routines/runtime.mjs'
import { compileModules, fixture, rpc as leaseRpc, USER } from '../pg17-recording-worker/fixture.mjs'
import { candidateRpc } from '../pg17-recording-candidates/fixture.mjs'
import { setup, FINALIZATION, WORKER, state, PERMANENT_CODES } from './fixture.mjs'
import { finalizationHttp } from './http.mjs'

const require = createRequire(import.meta.url), ts = require('typescript')
const mode = process.argv.includes('--without-migration') ? 'http-red-without-migration' : 'http-application'
const evidence = join(root, 'docs/research/evidence/2026-11-04-g1-recording-finalization', `${mode}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`)
const report = { startedAt: new Date().toISOString(), mode, status: 'running', assertions: 0,
  actorConnections: [], scenarios: [], sources: {}, snapshots: {}, tuples: [],
  limits: ['Actual Supabase JS and native fetch over disposable loopback HTTP; parameterized native PG17 RPC. PostgREST substituted. No Storage bytes/audio verification, cloud qualification or worker wiring.'],
  g1Item01Complete: false, g1MilestoneSatisfied: false, pushConditionSatisfied: false }
const h = new Harness(report)
await mkdir(evidence, { recursive: true })
async function source(path) {
  const bytes = await readFile(join(root, path))
  if (report.sources[path]) { h.eq(digest(bytes), report.sources[path], 'source unchanged at reuse'); return bytes.toString() }
  report.sources[path] = digest(bytes)
  const name = `${Object.keys(report.snapshots).length}-${path.split('/').at(-1)}.gz`, compressed = gzipSync(bytes)
  await writeFile(join(evidence, name), compressed, { flag: 'wx' })
  report.snapshots[path] = { path: name, sha256: digest(compressed), decodedSha256: digest(bytes) }
  return bytes.toString()
}
let http
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { h.signal ??= signal })
try {
  for (const path of ['experiments/pg17-recording-finalization/verify-http.mjs', 'experiments/pg17-recording-finalization/http.mjs',
    'experiments/pg17-recording-finalization/fixture.mjs', 'experiments/pg17-recording-worker/fixture.mjs',
    'experiments/pg17-recording-candidates/fixture.mjs', 'experiments/pg17-routines/runtime.mjs', 'experiments/pg17-routines/runtime-pins.json',
    'package-lock.json', 'node_modules/@supabase/supabase-js/package.json', 'node_modules/@supabase/postgrest-js/package.json']) await source(path)
  report.sdkVersion = require('@supabase/supabase-js/package.json').version
  report.sdkEntrySha256 = digest(await readFile(require.resolve('@supabase/supabase-js')))
  report.postgrestEntrySha256 = digest(await readFile(require.resolve('@supabase/postgrest-js')))
  await h.start(); await setup(h, source)
  if (mode !== 'http-red-without-migration') { await h.db.query(await source(FINALIZATION)); report.fixture.fullMigrations.push(FINALIZATION) }
  const base = await compileModules(h, source)
  for (const name of ['recording-output-candidate', 'recording-job-finalization']) {
    const compiled = ts.transpileModule(await source(`packages/web/src/lib/server/${name}.ts`), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }, reportDiagnostics: true })
    h.eq(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `${name} transpiles`)
    await writeFile(join(h.scratch, 'compiled/lib/server', `${name}.js`), compiled.outputText)
  }
  const finalizer = require(join(h.scratch, 'compiled/lib/server/recording-job-finalization.js'))
  const { RecordingProcessingError } = require(join(h.scratch, 'compiled/lib/server/recording-processing-error.js'))
  const service = await h.actorClient('service_role', USER)
  async function fresh(prepared = true) {
    const f = await fixture(h, service, base.prepareRecordingSessionSeal)
    const began = performance.now()
    await leaseRpc(service, f.jobId, 'claim', WORKER, null, 120000)
    const lease = await leaseRpc(service, f.jobId, 'start', WORKER, 1)
    f.lease = { ...lease, deadline: began + 119000 }
    if (prepared) {
      f.candidateId = randomUUID()
      f.output = { byteSize: f.bytes.length, sha256: digest(f.bytes), mimeType: f.mimeType, durationMs: 1250 }
      await candidateRpc(service, [f.jobId, 'reserve', WORKER, 1, f.manifestSha256, f.candidateId, f.output])
      f.candidate = await candidateRpc(service, [f.jobId, 'prepare', WORKER, 1, f.manifestSha256, f.candidateId, f.output])
    }
    return f
  }
  http = await finalizationHttp(h)
  async function run(name, mode, { fail = false, prepared = !fail, code = PERMANENT_CODES[0] } = {}) {
    const f = await fresh(prepared), before = await state(h, f), controller = new AbortController()
    http.configure({ name, mode, checkpoint: () => controller.abort() })
    const first = http.events.length, firstTransport = http.transports.length
    let receipt, error
    try {
      const options = { admin: http.admin, signal: controller.signal, timeoutMs: mode === 'timeout-before-commit' ? 250 : 5000 }
      receipt = fail ? await finalizer.failRecordingJob(f.lease, new RecordingProcessingError(code, 'SECRET private source'), options)
        : await finalizer.publishRecordingJob(f.lease, f.candidate, options)
    } catch (caught) { error = caught }
    await http.drain()
    const after = await state(h, f), events = http.events.slice(first)
    report.tuples.push({ name, before, after, receipt, errorCode: error?.message })
    h.eq(events.length, 1, 'one HTTP request: no retry, follow-up failure, deletion or direct write')
    h.eq(http.transports.length - firstTransport, 1, 'actual SDK invokes native fetch exactly once')
    h.eq(events[0].input, { p_job_id: f.jobId, p_action: fail ? 'fail' : 'publish', p_worker_id: WORKER, p_attempt: 1,
      p_manifest_sha256: f.manifestSha256, p_candidate_id: fail ? null : f.candidateId, p_output: fail ? null : f.output,
      p_failure_code: fail ? code : null }, 'actual SDK serializes exact action-specific nulls and candidate output')
    if (mode === 'normal' && !(fail && prepared)) {
      h.eq(error?.message ?? null, null, 'terminal request succeeds')
      h.eq(receipt, events[0].receipt, 'SDK adapter returns exact committed SQL receipt')
      h.eq(receipt.canClearLocalDrafts, false, 'receipt retains local copies')
      h.eq(after.job.state, fail ? 'failed' : 'succeeded', 'job committed terminal state')
      h.eq(after.asset.state, fail ? 'quarantined' : 'ready', 'asset committed terminal state')
      h.eq(after.session.state, fail ? 'failed' : 'cloud_confirmed', 'session committed terminal state')
    } else {
      h.eq(receipt, undefined, 'unavailable response never claims success')
      h.eq(error?.message, 'recording_finalization_unavailable', 'no provider bodies/paths escape')
      if (['bad-receipt', 'response-loss', 'cancel-after-commit'].includes(mode)) {
        h.eq(events[0].committed, true, 'SQL committed despite rejected/lost response')
        h.eq(after.job.state, 'succeeded', 'committed job is not overwritten as failure')
        h.eq(after.asset.state, 'ready', 'committed asset remains published')
      } else {
        h.eq(after, before, 'precommit cancellation or post-candidate fail rejection leaves every field unchanged')
        h.eq(events[0].rolledBack, true, 'native transaction rolled back')
      }
    }
    h.eq(after.candidates, before.candidates, 'candidate rows retained unchanged')
    h.eq(after.chunks, before.chunks, 'input chunk rows retained unchanged')
  }
  await h.scenario('SDK publishes prepared pointer through native HTTP + PostgreSQL', () => run('publish', 'normal'))
  await h.scenario('SDK fails every branded permanent code before reservation', async () => {
    for (const code of PERMANENT_CODES) await run(`fail-${code}`, 'normal', { fail: true, code })
  })
  for (const mode of ['bad-receipt', 'response-loss', 'cancel-before-commit', 'cancel-after-commit', 'timeout-before-commit']) {
    await h.scenario(`SDK ${mode}: retain evidence and never replay`, () => run(mode, mode))
  }
  await h.scenario('SDK permanent failure rejected after candidate reservation', () => run('fail-after-candidate', 'normal', { fail: true, prepared: true }))
  await h.close(service)
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'; report.error = { code: error.code ?? 'ERROR', label: error.label ?? error.message }; process.exitCode = 1
} finally {
  if (http) try { await http.close() } catch (error) { report.status = 'failed'; report.httpCleanupError = error.label ?? error.message; process.exitCode = 1 }
  if (h.scratch && await exists(join(h.scratch, 'postgres.log'))) {
    const bytes = await readFile(join(h.scratch, 'postgres.log')), compressed = gzipSync(bytes)
    await writeFile(join(evidence, 'postgres.log.gz'), compressed, { flag: 'wx' })
    report.postgresLog = { path: 'postgres.log.gz', sha256: digest(compressed), decodedSha256: digest(bytes) }
  }
  await h.cleanup()
  report.cleanup.socketDirectoryRemoved = !h.config?.host || !await exists(h.config.host)
  if (report.runtime.serverPid) {
    try { process.kill(report.runtime.serverPid, 0); report.cleanup.serverPidGone = false }
    catch (error) { report.cleanup.serverPidGone = error.code === 'ESRCH' }
  }
  report.sourcesChangedDuringRun = []
  for (const [path, hash] of Object.entries(report.sources)) if (digest(await readFile(join(root, path))) !== hash) report.sourcesChangedDuringRun.push(path)
  if (report.sourcesChangedDuringRun.length || !report.cleanup.socketDirectoryRemoved ||
    (report.runtime.serverPid && !report.cleanup.serverPidGone) || report.status !== 'passed') { report.status = 'failed'; process.exitCode = 1 }
  report.finishedAt = new Date().toISOString()
  await writeFile(join(evidence, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ evidence, status: report.status, assertions: report.assertions, scenarios: report.scenarios,
    cleanup: report.cleanup, httpCleanup: report.httpCleanup, error: report.error ?? null }, null, 2))
}
