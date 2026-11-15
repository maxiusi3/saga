import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { prepareRecordingSessionSeal } from '../../recording-session-service'

type Row = Record<string, unknown>
export const PROJECT = '11111111-1111-4111-8111-111111111111'
export const SESSION = '22222222-2222-4222-8222-222222222222'
export const ACTOR = '33333333-3333-4333-8333-333333333333'
export const STORY = '44444444-4444-4444-8444-444444444444'
export const JOB = '55555555-5555-4555-8555-555555555555'
export const OTHER = '66666666-6666-4666-8666-666666666666'
export const CANDIDATE = '77777777-7777-4777-8777-777777777777'
export const TIME = Array.from({ length: 10 }, (_, i) => `2026-11-05T00:00:00.00000${i}Z`)
export const ERROR = 'recording_status_unavailable'
export function pgText(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(pgText).join(', ')}]`
  if (value && typeof value === 'object') {
    const row = value as Row
    return `{${Object.keys(row).sort((a, b) => a.length - b.length || (a < b ? -1 : 1))
      .map(key => `${JSON.stringify(key)}: ${pgText(row[key])}`).join(', ')}}`
  }
  return JSON.stringify(value)
}
export function manifestHash(value: unknown) { return createHash('sha256').update(pgText(value)).digest('hex') }
export function statusFixture(state: 'succeeded' | 'failed' | 'queued' | 'running' = 'succeeded') {
  const chunks = [{ index: 0, chunkId: 'chunk-0', bucket: 'audio-recordings' as const,
    objectKey: `projects/${PROJECT}/sessions/${SESSION}/0`, byteSize: 3, sha256: 'a'.repeat(64) }]
  const sealed = prepareRecordingSessionSeal({ projectId: PROJECT, sessionId: SESSION, actorId: ACTOR,
    actorRole: 'storyteller', actorActive: true, storyId: STORY, jobId: JOB, mimeType: 'audio/webm', chunks })
  const manifest = { schemaVersion: 1, projectId: PROJECT, sessionId: SESSION, userId: ACTOR, storyId: STORY,
    assetId: sealed.task.assetId, mimeType: 'audio/webm',
    chunks: chunks.map(chunk => ({ ...chunk, storageObjectKey: `${ACTOR}/${chunk.objectKey}` })) }
  const hash = manifestHash(manifest)
  const session: Row = { id: SESSION, project_id: PROJECT, user_id: ACTOR, story_id: STORY, mime_type: 'audio/webm',
    state: 'sealing', total_chunks: 1, total_input_bytes: 3, manifest_sha256: hash, seal_input: manifest,
    started_at: TIME[0], sealed_at: TIME[1], confirmed_asset_id: null, merge_job_id: null, confirmed_at: null }
  const asset: Row = { ...sealed.assetRecord, original_filename: 'unnamed-asset', parent_asset_id: null,
    sha256: null, duration_ms: null, verified_at: null, content_verified_at: null, verification_error: null,
    created_at: TIME[2], updated_at: TIME[2] }
  const job: Row = { id: JOB, project_id: PROJECT, asset_id: sealed.task.assetId, created_by: ACTOR, input_version: 1,
    job_type: 'recording_merge', processor_version: 'ffmpeg-merge-v1', model_config_version: 'none', parameter_version: 'default',
    idempotency_key: sealed.task.idempotencyKey, state: 'queued', attempt_count: 0, max_attempts: 3, not_before: null,
    lease_owner: null, lease_expires_at: null, cancel_requested_at: null, result_ref: null, error_code: null,
    created_at: TIME[2], updated_at: TIME[2] }
  const attempt: Row = { id: OTHER, job_id: JOB, attempt_no: 1, worker_id: 'worker-1', provider: null,
    provider_request_id: null, usage_units: null, reserved_cost_usd: null, settled_cost_usd: null,
    dispatched_at: TIME[3], finished_at: null, result_state: 'running', error_code: null }
  const candidate: Row = { id: CANDIDATE, job_id: JOB, project_id: PROJECT, asset_id: sealed.task.assetId,
    session_id: SESSION, attempt_no: 1, worker_id: 'worker-1', manifest_sha256: hash, bucket: 'recording-candidates',
    object_key: `jobs/${JOB}/attempts/1/${CANDIDATE}`, byte_size: 3, sha256: 'b'.repeat(64), mime_type: 'audio/webm',
    duration_ms: 10, state: 'prepared', created_at: TIME[4], prepared_at: TIME[5] }
  const snapshot = { schemaVersion: 1, actorId: ACTOR, projectId: PROJECT, sessionId: SESSION, manifestSha256: hash,
    observedAt: TIME[7], matchingSessionCount: 1, session, asset: asset as Row | null, jobs: [job],
    attempts: [] as Row[], candidates: [] as Row[], chunks: [{ id: CANDIDATE, session_id: SESSION, project_id: PROJECT,
      chunk_index: 0, seal_chunk_id: 'chunk-0', bucket: 'audio-recordings', object_key: `${ACTOR}/${chunks[0].objectKey}`,
      byte_size: 3, sha256: 'a'.repeat(64), persisted_at: TIME[1] }] as Row[] }
  if (state !== 'queued') {
    Object.assign(job, { state: 'running', attempt_count: 1, lease_owner: 'worker-1',
      lease_expires_at: '2026-11-05T00:01:00Z', updated_at: TIME[3] })
    snapshot.attempts.push(attempt)
  }
  if (state === 'succeeded' || state === 'failed') {
    Object.assign(job, { state, lease_owner: null, lease_expires_at: null, updated_at: TIME[6],
      result_ref: state === 'succeeded' ? sealed.task.assetId : null,
      error_code: state === 'failed' ? 'recording_source_missing' : null })
    Object.assign(attempt, { result_state: state === 'succeeded' ? 'succeeded' : 'fatal_error',
      finished_at: TIME[6], error_code: job.error_code })
    Object.assign(asset, { state: state === 'succeeded' ? 'ready' : 'quarantined', verification_error: job.error_code, updated_at: TIME[6] })
    session.state = state === 'succeeded' ? 'cloud_confirmed' : 'failed'
    if (state === 'succeeded') {
      snapshot.candidates.push(candidate)
      Object.assign(asset, { bucket: candidate.bucket, object_key: candidate.object_key, sha256: candidate.sha256,
        duration_ms: candidate.duration_ms, verified_at: TIME[6], content_verified_at: TIME[6] })
      Object.assign(session, { confirmed_asset_id: sealed.task.assetId, merge_job_id: JOB, confirmed_at: TIME[6] })
    }
  }
  return { snapshot, session, asset, job, attempt, candidate, manifest, sealed,
    input: { actorId: ACTOR, projectId: PROJECT, sessionId: SESSION, manifestSha256: hash } }
}

/** Transport boundary only. The actual Supabase client and actual reader validate every response. */
export function statusTransport(value: unknown) {
  let hook: (() => Promise<void> | void) | undefined
  let response: (() => Response) | undefined
  const requests: Array<{ url: URL; init: RequestInit }> = []
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: new URL(String(input)), init: init ?? {} })
    await hook?.()
    return response?.() ?? new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
  })
  const admin = createClient('https://status.invalid', 'test-service-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock },
  })
  return { admin, requests, fetchMock, setHook(next: typeof hook) { hook = next }, setResponse(next: typeof response) { response = next } }
}
