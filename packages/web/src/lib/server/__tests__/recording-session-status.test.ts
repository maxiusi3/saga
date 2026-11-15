/** @jest-environment node */
import { readRecordingSessionStatus } from '../recording-session-status'
import { ACTOR, PROJECT, SESSION, JOB, OTHER, TIME, ERROR, manifestHash, statusFixture, statusTransport } from '../test-support/recording-status-fixture'

type Fixture = ReturnType<typeof statusFixture>
type Row = Record<string, unknown>
const read = (f: Fixture) => readRecordingSessionStatus(f.input, { admin: statusTransport(f.snapshot).admin })

it.each(['succeeded', 'failed'] as const)('certifies the complete %s tuple into a closed immutable receipt', async state => {
  const f = statusFixture(state), t = statusTransport(f.snapshot)
  const before = structuredClone(f.snapshot)
  const result = await readRecordingSessionStatus(f.input, { admin: t.admin })
  expect(result).toEqual({ schemaVersion: 1, projectId: PROJECT, sessionId: SESSION, assetId: f.sealed.task.assetId,
    jobId: JOB, manifestSha256: f.input.manifestSha256, observedAt: TIME[7], state,
    content: state === 'succeeded' ? { byteSize: 3, sha256: 'b'.repeat(64), mimeType: 'audio/webm', durationMs: 10 } : null,
    errorCode: state === 'succeeded' ? null : 'recording_source_missing', finishedAt: TIME[6], canClearLocalDrafts: false })
  expect(Object.isFrozen(result)).toBe(true)
  if (state === 'succeeded') expect(Object.isFrozen((result as Row).content)).toBe(true)
  expect(f.snapshot).toEqual(before)
  expect(t.requests).toHaveLength(1)
  expect(t.requests[0].url.pathname).toBe('/rest/v1/rpc/read_recording_session_snapshot')
  expect(JSON.parse(String(t.requests[0].init.body))).toEqual({ p_actor_id: ACTOR, p_project_id: PROJECT,
    p_session_id: SESSION, p_manifest_sha256: f.input.manifestSha256 })
  expect(t.requests[0].init.signal).toBeInstanceOf(AbortSignal)
})

it.each(['sealed-only', 'asset-only', 'queued', 'leased', 'running', 'expired-running', 'reserved', 'prepared', 'outcome_unknown', 'retry_wait', 'max-attempts'])
('reports valid %s as unresolved without granting retry or cleanup', async mode => {
  const f = statusFixture(['sealed-only', 'asset-only', 'queued'].includes(mode) ? 'queued' : 'running')
  if (mode === 'sealed-only') { f.snapshot.asset = null; f.snapshot.jobs = [] }
  if (mode === 'asset-only') f.snapshot.jobs = []
  if (mode === 'leased') { f.job.state = 'leased'; f.attempt.result_state = 'leased'; f.attempt.dispatched_at = null }
  if (mode === 'expired-running') f.job.lease_expires_at = TIME[4]
  if (mode === 'reserved' || mode === 'prepared' || mode === 'outcome_unknown') {
    f.snapshot.candidates.push(f.candidate)
    if (mode === 'reserved') { f.candidate.state = 'reserved'; f.candidate.prepared_at = null }
  }
  if (mode === 'outcome_unknown' || mode === 'retry_wait' || mode === 'max-attempts') {
    const failed = mode === 'max-attempts'
    Object.assign(f.job, { state: failed ? 'failed' : mode, lease_owner: null, lease_expires_at: null,
      updated_at: TIME[6], not_before: mode === 'retry_wait' ? TIME[6] : null,
      error_code: mode === 'outcome_unknown' ? 'lease_expired_after_dispatch_unknown'
        : failed ? 'lease_expired_before_dispatch_max_attempts' : 'lease_expired_before_dispatch' })
    Object.assign(f.attempt, { result_state: mode === 'outcome_unknown' ? mode : failed ? 'fatal_error' : 'retryable_error',
      finished_at: TIME[6], error_code: f.job.error_code, dispatched_at: mode === 'outcome_unknown' ? TIME[3] : null })
    if (failed) {
      f.job.attempt_count = 3; f.attempt.attempt_no = 3
      f.snapshot.attempts.unshift(...[1, 2].map(n => ({ ...f.attempt, id: `88888888-8888-4888-8888-00000000000${n}`,
        attempt_no: n, result_state: 'retryable_error', finished_at: TIME[n + 2], error_code: 'lease_expired_before_dispatch' })))
    }
  }
  await expect(read(f)).resolves.toMatchObject({ state: 'unresolved', content: null, errorCode: null, finishedAt: null,
    jobId: f.snapshot.jobs.length ? JOB : null, canClearLocalDrafts: false })
})

