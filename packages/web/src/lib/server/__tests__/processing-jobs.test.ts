import {
  approveProcessingJobReview,
  assertProcessingJobTransition,
  buildProcessingJobIdempotencyKey,
  claimProcessingJob,
  completeProcessingJob,
  enterProcessingJobReview,
  recoverExpiredProcessingLease,
  requestProcessingJobCancellation,
  retryProcessingJob,
} from '../processing-jobs'
import type { ProcessingJobSnapshot } from '../processing-jobs'

const now = '2026-10-13T12:00:00.000Z'

function job(overrides: Partial<ProcessingJobSnapshot> = {}): ProcessingJobSnapshot {
  return {
    id: 'job-1',
    projectId: 'project-1',
    assetId: 'asset-1',
    state: 'queued',
    inputVersion: 2,
    jobType: 'transcribe',
    processorVersion: 'asr-v1',
    modelConfigVersion: 'model-v1',
    parameterVersion: 'params-v1',
    attemptCount: 0,
    maxAttempts: 3,
    notBefore: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    cancelRequestedAt: null,
    deletionRequestedAt: null,
    errorCode: null,
    resultRef: null,
    ...overrides,
  }
}

describe('processing job state contract', () => {
  it('builds a stable idempotency key that changes with input or processor versions', () => {
    const input = {
      projectId: 'project-1',
      assetId: 'asset-1',
      inputVersion: 2,
      jobType: 'transcribe',
      processorVersion: 'asr-v1',
      modelConfigVersion: 'model-v1',
      parameterVersion: 'params-v1',
    }

    expect(buildProcessingJobIdempotencyKey(input)).toBe(buildProcessingJobIdempotencyKey(input))
    expect(buildProcessingJobIdempotencyKey({ ...input, inputVersion: 3 })).not.toBe(
      buildProcessingJobIdempotencyKey(input),
    )
  })

  it.each([
    'projectId', 'assetId', 'jobType', 'processorVersion', 'modelConfigVersion', 'parameterVersion',
  ] as const)('includes %s in the idempotency identity and rejects blank values', (field) => {
    const input = job()
    expect(buildProcessingJobIdempotencyKey({ ...input, [field]: `${input[field]}-next` }))
      .not.toBe(buildProcessingJobIdempotencyKey(input))
    for (const invalid of ['', ' ', '\t\n', ' padded ']) {
      expect(() => buildProcessingJobIdempotencyKey({ ...input, [field]: invalid })).toThrow(field)
    }
  })

  it.each([null, undefined, 7])('rejects missing or non-string identity fields: %s', (invalid) => {
    const fields = ['projectId', 'assetId', 'jobType', 'processorVersion', 'modelConfigVersion', 'parameterVersion']
    for (const field of fields) {
      expect(() => buildProcessingJobIdempotencyKey({ ...job(), [field]: invalid })).toThrow(field)
    }
  })

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid input version %s', (inputVersion) => {
      expect(() => buildProcessingJobIdempotencyKey({ ...job(), inputVersion })).toThrow('inputVersion')
    },
  )

  it.each([null, undefined, '2'])('does not coerce input version %s', (inputVersion) => {
    // @ts-expect-error Deliberately exercise malformed input from a future persistence adapter.
    expect(() => buildProcessingJobIdempotencyKey({ ...job(), inputVersion })).toThrow('inputVersion')
  })

  it('keeps delimiter-containing identities distinct', () => {
    const first = { ...job(), projectId: 'project:a', assetId: 'b' }
    const second = { ...job(), projectId: 'project', assetId: 'a:b' }
    expect(buildProcessingJobIdempotencyKey(first)).not.toBe(buildProcessingJobIdempotencyKey(second))
    expect(buildProcessingJobIdempotencyKey({ ...job(), projectId: 'project%3Aa' }))
      .not.toBe(buildProcessingJobIdempotencyKey({ ...job(), projectId: 'project:a' }))
  })

  it('allows only contract-defined transitions', () => {
    expect(() => assertProcessingJobTransition('queued', 'leased')).not.toThrow()
    expect(() => assertProcessingJobTransition('running', 'outcome_unknown')).not.toThrow()
    expect(() => assertProcessingJobTransition('succeeded', 'retry_wait')).toThrow(
      'Invalid processing job state transition',
    )
  })

  it('claims queued work only when it is due and increments the attempt count', () => {
    const claimed = claimProcessingJob(job({ notBefore: '2026-10-13T11:59:00.000Z' }), {
      workerId: 'worker-a',
      now,
      leaseMs: 30_000,
    })

    expect(claimed).toMatchObject({
      state: 'leased',
      attemptCount: 1,
      leaseOwner: 'worker-a',
      leaseExpiresAt: '2026-10-13T12:00:30.000Z',
    })
    expect(() => claimProcessingJob(job({ notBefore: '2026-10-13T12:01:00.000Z' }), {
      workerId: 'worker-a',
      now,
      leaseMs: 30_000,
    })).toThrow('not ready to be claimed')
  })

  it('recovers an expired pre-dispatch lease into retry_wait', () => {
    const recovered = recoverExpiredProcessingLease(job({
      state: 'leased',
      leaseOwner: 'worker-a',
      leaseExpiresAt: '2026-10-13T11:59:59.000Z',
      attemptCount: 1,
    }), now)

    expect(recovered).toMatchObject({
      state: 'retry_wait',
      notBefore: now,
      leaseOwner: null,
      leaseExpiresAt: null,
      errorCode: 'lease_expired_before_dispatch',
    })
  })

  it('recovers an expired running lease as outcome_unknown instead of blind retry', () => {
    const recovered = recoverExpiredProcessingLease(job({
      state: 'running',
      leaseOwner: 'worker-a',
      leaseExpiresAt: '2026-10-13T11:59:59.000Z',
      attemptCount: 1,
    }), now)

    expect(recovered).toMatchObject({
      state: 'outcome_unknown',
      leaseOwner: null,
      leaseExpiresAt: null,
      errorCode: 'lease_expired_after_dispatch_unknown',
    })
    expect(() => retryProcessingJob(recovered, { now, errorCode: 'retry', delayMs: 0 })).toThrow(
      'Controlled retry is required',
    )
  })

  it('moves retryable work to retry_wait and fails after max attempts', () => {
    const retry = retryProcessingJob(job({
      state: 'running',
      attemptCount: 1,
      leaseOwner: 'worker-a',
      leaseExpiresAt: '2026-10-13T12:00:30.000Z',
    }), { now, errorCode: 'provider_timeout', delayMs: 5_000 })
    expect(retry).toMatchObject({
      state: 'retry_wait',
      notBefore: '2026-10-13T12:00:05.000Z',
      errorCode: 'provider_timeout',
      leaseOwner: null,
    })

    const failed = retryProcessingJob(job({
      state: 'running',
      attemptCount: 3,
      leaseOwner: 'worker-a',
      leaseExpiresAt: '2026-10-13T12:00:30.000Z',
    }), { now, errorCode: 'provider_timeout', delayMs: 5_000 })
    expect(failed).toMatchObject({ state: 'failed', errorCode: 'provider_timeout', leaseOwner: null })
  })

  it('cancels active work and rejects a late completion', () => {
    const cancelled = requestProcessingJobCancellation(job({
      state: 'running',
      leaseOwner: 'worker-a',
      leaseExpiresAt: '2026-10-13T12:00:30.000Z',
    }), now)

    expect(cancelled).toMatchObject({
      state: 'cancelled',
      cancelRequestedAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    expect(() => completeProcessingJob(cancelled, now, 'result-1')).toThrow(
      'Cannot complete a cancelled processing job',
    )
  })

  it('completes running work exactly once with a result reference', () => {
    const completed = completeProcessingJob(job({
      state: 'running',
      leaseOwner: 'worker-a',
      leaseExpiresAt: '2026-10-13T12:00:30.000Z',
    }), now, 'artifact-1')

    expect(completed).toMatchObject({
      state: 'succeeded',
      resultRef: 'artifact-1',
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    expect(() => completeProcessingJob(completed, now, 'artifact-2')).toThrow(
      'Cannot complete processing job from state succeeded',
    )
  })

  it('releases the lease while awaiting review and resumes after approval on a later day', () => {
    const waiting = enterProcessingJobReview(job({
      state: 'running',
      attemptCount: 1,
      leaseOwner: 'worker-a',
      leaseExpiresAt: '2026-10-13T12:00:30.000Z',
      errorCode: 'previous_error',
    }), now, 'artifact-for-review')
    expect(waiting).toMatchObject({
      state: 'awaiting_review', resultRef: 'artifact-for-review',
      leaseOwner: null, leaseExpiresAt: null, notBefore: null, errorCode: null,
    })

    const tomorrow = '2026-10-14T12:00:00.000Z'
    const approved = approveProcessingJobReview(waiting, tomorrow)
    expect(approved).toMatchObject({
      state: 'queued', attemptCount: 1, resultRef: 'artifact-for-review',
      leaseOwner: null, leaseExpiresAt: null, notBefore: tomorrow, errorCode: null,
    })
    expect(() => claimProcessingJob(approved, { workerId: 'worker-b', now, leaseMs: 30_000 }))
      .toThrow('not ready')
    expect(claimProcessingJob(approved, { workerId: 'worker-b', now: tomorrow, leaseMs: 30_000 }))
      .toMatchObject({ state: 'leased', attemptCount: 2, leaseOwner: 'worker-b' })
    expect(() => approveProcessingJobReview(approved, tomorrow)).toThrow('awaiting_review')
  })

  it('requires a durable review reference and valid times at review boundaries', () => {
    const running = job({ state: 'running' })
    expect(() => enterProcessingJobReview(running, now, ' ')).toThrow('Result reference')
    expect(() => enterProcessingJobReview(running, 'bad-time', 'artifact')).toThrow('time')
    expect(() => approveProcessingJobReview(job({ state: 'awaiting_review' }), now))
      .toThrow('Result reference')
    expect(() => approveProcessingJobReview(job({ state: 'awaiting_review', resultRef: 'artifact' }), 'bad-time'))
      .toThrow('time')
  })

  it('does not reset the attempt budget through approval', () => {
    const input = job({ state: 'awaiting_review', attemptCount: 3, resultRef: 'artifact' })
    expect(() => approveProcessingJobReview(input, now)).toThrow('exhausted')
  })

  it.each([undefined, false, 'true', 1])('requires explicit boolean approval for unknown-result retry: %s', (controlledRetry) => {
    const options = { now, errorCode: 'provider_result_unavailable', delayMs: 0, controlledRetry }
    // @ts-expect-error Truthy runtime values must never authorize a controlled retry.
    expect(() => retryProcessingJob(job({ state: 'outcome_unknown', attemptCount: 1 }), options))
      .toThrow('Controlled retry is required')
  })

  it('allows controlled unknown-result retry once due and still respects the attempt budget', () => {
    const unknown = job({ state: 'outcome_unknown', attemptCount: 1 })
    const retried = retryProcessingJob(unknown, { now, errorCode: 'confirmed_retry', delayMs: 5_000, controlledRetry: true })
    expect(retried).toMatchObject({ state: 'retry_wait', notBefore: '2026-10-13T12:00:05.000Z', attemptCount: 1 })
    expect(() => claimProcessingJob(retried, { workerId: 'worker-b', now, leaseMs: 30_000 })).toThrow('not ready')
    expect(retryProcessingJob({ ...unknown, attemptCount: 3 }, {
      now, errorCode: 'confirmed_retry', delayMs: 0, controlledRetry: true,
    })).toMatchObject({ state: 'failed', notBefore: null, attemptCount: 3 })
    expect(() => enterProcessingJobReview(unknown, now, 'unverified-result')).toThrow('running')
    expect(() => approveProcessingJobReview(unknown, now)).toThrow('awaiting_review')
  })

  it.each(['cancelRequestedAt', 'deletionRequestedAt'] as const)(
    'blocks new work and late results when %s is present, even before state cancellation', (field) => {
      const input = job({ [field]: now })
      const rejected = /cancelled|deletion/
      expect(() => claimProcessingJob(input, { workerId: 'worker-a', now, leaseMs: 30_000 })).toThrow(rejected)
      expect(() => retryProcessingJob({ ...input, state: 'running' }, {
        now, errorCode: 'retry', delayMs: 0,
      })).toThrow(rejected)
      expect(() => retryProcessingJob({ ...input, state: 'outcome_unknown' }, {
        now, errorCode: 'retry', delayMs: 0, controlledRetry: true,
      })).toThrow(rejected)
      expect(() => recoverExpiredProcessingLease({
        ...input, state: 'leased', leaseExpiresAt: now,
      }, now)).toThrow(rejected)
      expect(() => enterProcessingJobReview({ ...input, state: 'running' }, now, 'artifact')).toThrow(rejected)
      expect(() => approveProcessingJobReview({ ...input, state: 'awaiting_review', resultRef: 'artifact' }, now))
        .toThrow(rejected)
      expect(() => completeProcessingJob({ ...input, state: 'running' }, now, 'artifact')).toThrow(rejected)
    },
  )

  it('never reclaims a cancelled task and preserves the first cancellation timestamp', () => {
    const cancelled = requestProcessingJobCancellation(job(), now)
    expect(() => claimProcessingJob(cancelled, { workerId: 'worker-a', now, leaseMs: 30_000 })).toThrow('cancelled')
    expect(requestProcessingJobCancellation(cancelled, '2026-10-14T12:00:00.000Z')).toEqual(cancelled)
  })

  it('returns new snapshots without mutating inputs across recovery operations', () => {
    const assertSnapshot = (input: ProcessingJobSnapshot, operation: (value: ProcessingJobSnapshot) => ProcessingJobSnapshot) => {
      const before = { ...input }
      Object.freeze(input)
      expect(operation(input)).not.toBe(input)
      expect(input).toEqual(before)
    }
    assertSnapshot(job(), (input) => claimProcessingJob(input, { workerId: 'worker-a', now, leaseMs: 30_000 }))
    assertSnapshot(job({ state: 'leased', leaseExpiresAt: now }), (input) => recoverExpiredProcessingLease(input, now))
    assertSnapshot(job({ state: 'running' }), (input) => retryProcessingJob(input, { now, errorCode: 'retry', delayMs: 0 }))
    assertSnapshot(job(), (input) => requestProcessingJobCancellation(input, now))
    assertSnapshot(job({ state: 'cancelled', cancelRequestedAt: now }), (input) => requestProcessingJobCancellation(input, now))
    assertSnapshot(job({ state: 'running' }), (input) => completeProcessingJob(input, now, 'artifact'))
    assertSnapshot(job({ state: 'running' }), (input) => enterProcessingJobReview(input, now, 'artifact'))
    assertSnapshot(job({ state: 'awaiting_review', resultRef: 'artifact' }), (input) => approveProcessingJobReview(input, now))
  })
})
