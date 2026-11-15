// Local-only HTTP/FFmpeg evidence. No environment files, remote services, or real credentials.
// SAGA_FFMPEG_PATH=/absolute/path/to/ffmpeg node scripts/verify-recording-job-input.cjs
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const childProcess = require('node:child_process')
const fs = require('node:fs/promises')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const ts = require('typescript')
const { createClient } = require('@supabase/supabase-js')

const root = path.resolve(__dirname, '..')
const output = path.join(root, 'docs/research/evidence/2026-11-03-g1-worker-input')
const runOutput = path.join(output, `run-${new Date().toISOString().replace(/[.:]/g, '-')}-${process.pid}`)
const digest = value => createHash('sha256').update(value).digest('hex')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const PROJECT = '11111111-1111-4111-8111-111111111111'
const SESSION = '22222222-2222-4222-8222-222222222222'
const USER = '33333333-3333-4333-8333-333333333333'
const STORY = '44444444-4444-4444-8444-444444444444'
const JOB = '55555555-5555-4555-8555-555555555555'
const DATE = '2026-11-02T00:00:00.000Z'
const SYNTHETIC_KEY = 'synthetic-local-only-no-permissions'
const nativeFetch = globalThis.fetch
const nativeSpawn = childProcess.spawn
const requests = []
const decoderEvents = []
const commands = []
const report = {
  timestamp: new Date().toISOString(),
  evidenceDirectory: runOutput,
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  limits: [
    'Synthetic data; actual Supabase JS query client and native Node fetch, but a loopback HTTP fixture replaces PostgREST and Storage.',
    'Production accepts HTTPS only. The injected Storage fetch translates exactly https://fixture.invalid to the loopback fixture; no real TLS, auth, RLS, PostgreSQL transaction or Storage-service acceptance is claimed.',
    'A transparent child_process.spawn observer delegates to the original spawn and observes the real FFmpeg PCM/close events to inject deterministic concurrent state changes. It never replaces decoder output.',
    'No claim, lease, database write, upload, publication, ready transition, cloud call, or local recording-draft cleanup. Optimistic rechecks are not an atomic revocation barrier.',
    'Native FFmpeg is supplied externally and is not deployment-qualified or OS-sandboxed by this experiment. Successful decode does not prove recording-tail completeness or real-device behavior.',
  ],
  checks: [], cases: [], fixtures: [], sourceSha256: {},
  g1Item01Complete: false, g1MilestoneSatisfied: false, pushConditionSatisfied: false,
}
let scratch
let server
let active
let executable
let localOrigin
let tempRoot
const children = new Set()
const sockets = new Set()

function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name)
  report.checks.push(name)
}

function command(args) {
  const result = childProcess.spawnSync(executable, args, { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 })
  commands.push({ executable, args, status: result.status, signal: result.signal,
    stdout: result.stdout, stderr: result.stderr, error: result.error?.message ?? null })
  if (result.error || result.status !== 0) throw new Error(`Local FFmpeg command failed: ${result.error?.message ?? result.stderr}`)
  return result.stdout
}

// Only fixture manifests use this closed ASCII/integer jsonb::text representation.
function pgText(value) {
  if (Array.isArray(value)) return `[${value.map(pgText).join(', ')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort((a, b) => a.length - b.length || (a < b ? -1 : 1))
      .map(key => `${JSON.stringify(key)}: ${pgText(value[key])}`).join(', ')}}`
  }
  return JSON.stringify(value)
}

