import type { getSupabaseAdmin } from '@/lib/supabase'
import type { RecordingJobLease } from './recording-job-lease'

export type RecordingCandidateOutput = Readonly<{ byteSize: number; sha256: string; mimeType: string; durationMs: number }>
export type RecordingOutputCandidate = Readonly<RecordingCandidateOutput & {
  schemaVersion: 1; candidateId: string; jobId: string; projectId: string; assetId: string; sessionId: string
  manifestSha256: string; workerId: string; attempt: number; state: 'reserved' | 'prepared'
  bucket: 'recording-candidates'; objectKey: string; createdAt: string; preparedAt: string | null; canClearLocalDrafts: false
}>
type Options = { admin: ReturnType<typeof getSupabaseAdmin>; signal?: AbortSignal; timeoutMs?: number }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const HASH = /^[0-9a-f]{64}$/
const IDENTITY = ['jobId', 'projectId', 'assetId', 'sessionId', 'manifestSha256', 'workerId', 'attempt'] as const
const OUTPUT = ['byteSize', 'sha256', 'mimeType', 'durationMs'] as const
const KEYS = ['schemaVersion', 'candidateId', ...IDENTITY, 'state', 'bucket', 'objectKey', ...OUTPUT, 'createdAt', 'preparedAt', 'canClearLocalDrafts']

function unavailable(): never { throw new Error('recording_candidate_unavailable') }
function validOutput(output: RecordingCandidateOutput) {
  return output && Number.isSafeInteger(output.byteSize) && output.byteSize > 0 && output.byteSize <= 104857600 &&
    Number.isSafeInteger(output.durationMs) && output.durationMs > 0 && output.durationMs <= 86400000 &&
    typeof output.sha256 === 'string' && HASH.test(output.sha256) && typeof output.mimeType === 'string' &&
    /^audio\/(webm|mp4|ogg)(;codecs=(opus|vorbis|mp4a\.40\.2))?$/.test(output.mimeType)
}
function utc(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/.test(value)) unavailable()
  const time = Date.parse(value)
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 19) !== value.slice(0, 19)) unavailable()
  // PostgreSQL timestamps retain microseconds; Date.parse alone loses ordering.
  const fraction = /\.(\d+)(?:Z|\+00:00)$/.exec(value)?.[1] ?? ''
  return BigInt(time) * BigInt(1000) + BigInt(fraction.padEnd(6, '0').slice(3))
}
function validIdentity(row: Pick<RecordingJobLease, typeof IDENTITY[number]>) {
  return ['jobId', 'projectId', 'assetId', 'sessionId'].every(key => {
    const value = row[key as 'jobId']; return typeof value === 'string' && UUID.test(value)
  }) && typeof row.manifestSha256 === 'string' && HASH.test(row.manifestSha256) &&
    typeof row.workerId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(row.workerId) &&
    Number.isInteger(row.attempt) && row.attempt >= 1 && row.attempt <= 3
}

/** Closed, server-only receipt, also checked before constructing a Storage URL. */
export function validateRecordingOutputCandidate(value: unknown): asserts value is RecordingOutputCandidate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) unavailable()
  const row = value as RecordingOutputCandidate
  if (Object.keys(row).length !== KEYS.length || KEYS.some(key => !Object.prototype.hasOwnProperty.call(row, key)) ||
    row.schemaVersion !== 1 || row.canClearLocalDrafts !== false || !validIdentity(row) || !validOutput(row) ||
    typeof row.candidateId !== 'string' || !UUID.test(row.candidateId) || row.bucket !== 'recording-candidates' ||
    row.objectKey !== `jobs/${row.jobId}/attempts/${row.attempt}/${row.candidateId}`) unavailable()
  const created = utc(row.createdAt)
  if (row.state === 'reserved') { if (row.preparedAt !== null) unavailable() }
  else if (row.state !== 'prepared' || utc(row.preparedAt) < created) unavailable()
}

async function request(action: 'reserve' | 'prepare', lease: RecordingJobLease, id: string,
  output: RecordingCandidateOutput, options: Options, previous?: RecordingOutputCandidate): Promise<RecordingOutputCandidate> {
  const timeoutMs = options.timeoutMs ?? 5000
  if (typeof window !== 'undefined' || !lease || !validIdentity(lease) || lease.state !== 'running' ||
    lease.schemaVersion !== 1 || lease.canClearLocalDrafts !== false || !Number.isFinite(lease.deadline) ||
    lease.deadline <= performance.now() || typeof id !== 'string' || !UUID.test(id) || !validOutput(output) ||
    !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 || options.signal?.aborted) unavailable()
  const ttl = utc(lease.leaseExpiresAt) - utc(lease.serverNow)
  if (ttl <= BigInt(0) || ttl > BigInt(120000000)) unavailable()
  if (previous) {
    validateRecordingOutputCandidate(previous)
    if (IDENTITY.some(key => previous[key] !== lease[key])) unavailable()
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  let rejectAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new Error('recording_candidate_unavailable'))
    controller.signal.addEventListener('abort', rejectAbort, { once: true })
  })
  const timer = setTimeout(abort, Math.min(timeoutMs, Math.max(1, lease.deadline - performance.now())))
  try {
    const result = await Promise.race([options.admin.rpc('recording_output_candidate', {
      p_job_id: lease.jobId, p_action: action, p_worker_id: lease.workerId, p_attempt: lease.attempt,
      p_manifest_sha256: lease.manifestSha256, p_candidate_id: id,
      p_output: { byteSize: output.byteSize, sha256: output.sha256, mimeType: output.mimeType, durationMs: output.durationMs },
    }).abortSignal(controller.signal).retry(false), interrupted])
    if (controller.signal.aborted || options.signal?.aborted || lease.deadline <= performance.now() || !result || result.error) unavailable()
    validateRecordingOutputCandidate(result.data)
    const row = result.data
    if (row.candidateId !== id || row.state !== (action === 'reserve' ? 'reserved' : 'prepared') ||
      IDENTITY.some(key => row[key] !== lease[key]) || OUTPUT.some(key => row[key] !== output[key]) ||
      (previous && (row.createdAt !== previous.createdAt ||
        (previous.state === 'prepared' && row.preparedAt !== previous.preparedAt)))) unavailable()
    return Object.freeze({ ...row })
  } catch { return unavailable() }
  finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', rejectAbort)
    abort()
  }
}

export async function reserveRecordingOutputCandidate(lease: RecordingJobLease, id: string, output: RecordingCandidateOutput, options: Options) {
  return request('reserve', lease, id, output, options)
}
export async function prepareRecordingOutputCandidate(lease: RecordingJobLease, candidate: RecordingOutputCandidate, options: Options) {
  return request('prepare', lease, candidate.candidateId, candidate, options, candidate)
}
