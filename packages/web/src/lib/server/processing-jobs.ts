export type ProcessingJobState =
  | 'queued'
  | 'leased'
  | 'running'
  | 'retry_wait'
  | 'succeeded'
  | 'failed'
  | 'outcome_unknown'
  | 'awaiting_review'
  | 'cancelled'

export interface ProcessingJobSnapshot {
  id: string
  projectId: string
  assetId: string
  state: ProcessingJobState
  inputVersion: number
  jobType: string
  processorVersion: string
  modelConfigVersion: string
  parameterVersion: string
  attemptCount: number
  maxAttempts: number
  notBefore: string | null
  leaseOwner: string | null
  leaseExpiresAt: string | null
  cancelRequestedAt: string | null
  // Projected from the latest server-side deletion check, not a deployed job-table column.
  deletionRequestedAt: string | null
  errorCode: string | null
  resultRef: string | null
}

const transitions: Record<ProcessingJobState, readonly ProcessingJobState[]> = {
  queued: ['leased', 'cancelled'],
  leased: ['running', 'retry_wait', 'outcome_unknown', 'cancelled', 'failed'],
  running: ['succeeded', 'retry_wait', 'outcome_unknown', 'awaiting_review', 'cancelled', 'failed'],
  retry_wait: ['leased', 'cancelled', 'failed'],
  succeeded: [],
  failed: [],
  outcome_unknown: ['retry_wait', 'awaiting_review', 'failed', 'cancelled'],
  awaiting_review: ['queued', 'cancelled'],
  cancelled: [],
}

