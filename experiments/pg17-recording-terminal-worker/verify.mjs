import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { setTimeout as delay } from 'node:timers/promises'
import { Harness, root, bin, digest, exists } from '../pg17-routines/runtime.mjs'
import { fixture, USER, PROJECT } from '../pg17-recording-worker/fixture.mjs'
import { compileCandidateModules } from '../pg17-recording-candidates/application-compiler.mjs'
import { applicationClient, ORIGIN, SECRET } from '../pg17-recording-candidates/application-client.mjs'
import { setup, FINALIZATION, state } from '../pg17-recording-finalization/fixture.mjs'
import { terminalHttp } from './http.mjs'
import { observeResources } from './observations.mjs'

const require = createRequire(import.meta.url), ts = require('typescript')
const own = 'experiments/pg17-recording-terminal-worker'
const selected = process.argv.slice(2)
const cases = ['success-renewed', 'bad-source-hash', 'decode-duration-exceeded', 'post-candidate-error',
  'response-loss', 'malformed-receipt', 'cancel-during-cleanup', 'revoke-before-publication']
if (selected.some(name => !cases.includes(name))) throw new Error(`Unknown case; choose ${cases.join(', ')}`)
const evidence = join(root, 'docs/research/evidence/2026-11-05-g1-terminal-worker', `native-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`)
const report = { startedAt: new Date().toISOString(), command: ['node', `${own}/verify.mjs`, ...selected],
  status: 'running', assertions: 0, actorConnections: [], scenarios: [], cases: [], sources: {}, snapshots: {},
  compiled: {}, artifacts: {}, selectedCases: selected.length ? selected : cases,
  g1Item01Complete: false, g1MilestoneSatisfied: false, pushConditionSatisfied: false,
  limits: [
    'Actual Supabase JS, native fetch and streamed disk-backed synthetic Storage bytes use a loopback PostgREST-shaped SQL adapter, not real PostgREST, managed Storage, TLS, deployment or device qualification.',
    'Full seal/lease/candidate/finalization migrations are intact; foundation tables/helpers and auth/project prerequisites are the existing minimal synthetic fixture, not a full deployment schema replay.',
    'All UUIDs and audio are synthetic. Worker retains original and candidate bytes; only the owning harness removes its disposable fixture after byte snapshots. No draft clearing, cloud writes, retries, recovery, fallback failure or deletion is authorized.',
    'Response loss occurs after a confirmed PostgreSQL COMMIT, at the HTTP response boundary; PostgreSQL wire COMMIT acknowledgement loss is not simulated.',
    'Caller cancellation is injected after the real scoped rm settles; revocation is injected at the first post-cleanup input lease revalidation. Forced worker death and OS-wide process isolation are not qualified by this harness.',
    'Source snapshots include static ESM helper imports, compiled TypeScript inputs/output, loaded CommonJS dependencies and SQL. Runtime executables are fingerprinted, not copied; dynamically linked operating-system libraries and Node builtin sources are not independently snapshotted.',
  ] }
