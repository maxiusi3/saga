import type { getSupabaseAdmin } from '@/lib/supabase'
import type { RecordingJobLease } from './recording-job-lease'
import { validateRecordingOutputCandidate, type RecordingOutputCandidate } from './recording-output-candidate'
import { isRecordingProcessingError, type RecordingProcessingError, type RecordingProcessingErrorCode } from './recording-processing-error'

type Options = { admin: ReturnType<typeof getSupabaseAdmin>; signal?: AbortSignal; timeoutMs?: number }
type PermanentCode = Exclude<RecordingProcessingErrorCode, 'recording_source_read_timeout' | 'recording_source_read_temporary'>
type Identity = Pick<RecordingJobLease, 'jobId' | 'projectId' | 'assetId' | 'sessionId' | 'manifestSha256' | 'workerId' | 'attempt'>
type TerminalBase = Identity & { schemaVersion: 1; finishedAt: string; canClearLocalDrafts: false }
export type PublishedRecordingJob = Readonly<TerminalBase & Pick<RecordingOutputCandidate,
  'candidateId' | 'bucket' | 'objectKey' | 'byteSize' | 'sha256' | 'mimeType' | 'durationMs'> & {
  state: 'succeeded'; assetState: 'ready'; sessionState: 'cloud_confirmed'; errorCode: null
}>
export type FailedRecordingJob = Readonly<TerminalBase & {
  state: 'failed'; assetState: 'quarantined'; sessionState: 'failed'; errorCode: PermanentCode
  candidateId: null; bucket: null; objectKey: null; byteSize: null; sha256: null; mimeType: null; durationMs: null
}>
export type RecordingJobFinalization = PublishedRecordingJob | FailedRecordingJob