it.each(['recording_source_missing', 'recording_source_not_private_file', 'recording_source_size_mismatch',
  'recording_source_hash_mismatch', 'recording_decode_invalid_pcm', 'recording_decode_duration_exceeded'])
('accepts only the complete permanent failure for %s', async code => {
  const f = statusFixture('failed'); f.job.error_code = code; f.asset.verification_error = code; f.attempt.error_code = code
  await expect(read(f)).resolves.toMatchObject({ state: 'failed', errorCode: code, content: null })
})

const corruptions: Array<[string, (f: Fixture) => void]> = [
  ['schema extra', f => { Object.assign(f.snapshot, { leaked: true }) }],
  ['schema missing', f => { delete (f.snapshot as unknown as Row).observedAt }],
  ['schema version', f => { f.snapshot.schemaVersion = 2 }],
  ...['actorId', 'projectId', 'sessionId', 'manifestSha256'].map(key => [key, (f: Fixture) => {
    (f.snapshot as unknown as Row)[key] = key === 'manifestSha256' ? 'c'.repeat(64) : OTHER
  }] as [string, (f: Fixture) => void]),
  ...[0, 2, '1'].map(value => [`session count ${value}`, (f: Fixture) => { (f.snapshot as unknown as Row).matchingSessionCount = value }] as [string, (f: Fixture) => void]),
  ['asset absent', f => { f.snapshot.asset = null }], ['job absent', f => { f.snapshot.jobs = [] }],
  ['duplicate job', f => { f.snapshot.jobs.push({ ...f.job }) }], ['candidate absent', f => { f.snapshot.candidates = [] }],
  ['candidate duplicated', f => { f.snapshot.candidates.push({ ...f.candidate, id: OTHER }) }],
  ['attempt absent', f => { f.snapshot.attempts = [] }], ['attempt duplicate', f => { f.snapshot.attempts.push({ ...f.attempt }) }],
  ['chunks extra', f => { f.snapshot.chunks.push({ ...f.snapshot.chunks[0] }) }], ['chunks missing', f => { f.snapshot.chunks = [] }],
  ['manifest extra', f => { Object.assign(f.manifest, { secret: true }); rehash(f) }],
  ['manifest storage', f => { f.manifest.chunks[0].storageObjectKey += '/other'; rehash(f) }],
  ['manifest hash', f => { f.manifest.chunks[0].sha256 = 'c'.repeat(64) }],
  ['manifest different asset', f => { f.manifest.assetId = OTHER; rehash(f) }],
  ['manifest wrong ordinal', f => { f.manifest.chunks[0].index = 1; rehash(f) }],
  ['manifest quota', f => { f.manifest.chunks[0].byteSize = 104857601; rehash(f) }],
]
function rehash(f: Fixture) { f.input.manifestSha256 = f.snapshot.manifestSha256 = String(f.session.manifest_sha256 = manifestHash(f.manifest)) }
const rowFields: Array<[keyof Pick<Fixture, 'asset' | 'session' | 'job' | 'attempt' | 'candidate'>, string, unknown]> = [
  ['session', 'id', OTHER], ['session', 'project_id', OTHER], ['session', 'user_id', OTHER], ['session', 'story_id', null],
  ['session', 'mime_type', 'audio/ogg'], ['session', 'manifest_sha256', 'c'.repeat(64)], ['session', 'total_input_bytes', 4],
  ['session', 'total_chunks', 2], ['session', 'confirmed_asset_id', OTHER], ['session', 'merge_job_id', OTHER],
  ['session', 'state', 'sealing'], ['session', 'confirmed_at', TIME[5]], ['session', 'sealed_at', TIME[8]],
  ['session', 'started_at', TIME[2]], ['session', 'sealed_at', null],
  ['asset', 'state', 'verifying'], ['asset', 'project_id', OTHER], ['asset', 'created_by', OTHER], ['asset', 'story_id', null],
  ['asset', 'kind', 'derived_audio'], ['asset', 'version', 2], ['asset', 'idempotency_key', 'bad'], ['asset', 'id', OTHER],
  ['asset', 'original_filename', 'changed'], ['asset', 'parent_asset_id', OTHER], ['asset', 'verification_error', 'oops'],
  ['asset', 'bucket', 'audio-recordings'], ['asset', 'object_key', 'wrong/key'], ['asset', 'sha256', 'c'.repeat(64)],
  ['asset', 'byte_size', 4], ['asset', 'mime_type', 'audio/ogg'], ['asset', 'duration_ms', 11],
  ['asset', 'verified_at', TIME[5]], ['asset', 'content_verified_at', null], ['asset', 'updated_at', TIME[5]],
  ['asset', 'created_at', TIME[8]],
  ['job', 'id', OTHER], ['job', 'asset_id', OTHER], ['job', 'project_id', OTHER], ['job', 'created_by', OTHER],
  ['job', 'job_type', 'transcribe'], ['job', 'processor_version', 'other'], ['job', 'input_version', 2],
  ['job', 'parameter_version', 'other'], ['job', 'model_config_version', 'model'], ['job', 'idempotency_key', 'bad'],
  ['job', 'state', 'running'], ['job', 'max_attempts', 4], ['job', 'attempt_count', 0], ['job', 'attempt_count', 1.5],
  ['job', 'result_ref', OTHER], ['job', 'lease_owner', 'worker-1'], ['job', 'lease_expires_at', TIME[8]],
  ['job', 'not_before', TIME[2]], ['job', 'error_code', 'secret'], ['job', 'updated_at', TIME[5]], ['job', 'created_at', TIME[4]],
  ['attempt', 'id', 'INVALID'], ['attempt', 'job_id', OTHER], ['attempt', 'attempt_no', 2], ['attempt', 'worker_id', '../bad'],
  ['attempt', 'result_state', 'running'], ['attempt', 'error_code', 'secret'], ['attempt', 'finished_at', TIME[5]],
  ['attempt', 'dispatched_at', null], ['attempt', 'dispatched_at', TIME[7]],
  ...['provider', 'provider_request_id', 'usage_units', 'reserved_cost_usd', 'settled_cost_usd']
    .map(key => ['attempt', key, 'secret'] as ['attempt', string, unknown]),
  ['candidate', 'job_id', OTHER], ['candidate', 'project_id', OTHER], ['candidate', 'asset_id', OTHER], ['candidate', 'session_id', OTHER],
  ['candidate', 'manifest_sha256', 'c'.repeat(64)], ['candidate', 'worker_id', 'different'], ['candidate', 'attempt_no', 2],
  ['candidate', 'state', 'reserved'], ['candidate', 'object_key', 'wrong/key'], ['candidate', 'bucket', 'audio-recordings'],
  ['candidate', 'byte_size', 4], ['candidate', 'sha256', 'B'.repeat(64)], ['candidate', 'mime_type', 'audio/ogg'],
  ['candidate', 'duration_ms', 0], ['candidate', 'created_at', TIME[2]], ['candidate', 'prepared_at', TIME[7]],
]
corruptions.push(...rowFields.map(([row, key, value]) => [`${row}.${key}`, (f: Fixture) => { f[row][key] = value }] as [string, (f: Fixture) => void]))
it.each(corruptions)('rejects corrupt published %s', async (_label, corrupt) => {
  const f = statusFixture(); corrupt(f); await expect(read(f)).rejects.toThrow(ERROR)
})