async function compileModules() {
  const compiledRoot = path.join(scratch, 'compiled')
  const names = ['lib/recording-chunk-location', ...[
    'consent-deletion', 'processing-jobs', 'recording-merge', 'recording-merge-executor',
    'recording-processing-error', 'recording-audio-decoder', 'recording-session-service',
    'recording-job-lease', 'recording-job-input', 'recording-job-verifier',
  ].map(name => `lib/server/${name}`)]
  for (const name of names) {
    const source = await fs.readFile(path.join(root, `packages/web/src/${name}.ts`), 'utf8')
    report.sourceSha256[name] = digest(source)
    const result = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
      reportDiagnostics: true,
    })
    assert.equal(result.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0)
    const compiled = result.outputText.replace(/require\((['"])@\/([^'"]+)\1\)/g,
      (_match, _quote, alias) => `require(${JSON.stringify(path.join(compiledRoot, alias))})`)
    const destination = path.join(compiledRoot, `${name}.js`)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.writeFile(destination, compiled)
  }
  return {
    ...require(path.join(compiledRoot, 'lib/server/recording-session-service.js')),
    ...require(path.join(compiledRoot, 'lib/server/recording-job-verifier.js')),
  }
}

function fixture(prepareRecordingSessionSeal, bytes, mimeType) {
  const width = Math.ceil(bytes.length / 13)
  const chunks = []
  const objects = new Map()
  for (let offset = 0, index = 0; offset < bytes.length; offset += width, index++) {
    const body = Buffer.from(bytes.subarray(offset, offset + width))
    const objectKey = `projects/${PROJECT}/sessions/${SESSION}/${index}`
    chunks.push({ index, chunkId: `chunk-${index}`, bucket: 'audio-recordings', objectKey, byteSize: body.length, sha256: digest(body) })
    objects.set(`${USER}/${objectKey}`, body)
  }
  const sealed = prepareRecordingSessionSeal({ jobId: JOB, projectId: PROJECT, sessionId: SESSION,
    actorId: USER, actorRole: 'storyteller', actorActive: true, storyId: STORY, mimeType, chunks })
  const manifest = { schemaVersion: 1, projectId: PROJECT, sessionId: SESSION, userId: USER, storyId: STORY,
    assetId: sealed.task.assetId, mimeType, chunks: chunks.map(chunk => ({ ...chunk, storageObjectKey: `${USER}/${chunk.objectKey}` })) }
  const rows = {
    processing_jobs: [{ id: JOB, project_id: PROJECT, asset_id: sealed.task.assetId, created_by: USER,
      input_version: 1, job_type: 'recording_merge', processor_version: 'ffmpeg-merge-v1',
      parameter_version: 'default', model_config_version: 'none', idempotency_key: sealed.task.idempotencyKey,
      state: 'queued', attempt_count: 0, max_attempts: 3, not_before: null, lease_owner: null,
      lease_expires_at: null, cancel_requested_at: null, result_ref: null, error_code: null }],
    media_assets: [{ ...sealed.assetRecord, parent_asset_id: null, original_filename: 'unnamed-asset',
      sha256: null, duration_ms: null, verified_at: null, content_verified_at: null, verification_error: null }],
    recording_sessions: [{ id: SESSION, project_id: PROJECT, user_id: USER, story_id: STORY, mime_type: mimeType,
      state: 'sealing', total_chunks: chunks.length, total_input_bytes: bytes.length,
      manifest_sha256: digest(pgText(manifest)), started_at: DATE, sealed_at: DATE,
      confirmed_asset_id: null, merge_job_id: null, confirmed_at: null, seal_input: manifest }],
    recording_chunks: chunks.map(chunk => ({ id: `77777777-7777-4777-8777-${String(chunk.index).padStart(12, '0')}`,
      session_id: SESSION, project_id: PROJECT, chunk_index: chunk.index, seal_chunk_id: chunk.chunkId,
      bucket: chunk.bucket, object_key: `${USER}/${chunk.objectKey}`, byte_size: chunk.byteSize,
      sha256: chunk.sha256, persisted_at: DATE })),
    projects: [{ id: PROJECT }],
    project_roles: [{ project_id: PROJECT, user_id: USER, role: 'storyteller', status: 'active' }],
    stories: [{ id: STORY, project_id: PROJECT, storyteller_id: USER }],
    deletion_requests: [],
  }
  return { rows, objects, sealed, manifest, bytes, mimeType, errors: [], mutations: [], decodeCalls: 0,
    streamMode: 'normal', initialObjectsHash: digest(Buffer.concat([...objects.values()])) }
}

function matchRows(rows, url) {
  const matches = rows.filter(row => [...url.searchParams].every(([key, filter]) => {
    if (['select', 'order', 'limit', 'offset'].includes(key)) return true
    if (filter.startsWith('eq.')) return String(row[key]) === filter.slice(3)
    if (filter.startsWith('cs.')) return Object.entries(JSON.parse(filter.slice(3))).every(([k, v]) => row[key]?.[k] === v)
    if (filter.startsWith('in.(')) return filter.slice(4, -1).split(',').includes(String(row[key]))
    if (filter === 'not.is.null') return row[key] !== null && row[key] !== undefined
    throw new Error(`Unsupported fixture filter: ${filter}`)
  }))
  if (url.searchParams.has('order')) {
    assert.equal(url.searchParams.get('order'), 'chunk_index.asc')
    matches.sort((a, b) => a.chunk_index - b.chunk_index)
  }
  return matches
}

function jsonResponse(res, status, body, headers = {}) {
  const content = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(content), ...headers })
  res.end(content)
}

