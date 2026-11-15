import { verifyRecordingJobInput } from './recording-job-verifier'
import { claimRecordingJob, startRecordingJob, heartbeatRecordingJob, checkRecordingJobLease,
  type RecordingJobLease } from './recording-job-lease'

type Options = Omit<Parameters<typeof verifyRecordingJobInput>[1], 'lease'> & {
  workerId: string
  leaseMs?: number
  heartbeatMs?: number
  rpcTimeoutMs?: number
}

/** Owns one attempt's input verification, not publication or terminal success. */
export async function verifyLeasedRecordingJobInput(jobId: string, options: Options): Promise<
  Awaited<ReturnType<typeof verifyRecordingJobInput>> & { lease: RecordingJobLease }
> {
  return withRecordingJobLease(jobId, options, context => verifyRecordingJobInput(jobId,
    { ...options, lease: context.getLease(), signal: context.signal }))
}

export async function withRecordingJobLease<T extends object>(jobId: string, options: Options,
  consume: (context: { getLease: () => RecordingJobLease; signal: AbortSignal; rpcTimeoutMs: number }) => Promise<T>): Promise<T & { lease: RecordingJobLease }> {
  const leaseMs = options.leaseMs ?? 30000
  const heartbeatMs = options.heartbeatMs ?? Math.floor(leaseMs / 3)
  const rpcTimeoutMs = options.rpcTimeoutMs ?? Math.min(5000, Math.floor(leaseMs / 3))
  const unavailable = () => new Error('recording_worker_unavailable')
  if (!Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 120000 ||
    !Number.isInteger(heartbeatMs) || heartbeatMs < 1 || heartbeatMs > leaseMs / 3 ||
    !Number.isInteger(rpcTimeoutMs) || rpcTimeoutMs < 1 || rpcTimeoutMs > leaseMs / 2) throw unavailable()

  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) abort()
  const rpc = { admin: options.admin, signal: controller.signal, timeoutMs: rpcTimeoutMs }
  let lease: RecordingJobLease | undefined
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined
  let heartbeatTimer: ReturnType<typeof setTimeout> | undefined
  let heartbeat: Promise<void> | undefined
  let stopped = false

  function requireLive() {
    if (controller.signal.aborted || (lease && lease.deadline <= performance.now())) {
      abort()
      throw unavailable()
    }
  }
  function armDeadline() {
    clearTimeout(deadlineTimer)
    requireLive()
    deadlineTimer = setTimeout(() => {
      if (lease!.deadline <= performance.now()) abort()
      else armDeadline()
    }, Math.ceil(lease!.deadline - performance.now()))
  }
  function scheduleHeartbeat() {
    if (stopped || controller.signal.aborted) return
    heartbeatTimer = setTimeout(() => {
      // Schedule the next renewal only after this request settles; never overlap.
      heartbeat = (async () => {
        requireLive()
        const renewed = await heartbeatRecordingJob(lease!, leaseMs, rpc)
        requireLive()
        lease = renewed
        armDeadline()
      })().catch(abort).then(scheduleHeartbeat)
    }, heartbeatMs)
  }
  function stopHeartbeat() { stopped = true; clearTimeout(heartbeatTimer) }

  try {
    requireLive()
    lease = await claimRecordingJob(jobId, options.workerId, leaseMs, rpc)
    armDeadline()
    lease = await startRecordingJob(lease, rpc)
    armDeadline()
    scheduleHeartbeat()
    // Await owned work itself so cancellation cannot abandon stream/FFmpeg cleanup.
    const result = await consume({ getLease: () => { requireLive(); return lease! }, signal: controller.signal, rpcTimeoutMs })
    stopHeartbeat()
    await heartbeat
    requireLive()
    lease = await checkRecordingJobLease(lease, rpc)
    requireLive()
    return { ...result, lease }
  } catch {
    throw unavailable()
  } finally {
    stopHeartbeat()
    clearTimeout(deadlineTimer)
    abort()
    options.signal?.removeEventListener('abort', abort)
    await heartbeat
  }
}