const h = new Harness(report)
await mkdir(evidence, { recursive: true })
async function archive(label, bytes, collection = report.snapshots) {
  const file = `${Object.keys(report.snapshots).length + Object.keys(report.artifacts).length}-${label.split('/').at(-1)}.gz`
  const compressed = gzipSync(bytes)
  await writeFile(join(evidence, file), compressed, { flag: 'wx' })
  collection[label] = { path: file, sha256: digest(compressed), decodedSha256: digest(bytes), byteSize: bytes.length }
}
async function source(path) {
  const bytes = await readFile(join(root, path))
  if (report.sources[path]) h.eq(digest(bytes), report.sources[path], 'source unchanged when reused')
  else { report.sources[path] = digest(bytes); await archive(path, bytes) }
  return bytes.toString()
}
async function esmClosure(path) {
  if (report.sources[path]) return
  const text = await source(path)
  for (const match of text.matchAll(/from\s+['"](\.[^'"]+\.mjs)['"]/g)) {
    await esmClosure(relative(root, resolve(root, dirname(path), match[1])))
  }
}
async function runtimeSources() {
  // Node's require cache canonicalizes /tmp to /private/tmp on macOS.
  const scratch = h.scratch ? await realpath(h.scratch) : undefined
  for (const path of Object.keys(require.cache).sort()) {
    if (scratch && path.startsWith(`${scratch}/`)) {
      const bytes = await readFile(path), label = `compiled/${relative(join(scratch, 'compiled'), path)}`
      if (!report.compiled[label]) { report.compiled[label] = digest(bytes); await archive(label, bytes) }
    } else if (path.startsWith(`${root}/`) && !report.sources[relative(root, path)]) await source(relative(root, path))
  }
}
let http, observations, service
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { h.signal ??= signal })
try {
  await esmClosure(`${own}/verify.mjs`)
  for (const path of [`${own}/README.md`, 'experiments/pg17-routines/runtime-pins.json', 'package-lock.json',
    'node_modules/@supabase/supabase-js/package.json', 'node_modules/@supabase/postgrest-js/package.json']) await source(path)
  await runtimeSources()
  await h.start(); await setup(h, source)
  report.runtime.nodeExecutable = process.execPath
  report.runtime.postgresBinaryDirectory = bin
  await h.db.query(await source(FINALIZATION)); report.fixture.fullMigrations.push(FINALIZATION)
  const modules = await compileCandidateModules(h, source)
  for (const name of ['recording-job-finalization', 'recording-terminal-worker']) {
    const compiled = ts.transpileModule(await source(`packages/web/src/lib/server/${name}.ts`), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }, reportDiagnostics: true })
    h.eq(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `${name} transpiles`)
    await writeFile(join(h.scratch, 'compiled/lib/server', `${name}.js`), compiled.outputText)
  }
  const { finalizeLeasedRecordingJob } = require(join(h.scratch, 'compiled/lib/server/recording-terminal-worker.js'))
  await runtimeSources()
  h.ok(report.compiled['compiled/lib/server/recording-terminal-worker.js'], 'executed terminal JavaScript is archived')
  h.ok(report.compiled['compiled/lib/server/recording-job-worker.js'], 'executed lease supervisor JavaScript is archived')
  h.ok(report.compiled['compiled/lib/server/recording-candidate-worker.js'], 'executed shared preparation JavaScript is archived')
  const executable = process.env.SAGA_FFMPEG_PATH
  h.ok(executable && isAbsolute(executable), 'SAGA_FFMPEG_PATH specifies available native executable')
  function ffmpeg(args) {
    const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 15000, maxBuffer: 1048576 })
    h.eq(result.status, 0, 'native FFmpeg command succeeds')
    return result.stdout
  }
  report.audioRuntime = { executable, sha256: digest(await readFile(executable)), version: ffmpeg(['-version']).split('\n')[0],
    supabaseJs: require('@supabase/supabase-js/package.json').version, postgrestJs: require('@supabase/postgrest-js/package.json').version }
  const audio = join(h.scratch, 'synthetic.webm'), tempRoot = join(h.scratch, 'attempts')
  ffmpeg(['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
    'sine=frequency=440:sample_rate=48000:duration=2', '-c:a', 'libopus', '-f', 'webm', audio])
  const bytes = await readFile(audio)
  await archive('synthetic-source.webm', bytes, report.artifacts)
  report.audioFixture = { description: '2s 440Hz WebM/Opus sine wave', sha256: digest(bytes), byteSize: bytes.length }
  await mkdir(tempRoot)
  observations = observeResources(h, executable, tempRoot)
  service = await h.actorClient('service_role', USER)
  http = await terminalHttp(h)
  for (const name of report.selectedCases) await h.scenario(name, async () => {
    const f = await fixture(h, service, modules.prepareRecordingSessionSeal, bytes)
    const before = await state(h, f), controller = new AbortController(), fetchEvents = []
    const { admin, transport } = applicationClient(http.loopback, fetchEvents)
    const mode = name, first = http.events.length, started = performance.now(), resourceStart = observations.events.length
    observations.configure({ name, mode, controller })
    await http.configure({ name, mode, f, readbackMs: name === 'success-renewed' ? 1400 : 0,
      localCleanupSettled: () => observations.events.slice(resourceStart).some(event => event.kind === 'merged-directory-removal' && event.closed),
      cleanupAtTerminal: async () => {
        const value = await observations.assertClean(true)
        h.ok(fetchEvents.filter(event => event.readers).every(event => event.readers.every(reader => reader.closed && reader.cancelCalled && reader.released)),
          'all Storage readers settled before terminal request')
        const preceding = http.events.slice(first, -1)
        h.eq(preceding.at(-1)?.action, 'check', 'terminal request follows final active check')
        h.ok(preceding.filter(event => event.action === 'heartbeat').every(event => event.committed), 'every heartbeat completed before terminal request')
        return value
      } })
    let receipt, error, settlements = 0
    await finalizeLeasedRecordingJob(f.jobId, { admin, storageUrl: ORIGIN, serviceRoleKey: SECRET, fetch: transport,
      ffmpeg: { executable, timeoutMs: 10000, maxDurationMs: name === 'decode-duration-exceeded' ? 1 : 5000 },
      tempRoot, ioTimeoutMs: 3000, workerId: 'native-terminal-worker', leaseMs: 1000, heartbeatMs: 100, rpcTimeoutMs: 400,
      signal: controller.signal }).then(value => { receipt = value; settlements++ }, value => { error = value; settlements++ })
    await http.settle()
    const returnedCount = http.events.length
    await delay(250)
    h.eq(http.events.length, returnedCount, 'no late heartbeat, check, retry or fallback after attempt settles')
    h.eq(settlements, 1, 'worker promise settles exactly once')
    const cleanup = await observations.assertClean()
    h.eq(h.clients.size, 2, 'only harness and explicit fixture service PG clients remain')
    const after = await state(h, f), events = http.events.slice(first), terminal = events.filter(event => event.rpc === 'finalize')
    const resources = observations.events.slice(resourceStart)
    const entry = { name, jobId: f.jobId, elapsedMs: performance.now() - started, before, after, receipt: receipt ?? null,
      error: error?.message ?? null, settlements, cleanup, firstRequest: first, requests: events.length,
      heartbeats: events.filter(event => event.action === 'heartbeat').length, fetchEvents, retained: [] }
    report.cases.push(entry)
    h.ok(events.every(event => event.finished && event.fixtureListenersRemoved), 'native request handlers and owned listeners settle')
    h.ok(fetchEvents.every(event => event.settled), 'all native fetch transports settled')
    h.ok(events.every(event => !['DELETE', 'PUT', 'PATCH'].includes(event.method)), 'worker never deletes, overwrites or directly mutates a table')
    h.ok(fetchEvents.filter(event => event.path.startsWith('/storage/')).every(event => event.redirect === 'error' && event.cache === 'no-store'), 'Storage disables redirects and caching')
    h.ok(fetchEvents.filter(event => event.readers).every(event => event.readers.length ? event.readers.every(reader => reader.closed && reader.cancelCalled && reader.released) : event.bodyCancelCalled),
      'all Storage bodies are closed/cancelled and readers released')
    h.eq(after.chunks, before.chunks, 'every immutable source chunk tuple retained')
    for (const [key, original] of f.objects) {
      const stored = http.inputs.get(key), retained = await readFile(stored.file)
      h.eq(retained, original, 'original source object bytes retained exactly after worker returns')
      entry.retained.push({ kind: 'source', key, byteSize: retained.length, sha256: digest(retained) })
    }
    for (const candidate of after.candidates) {
      const stored = http.objects.get(candidate.object_key)
      h.ok(stored, 'candidate object remains stored after worker returns')
      const retained = await readFile(stored.file)
      h.eq(retained, bytes, 'entire immutable candidate bytes retained exactly')
      const label = `${name}-candidate.webm`
      await archive(label, retained, report.artifacts)
      entry.retained.push({ kind: 'candidate', key: candidate.object_key, byteSize: retained.length, sha256: digest(retained), artifact: label })
    }
    const permanent = ['bad-source-hash', 'decode-duration-exceeded'].includes(name)
    const published = ['success-renewed', 'response-loss', 'malformed-receipt'].includes(name)
    h.eq(terminal.length, permanent || published ? 1 : 0, 'exactly one appropriate terminal request, otherwise none')
    if (terminal.length) {
      const t = terminal[0], finished = t.receipt.finishedAt, failureCode = permanent ? (name === 'bad-source-hash' ? 'recording_source_hash_mismatch' : 'recording_decode_duration_exceeded') : null
      h.eq(events.at(-1), t, 'finalization is the final worker HTTP request')
      h.eq(t.committed, true, 'terminal transaction actually committed')
      h.eq(t.input.p_action, permanent ? 'fail' : 'publish', 'terminal action matches verified outcome')
      h.eq(t.input.p_failure_code, failureCode, 'only actual branded processing failure reaches SQL')
      h.eq(t.receipt.canClearLocalDrafts, false, 'terminal receipt never permits draft clearing')
      h.eq(after.candidates, t.before.candidates, 'terminal operation retains every candidate field')
      const expected = structuredClone(t.before), c = after.candidates[0]
      Object.assign(expected.job, { state: permanent ? 'failed' : 'succeeded', result_ref: permanent ? null : f.assetId,
        lease_owner: null, lease_expires_at: null, not_before: null, error_code: failureCode, updated_at: finished })
      Object.assign(expected.attempts[0], { result_state: permanent ? 'fatal_error' : 'succeeded', finished_at: finished, error_code: failureCode })
      Object.assign(expected.session, { state: permanent ? 'failed' : 'cloud_confirmed', confirmed_asset_id: permanent ? null : f.assetId,
        merge_job_id: permanent ? null : f.jobId, confirmed_at: permanent ? null : finished })
      if (permanent) Object.assign(expected.asset, { state: 'quarantined', verification_error: failureCode, updated_at: finished })
      else Object.assign(expected.asset, { state: 'ready', bucket: c.bucket, object_key: c.object_key, byte_size: c.byte_size,
        sha256: c.sha256, mime_type: c.mime_type, duration_ms: c.duration_ms, verified_at: finished, content_verified_at: finished,
        verification_error: null, updated_at: finished })
      h.eq(after, expected, 'complete terminal asset/job/attempt/session/chunk/candidate tuples match exact intended delta')
      h.eq(after, t.after, 'no mutation after terminal transaction')
      h.ok(resources.every(resource => resource.closed && resource.closedAt <= t.at), 'every decoder/file/directory settled before terminal request arrived')
      if (permanent) {
        h.eq(after.candidates, [], 'permanent bad input reserves no candidate')
        h.eq(events.filter(event => event.rpc === 'candidate' || event.kind.startsWith('candidate-')).length, 0, 'permanent failure performs zero candidate RPC or Storage operation')
      } else {
        h.eq(events.filter(event => event.rpc === 'candidate').map(event => event.action), ['reserve', 'prepare'], 'one reserve and one prepare without retries')
        h.eq(events.filter(event => event.kind.startsWith('candidate-')).map(event => event.kind), ['candidate-upload', 'candidate-readback'], 'one complete upload and readback')
        h.eq(after.candidates.length, 1, 'only exact prepared candidate published')
        h.eq(after.candidates[0].state, 'prepared', 'candidate remains prepared evidence')
      }
    } else {
      h.eq(after.job.state, 'running', 'uncertain or cancelled preparation leaves job running for explicit later handling')
      h.eq(after.job.result_ref, null, 'uncertain preparation has no published result')
      h.eq(after.asset, before.asset, 'nonterminal case preserves complete asset tuple')
      h.eq(after.session, before.session, 'nonterminal case preserves complete session tuple')
      h.eq(after.attempts[0].result_state, 'running', 'attempt remains running without invented failure')
      h.eq(after.attempts[0].finished_at, null, 'nonterminal attempt has no terminal timestamp')
      h.eq(after.candidates.length, 1, 'one committed candidate retained for uncertain attempt')
      h.eq(after.candidates[0].state, name === 'post-candidate-error' ? 'reserved' : 'prepared', 'candidate retained at actual committed phase')
    }
    if (['success-renewed', 'bad-source-hash', 'decode-duration-exceeded'].includes(name)) {
      h.eq(error, undefined, 'verified terminal outcome returns success receipt')
      h.eq(receipt, terminal[0].receipt, 'worker returns exact SQL receipt without lease')
      h.eq(Object.hasOwn(receipt, 'lease'), false, 'no active lease attached to terminal receipt')
    } else {
      h.eq(receipt, undefined, 'unavailable outcome returns no success receipt')
      h.eq(error?.message, 'recording_worker_unavailable', 'worker rejects once with fixed redacted error')
    }
    if (name === 'success-renewed') {
      h.ok(entry.elapsedMs > 1000 && entry.heartbeats >= 3, 'slow real readback outlives initial lease with renewed heartbeats')
      const decoder = resources.filter(resource => resource.kind === 'decoder')
      h.eq(decoder.length, 1, 'exactly one real full-audio decoder')
      h.ok(decoder[0].pcmBytes > 0 && decoder[0].code === 0, 'actual decoder produced PCM and exited successfully')
    }
    if (name === 'bad-source-hash') {
      h.ok(events.some(event => event.kind === 'input-read' && event.sentSha256 !== event.storedSha256), 'real native HTTP source bytes differ from sealed hash')
      h.eq(resources.filter(resource => resource.kind === 'decoder').length, 0, 'hash mismatch rejects before decoding')
    }
    if (name === 'post-candidate-error') h.ok(events.some(event => event.kind === 'candidate-readback' && event.sentSha256 !== digest(bytes)), 'real candidate readback is corrupted after immutable upload')
    if (name === 'cancel-during-cleanup') h.ok(resources.some(resource => resource.callerCancelled && resource.closed), 'caller cancellation happened inside real settled local cleanup')
    if (name === 'revoke-before-publication') {
      const revocation = events.find(event => event.accessRevoked && event.sqlstate)
      h.ok(revocation, 'actual role revocation is rejected by post-cleanup lease revalidation')
      h.ok(resources.every(resource => resource.closed && resource.closedAt <= revocation.at), 'role revoked only after every local artifact settled')
      await h.db.query("UPDATE project_roles SET status='active' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER])
    }
  })
  await h.close(service); service = undefined
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'; report.error = { code: error.code ?? 'ERROR', label: error.label ?? error.message }; process.exitCode = 1
} finally {
  if (http) try { await http.close() } catch (error) { report.status = 'failed'; report.httpCleanupError = error.label ?? error.message }
  if (observations) try { await observations.close() } catch (error) { report.status = 'failed'; report.applicationCleanupError = error.label ?? error.message }
  await runtimeSources()
  if (h.scratch && await exists(join(h.scratch, 'postgres.log'))) await archive('postgres.log', await readFile(join(h.scratch, 'postgres.log')), report.artifacts)
  report.sourcesChangedDuringRun = []
  for (const [path, hash] of Object.entries(report.sources)) if (digest(await readFile(join(root, path))) !== hash) report.sourcesChangedDuringRun.push(path)
  report.compiledChangedDuringRun = []
  for (const [path, hash] of Object.entries(report.compiled)) if (digest(await readFile(join(h.scratch, path))) !== hash) report.compiledChangedDuringRun.push(path)
  report.runtimeChangedDuringRun = []
  for (const [name, hash] of Object.entries(report.runtime.binarySha256 ?? {})) if (digest(await readFile(join(bin, name))) !== hash) report.runtimeChangedDuringRun.push(name)
  if (report.audioRuntime && digest(await readFile(report.audioRuntime.executable)) !== report.audioRuntime.sha256) report.runtimeChangedDuringRun.push('ffmpeg')
  if (report.runtime.nodeExecutableSha256 && digest(await readFile(process.execPath)) !== report.runtime.nodeExecutableSha256) report.runtimeChangedDuringRun.push('node')
  await h.cleanup()
  report.cleanup.socketDirectoryRemoved = !h.config?.host || !await exists(h.config.host)
  if (report.runtime.serverPid) {
    try { process.kill(report.runtime.serverPid, 0); report.cleanup.serverPidGone = false }
    catch (error) { report.cleanup.serverPidGone = error.code === 'ESRCH' }
  }
  if (report.sourcesChangedDuringRun.length || report.compiledChangedDuringRun.length || report.runtimeChangedDuringRun.length || !report.cleanup.socketDirectoryRemoved ||
    (report.runtime.serverPid && !report.cleanup.serverPidGone) || report.status !== 'passed') { report.status = 'failed'; process.exitCode = 1 }
  report.finishedAt = new Date().toISOString()
  await writeFile(join(evidence, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ evidence, status: report.status, assertions: report.assertions, scenarios: report.scenarios,
    cleanup: report.cleanup, httpCleanup: report.httpCleanup, applicationCleanup: report.applicationCleanup, error: report.error ?? null }, null, 2))
}