function assertIso(value: string, label: string): number {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ${label}`)
  return timestamp
}

function clone(job: ProcessingJobSnapshot): ProcessingJobSnapshot {
  return { ...job }
}

function clearLease(job: ProcessingJobSnapshot): ProcessingJobSnapshot {
  return { ...job, leaseOwner: null, leaseExpiresAt: null }
}

function assertProcessingAllowed(job: ProcessingJobSnapshot, action: string): void {
  if (job.state === 'cancelled' || job.cancelRequestedAt !== null) {
    throw new Error(`Cannot ${action} a cancelled processing job`)
  }
  // Missing checks fail closed too: adapters must explicitly supply null after checking.
  if (job.deletionRequestedAt !== null) {
    throw new Error(`Cannot ${action} a processing job scheduled for deletion`)
  }
}

function assertResultReference(resultRef: unknown): asserts resultRef is string {
  if (typeof resultRef !== 'string' || !resultRef.trim()) throw new Error('Result reference is required')
}

export function assertProcessingJobTransition(from: ProcessingJobState, to: ProcessingJobState): void {
  if (!transitions[from]?.includes(to)) {
    throw new Error(`Invalid processing job state transition: ${from} -> ${to}`)
  }
}

export function buildProcessingJobIdempotencyKey(input: {
  projectId: string
  assetId: string
  inputVersion: number
  jobType: string
  processorVersion: string
  modelConfigVersion: string
  parameterVersion: string
}): string {
  for (const field of ['projectId', 'assetId', 'jobType', 'processorVersion', 'modelConfigVersion', 'parameterVersion'] as const) {
    const value = input[field]
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
      throw new Error(`Invalid ${field}: expected a non-empty, trimmed string`)
    }
  }
  if (!Number.isSafeInteger(input.inputVersion) || input.inputVersion <= 0) {
    throw new Error('Invalid inputVersion: expected a positive safe integer')
  }
  // Serialize a tuple so delimiters inside any component cannot merge two identities.
  return `processing-job-v1:${JSON.stringify([
    input.projectId,
    input.assetId,
    input.inputVersion,
    input.jobType,
    input.processorVersion,
    input.modelConfigVersion,
    input.parameterVersion,
  ])}`
}

export function claimProcessingJob(
  input: ProcessingJobSnapshot,
  options: { workerId: string; now: string; leaseMs: number },
): ProcessingJobSnapshot {
  assertProcessingAllowed(input, 'claim')
  if (!options.workerId.trim()) throw new Error('Worker id is required')
  const nowMs = assertIso(options.now, 'current time')
  if (!Number.isFinite(options.leaseMs) || options.leaseMs <= 0) throw new Error('Lease duration must be positive')
  if (input.state !== 'queued' && input.state !== 'retry_wait') {
    throw new Error(`Processing job is not claimable from state ${input.state}`)
  }
  if (input.notBefore && assertIso(input.notBefore, 'not-before time') > nowMs) {
    throw new Error('Processing job is not ready to be claimed')
  }
  if (input.attemptCount >= input.maxAttempts) {
    throw new Error('Processing job has exhausted its attempts')
  }

  assertProcessingJobTransition(input.state, 'leased')
  const result = clone(input)
  result.state = 'leased'
  result.attemptCount += 1
  result.leaseOwner = options.workerId
  result.leaseExpiresAt = new Date(nowMs + options.leaseMs).toISOString()
  result.notBefore = null
  result.errorCode = null
  return result
}

export function recoverExpiredProcessingLease(input: ProcessingJobSnapshot, now: string): ProcessingJobSnapshot {
  assertProcessingAllowed(input, 'recover')
  const nowMs = assertIso(now, 'current time')
  if (input.state !== 'leased' && input.state !== 'running') {
    throw new Error(`Processing job has no active lease in state ${input.state}`)
  }
  if (!input.leaseExpiresAt || assertIso(input.leaseExpiresAt, 'lease expiry') > nowMs) {
    throw new Error('Processing job lease has not expired')
  }

  const result = clearLease(input)
  if (input.state === 'leased') {
    if (input.attemptCount >= input.maxAttempts) {
      assertProcessingJobTransition(input.state, 'failed')
      result.state = 'failed'
      result.errorCode = 'lease_expired_before_dispatch_max_attempts'
      result.notBefore = null
    } else {
      assertProcessingJobTransition(input.state, 'retry_wait')
      result.state = 'retry_wait'
      result.errorCode = 'lease_expired_before_dispatch'
      result.notBefore = now
    }
    return result
  }

  assertProcessingJobTransition(input.state, 'outcome_unknown')
  result.state = 'outcome_unknown'
  result.errorCode = 'lease_expired_after_dispatch_unknown'
  result.notBefore = null
  return result
}

export function retryProcessingJob(
  input: ProcessingJobSnapshot,
  options: { now: string; errorCode: string; delayMs: number; controlledRetry?: boolean },
): ProcessingJobSnapshot {
  assertProcessingAllowed(input, 'retry')
  const nowMs = assertIso(options.now, 'current time')
  if (!options.errorCode.trim()) throw new Error('Error code is required')
  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) throw new Error('Retry delay must be non-negative')
  if (input.state === 'outcome_unknown' && options.controlledRetry !== true) {
    throw new Error('Controlled retry is required when the external outcome is unknown')
  }
  if (input.state !== 'running' && input.state !== 'outcome_unknown') {
    throw new Error(`Processing job is not retryable from state ${input.state}`)
  }

  const result = clearLease(input)
  result.errorCode = options.errorCode
  if (input.attemptCount >= input.maxAttempts) {
    assertProcessingJobTransition(input.state, 'failed')
    result.state = 'failed'
    result.notBefore = null
  } else {
    assertProcessingJobTransition(input.state, 'retry_wait')
    result.state = 'retry_wait'
    result.notBefore = new Date(nowMs + options.delayMs).toISOString()
  }
  return result
}

export function enterProcessingJobReview(
  input: ProcessingJobSnapshot,
  now: string,
  resultRef: string,
): ProcessingJobSnapshot {
  assertProcessingAllowed(input, 'review')
  assertIso(now, 'review time')
  // Unknown outcomes must be reconciled separately, never requeued through approval.
  if (input.state !== 'running') throw new Error('Only a running processing job can enter review')
  assertResultReference(resultRef)
  assertProcessingJobTransition(input.state, 'awaiting_review')
  return {
    ...clearLease(input),
    state: 'awaiting_review',
    resultRef,
    notBefore: null,
    errorCode: null,
  }
}

export function approveProcessingJobReview(input: ProcessingJobSnapshot, now: string): ProcessingJobSnapshot {
  assertProcessingAllowed(input, 'approve')
  assertIso(now, 'approval time')
  if (input.state !== 'awaiting_review') throw new Error('Processing job is not awaiting_review')
  assertResultReference(input.resultRef)
  if (input.attemptCount >= input.maxAttempts) throw new Error('Processing job has exhausted its attempts')
  assertProcessingJobTransition(input.state, 'queued')
  // Resume this job without resetting its retry budget. A new stage needs a new identity.
  return { ...clearLease(input), state: 'queued', notBefore: now, errorCode: null }
}

export function requestProcessingJobCancellation(input: ProcessingJobSnapshot, now: string): ProcessingJobSnapshot {
  assertIso(now, 'cancellation time')
  if (input.state === 'cancelled') return clone(input)
  if (input.state === 'succeeded' || input.state === 'failed') {
    throw new Error(`Cannot cancel a ${input.state} processing job`)
  }
  assertProcessingJobTransition(input.state, 'cancelled')
  return { ...clearLease(input), state: 'cancelled', cancelRequestedAt: now, notBefore: null }
}

export function completeProcessingJob(
  input: ProcessingJobSnapshot,
  now: string,
  resultRef: string,
): ProcessingJobSnapshot {
  assertProcessingAllowed(input, 'complete')
  assertIso(now, 'completion time')
  if (input.state !== 'running') {
    throw new Error(`Cannot complete processing job from state ${input.state}`)
  }
  assertResultReference(resultRef)
  assertProcessingJobTransition(input.state, 'succeeded')
  return {
    ...clearLease(input),
    state: 'succeeded',
    resultRef,
    notBefore: null,
    errorCode: null,
  }
}