const IDENTITY = ['jobId', 'projectId', 'assetId', 'sessionId', 'manifestSha256', 'workerId', 'attempt'] as const
const CONTENT = ['candidateId', 'bucket', 'objectKey', 'byteSize', 'sha256', 'mimeType', 'durationMs'] as const
const LEASE_KEYS = ['schemaVersion', ...IDENTITY, 'state', 'leaseExpiresAt', 'serverNow', 'canClearLocalDrafts', 'deadline']
const RECEIPT_KEYS = ['schemaVersion', ...IDENTITY, ...CONTENT, 'state', 'assetState', 'sessionState', 'errorCode', 'finishedAt', 'canClearLocalDrafts']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
function unavailable(): never { throw new Error('recording_finalization_unavailable') }
function closed(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length &&
    keys.every(key => Object.prototype.hasOwnProperty.call(value, key))
}
// Preserve PostgreSQL microseconds; Date.parse alone truncates the lease boundary.
function utc(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/.test(value)) unavailable()
  const ms = Date.parse(value)
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 19) !== value.slice(0, 19)) unavailable()
  const fraction = /\.(\d+)(?:Z|\+00:00)$/.exec(value)?.[1] ?? ''
  return BigInt(ms) * BigInt(1000) + BigInt(fraction.padEnd(6, '0').slice(3))
}
function validateLease(lease: RecordingJobLease) {
  if (!closed(lease, LEASE_KEYS) || lease.schemaVersion !== 1 || lease.canClearLocalDrafts !== false || lease.state !== 'running' ||
    (['jobId', 'projectId', 'assetId', 'sessionId'] as const).some(key => typeof lease[key] !== 'string' || !UUID.test(lease[key] as string)) ||
    typeof lease.manifestSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(lease.manifestSha256) ||
    typeof lease.workerId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(lease.workerId) ||
    !Number.isInteger(lease.attempt) || lease.attempt < 1 || lease.attempt > 3 ||
    !Number.isFinite(lease.deadline) || lease.deadline <= performance.now()) unavailable()
  const ttl = utc(lease.leaseExpiresAt) - utc(lease.serverNow)
  if (ttl <= BigInt(0) || ttl > BigInt(120000000)) unavailable()
}
function receipt(value: unknown, lease: RecordingJobLease, candidate: RecordingOutputCandidate | null, code: PermanentCode | null): RecordingJobFinalization {
  if (!closed(value, RECEIPT_KEYS) || value.schemaVersion !== 1 || value.canClearLocalDrafts !== false ||
    IDENTITY.some(key => value[key] !== lease[key]) || value.errorCode !== code ||
    value.state !== (candidate ? 'succeeded' : 'failed') || value.assetState !== (candidate ? 'ready' : 'quarantined') ||
    value.sessionState !== (candidate ? 'cloud_confirmed' : 'failed') || CONTENT.some(key => value[key] !== (candidate ? candidate[key] : null))) unavailable()
  const finished = utc(value.finishedAt)
  if (finished < utc(lease.serverNow) || finished >= utc(lease.leaseExpiresAt) ||
    (candidate && finished < utc(candidate.preparedAt))) unavailable()
  return Object.freeze({ ...value }) as RecordingJobFinalization
}
async function request(leaseInput: RecordingJobLease, candidateInput: RecordingOutputCandidate | null,
  error: RecordingProcessingError | null, options: Options): Promise<RecordingJobFinalization> {
  // Inputs are process-local evidence, not transferable capabilities. Snapshot
  // their closed scalar values before yielding so caller mutation cannot repin a response.
  let lease: RecordingJobLease, candidate: RecordingOutputCandidate | null, code: PermanentCode | null
  const timeoutMs = options.timeoutMs ?? 5000
  try {
    if (typeof window !== 'undefined' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 || options.signal?.aborted) unavailable()
    validateLease(leaseInput)
    lease = Object.freeze({ ...leaseInput })
    if (candidateInput !== null) {
      validateRecordingOutputCandidate(candidateInput)
      if (candidateInput.state !== 'prepared' || IDENTITY.some(key => candidateInput[key] !== lease[key])) unavailable()
      candidate = Object.freeze({ ...candidateInput }); code = null
    } else {
      if (!isRecordingProcessingError(error) || error.disposition !== 'permanent') unavailable()
      candidate = null; code = error.code as PermanentCode
    }
  } catch { return unavailable() }
  const controller = new AbortController()
  const abort = () => controller.abort()
  let rejectAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new Error('recording_finalization_unavailable'))
    controller.signal.addEventListener('abort', rejectAbort, { once: true })
  })
  options.signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, Math.min(timeoutMs, Math.max(1, lease.deadline - performance.now())))
  try {
    const result = await Promise.race([options.admin.rpc('finalize_recording_job', {
      p_job_id: lease.jobId, p_action: candidate ? 'publish' : 'fail', p_worker_id: lease.workerId, p_attempt: lease.attempt,
      p_manifest_sha256: lease.manifestSha256, p_candidate_id: candidate?.candidateId ?? null,
      p_output: candidate ? { byteSize: candidate.byteSize, sha256: candidate.sha256, mimeType: candidate.mimeType, durationMs: candidate.durationMs } : null,
      p_failure_code: code,
    }).abortSignal(controller.signal).retry(false), interrupted])
    if (controller.signal.aborted || options.signal?.aborted || lease.deadline <= performance.now() || !result || result.error) unavailable()
    return receipt(result.data, lease, candidate, code)
  } catch { return unavailable() }
  finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', rejectAbort)
    abort()
  }
}
/** A rejected/lost response may already have committed. Never retry or clean up from this result. */
export async function publishRecordingJob(lease: RecordingJobLease, candidate: RecordingOutputCandidate, options: Options): Promise<PublishedRecordingJob> {
  return await request(lease, candidate, null, options) as PublishedRecordingJob
}
export async function failRecordingJob(lease: RecordingJobLease, error: RecordingProcessingError, options: Options): Promise<FailedRecordingJob> {
  return await request(lease, null, error, options) as FailedRecordingJob
}
