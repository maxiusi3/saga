import { parseRecordingJobManifest, recordingManifestSha256 } from './recording-job-input'
import { prepareRecordingSessionSeal } from './recording-session-service'
import { validateRecordingOutputCandidate, type RecordingCandidateOutput } from './recording-output-candidate'

export type RecordingSessionStatusInput = Readonly<{ actorId: string; projectId: string; sessionId: string; manifestSha256: string }>
export type RecordingSessionStatus = Readonly<{
  schemaVersion: 1; projectId: string; sessionId: string; assetId: string; jobId: string | null; manifestSha256: string
  observedAt: string; state: 'succeeded' | 'failed' | 'unresolved'; content: RecordingCandidateOutput | null
  errorCode: string | null; finishedAt: string | null; canClearLocalDrafts: false
}>
type Row = Record<string, unknown>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const HASH = /^[0-9a-f]{64}$/
const WORKER = /^[A-Za-z0-9_-]{1,128}$/
const INPUT_KEYS = ['actorId', 'projectId', 'sessionId', 'manifestSha256']
const SNAPSHOT_KEYS = ['schemaVersion', ...INPUT_KEYS, 'observedAt', 'matchingSessionCount', 'session', 'asset', 'jobs', 'attempts', 'candidates', 'chunks']
const BLOCKERS = ['tombstone_at', 'deletion_requested_at', 'deleted_at', 'cancel_requested_at']
const CONTENT_NULLS = ['sha256', 'duration_ms', 'verified_at', 'content_verified_at']
const PERMANENT_CODES = new Set(['recording_source_missing', 'recording_source_not_private_file', 'recording_source_size_mismatch',
  'recording_source_hash_mismatch', 'recording_decode_invalid_pcm', 'recording_decode_duration_exceeded'])
const RETRY_CODE = 'lease_expired_before_dispatch'

function unavailable(): never { throw new Error('recording_status_unavailable') }
function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) unavailable()
  return value as Row
}
function closed(value: unknown, keys: readonly string[]): Row {
  const object = row(value)
  if (Object.keys(object).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(object, key))) unavailable()
  return object
}
function uuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value) }
function equal(value: Row, expected: Row) {
  if (Object.entries(expected).some(([key, item]) => value[key] !== item)) unavailable()
}
function nulls(value: Row, keys: readonly string[]) { if (keys.some(key => value[key] !== null)) unavailable() }
function noBlockers(value: Row) { if (BLOCKERS.some(key => value[key] != null)) unavailable() }
function rows(value: unknown, max: number): Row[] {
  if (!Array.isArray(value) || value.length > max) unavailable()
  return value.map(item => { const object = row(item); noBlockers(object); return object })
}
/** UTC only. Round-trip the calendar and preserve the sub-millisecond fraction. */
function utc(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/.test(value)) unavailable()
  const ms = Date.parse(value)
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 19) !== value.slice(0, 19)) unavailable()
  const fraction = /\.(\d+)(?:Z|\+00:00)$/.exec(value)?.[1] ?? ''
  return BigInt(ms) * BigInt(1000) + BigInt(fraction.padEnd(6, '0').slice(3))
}
function range(value: unknown, min: bigint, max: bigint): bigint {
  const time = utc(value)
  if (time < min || time > max) unavailable()
  return time
}
function times(value: Row, observed: bigint) {
  const created = utc(value.created_at), updated = range(value.updated_at, created, observed)
  return { created, updated }
}
function sameTime(expected: bigint, ...values: unknown[]) { if (values.some(value => utc(value) !== expected)) unavailable() }

export function validateRecordingSessionStatusInput(value: unknown): asserts value is RecordingSessionStatusInput {
  const input = closed(value, INPUT_KEYS)
  if (!uuid(input.actorId) || !uuid(input.projectId) || !uuid(input.sessionId) ||
    typeof input.manifestSha256 !== 'string' || !HASH.test(input.manifestSha256)) unavailable()
}

