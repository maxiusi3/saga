import type { getSupabaseAdmin } from '@/lib/supabase'

type Options = { admin: ReturnType<typeof getSupabaseAdmin>; signal?: AbortSignal; timeoutMs?: number }
type Action = 'claim' | 'start' | 'heartbeat' | 'check' | 'recover'
interface LeaseReceipt {
  schemaVersion: 1
  jobId: string; projectId: string; assetId: string; sessionId: string; manifestSha256: string
  state: 'leased' | 'running' | 'retry_wait' | 'failed' | 'outcome_unknown' | 'cancelled'
  attempt: number; workerId: string | null; leaseExpiresAt: string | null; serverNow: string
  canClearLocalDrafts: false
}
export type RecordingJobLease = Readonly<Omit<LeaseReceipt, 'state' | 'workerId' | 'leaseExpiresAt'> & {
  state: 'leased' | 'running'; workerId: string; leaseExpiresAt: string
  // Process-local monotonic deadline, never a persisted timestamp or transferable capability.
  deadline: number
}>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const WORKER = /^[A-Za-z0-9_-]{1,128}$/
const KEYS = ['schemaVersion', 'jobId', 'projectId', 'assetId', 'sessionId', 'manifestSha256', 'state',
  'attempt', 'workerId', 'leaseExpiresAt', 'serverNow', 'canClearLocalDrafts']
const IDENTITY = ['jobId', 'projectId', 'assetId', 'sessionId', 'manifestSha256', 'workerId', 'attempt'] as const

function unavailable(): never { throw new Error('recording_lease_unavailable') }
function validDuration(value: number) { return Number.isInteger(value) && value >= 1000 && value <= 120000 }
function utcTime(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/.test(value)) unavailable()
  const ms = Date.parse(value)
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 19) !== value.slice(0, 19)) unavailable()
  return ms
}
function parseReceipt(value: unknown): LeaseReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) unavailable()
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== KEYS.length || KEYS.some(key => !Object.prototype.hasOwnProperty.call(row, key)) ||
    row.schemaVersion !== 1 || row.canClearLocalDrafts !== false ||
    ['jobId', 'projectId', 'assetId', 'sessionId'].some(key => typeof row[key] !== 'string' || !UUID.test(row[key] as string)) ||
    typeof row.manifestSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(row.manifestSha256) ||
    !Number.isSafeInteger(row.attempt) || Number(row.attempt) < 1 || Number(row.attempt) > 3) unavailable()
  const now = utcTime(row.serverNow)
  if (row.state === 'leased' || row.state === 'running') {
    if (typeof row.workerId !== 'string' || !WORKER.test(row.workerId)) unavailable()
    const ttl = utcTime(row.leaseExpiresAt) - now
    if (ttl <= 0 || ttl > 120000) unavailable()
  } else if (!['retry_wait', 'failed', 'outcome_unknown', 'cancelled'].includes(String(row.state)) ||
    row.workerId !== null || row.leaseExpiresAt !== null) unavailable()
  return row as unknown as LeaseReceipt
}
function validateLease(lease: RecordingJobLease) {
  const { deadline, ...receipt } = lease
  const parsed = parseReceipt(receipt)
  if (!['leased', 'running'].includes(parsed.state) || !Number.isFinite(deadline) || deadline < 0) unavailable()
}

async function request(jobId: string, action: Action, options: Options,
  workerId: string | null, attempt: number | null, leaseMs: number | null, expected?: RecordingJobLease) {
  if (typeof window !== 'undefined' || typeof jobId !== 'string' || !UUID.test(jobId) ||
    (workerId !== null && (typeof workerId !== 'string' || !WORKER.test(workerId))) ||
    (leaseMs !== null && !validDuration(leaseMs))) unavailable()
  const timeoutMs = options.timeoutMs ?? 5000
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 || options.signal?.aborted) unavailable()
  if (expected) validateLease(expected)
  const started = performance.now()
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  let rejectAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new Error('recording_lease_unavailable'))
    controller.signal.addEventListener('abort', rejectAbort, { once: true })
  })
  const timer = setTimeout(abort, timeoutMs)
  try {
    const query = options.admin.rpc('recording_job_lease', { p_job_id: jobId, p_action: action,
      p_worker_id: workerId, p_attempt: attempt, p_lease_ms: leaseMs }).abortSignal(controller.signal).retry(false)
    const result = await Promise.race([query, interrupted])
    if (controller.signal.aborted || options.signal?.aborted || !result || result.error) unavailable()
    const receipt = parseReceipt(result.data)
    if (receipt.jobId !== jobId || (expected && IDENTITY.some(key => receipt[key] !== expected[key]))) unavailable()
    if (action === 'recover') {
      if (receipt.state === 'leased' || receipt.state === 'running') unavailable()
      return { receipt, deadline: null }
    }
    const state = action === 'claim' ? 'leased' : action === 'check' ? expected!.state : 'running'
    if (receipt.state !== state || receipt.workerId !== workerId || (attempt !== null && receipt.attempt !== attempt)) unavailable()
    const ttl = utcTime(receipt.leaseExpiresAt) - utcTime(receipt.serverNow)
    if (leaseMs !== null && ttl > leaseMs) unavailable()
    // Starting the deadline before the request conservatively includes transport/lock wait.
    const deadline = started + ttl
    if (deadline <= performance.now()) unavailable()
    return { receipt, deadline }
  } catch { unavailable() }
  finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', rejectAbort)
    controller.abort()
  }
}

function active(result: { receipt: LeaseReceipt; deadline: number | null }): RecordingJobLease {
  if (result.deadline === null || !['leased', 'running'].includes(result.receipt.state)) unavailable()
  return Object.freeze({ ...result.receipt, deadline: result.deadline }) as RecordingJobLease
}
export async function claimRecordingJob(jobId: string, workerId: string, leaseMs: number, options: Options) {
  return active(await request(jobId, 'claim', options, workerId, null, leaseMs))
}
export async function startRecordingJob(lease: RecordingJobLease, options: Options) {
  if (lease.state !== 'leased' || lease.deadline <= performance.now()) unavailable()
  return active(await request(lease.jobId, 'start', options, lease.workerId, lease.attempt, null, lease))
}
export async function heartbeatRecordingJob(lease: RecordingJobLease, leaseMs: number, options: Options) {
  if (lease.state !== 'running') unavailable()
  return active(await request(lease.jobId, 'heartbeat', options, lease.workerId, lease.attempt, leaseMs, lease))
}
export async function checkRecordingJobLease(lease: RecordingJobLease, options: Options) {
  return active(await request(lease.jobId, 'check', options, lease.workerId, lease.attempt, null, lease))
}
export async function recoverRecordingJob(jobId: string, options: Options) {
  return Object.freeze((await request(jobId, 'recover', options, null, null, null)).receipt)
}