async function handleRequest(req, res) {
  const state = active
  const url = new URL(req.url, localOrigin)
  const event = { case: state?.name ?? null, method: req.method, path: url.pathname, query: url.search,
    prefer: req.headers.prefer ?? null, accept: req.headers.accept ?? null,
    status: null, bytesSent: 0, finished: false, closed: false }
  requests.push(event)
  res.on('finish', () => { event.finished = true })
  res.on('close', () => { event.closed = true })
  try {
    assert.ok(state, 'HTTP calls need an active local case')
    assert.equal(req.method, 'GET', 'read-only harness refuses every HTTP write')
    assert.equal(req.headers.authorization, `Bearer ${SYNTHETIC_KEY}`)
    assert.equal(req.headers.apikey, SYNTHETIC_KEY)
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.slice('/rest/v1/'.length)
      assert.ok(Object.hasOwn(state.rows, table), 'only expected production tables may be read')
      assert.ok(req.headers.prefer?.includes('count=exact'), 'loader must request exact counts')
      const matches = matchRows(state.rows[table], url)
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = Math.min(1000, Number(url.searchParams.get('limit') ?? 1000))
      let page = matches.slice(offset, offset + limit)
      const select = url.searchParams.get('select')
      if (select !== '*') page = page.map(row => Object.fromEntries(select.split(',').map(key => key.trim()).map(key => [key, row[key]])))
      event.status = 200
      const range = page.length ? `${offset}-${offset + page.length - 1}/${matches.length}` : `*/${matches.length}`
      jsonResponse(res, 200, page, { 'content-range': range, 'range-unit': 'items' })
      return
    }
    const storagePrefix = '/storage/v1/object/audio-recordings/'
    assert.ok(url.pathname.startsWith(storagePrefix), 'only the private source-object route is allowed')
    assert.equal(url.search, '')
    const key = decodeURIComponent(url.pathname.slice(storagePrefix.length))
    assert.ok(state.manifest.chunks.some(chunk => chunk.storageObjectKey === key), 'only sealed physical keys may be read')
    state.onStorageRequest?.(key)
    let body = state.objects.get(key)
    if (!body) {
      event.status = 404
      jsonResponse(res, 404, { message: 'SECRET fixture provider detail must never escape' })
      return
    }
    event.status = state.streamMode === 'partial' ? 206 : 200
    const headers = { 'content-type': state.mimeType, 'content-length': body.length }
    if (state.streamMode === 'wrong-length') headers['content-length'] = body.length + 1
    if (['too-long', 'too-short'].includes(state.streamMode)) {
      delete headers['content-length']
      body = state.streamMode === 'too-long' ? Buffer.concat([body, Buffer.from([1])]) : body.subarray(0, -1)
    }
    if (state.streamMode === 'redirect') {
      event.status = 302
      res.writeHead(302, { location: 'https://must-not-follow.invalid/object' })
      res.end()
      return
    }
    res.writeHead(event.status, headers)
    res.flushHeaders()
    if (state.streamMode === 'stall') {
      res.write(body.subarray(0, 1))
      event.bytesSent = 1
      state.onStorageBytes?.(key)
      return
    }
    for (let offset = 0; offset < body.length && !res.destroyed; offset += 137) {
      const part = body.subarray(offset, offset + 137)
      res.write(part)
      event.bytesSent += part.length
      if (offset === 0) state.onStorageBytes?.(key)
      await new Promise(resolve => setImmediate(resolve))
    }
    if (!res.destroyed) res.end()
  } catch (error) {
    state?.errors.push(error.message)
    if (!res.headersSent) { event.status = 500; jsonResponse(res, 500, { message: 'Local fixture assertion failed' }) }
    else res.destroy()
  }
}

