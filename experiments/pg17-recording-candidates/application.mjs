import { createRequire } from 'node:module'
import { once } from 'node:events'
import { mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { digest, root, exists } from '../pg17-routines/runtime.mjs'
import { USER, PROJECT, fixture, rpc } from '../pg17-recording-worker/fixture.mjs'
import { candidateState } from './fixture.mjs'
import { applicationClient, ORIGIN, SECRET } from './application-client.mjs'
import { nativeHttpFixture } from './application-http.mjs'

const require = createRequire(import.meta.url)
const cp = require('node:child_process')
const fs = require('node:fs')
const fsp = require('node:fs/promises')

export async function applicationScenarios(h, modules, children) {
  const executable = process.env.SAGA_FFMPEG_PATH
  h.ok(executable && isAbsolute(executable), 'SAGA_FFMPEG_PATH supplies explicit native executable')
  function run(args) {
    const result = cp.spawnSync(executable, args, { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 })
    h.eq(result.status, 0, 'real native FFmpeg command succeeds')
    return result.stdout
  }
  h.report.audioRuntime = { executable, sha256: digest(await readFile(executable)), version: run(['-version']).split('\n')[0],
    supabaseJs: require('@supabase/supabase-js/package.json').version }
  const file = join(h.scratch, 'synthetic-candidate.webm')
  run(['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
    'sine=frequency=440:sample_rate=48000:duration=2', '-c:a', 'libopus', '-f', 'webm', file])
  const bytes = await readFile(file), tempRoot = join(h.scratch, 'application-attempts')
  await mkdir(tempRoot)
  h.report.audioFixture = { sha256: digest(bytes), byteSize: bytes.length, synthetic: '2s 440Hz WebM/Opus sine wave' }
  const service = await h.actorClient('service_role', USER)
  const http = await nativeHttpFixture(h)
  const nativeChildren = new Set(), streams = new Set(), handles = new Set()
  const decoders = h.report.nativeDecoders = [], files = h.report.applicationFiles = []
  const originalSpawn = cp.spawn, originalRead = fs.createReadStream, originalOpen = fsp.open
  let currentName
  cp.spawn = function (...args) {
    h.eq(args[0], executable, 'compiled verifier invokes configured actual native FFmpeg')
    const child = originalSpawn.apply(this, args)
    const event = { case: currentName, pid: child.pid, pcmBytes: 0, code: null, signal: null, closed: false }
    decoders.push(event); nativeChildren.add(child)
    child.stdout.on('data', part => { event.pcmBytes += part.length })
    child.once('close', (code, signal) => { Object.assign(event, { code, signal, closed: true }); nativeChildren.delete(child) })
    return child
  }
  fs.createReadStream = function (...args) {
    const stream = originalRead.apply(this, args)
    const event = { case: currentName, kind: 'upload-read-stream', opened: false, closed: false }
    files.push(event); streams.add(stream)
    stream.once('open', () => { event.opened = true })
    stream.once('close', () => { event.closed = true; streams.delete(stream) })
    return stream
  }
  fsp.open = async function (...args) {
    const handle = await originalOpen.apply(this, args)
    if (!String(args[0]).startsWith(tempRoot)) return handle
    const event = { case: currentName, kind: 'merged-file-handle', opened: true, closed: false }
    files.push(event); handles.add(handle)
    handle.once('close', () => { event.closed = true; handles.delete(handle) })
    return handle
  }
  const options = { ffmpeg: { executable, timeoutMs: 10000, maxDurationMs: 5000 }, tempRoot,
    ioTimeoutMs: 2500, workerId: 'native-candidate-worker', leaseMs: 1000, heartbeatMs: 100, rpcTimeoutMs: 400 }
  async function boundary(f) {
    const persisted = await candidateState(h, f.jobId)
    h.eq(persisted.job.result_ref, null, 'candidate never publishes terminal result')
    h.eq(persisted.job.state, 'running', 'attempt remains running before explicit recovery')
    const asset = (await h.db.query('SELECT state,sha256,object_key FROM media_assets WHERE id=$1', [f.assetId])).rows[0]
    h.eq(asset.state, 'verifying', 'original asset remains verifying')
    h.eq(asset.sha256, null, 'original asset receives no candidate content hash')
    h.eq(asset.object_key, f.sealed.assetRecord.object_key, 'original asset object destination remains unchanged')
    const session = (await h.db.query('SELECT state,confirmed_at FROM recording_sessions WHERE id=$1', [f.sessionId])).rows[0]
    h.eq(session, { state: 'sealing', confirmed_at: null }, 'session remains sealing and never cloud confirmed')
    return persisted
  }
  async function execute(name, config = {}) {
    currentName = name
    const f = await fixture(h, service, modules.prepareRecordingSessionSeal, bytes)
    const controller = new AbortController()
    http.setCase({ name, f, ...config, abort: () => controller.abort() })
    const fetchEvents = [], { admin, transport } = applicationClient(http.loopback, fetchEvents)
    const first = http.requests.length, firstDecoder = decoders.length, firstFile = files.length, started = performance.now()
    let result, error
    try {
      result = await modules.prepareLeasedRecordingJobCandidate(f.jobId, { ...options, ...config.options,
        admin, storageUrl: ORIGIN, serviceRoleKey: SECRET, fetch: transport, signal: controller.signal })
    } catch (caught) { error = caught }
    await http.settle()
    const count = http.requests.length
    await delay(200)
    h.eq(http.requests.length, count, 'no retry, late prepare or heartbeat after worker returns')
    h.eq(await readdir(tempRoot), [], 'application removes all scoped merged files and directories')
    h.eq(nativeChildren.size, 0, 'native decoder children are reaped')
    h.eq(streams.size, 0, 'all actual upload file streams are closed')
    h.eq(handles.size, 0, 'all actual merged-file descriptors are closed')
    h.eq(h.clients.size, 2, 'only harness and fixture service PG clients remain')
    const observed = http.requests.slice(first), decoded = decoders.slice(firstDecoder)
    h.ok(observed.every(row => row.handlerFinished), 'all native handlers finish before returning to test')
    h.eq(observed.some(row => row.method === 'DELETE' || row.method === 'PUT' || row.method === 'PATCH'), false, 'no candidate deletion, overwrite or direct table mutation')
    h.ok(fetchEvents.filter(row => row.path.startsWith('/storage/')).every(row => row.redirect === 'error' && row.cache === 'no-store'), 'all Storage requests disable redirects and caching')
    const storageResponses = fetchEvents.filter(row => row.readers)
    h.ok(storageResponses.every(row => row.readers.length ? row.readers.every(reader => reader.closed && reader.cancelCalled && reader.released)
      : row.bodyCancelCalled), 'all observed native Storage readers are closed, cancelled and released or bodies cancelled directly')
    h.ok(files.slice(firstFile).every(row => row.closed), 'every tracked local descriptor is closed')
    const persisted = await boundary(f)
    const entry = { name, elapsedMs: performance.now() - started, status: result?.status ?? null,
      error: error ? { code: error.code ?? null, message: error.message } : null, requests: observed.length,
      heartbeats: observed.filter(row => row.action === 'heartbeat').length, decoders: decoded.length,
      candidateStates: persisted.candidates.map(row => row.state), objectCount: persisted.candidates.filter(row => http.objects.has(row.object_key)).length }
    entry.nativeBodyObservations = storageResponses.map(row => ({ method: row.method, bodyCancelCalled: row.bodyCancelCalled, readers: row.readers }))
    ;(h.report.applicationCases ??= []).push(entry)
    if (error) h.eq(error.message, 'recording_worker_unavailable', 'application failure is fixed and redacted')
    return { f, result, error, observed, decoded, persisted, entry }
  }
  function retained(value, state = 'reserved', object = true) {
    h.ok(value.error, 'uncertain or invalid candidate never returns success')
    h.eq(value.result, undefined, 'no apparent success receipt on failure')
    h.eq(value.persisted.candidates.length, 1, 'one attempt retains exactly one immutable candidate')
    h.eq(value.persisted.candidates[0].state, state, 'persisted candidate remains at committed phase')
    const key = value.persisted.candidates[0].object_key
    h.eq(http.objects.has(key), object, 'unknown outcome retains any committed object without cleanup')
    h.eq(value.observed.filter(row => row.rpc === 'candidate' && row.action === 'reserve').length, 1, 'reserve never retries')
    h.eq(value.observed.filter(row => row.kind === 'candidate-upload').length, object ? 1 : 0, 'upload never retries')
    if (object && value.entry.name !== 'native-object-conflict') h.eq(http.objects.get(key).sha256, digest(bytes), 'stored object stays original and intact despite response fault')
  }
  async function recoverUnknown(f) {
    const ms = Number((await h.db.query('SELECT greatest(0,extract(epoch FROM (lease_expires_at-clock_timestamp()))*1000) AS ms FROM processing_jobs WHERE id=$1', [f.jobId])).rows[0].ms)
    h.ok(ms < 2000, 'explicit recovery awaits bounded real lease expiry')
    await delay(Math.ceil(ms) + 50)
    h.eq((await h.db.query('SELECT lease_expires_at<clock_timestamp() AS expired FROM processing_jobs WHERE id=$1', [f.jobId])).rows[0].expired, true, 'database confirms actual expiry before recovery')
    const before = (await candidateState(h, f.jobId)).candidates
    h.eq((await rpc(service, f.jobId, 'recover')).state, 'outcome_unknown', 'dispatched loss requires explicit unknown outcome, never restart')
    h.eq((await candidateState(h, f.jobId)).candidates, before, 'explicit recovery preserves candidate evidence exactly')
  }
  try {
    await h.scenario('Native HTTP streamed upload/readback, real PG candidate RPC and FFmpeg survive renewed initial lease', async () => {
      const value = await execute('native-candidate-success-heartbeats', { readbackDelayMs: 1400 })
      if (value.error) throw value.error
      h.eq(value.result.status, 'candidate_prepared', 'actual production worker returns only private candidate prepared')
      h.eq(value.result.canClearLocalDrafts, false, 'local draft cleanup remains forbidden')
      h.eq(value.result.candidate.state, 'prepared', 'actual strict RPC receipt is prepared')
      h.eq(value.result.candidate.sha256, digest(bytes), 'full remote object matches actual merged audio hash')
      h.eq(value.result.candidate.byteSize, bytes.length, 'full remote object matches actual merged audio size')
      h.eq(value.persisted.candidates[0].state, 'prepared', 'prepare is durable in real PG')
      h.ok(value.entry.elapsedMs > options.leaseMs && value.entry.heartbeats >= 3, 'native I/O spans initial TTL with real lease heartbeats')
      h.eq(value.decoded.length, 1, 'one actual native full-stream decoder runs')
      h.ok(value.decoded[0].pcmBytes > 0 && value.decoded[0].code === 0, 'native decoder produces PCM and exits zero')
      h.eq(value.observed.at(-1).action, 'check', 'successful return follows final live fence check')
      h.eq(value.observed.filter(row => row.rpc === 'candidate').map(row => row.action), ['reserve', 'prepare'], 'only one reserve and prepare mutation')
      h.eq(value.observed.filter(row => row.kind.startsWith('candidate-')).map(row => row.kind), ['candidate-upload', 'candidate-readback'], 'one complete immutable upload then exact object readback')
    })
    for (const phase of ['reserve', 'upload', 'prepare']) await h.scenario(`Native ${phase} response loss retains committed evidence without retry or false success`, async () => {
      const value = await execute(`native-${phase}-response-lost`, { mode: `${phase}-response-lost`, options: { ioTimeoutMs: 500 } })
      retained(value, phase === 'prepare' ? 'prepared' : 'reserved', phase !== 'reserve')
      const lost = value.observed.filter(row => row.responseLost)
      h.eq(lost.length, 1, 'exactly one real committed operation loses its response')
      h.eq(lost[0].committed, true, 'native server commits before suppressing response')
      h.eq(lost[0].aborted, true, 'timeout closes native response and server PG connection')
      h.eq(value.observed.filter(row => row.kind === 'candidate-readback').length, phase === 'prepare' ? 1 : 0, 'unknown reserve or upload response prevents all later readback')
      h.eq(value.observed.filter(row => row.rpc === 'candidate' && row.action === 'prepare').length, phase === 'prepare' ? 1 : 0, 'no later prepare after uncertain earlier phase')
      await recoverUnknown(value.f)
    })
    await h.scenario('Existing native Storage object conflicts and remains immutable', async () => {
      const value = await execute('native-object-conflict', { mode: 'conflict' })
      retained(value)
      h.eq(http.objects.get(value.persisted.candidates[0].object_key).bytes.toString(), 'preexisting-immutable-object', 'conflicting object bytes never overwritten')
      h.eq(value.observed.some(row => row.kind === 'candidate-readback' || row.action === 'prepare'), false, 'conflict prevents readback and preparation')
    })
    for (const mode of ['short', 'long', 'hash-corrupt', 'stall', 'redirect', 'encoding']) await h.scenario(`Native readback ${mode} fails closed, retains object and closes readers`, async () => {
      const value = await execute(`native-readback-${mode}`, { mode, options: { ioTimeoutMs: 500 } })
      retained(value)
      h.eq(value.observed.filter(row => row.kind === 'candidate-readback').length, 1, 'one real readback request, never retry')
      h.eq(value.observed.some(row => row.action === 'prepare'), false, 'invalid readback never reaches prepare RPC')
      h.eq(value.observed.some(row => row.path === '/unexpected-redirect'), false, 'native fetch never follows redirect')
      const readback = value.observed.find(row => row.kind === 'candidate-readback')
      if (mode === 'short') h.eq(readback.responseBytes, bytes.length - 1, 'native peer actually transmits a truncated body without a length header')
      if (mode === 'long') h.eq(readback.responseBytes, bytes.length + 1, 'native peer actually transmits excess bytes without a length header')
      if (mode === 'hash-corrupt') {
        h.eq(readback.responseBytes, bytes.length, 'corrupt native body retains exact length')
        h.ok(readback.responseSha256 !== digest(bytes), 'corrupt native body differs by content hash')
      }
      if (mode === 'encoding') h.eq(readback.responseEncoding, 'gzip', 'native peer actually emits a non-identity encoded body')
      if (mode === 'stall') h.eq(value.observed.find(row => row.kind === 'candidate-readback').aborted, true, 'stalled remote stream is actively cancelled')
    })
    for (const mode of ['cancel', 'job-cancel', 'revoke']) await h.scenario(`Native readback ${mode} stops owned network, files and heartbeat with no later prepare`, async () => {
      const value = await execute(`native-readback-${mode}`, { mode })
      retained(value)
      h.eq(value.observed.some(row => row.action === 'prepare'), false, 'cancellation or revocation prevents prepare RPC')
      h.eq(value.observed.find(row => row.kind === 'candidate-readback').aborted, true, 'owned native readback connection aborts')
      if (mode !== 'cancel') h.eq((await rpc(service, value.f.jobId, 'recover')).state, 'cancelled', 'actual permission/job cancellation guard permits only cancelled recovery')
      if (mode === 'revoke') await h.db.query("UPDATE project_roles SET status='active' WHERE project_id=$1 AND user_id=$2", [PROJECT, USER])
    })
    for (const phase of ['upload', 'prepare']) await h.scenario(`Actual worker SIGKILL after ${phase} commit preserves evidence; parent reaps resources and recovers unknown`, async () => {
      const name = `native-child-kill-${phase}`, childTemp = join(h.scratch, name)
      await mkdir(childTemp)
      const f = await fixture(h, service, modules.prepareRecordingSessionSeal, bytes)
      let checkpoint
      const reached = new Promise(resolve => { checkpoint = resolve })
      http.setCase({ name, f, mode: `kill-${phase}`, checkpoint: (actual, event) => checkpoint({ actual, event }) })
      const first = http.requests.length, childEvents = []
      const child = originalSpawn(process.execPath, [join(root, 'experiments/pg17-recording-candidates/worker-child-application.mjs')], {
        cwd: root, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      })
      children.add(child)
      let stderr = ''
      child.stderr.on('data', value => { stderr += value.toString() })
      child.stdout.resume()
      child.on('message', event => { childEvents.push(event); h.report.childEvents.push(event) })
      const exited = once(child, 'exit')
      child.once('exit', (code, signal) => { children.delete(child); h.report.childEvents.push({ type: 'exit', pid: child.pid, code, signal }) })
      let timer
      try {
        const ready = await once(child, 'message')
        h.eq(ready[0].type, 'ready', 'isolated application child starts')
        child.send({ jobId: f.jobId, workerModule: modules.workerModule, loopback: http.loopback,
          options: { ...options, tempRoot: childTemp, ioTimeoutMs: 5000, leaseMs: 2000, rpcTimeoutMs: 800 } })
        const value = await Promise.race([reached, exited.then(() => { throw new Error(`Child exited before checkpoint: ${stderr.slice(0, 200)}`) }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Native child checkpoint timeout')), 15000) })])
        h.eq(value.actual, phase, 'child reaches intended actual committed phase')
        h.eq(value.event.committed, true, 'server committed native operation before SIGKILL')
        child.kill('SIGKILL')
        h.eq(await exited, [null, 'SIGKILL'], 'actual application process terminated by SIGKILL')
        await http.settle()
        h.eq(childEvents.some(event => event.type === 'unexpected-result' || event.type === 'unexpected-error'), false, 'killed worker never reports success or graceful error')
        const afterExit = http.requests.length
        await delay(200)
        h.eq(http.requests.length, afterExit, 'no new heartbeat or prepare from dead process')
        const persisted = await boundary(f)
        h.eq(persisted.candidates.length, 1, 'process death retains registered candidate')
        h.eq(persisted.candidates[0].state, phase === 'prepare' ? 'prepared' : 'reserved', 'candidate survives kill at exact committed phase')
        const stored = http.objects.get(persisted.candidates[0].object_key)
        h.eq(stored.sha256, digest(bytes), 'process death retains complete remote object bytes')
        h.eq(digest(await readFile(stored.file)), digest(bytes), 'worker process death preserves independently persisted native object file')
        h.eq(http.requests.slice(first).filter(row => row.action === 'prepare').length, phase === 'prepare' ? 1 : 0, 'killed attempt never performs later preparation')
        const decoderEvents = childEvents.filter(event => event.type === 'native-spawn')
        h.eq(decoderEvents.length, 1, 'child invoked actual native decoder before upload')
        for (const event of decoderEvents) {
          h.ok(childEvents.some(closed => closed.type === 'native-close' && closed.decoderPid === event.decoderPid && closed.code === 0), 'decoder is reaped before network checkpoint')
          let gone = false
          try { process.kill(event.decoderPid, 0) } catch (error) { gone = error.code === 'ESRCH' }
          h.ok(gone, 'killed application leaves no native decoder process')
        }
        const leftovers = await readdir(childTemp)
        h.ok(leftovers.length > 0, 'SIGKILL honestly leaves scoped temporary artifacts, not graceful cleanup')
        await rm(childTemp, { recursive: true })
        h.eq(await exists(childTemp), false, 'parent removes only its isolated killed-child temp directory')
        h.eq(h.clients.size, 2, 'killed-child request PG clients have closed')
        await recoverUnknown(f)
        ;(h.report.applicationChildCases ??= []).push({ name, pid: child.pid, signal: 'SIGKILL', candidateState: persisted.candidates[0].state,
          objectSha256: stored.sha256, temporaryEntriesBeforeParentCleanup: leftovers.length, cleanup: 'parent-owned; not graceful', stderrSha256: digest(stderr) })
      } finally {
        clearTimeout(timer)
        if (children.has(child)) { child.kill('SIGKILL'); await exited }
      }
    })
  } finally {
    cp.spawn = originalSpawn; fs.createReadStream = originalRead; fsp.open = originalOpen
    await Promise.all([...nativeChildren].map(async child => { const closed = once(child, 'close'); child.kill('SIGKILL'); await closed }))
    for (const stream of streams) stream.destroy()
    for (const handle of handles) await handle.close()
    await http.close()
    await h.close(service)
    h.report.applicationCleanup = { observersRestored: cp.spawn === originalSpawn && fs.createReadStream === originalRead && fsp.open === originalOpen,
      nativeChildrenRemaining: nativeChildren.size, streamsRemaining: streams.size, handlesRemaining: handles.size }
    h.report.limits.push('Actual compiled TypeScript and Supabase JS call a native loopback HTTP server. A strict PostgREST-shaped adapter translates requests to parameterized real PostgreSQL as service_role; it is not actual PostgREST.',
      'Synthetic Storage HTTP uses native streamed POST/GET and disk-backed bytes plus fixture metadata. Its HTTPS origin is rewritten only to 127.0.0.1 HTTP; real TLS, cloud Storage behavior and managed schema ownership are unqualified.',
      'Faults suppress committed server responses or alter native HTTP response bodies; PostgreSQL wire COMMIT acknowledgement loss is not simulated. SIGKILL bypasses graceful application cleanup; only the owning harness removes its isolated temporary artifacts.',
      'Only synthetic two-second sine-wave WebM/Opus and external native FFmpeg are qualified here; not device/long audio, deployment, backups, atomic publication or large manifests. No candidate is published or deleted and no local draft deletion is authorized.')
  }
}
