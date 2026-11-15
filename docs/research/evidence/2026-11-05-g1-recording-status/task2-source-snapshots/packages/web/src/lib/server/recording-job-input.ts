import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import type { getSupabaseAdmin } from '@/lib/supabase'
import { recordingChunkLocation } from '@/lib/recording-chunk-location'
import type { RecordingMergeChunk, RecordingMergeTaskInput } from './recording-merge'
import { prepareRecordingSessionSeal, DEFAULT_MAX_RECORDING_INPUT_BYTES } from './recording-session-service'
import { checkRecordingJobLease, type RecordingJobLease } from './recording-job-lease'

type Row = Record<string, unknown>
type Options = { admin: ReturnType<typeof getSupabaseAdmin>; signal?: AbortSignal; queryTimeoutMs?: number; lease?: RecordingJobLease }
type QueryResult = { data: unknown; error: unknown; count: number | null }
type Query = PromiseLike<QueryResult> & { abortSignal: (signal: AbortSignal) => Query; retry: (enabled: boolean) => Query }
type SealedInput = {
  schemaVersion: 1; projectId: string; sessionId: string; userId: string; storyId: string | null
  assetId: string; mimeType: string; chunks: Array<RecordingMergeChunk & { storageObjectKey: string }>
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const HASH = /^[0-9a-f]{64}$/
const OPTIONAL_BLOCKERS = ['tombstone_at', 'deletion_requested_at', 'deleted_at', 'cancel_requested_at']

function unavailable(): never {
  throw new Error('Recording job input is unavailable')
}

function record(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) unavailable()
  return value as Row
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

function exactKeys(value: Row, keys: string[]) {
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) unavailable()
}

function equalFields(row: Row, expected: Row) {
  if (Object.entries(expected).some(([key, value]) => row[key] !== value)) unavailable()
}

function requireNull(row: Row, fields: string[]) {
  if (fields.some(field => row[field] !== null)) unavailable()
}

function noBlockers(row: Row) {
  if (OPTIONAL_BLOCKERS.some(field => row[field] != null)) unavailable()
}

function finiteDate(value: unknown): number {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) unavailable()
  return Date.parse(value)
}

function parseManifest(value: unknown): SealedInput {
  const manifest = record(value)
  exactKeys(manifest, ['schemaVersion', 'projectId', 'sessionId', 'userId', 'storyId', 'assetId', 'mimeType', 'chunks'])
  if (manifest.schemaVersion !== 1 || !uuid(manifest.projectId) || !uuid(manifest.sessionId) ||
    !uuid(manifest.userId) || !uuid(manifest.assetId) || (manifest.storyId !== null && !uuid(manifest.storyId)) ||
    typeof manifest.mimeType !== 'string' || !/^audio\/(webm|mp4|ogg)(;codecs=(opus|vorbis|mp4a\.40\.2))?$/.test(manifest.mimeType) ||
    !Array.isArray(manifest.chunks) || manifest.chunks.length === 0 || manifest.chunks.length > 2000) unavailable()
  let total = 0
  const ids = new Set<string>()
  for (const [index, item] of manifest.chunks.entries()) {
    const chunk = record(item)
    exactKeys(chunk, ['index', 'chunkId', 'bucket', 'objectKey', 'storageObjectKey', 'byteSize', 'sha256'])
    if (chunk.index !== index || typeof chunk.chunkId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(chunk.chunkId) ||
      ids.has(chunk.chunkId) || chunk.bucket !== 'audio-recordings' || typeof chunk.sha256 !== 'string' || !HASH.test(chunk.sha256) ||
      typeof chunk.byteSize !== 'number' || !Number.isSafeInteger(chunk.byteSize) || chunk.byteSize <= 0) unavailable()
    total += chunk.byteSize
    if (!Number.isSafeInteger(total) || total > DEFAULT_MAX_RECORDING_INPUT_BYTES) unavailable()
    ids.add(chunk.chunkId)
    const location = recordingChunkLocation({ userId: manifest.userId, projectId: manifest.projectId, sessionId: manifest.sessionId, index })
    if (chunk.objectKey !== location.objectKey || chunk.storageObjectKey !== location.storageObjectKey) unavailable()
  }
  return manifest as unknown as SealedInput
}