function validateAttempts(attempts: Row[], job: Row, observed: bigint, sealedAt: bigint): Row | null {
  const count = job.attempt_count
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 3 || attempts.length !== count) unavailable()
  const ordered = [...attempts].sort((a, b) => Number(a.attempt_no) - Number(b.attempt_no))
  const ids = new Set<string>()
  let previous = utc(job.created_at)
  for (const [index, attempt] of ordered.entries()) {
    if (!uuid(attempt.id) || ids.has(attempt.id) || typeof attempt.worker_id !== 'string' || !WORKER.test(attempt.worker_id)) unavailable()
    ids.add(attempt.id)
    equal(attempt, { job_id: job.id, attempt_no: index + 1 })
    nulls(attempt, ['provider', 'provider_request_id', 'usage_units', 'reserved_cost_usd', 'settled_cost_usd'])
    if (index < count - 1) {
      equal(attempt, { result_state: 'retryable_error', dispatched_at: null, error_code: RETRY_CODE })
      previous = range(attempt.finished_at, previous, observed)
      if (previous < sealedAt) unavailable()
    } else if (attempt.dispatched_at !== null) {
      const dispatched = range(attempt.dispatched_at, previous, utc(job.updated_at))
      if (dispatched < sealedAt) unavailable()
      if (attempt.finished_at !== null) range(attempt.finished_at, dispatched, observed)
    } else if (attempt.finished_at !== null) range(attempt.finished_at, previous, observed)
    else if (previous > utc(job.updated_at)) unavailable()
  }
  return ordered.at(-1) ?? null
}

function validateCandidate(candidate: Row, input: RecordingSessionStatusInput, assetId: string, job: Row,
  attempt: Row, totalBytes: number, mimeType: string, observed: bigint) {
  const receipt = {
    schemaVersion: 1, candidateId: candidate.id, jobId: candidate.job_id, projectId: candidate.project_id,
    assetId: candidate.asset_id, sessionId: candidate.session_id, manifestSha256: candidate.manifest_sha256,
    workerId: candidate.worker_id, attempt: candidate.attempt_no, state: candidate.state, bucket: candidate.bucket,
    objectKey: candidate.object_key, byteSize: candidate.byte_size, sha256: candidate.sha256, mimeType: candidate.mime_type,
    durationMs: candidate.duration_ms, createdAt: candidate.created_at, preparedAt: candidate.prepared_at, canClearLocalDrafts: false,
  }
  validateRecordingOutputCandidate(receipt)
  equal(candidate, { job_id: job.id, project_id: input.projectId, asset_id: assetId, session_id: input.sessionId,
    manifest_sha256: input.manifestSha256, worker_id: attempt.worker_id, attempt_no: attempt.attempt_no,
    byte_size: totalBytes, mime_type: mimeType })
  range(candidate.created_at, utc(attempt.dispatched_at), observed)
  if (candidate.prepared_at !== null) range(candidate.prepared_at, utc(candidate.created_at), observed)
  return receipt
}

function validateUnresolvedJob(job: Row, attempt: Row | null, candidates: Row[], observed: bigint) {
  nulls(job, ['result_ref'])
  if (job.state === 'queued') {
    equal(job, { attempt_count: 0, error_code: null })
    nulls(job, ['lease_owner', 'lease_expires_at', 'not_before'])
    if (attempt !== null || candidates.length) unavailable()
    return
  }
  if (!attempt) unavailable()
  if (job.state === 'leased' || job.state === 'running') {
    equal(attempt, { result_state: job.state, worker_id: job.lease_owner })
    nulls(job, ['not_before', 'error_code']); nulls(attempt, ['error_code', 'finished_at'])
    const expires = utc(job.lease_expires_at), updated = utc(job.updated_at)
    // Expiry does not authorize recovery. It is still a coherent unresolved observation.
    if (expires <= updated || expires > updated + BigInt(120000000)) unavailable()
    if (job.state === 'leased') {
      if (attempt.dispatched_at !== null || candidates.length) unavailable()
    } else if (utc(attempt.dispatched_at) >= expires) unavailable()
    return
  }
  nulls(job, ['lease_owner', 'lease_expires_at'])
  sameTime(utc(job.updated_at), attempt.finished_at)
  if (job.state === 'outcome_unknown') {
    equal(job, { error_code: 'lease_expired_after_dispatch_unknown', not_before: null })
    equal(attempt, { result_state: 'outcome_unknown', error_code: job.error_code })
    if (attempt.dispatched_at === null) unavailable()
    for (const candidate of candidates) {
      range(candidate.created_at, utc(attempt.dispatched_at), utc(attempt.finished_at))
      if (candidate.prepared_at !== null) range(candidate.prepared_at, utc(candidate.created_at), utc(attempt.finished_at))
    }
  } else if (job.state === 'retry_wait') {
    equal(job, { error_code: RETRY_CODE }); equal(attempt, { result_state: 'retryable_error', error_code: RETRY_CODE, dispatched_at: null })
    sameTime(utc(job.updated_at), job.not_before)
    if (Number(job.attempt_count) >= 3 || candidates.length) unavailable()
  } else if (job.state === 'failed') {
    equal(job, { attempt_count: 3, error_code: 'lease_expired_before_dispatch_max_attempts', not_before: null })
    equal(attempt, { result_state: 'fatal_error', error_code: job.error_code, dispatched_at: null })
    if (candidates.length) unavailable()
  } else unavailable()
  range(attempt.finished_at, utc(job.created_at), observed)
}