it.each(['session', 'asset', 'job', 'attempt', 'candidate', 'chunk'])('rejects optional blockers on %s', async name => {
  for (const key of ['tombstone_at', 'deletion_requested_at', 'deleted_at', 'cancel_requested_at']) {
    const f = statusFixture(), row = name === 'chunk' ? f.snapshot.chunks[0] : f[name as 'session']
    row[key] = TIME[4]; await expect(read(f)).rejects.toThrow(ERROR)
  }
})
it.each(['session', 'asset', 'job', 'attempt', 'candidate', 'chunk'])('rejects invalid UTC/microsecond dates on %s', async name => {
  const field = { session: 'sealed_at', asset: 'created_at', job: 'created_at', attempt: 'dispatched_at', candidate: 'created_at', chunk: 'persisted_at' }[name]!
  for (const value of ['2026-02-30T00:00:00Z', '2026-11-05T00:00:00.0000001Z', '2026-11-05T00:00:00+01:00', '2026-11-05', 'infinity', 0]) {
    const f = statusFixture(), row = name === 'chunk' ? f.snapshot.chunks[0] : f[name as 'session']
    row[field] = value; await expect(read(f)).rejects.toThrow(ERROR)
  }
})
it('accepts equivalent UTC timestamp representations while retaining microsecond ordering', async () => {
  const f = statusFixture(); f.session.confirmed_at = TIME[6].replace('Z', '+00:00')
  await expect(read(f)).resolves.toMatchObject({ state: 'succeeded' })
  f.attempt.finished_at = TIME[5]
  await expect(read(f)).rejects.toThrow(ERROR)
})
it('rejects terminal evidence beyond the statement observation, including one microsecond', async () => {
  const f = statusFixture(); f.snapshot.observedAt = TIME[5]
  await expect(read(f)).rejects.toThrow(ERROR)
})
it.each(['observedAt', 'session'])('rejects malformed observation/schema values %s', async mode => {
  const f = statusFixture(); (f.snapshot as unknown as Row)[mode] = mode === 'session' ? [] : '2026-02-30T00:00:00Z'
  await expect(read(f)).rejects.toThrow(ERROR)
})