function observeDecoder() {
  childProcess.spawn = function (...args) {
    const state = active
    assert.equal(args[0], executable, 'decoder must execute the configured real native binary')
    const child = nativeSpawn.apply(this, args)
    children.add(child)
    state.decodeCalls++
    const event = { case: state.name, executable: args[0], args: args[1], pid: child.pid,
      startedAt: new Date().toISOString(), pcmBytes: 0, code: null, signal: null, closed: false }
    decoderEvents.push(event)
    child.stdout.on('data', bytes => {
      const first = event.pcmBytes === 0
      event.pcmBytes += bytes.length
      if (first) {
        event.firstPcmAt = new Date().toISOString()
        state.onFirstPcm?.()
      }
    })
    child.once('close', (code, signal) => {
      event.code = code
      event.signal = signal
      event.closed = true
      event.closedAt = new Date().toISOString()
      children.delete(child)
    })
    return child
  }
}

async function main() {
  report.sourceSha256['verification-script'] = digest(await fs.readFile(__filename))
  executable = process.env.SAGA_FFMPEG_PATH
  if (!executable || !path.isAbsolute(executable)) throw new Error('Set SAGA_FFMPEG_PATH to an absolute standalone FFmpeg executable path')
  report.runtime = { node: process.version, harnessPid: process.pid, supabaseJs: require('@supabase/supabase-js/package.json').version,
    ffmpegVersion: command(['-version']).split('\n')[0], ffmpegSha256: digest(await fs.readFile(executable)) }
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'saga-worker-input-evidence-'))
  tempRoot = path.join(scratch, 'attempts')
  await fs.mkdir(tempRoot)
  const { prepareRecordingSessionSeal, verifyRecordingJobInput } = await compileModules()
  server = http.createServer((req, res) => { void handleRequest(req, res) })
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  localOrigin = `http://127.0.0.1:${server.address().port}`
  report.fixtureServer = { pid: process.pid, origin: localOrigin, interface: '127.0.0.1' }
  const admin = createClient(localOrigin, SYNTHETIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const fetchStorage = (input, init) => {
    const url = new URL(String(input))
    assert.equal(url.origin, 'https://fixture.invalid', 'Storage fetch cannot escape the explicit fixture origin')
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'error')
    assert.equal(init.cache, 'no-store')
    return nativeFetch(`${localOrigin}${url.pathname}${url.search}`, init)
  }
  observeDecoder()

  const goldenChunk = { index: 0, chunkId: 'chunk-0', bucket: 'audio-recordings',
    objectKey: `projects/${PROJECT}/sessions/${SESSION}/0`, byteSize: 3, sha256: 'a'.repeat(64) }
  const goldenSeal = prepareRecordingSessionSeal({ projectId: PROJECT, sessionId: SESSION, actorId: USER,
    actorRole: 'storyteller', actorActive: true, storyId: STORY, jobId: JOB, mimeType: 'audio/webm', chunks: [goldenChunk] })
  const goldenManifest = { schemaVersion: 1, projectId: PROJECT, sessionId: SESSION, userId: USER, storyId: STORY,
    assetId: goldenSeal.task.assetId, mimeType: 'audio/webm',
    chunks: [{ ...goldenChunk, storageObjectKey: `${USER}/${goldenChunk.objectKey}` }] }
  check('fixture serializer matches the independently recorded PostgreSQL 14.17 golden', digest(pgText(goldenManifest)),
    'c4b187f47ca380860f2bf43bd67a737e69e2df25070133f4130ca5dadf086a36')

  async function run(name, input, configure = () => {}, expected = 'success', expectedDecodeCalls = 0) {
    active = input
    active.name = name
    const requestStart = requests.length
    const decoderStart = decoderEvents.length
    const started = Date.now()
    const controller = new AbortController()
    const options = { admin, storageUrl: 'https://fixture.invalid', serviceRoleKey: SYNTHETIC_KEY,
      ffmpeg: { executable, timeoutMs: 10000, maxDurationMs: 5000 }, tempRoot, fetch: fetchStorage,
      ioTimeoutMs: 2000, signal: controller.signal }
    const mutate = (label, callback) => { active.mutations.push(label); callback() }
    configure(input, options, controller, mutate)
    const initialRows = JSON.stringify(input.rows)
    let receipt
    let error
    try { receipt = await verifyRecordingJobInput(JOB, options) }
    catch (caught) { error = caught }
    await delay(30)
    const observed = requests.slice(requestStart)
    const decoded = decoderEvents.slice(decoderStart)
    const storage = observed.filter(request => request.path.startsWith('/storage/'))
    const result = { name, expected, elapsedMs: Date.now() - started, outcome: error ? 'rejected' : receipt?.status,
      error: error ? { name: error.name, message: error.message, code: error.code ?? null } : null,
      httpRequests: observed.length, databaseReads: observed.length - storage.length,
      storageReads: storage.length, storageBytesSent: storage.reduce((sum, item) => sum + item.bytesSent, 0),
      decoderCalls: input.decodeCalls, mutations: input.mutations, tempFilesAfter: await fs.readdir(tempRoot),
      decoderPcmBytes: decoded.reduce((sum, item) => sum + item.pcmBytes, 0),
      closedResponses: observed.filter(item => item.closed).length,
      abandonedResponsesClosed: storage.filter(item => item.closed && !item.finished).length,
      completion: receipt?.completion ?? null }
    report.cases.push(result)
    check(`${name}: fixture HTTP assertions`, input.errors, [])
    check(`${name}: all requests read-only`, observed.every(request => request.method === 'GET'), true)
    check(`${name}: temporary files removed`, result.tempFilesAfter, [])
    check(`${name}: native decoder children closed`, children.size, 0)
    check(`${name}: all HTTP responses closed`, observed.every(item => item.closed), true)
    check(`${name}: decoder invocation count`, input.decodeCalls, expectedDecodeCalls)
    if (name.includes('-during-')) check(`${name}: state-change hook actually ran`, input.mutations.length, 1)
    if (name.endsWith('-native-decode')) check(`${name}: observed actual native PCM before interruption`, result.decoderPcmBytes > 0, true)
    if (name.includes('-during-native-decode')) check(`${name}: real decode completed before final state rejection`, decoded[0].code, 0)
    if (input.mutations.length === 0) check(`${name}: database unchanged`, JSON.stringify(input.rows), initialRows)
    if (expected === 'success') {
      assert.ifError(error)
      check(`${name}: input verified, not ready`, receipt.status, 'input_verified')
      check(`${name}: local drafts must remain`, receipt.canClearLocalDrafts, false)
      check(`${name}: receipt exposes no artifact path`, Object.keys(receipt).sort(), ['canClearLocalDrafts', 'completion', 'jobId', 'status'])
      check(`${name}: original total bytes`, receipt.completion.outputByteSize, input.bytes.length)
      check(`${name}: original SHA-256`, receipt.completion.outputSha256, digest(input.bytes))
      check(`${name}: all immutable source chunks`, receipt.completion.chunks, input.sealed.task.chunks)
      check(`${name}: full decode near two seconds`, receipt.completion.durationMs >= 1900 && receipt.completion.durationMs <= 2150, true)
      check(`${name}: native decoder exited successfully`, decoded[0].code, 0)
      check(`${name}: actual PCM agrees with reported duration`, Math.ceil(result.decoderPcmBytes / 32), receipt.completion.durationMs)
      check(`${name}: each physical chunk fetched once`, storage.length, input.manifest.chunks.length)
      check(`${name}: physical source bytes unchanged`, digest(Buffer.concat([...input.objects.values()])), input.initialObjectsHash)
      check(`${name}: returned only after tombstone recheck`, observed.at(-1).path, '/rest/v1/deletion_requests')
    } else {
      check(`${name}: no success receipt`, receipt, undefined)
      assert.ok(error, `${name}: must reject`)
      check(`${name}: safe error`, error.code ?? error.message, expected)
      check(`${name}: no provider detail, path, or credential in error`, /SECRET|projects\/|synthetic-local|127\.0\.0\.1|original\.audio/.test(error.message), false)
    }
    if (input.streamMode === 'stall') {
      check(`${name}: bounded stalled I/O`, result.elapsedMs < 3000, true)
      check(`${name}: stalled body socket closed`, result.abandonedResponsesClosed >= 1, true)
    }
    process.stdout.write(`${name}: ${result.outcome}; http=${result.httpRequests}; storage=${result.storageReads}; decoder=${result.decoderCalls}; elapsed=${result.elapsedMs}ms; temp=0\n`)
    active = undefined
  }

  const formats = [
    { name: 'webm-opus', mime: 'audio/webm;codecs=opus', args: ['-c:a', 'libopus', '-f', 'webm'] },
    { name: 'ogg-opus', mime: 'audio/ogg;codecs=opus', args: ['-c:a', 'libopus', '-f', 'ogg'] },
    { name: 'fragmented-mp4-aac', mime: 'audio/mp4;codecs=mp4a.40.2', args: ['-c:a', 'aac', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4'] },
  ]
  let webm
  for (const format of formats) {
    const filename = path.join(scratch, `${format.name}.audio`)
    command(['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2', ...format.args, filename])
    const bytes = await fs.readFile(filename)
    if (!webm) webm = bytes
    const input = fixture(prepareRecordingSessionSeal, bytes, format.mime)
    await run(format.name, input, undefined, 'success', 1)
    report.fixtures.push({ name: format.name, mimeType: format.mime, byteSize: bytes.length, sha256: digest(bytes),
      chunkCount: input.manifest.chunks.length, manifestSha256: input.rows.recording_sessions[0].manifest_sha256,
      manifest: input.manifest })
    check(`${format.name}: synthetic input file unchanged`, digest(await fs.readFile(filename)), digest(bytes))
  }
  const fresh = (bytes = webm, mime = 'audio/webm;codecs=opus') => fixture(prepareRecordingSessionSeal, bytes, mime)
  await run('same-size-corrupt-source', fresh(), input => { [...input.objects.values()][0][0] ^= 255 }, 'recording_source_hash_mismatch')
  await run('missing-source-object', fresh(), input => { input.objects.delete(input.manifest.chunks[1].storageObjectKey) }, 'recording_input_unavailable')
  await run('matching-hash-undecodable-source', fresh(Buffer.from('not a media container'.repeat(100))), undefined, 'recording_input_unavailable', 1)
  for (const mode of ['partial', 'redirect', 'wrong-length']) {
    await run(`http-${mode}`, fresh(), input => { input.streamMode = mode }, 'recording_input_unavailable')
  }
  for (const mode of ['too-long', 'too-short']) {
    await run(`stream-${mode}`, fresh(), input => { input.streamMode = mode }, 'recording_source_size_mismatch')
  }
  await run('already-revoked-storyteller', fresh(), input => { input.rows.project_roles[0].status = 'removed' }, 'recording_input_unavailable')
  await run('role-revoked-during-fetch', fresh(), (input, _options, _controller, mutate) => {
    input.onStorageRequest = () => mutate('storyteller revoked at actual Storage request', () => { input.rows.project_roles[0].status = 'removed' })
  }, 'recording_input_unavailable')
  await run('story-owner-drift-during-fetch', fresh(), (input, _options, _controller, mutate) => {
    input.onStorageBytes = () => mutate('story owner changed during actual body streaming', () => { input.rows.stories[0].storyteller_id = PROJECT })
  }, 'recording_input_unavailable')
  await run('tombstone-during-fetch', fresh(), (input, _options, _controller, mutate) => {
    input.onStorageBytes = () => mutate('asset tombstoned during actual body streaming', () => {
      input.rows.deletion_requests.push({ project_id: PROJECT, subject_id: input.sealed.task.assetId, tombstone_at: DATE })
    })
  }, 'recording_input_unavailable')
  await run('state-drift-during-native-decode', fresh(), (input, _options, _controller, mutate) => {
    input.onFirstPcm = () => mutate('queued job changed to running after real PCM output', () => { input.rows.processing_jobs[0].state = 'running' })
  }, 'recording_input_unavailable', 1)
  await run('tombstone-during-native-decode', fresh(), (input, _options, _controller, mutate) => {
    input.onFirstPcm = () => mutate('session tombstoned after real PCM output', () => {
      input.rows.deletion_requests.push({ project_id: PROJECT, subject_id: SESSION, tombstone_at: DATE })
    })
  }, 'recording_input_unavailable', 1)
  await run('stalled-body-timeout', fresh(), (input, options) => { input.streamMode = 'stall'; options.ioTimeoutMs = 100 }, 'recording_input_unavailable')
  await run('caller-cancelled-body', fresh(), (input, _options, controller) => {
    input.streamMode = 'stall'
    input.onStorageBytes = () => { setTimeout(() => controller.abort(new Error('synthetic caller cancelled')), 50) }
  }, 'recording_input_unavailable')
  await run('caller-cancelled-native-decode', fresh(), (input, _options, controller) => {
    input.onFirstPcm = () => controller.abort(new Error('synthetic caller cancelled'))
  }, 'recording_input_unavailable', 1)
  await run('caller-cancelled-before-load', fresh(), (_input, _options, controller) => { controller.abort() }, 'recording_input_unavailable')
  report.status = 'passed'
}

main().catch(error => {
  report.status = 'failed'
  report.error = { message: error.message, stack: error.stack }
  process.exitCode = 1
}).finally(async () => {
  childProcess.spawn = nativeSpawn
  if (children.size) {
    const pending = [...children].map(child => new Promise(resolve => { child.once('close', resolve); child.kill('SIGKILL') }))
    await Promise.all(pending)
  }
  if (server) {
    for (const socket of sockets) socket.destroy()
    await new Promise(resolve => server.close(resolve))
  }
  if (scratch) await fs.rm(scratch, { recursive: true, force: true })
  report.cleanup = { decoderChildrenRemaining: children.size, socketsRemaining: sockets.size,
    decoderPids: decoderEvents.map(event => event.pid), fixtureServerPid: server ? process.pid : null,
    serverClosed: server ? !server.listening : true,
    scratchRemoved: scratch ? await fs.stat(scratch).then(() => false, error => error.code === 'ENOENT') : true,
    spawnObserverRestored: childProcess.spawn === nativeSpawn }
  report.totals = { checks: report.checks.length, cases: report.cases.length, fixtures: report.fixtures.length,
    httpRequests: requests.length, databaseReads: requests.filter(item => item.path.startsWith('/rest/')).length,
    storageReads: requests.filter(item => item.path.startsWith('/storage/')).length, decoderInvocations: decoderEvents.length,
    nonGetRequests: requests.filter(item => item.method !== 'GET').length }
  report.sourceSha256After = {}
  for (const name of Object.keys(report.sourceSha256)) {
    const filename = name === 'verification-script' ? __filename : path.join(root, `packages/web/src/${name}.ts`)
    report.sourceSha256After[name] = digest(await fs.readFile(filename))
  }
  report.sourcesChangedDuringRun = Object.keys(report.sourceSha256).filter(name => report.sourceSha256[name] !== report.sourceSha256After[name])
  if (report.sourcesChangedDuringRun.length || children.size || sockets.size || !report.cleanup.scratchRemoved ||
    !report.cleanup.serverClosed || !report.cleanup.spawnObserverRestored) {
    report.status = 'failed'
    report.error ??= { message: 'Final source-stability or cleanup check failed' }
    process.exitCode = 1
  }
  await fs.mkdir(output, { recursive: true })
  await fs.mkdir(runOutput)
  await fs.writeFile(path.join(runOutput, 'input-results.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  await fs.writeFile(path.join(runOutput, 'input-http-requests.json'), `${JSON.stringify(requests, null, 2)}\n`, { flag: 'wx' })
  await fs.writeFile(path.join(runOutput, 'input-ffmpeg-events.json'), `${JSON.stringify({ commands, decoderEvents }, null, 2)}\n`, { flag: 'wx' })
  process.stdout.write(`${JSON.stringify({ status: report.status, evidenceDirectory: runOutput, totals: report.totals,
    cleanup: report.cleanup, sourcesChangedDuringRun: report.sourcesChangedDuringRun, error: report.error ?? null }, null, 2)}\n`)
})