function validateSnapshot(value: unknown, input: RecordingSessionStatusInput): RecordingSessionStatus {
  validateRecordingSessionStatusInput(input)
  const snapshot = closed(value, SNAPSHOT_KEYS)
  equal(snapshot, { schemaVersion: 1, ...input, matchingSessionCount: 1 })
  const observed = utc(snapshot.observedAt)
  const session = row(snapshot.session); noBlockers(session)
  const manifest = parseRecordingJobManifest(session.seal_input)
  if (recordingManifestSha256(manifest) !== input.manifestSha256) unavailable()
  equal(manifest, { projectId: input.projectId, sessionId: input.sessionId, userId: input.actorId })
  const jobs = rows(snapshot.jobs, 1), attempts = rows(snapshot.attempts, 3), candidates = rows(snapshot.candidates, 1)
  const chunks = rows(snapshot.chunks, 2000), job = jobs[0] ?? null
  if (job && !uuid(job.id)) unavailable()
  // Supplying a placeholder job ID avoids generating randomness before registration;
  // asset identity and content idempotency do not depend on job ID.
  const sealed = prepareRecordingSessionSeal({ jobId: job ? String(job.id) : input.sessionId,
    projectId: input.projectId, sessionId: input.sessionId, actorId: input.actorId, actorRole: 'storyteller', actorActive: true,
    storyId: manifest.storyId, mimeType: manifest.mimeType, chunks: manifest.chunks })
  if (sealed.task.assetId !== manifest.assetId) unavailable()
  equal(session, { id: input.sessionId, project_id: input.projectId, user_id: input.actorId, story_id: manifest.storyId,
    mime_type: manifest.mimeType, manifest_sha256: input.manifestSha256, total_chunks: manifest.chunks.length,
    total_input_bytes: sealed.task.totalInputBytes })
  const started = utc(session.started_at), sealedAt = range(session.sealed_at, started, observed)
  if (chunks.length !== manifest.chunks.length) unavailable()
  const chunkIds = new Set<string>()
  chunks.forEach((chunk, index) => {
    const expected = manifest.chunks[index]
    if (!uuid(chunk.id) || chunkIds.has(chunk.id)) unavailable()
    chunkIds.add(chunk.id)
    equal(chunk, { session_id: input.sessionId, project_id: input.projectId, chunk_index: index, seal_chunk_id: expected.chunkId,
      bucket: expected.bucket, object_key: expected.storageObjectKey, byte_size: expected.byteSize, sha256: expected.sha256 })
    // Chunk DEFAULT now() can predate the seal statement in a transaction.
    if (utc(chunk.persisted_at) > sealedAt) unavailable()
  })
  const base = { schemaVersion: 1 as const, projectId: input.projectId, sessionId: input.sessionId, assetId: manifest.assetId,
    jobId: job ? String(job.id) : null, manifestSha256: input.manifestSha256, observedAt: String(snapshot.observedAt), canClearLocalDrafts: false as const }
  const unresolved = () => Object.freeze({ ...base, state: 'unresolved' as const, content: null, errorCode: null, finishedAt: null })
  const unconfirmed = () => { equal(session, { state: 'sealing' }); nulls(session, ['confirmed_asset_id', 'merge_job_id', 'confirmed_at']) }
  if (snapshot.asset === null) {
    unconfirmed()
    if (job || attempts.length || candidates.length) unavailable()
    return unresolved()
  }
  const asset = row(snapshot.asset); noBlockers(asset)
  const { bucket, object_key, state: _state, ...immutableAsset } = sealed.assetRecord
  equal(asset, { ...immutableAsset, original_filename: 'unnamed-asset', parent_asset_id: null })
  const assetTimes = times(asset, observed)
  if (!job) {
    unconfirmed(); equal(asset, { bucket, object_key, state: 'verifying', verification_error: null }); nulls(asset, CONTENT_NULLS)
    if (attempts.length || candidates.length) unavailable()
    return unresolved()
  }
  equal(job, { project_id: input.projectId, asset_id: manifest.assetId, created_by: input.actorId, input_version: 1,
    job_type: 'recording_merge', processor_version: 'ffmpeg-merge-v1', parameter_version: 'default', model_config_version: 'none',
    idempotency_key: sealed.task.idempotencyKey, max_attempts: 3, cancel_requested_at: null })
  const jobTimes = times(job, observed)
  if (assetTimes.created > jobTimes.created) unavailable()
  const attempt = validateAttempts(attempts, job, observed, sealedAt)
  const candidate = candidates[0] && attempt ? validateCandidate(candidates[0], input, manifest.assetId, job, attempt,
    sealed.task.totalInputBytes, manifest.mimeType, observed) : null
  if (candidates.length && !candidate) unavailable()
  if (job.state === 'succeeded' || (job.state === 'failed' && PERMANENT_CODES.has(String(job.error_code)))) {
    if (!attempt || attempt.dispatched_at === null) unavailable()
    nulls(job, ['lease_owner', 'lease_expires_at', 'not_before'])
    sameTime(jobTimes.updated, asset.updated_at, attempt.finished_at)
    if (job.state === 'succeeded') {
      if (!candidate || candidate.state !== 'prepared') unavailable()
      equal(job, { result_ref: manifest.assetId, error_code: null })
      equal(attempt, { result_state: 'succeeded', error_code: null })
      equal(asset, { state: 'ready', bucket: candidate.bucket, object_key: candidate.objectKey, sha256: candidate.sha256,
        duration_ms: candidate.durationMs, verification_error: null })
      equal(session, { state: 'cloud_confirmed', confirmed_asset_id: manifest.assetId, merge_job_id: job.id })
      sameTime(jobTimes.updated, asset.verified_at, asset.content_verified_at, session.confirmed_at)
      if (utc(candidate.preparedAt) > jobTimes.updated) unavailable()
      return Object.freeze({ ...base, state: 'succeeded', content: Object.freeze({ byteSize: candidate.byteSize, sha256: candidate.sha256,
        mimeType: candidate.mimeType, durationMs: candidate.durationMs }), errorCode: null, finishedAt: String(job.updated_at) })
    }
    if (candidates.length) unavailable()
    equal(job, { result_ref: null }); equal(attempt, { result_state: 'fatal_error', error_code: job.error_code })
    equal(asset, { state: 'quarantined', bucket, object_key, verification_error: job.error_code }); nulls(asset, CONTENT_NULLS)
    equal(session, { state: 'failed' }); nulls(session, ['confirmed_asset_id', 'merge_job_id', 'confirmed_at'])
    return Object.freeze({ ...base, state: 'failed', content: null, errorCode: String(job.error_code), finishedAt: String(job.updated_at) })
  }
  unconfirmed(); equal(asset, { state: 'verifying', bucket, object_key, verification_error: null }); nulls(asset, CONTENT_NULLS)
  validateUnresolvedJob(job, attempt, candidates, observed)
  return unresolved()
}

/** A statement snapshot proves only this observation, never access or local cleanup. */
export function validateRecordingSessionSnapshot(value: unknown, input: RecordingSessionStatusInput): RecordingSessionStatus {
  try { return validateSnapshot(value, input) } catch { return unavailable() }
}