it('certifies contiguous undispatched retry history in chronological order', async () => {
  const f = statusFixture(); f.job.attempt_count = 2; f.attempt.attempt_no = 2; f.candidate.attempt_no = 2
  f.candidate.object_key = String(f.candidate.object_key).replace('/attempts/1/', '/attempts/2/'); f.asset.object_key = f.candidate.object_key
  f.snapshot.attempts.unshift({ ...f.attempt, id: JOB, attempt_no: 1, dispatched_at: null,
    result_state: 'retryable_error', finished_at: TIME[2], error_code: 'lease_expired_before_dispatch' })
  await expect(read(f)).resolves.toMatchObject({ state: 'succeeded' })
  for (const [field, value] of [['attempt_no', 0], ['job_id', OTHER], ['id', OTHER], ['dispatched_at', TIME[2]],
    ['finished_at', TIME[4]], ['error_code', 'other'], ['result_state', 'outcome_unknown'], ['provider', 'private']] as const) {
    const prior = f.snapshot.attempts[0], old = prior[field]; prior[field] = value
    await expect(read(f)).rejects.toThrow(ERROR); prior[field] = old
  }
})
it.each(['partial-success', 'partial-failure', 'candidate', 'mismatched-code', 'generic-code', 'successful-content', 'wrong-pointer'])
('does not certify corrupt permanent failure %s', async mode => {
  const f = statusFixture('failed')
  if (mode === 'partial-success') f.session.confirmed_asset_id = f.sealed.task.assetId
  if (mode === 'partial-failure') f.asset.state = 'verifying'
  if (mode === 'candidate') f.snapshot.candidates.push(f.candidate)
  if (mode === 'mismatched-code') f.attempt.error_code = 'recording_decode_invalid_pcm'
  if (mode === 'generic-code') f.job.error_code = f.asset.verification_error = f.attempt.error_code = 'unknown-failure'
  if (mode === 'successful-content') f.asset.sha256 = 'b'.repeat(64)
  if (mode === 'wrong-pointer') f.asset.object_key = f.candidate.object_key
  await expect(read(f)).rejects.toThrow(ERROR)
})
it.each(['success-fragment', 'failure-fragment', 'job-no-asset', 'candidate-no-job', 'attempt-no-job', 'bad-running-history', 'bad-running-lease', 'bad-candidate-history'])
('rejects unresolved corruption %s', async mode => {
  const f = statusFixture('running')
  if (mode === 'success-fragment') f.session.confirmed_at = TIME[6]
  if (mode === 'failure-fragment') f.job.error_code = 'recording_source_missing'
  if (mode === 'job-no-asset') f.snapshot.asset = null
  if (mode === 'candidate-no-job') { f.snapshot.jobs = []; f.snapshot.attempts = []; f.snapshot.candidates.push(f.candidate) }
  if (mode === 'attempt-no-job') f.snapshot.jobs = []
  if (mode === 'bad-running-history') f.attempt.finished_at = TIME[6]
  if (mode === 'bad-running-lease') f.job.lease_expires_at = TIME[2]
  if (mode === 'bad-candidate-history') { f.candidate.worker_id = 'old-worker'; f.snapshot.candidates.push(f.candidate) }
  await expect(read(f)).rejects.toThrow(ERROR)
})
it.each(['session_id', 'project_id', 'chunk_index', 'seal_chunk_id', 'bucket', 'object_key', 'byte_size', 'sha256', 'id'])
('rejects chunk ledger identity mismatch %s', async field => {
  const f = statusFixture(); f.snapshot.chunks[0][field] = field === 'chunk_index' || field === 'byte_size' ? 99 : 'wrong'
  await expect(read(f)).rejects.toThrow(ERROR)
})