// Only call after parseManifest: this closed schema has ASCII keys/values and
// positive safe integers. This is PostgreSQL jsonb::text, NOT a general JSON serializer.
function manifestPostgresText(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(manifestPostgresText).join(', ')}]`
  if (value && typeof value === 'object') {
    const object = value as Row
    const keys = Object.keys(object).sort((a, b) => a.length - b.length || (a < b ? -1 : 1))
    return `{${keys.map(key => `${JSON.stringify(key)}: ${manifestPostgresText(object[key])}`).join(', ')}}`
  }
  return JSON.stringify(value)
}

function queryReader(options: Options) {
  const timeoutMs = options.queryTimeoutMs ?? 5000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000) unavailable()
  return async (makeQuery: () => Query): Promise<QueryResult> => {
    if (options.signal?.aborted) unavailable()
    const controller = new AbortController()
    const abort = () => controller.abort()
    options.signal?.addEventListener('abort', abort, { once: true })
    let rejectAbort: () => void = () => {}
    const interrupted = new Promise<never>((_, reject) => {
      rejectAbort = () => reject(new Error('Recording job input is unavailable'))
      controller.signal.addEventListener('abort', rejectAbort, { once: true })
    })
    const timer = setTimeout(abort, timeoutMs)
    try {
      const result = await Promise.race([makeQuery().abortSignal(controller.signal).retry(false), interrupted])
      if (controller.signal.aborted || options.signal?.aborted || !result || result.error) unavailable()
      return result
    } catch {
      unavailable()
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', abort)
      controller.signal.removeEventListener('abort', rejectAbort)
      controller.abort()
    }
  }
}

function one(result: QueryResult): Row {
  if (result.count !== 1 || !Array.isArray(result.data) || result.data.length !== 1) unavailable()
  return record(result.data[0])
}

async function readTrustedState(jobId: string, options: Options) {
  const { admin } = options
  const lease = options.lease
  const checkLease = async () => {
    if (!lease) return
    if (lease.jobId !== jobId || lease.state !== 'running') unavailable()
    await checkRecordingJobLease(lease, { admin, signal: options.signal, timeoutMs: options.queryTimeoutMs })
  }
  await checkLease()
  const read = queryReader(options)
  const job = one(await read(() => admin.from('processing_jobs').select('*', { count: 'exact' }).eq('id', jobId).limit(2)))
  if (job.id !== jobId || !uuid(job.project_id) || !uuid(job.asset_id) || !uuid(job.created_by)) unavailable()
  noBlockers(job)
  const session = one(await read(() => admin.from('recording_sessions').select('*', { count: 'exact' })
    .contains('seal_input', { assetId: job.asset_id }).limit(2)))
  const manifest = parseManifest(session.seal_input)
  if (manifest.assetId !== job.asset_id || manifest.projectId !== job.project_id || manifest.userId !== job.created_by) unavailable()
  const sealed = prepareRecordingSessionSeal({
    jobId, projectId: manifest.projectId, sessionId: manifest.sessionId, actorId: manifest.userId,
    actorRole: 'storyteller', actorActive: true, storyId: manifest.storyId, mimeType: manifest.mimeType, chunks: manifest.chunks,
  })
  if (sealed.task.assetId !== manifest.assetId) unavailable()
  equalFields(job, {
    id: jobId, project_id: sealed.task.projectId, asset_id: sealed.task.assetId, created_by: manifest.userId,
    input_version: 1, job_type: 'recording_merge', processor_version: 'ffmpeg-merge-v1',
    parameter_version: 'default', model_config_version: 'none', idempotency_key: sealed.task.idempotencyKey,
    state: lease ? 'running' : 'queued', attempt_count: lease?.attempt ?? 0, max_attempts: 3,
  })
  requireNull(job, ['not_before', 'cancel_requested_at', 'result_ref', 'error_code'])
  if (lease) {
    equalFields(job, { lease_owner: lease.workerId })
    finiteDate(job.lease_expires_at)
    if (lease.projectId !== manifest.projectId || lease.assetId !== manifest.assetId ||
      lease.sessionId !== manifest.sessionId || lease.manifestSha256 !== session.manifest_sha256) unavailable()
  } else requireNull(job, ['lease_owner', 'lease_expires_at'])
  equalFields(session, {
    id: manifest.sessionId, project_id: manifest.projectId, user_id: manifest.userId, story_id: manifest.storyId,
    mime_type: manifest.mimeType, state: 'sealing', total_chunks: manifest.chunks.length,
    total_input_bytes: sealed.task.totalInputBytes,
    manifest_sha256: createHash('sha256').update(manifestPostgresText(manifest), 'utf8').digest('hex'),
  })
  requireNull(session, ['confirmed_asset_id', 'merge_job_id', 'confirmed_at'])
  noBlockers(session)
  if (finiteDate(session.sealed_at) < finiteDate(session.started_at) || finiteDate(session.sealed_at) > Date.now()) unavailable()
  const asset = one(await read(() => admin.from('media_assets').select('*', { count: 'exact' }).eq('id', manifest.assetId).limit(2)))
  equalFields(asset, { ...sealed.assetRecord, original_filename: 'unnamed-asset' })
  requireNull(asset, ['sha256', 'duration_ms', 'verified_at', 'content_verified_at', 'verification_error', 'parent_asset_id'])
  noBlockers(asset)

  const chunks: Row[] = []
  const chunkRowIds = new Set<string>()
  const count = manifest.chunks.length
  for (let offset = 0; offset < count; offset += 500) {
    const end = Math.min(count, offset + 500) - 1
    const page = await read(() => admin.from('recording_chunks').select('*', { count: 'exact' })
      .eq('session_id', manifest.sessionId).order('chunk_index', { ascending: true }).range(offset, end))
    if (page.count !== count || !Array.isArray(page.data) || page.data.length !== end - offset + 1) unavailable()
    for (const [pageIndex, value] of page.data.entries()) {
      const row = record(value)
      const expected = manifest.chunks[offset + pageIndex]
      if (!uuid(row.id) || chunkRowIds.has(row.id)) unavailable()
      chunkRowIds.add(row.id)
      equalFields(row, {
        session_id: manifest.sessionId, project_id: manifest.projectId, chunk_index: expected.index,
        seal_chunk_id: expected.chunkId, bucket: expected.bucket, object_key: expected.storageObjectKey,
        byte_size: expected.byteSize, sha256: expected.sha256,
      })
      noBlockers(row)
      chunks.push(row)
    }
  }

  const project = one(await read(() => admin.from('projects').select('*', { count: 'exact' }).eq('id', manifest.projectId).limit(2)))
  equalFields(project, { id: manifest.projectId })
  noBlockers(project)
  const role = one(await read(() => admin.from('project_roles').select('*', { count: 'exact' })
    .eq('project_id', manifest.projectId).eq('user_id', manifest.userId).limit(2)))
  equalFields(role, { project_id: manifest.projectId, user_id: manifest.userId, role: 'storyteller', status: 'active' })
  noBlockers(role)
  if (manifest.storyId !== null) {
    const story = one(await read(() => admin.from('stories').select('*', { count: 'exact' }).eq('id', manifest.storyId).limit(2)))
    equalFields(story, { id: manifest.storyId, project_id: manifest.projectId, storyteller_id: manifest.userId })
    noBlockers(story)
  }
  // Final await: reauthorize after external work, but this is not a transaction
  // with concurrent permission/deletion writers, nor permission to publish.
  const subjects = [manifest.projectId, manifest.sessionId, manifest.assetId, manifest.storyId].filter((id): id is string => id !== null)
  const tombstones = await read(() => admin.from('deletion_requests').select('subject_id, tombstone_at', { count: 'exact' })
    .eq('project_id', manifest.projectId).in('subject_id', subjects).not('tombstone_at', 'is', null).limit(1))
  if (!Array.isArray(tombstones.data) || tombstones.data.length !== 0 || tombstones.count !== 0 || options.signal?.aborted) unavailable()
  await checkLease()
  const pinnedJob = { ...job }
  if (lease) {
    // Heartbeats may change only these fields; the database check still validates the live fence.
    delete pinnedJob.lease_expires_at
    delete pinnedJob.updated_at
  }
  return { task: sealed.task, storageObjectKeys: manifest.chunks.map(chunk => chunk.storageObjectKey),
    pinned: { job: pinnedJob, session, asset, chunks } }
}

/** Read-only, server-side verification of declared input. Does not claim a job or verify Storage bytes. */
export async function loadRecordingJobInput(
  jobId: string,
  options: Options,
): Promise<{ task: RecordingMergeTaskInput; storageObjectKeys: readonly string[]; revalidate: (signal?: AbortSignal) => Promise<void> }> {
  try {
    if (typeof window !== 'undefined' || !uuid(jobId) || options.signal?.aborted) unavailable()
    const original = await readTrustedState(jobId, options)
    original.task.chunks.forEach(Object.freeze)
    Object.freeze(original.task.chunks)
    Object.freeze(original.task)
    return {
      task: original.task, storageObjectKeys: Object.freeze(original.storageObjectKeys),
      revalidate: async signal => {
        try {
          // A shorter I/O scope must cancel its queries without dropping caller cancellation.
          const combinedSignal = signal && options.signal ? AbortSignal.any([signal, options.signal]) : signal ?? options.signal
          const current = await readTrustedState(jobId, { ...options, signal: combinedSignal })
          if (!isDeepStrictEqual(current.pinned, original.pinned)) unavailable()
        } catch {
          unavailable()
        }
      },
    }
  } catch {
    unavailable()
  }
}

/** Pure closed-schema parser shared by read-only recording reconciliation. */
export { parseManifest as parseRecordingJobManifest }

/** Canonical PostgreSQL manifest digest; parsing is required before serialization. */
export function recordingManifestSha256(value: unknown): string {
  return createHash('sha256').update(manifestPostgresText(parseManifest(value)), 'utf8').digest('hex')
}