it.each(['actorId', 'projectId', 'sessionId', 'manifestSha256'])('rejects noncanonical %s before I/O', async key => {
  for (const value of ['UPPER', '', null, ` ${ACTOR}`, 123]) {
    const f = statusFixture(), t = statusTransport(f.snapshot); (f.input as Row)[key] = value
    await expect(readRecordingSessionStatus(f.input, { admin: t.admin })).rejects.toThrow(ERROR)
    expect(t.requests).toHaveLength(0)
  }
})
it.each([0, -1, 60001, 1.5, NaN, Infinity])('rejects invalid timeout %s before I/O', async timeoutMs => {
  const f = statusFixture(), t = statusTransport(f.snapshot)
  await expect(readRecordingSessionStatus(f.input, { admin: t.admin, timeoutMs })).rejects.toThrow(ERROR)
  expect(t.requests).toHaveLength(0)
})
it.each(['lost', 'malformed', 'rpc-error', 'missing-data'])('sanitizes %s transport and never retries', async mode => {
  const f = statusFixture(), t = statusTransport(f.snapshot)
  if (mode === 'lost') t.setHook(() => { throw new Error('SECRET TOKEN') })
  if (mode === 'malformed') t.setResponse(() => new Response('not json SECRET'))
  if (mode === 'rpc-error') t.setResponse(() => new Response(JSON.stringify({ message: 'SECRET', code: 'XX000' }), { status: 503 }))
  if (mode === 'missing-data') t.setResponse(() => new Response('null'))
  await expect(readRecordingSessionStatus(f.input, { admin: t.admin })).rejects.toThrow(ERROR)
  expect(t.requests).toHaveLength(1)
})
it('snapshots the caller identity and options before the asynchronous boundary', async () => {
  const f = statusFixture(), t = statusTransport(f.snapshot), signal = new AbortController()
  const options = { admin: t.admin, signal: signal.signal, timeoutMs: 1000 }
  t.setHook(() => { f.input.actorId = OTHER; options.admin = statusTransport(null).admin; options.signal = new AbortController().signal; options.timeoutMs = 0 })
  await expect(readRecordingSessionStatus(f.input, options)).resolves.toMatchObject({ state: 'succeeded' })
  expect(t.requests).toHaveLength(1)
})
it('honors the original signal even if the options are mutated while awaiting', async () => {
  const f = statusFixture(), t = statusTransport(f.snapshot), controller = new AbortController()
  const options = { admin: t.admin, signal: controller.signal }
  t.setHook(() => { options.signal = new AbortController().signal; controller.abort('SECRET') })
  await expect(readRecordingSessionStatus(f.input, options)).rejects.toThrow(ERROR)
})
it('rejects pre-abort without dispatch, and cancels a stalled request even if transport ignores abort', async () => {
  const f = statusFixture(), t = statusTransport(f.snapshot), controller = new AbortController(); controller.abort('SECRET')
  await expect(readRecordingSessionStatus(f.input, { admin: t.admin, signal: controller.signal })).rejects.toThrow(ERROR)
  expect(t.requests).toHaveLength(0)
  const mid = new AbortController(); t.setHook(() => new Promise(() => {}))
  const pending = readRecordingSessionStatus(f.input, { admin: t.admin, signal: mid.signal })
  const rejected = expect(pending).rejects.toThrow(ERROR)
  await new Promise(resolve => setImmediate(resolve)); mid.abort('SECRET')
  await rejected
  expect(t.requests).toHaveLength(1); expect(t.requests[0].init.signal?.aborted).toBe(true)
})
it('bounds and aborts a nonresponding RPC', async () => {
  const f = statusFixture(), t = statusTransport(f.snapshot); t.setHook(() => new Promise(() => {}))
  await expect(readRecordingSessionStatus(f.input, { admin: t.admin, timeoutMs: 10 })).rejects.toThrow(ERROR)
  expect(t.requests).toHaveLength(1); expect(t.requests[0].init.signal?.aborted).toBe(true)
})

it('accepts chunk transaction timestamps preceding the session statement timestamp', async () => {
  // seal_recording_manifest uses statement_timestamp for sessions but chunks
  // retain DEFAULT now() (transaction_timestamp), including explicit transactions.
  const f = statusFixture(); f.snapshot.chunks[0].persisted_at = '2026-11-04T23:59:59.999999Z'
  await expect(read(f)).resolves.toMatchObject({ state: 'succeeded' })
})
it('rejects asset creation after its registered job was created', async () => {
  const f = statusFixture(); f.asset.created_at = TIME[4]
  await expect(read(f)).rejects.toThrow(ERROR)
})
