/** @jest-environment node */
import {
  claimMediaDeletionJob, startMediaDeletionJob, heartbeatMediaDeletionJob,
  checkMediaDeletionJobLease, recoverMediaDeletionJob,
  type MediaDeletionLease, type MediaDeletionLeaseReceipt,
} from '../media-deletion-lease'
import type { getSupabaseAdmin } from '@/lib/supabase'

const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const subjectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const receipt = {
  schemaVersion: 1, requestId, projectId, subjectId, subjectType: 'story',
  captureTargetsSha256: 'a'.repeat(64), targetCount: 4,
  state: 'leased', attempt: 1, workerId: 'worker-1',
  serverNow: '2026-11-06T00:00:00.123456+00:00', leaseExpiresAt: '2026-11-06T00:01:00.123456+00:00',
  canDeleteStorage: false, physicalDeletionComplete: false,
} as const
const failure = { message: 'media_deletion_lease_unavailable' }
function client(...values: [] | [unknown]) {
  const data = values.length ? values[0] : receipt
  const retry = jest.fn<Promise<unknown>, [boolean]>(() => Promise.resolve({ data, error: null }))
  const abortSignal = jest.fn((_signal: AbortSignal) => ({ retry }))
  const rpc = jest.fn((_name: string, _args: Record<string, unknown>) => ({ abortSignal }))
  return { rpc, retry, abortSignal, admin: { rpc } as unknown as ReturnType<typeof getSupabaseAdmin> }
}
function active(overrides: Record<string, unknown> = {}): MediaDeletionLease {
  return { ...receipt, deadline: performance.now() + 60000, ...overrides } as MediaDeletionLease
}
function deferred(c: ReturnType<typeof client>) {
  let resolve!: (value: unknown) => void
  c.retry.mockImplementation(() => new Promise(done => { resolve = done }))
  return (data: unknown) => resolve({ data, error: null })
}
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

describe('durable deletion lease application boundary', () => {
  it('claims once with all five exact arguments and an immutable 14-key receipt plus local deadline', async () => {
    const c = client(), started = performance.now()
    const value: MediaDeletionLease = await claimMediaDeletionJob(requestId, 'worker-1', 60000, c)
    expect(c.rpc).toHaveBeenCalledTimes(1)
    expect(c.rpc).toHaveBeenCalledWith('media_deletion_job_lease', {
      p_request_id: requestId, p_action: 'claim', p_worker_id: 'worker-1', p_attempt: null, p_lease_ms: 60000,
    })
    expect(c.abortSignal).toHaveBeenCalledTimes(1)
    expect(c.abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal)
    expect(c.retry).toHaveBeenCalledTimes(1); expect(c.retry).toHaveBeenCalledWith(false)
    expect(value).toEqual({ ...receipt, deadline: expect.any(Number) })
    expect(value.deadline).toBeGreaterThanOrEqual(started + 60000)
    expect(value.deadline).toBeLessThanOrEqual(performance.now() + 60000)
    expect(Object.isFrozen(value)).toBe(true); expect(Object.keys(value)).toHaveLength(15)
  })

  it.each(['start', 'heartbeat', 'check'] as const)('forwards exact %s arguments and preserves identity', async action => {
    const lease = active({ state: action === 'heartbeat' ? 'running' : 'leased' })
    const data = { ...receipt, state: 'running' }, c = client(data)
    const value = action === 'start' ? await startMediaDeletionJob(lease, c)
      : action === 'heartbeat' ? await heartbeatMediaDeletionJob(lease, 1000, c)
        : await checkMediaDeletionJobLease(lease, c)
    expect(value).toMatchObject(data); expect(Object.isFrozen(value)).toBe(true)
    expect(c.rpc).toHaveBeenCalledWith('media_deletion_job_lease', {
      p_request_id: requestId, p_action: action, p_worker_id: 'worker-1', p_attempt: 1,
      p_lease_ms: action === 'heartbeat' ? 1000 : null,
    })
    expect(c.retry).toHaveBeenCalledTimes(1); expect(c.retry).toHaveBeenCalledWith(false)
  })

  it('allows live running start replay and same-state check', async () => {
    for (const operation of [startMediaDeletionJob, checkMediaDeletionJobLease]) {
      expect(await operation(active({ state: 'running' }), client({ ...receipt, state: 'running' }))).toMatchObject({ state: 'running' })
    }
    expect(await checkMediaDeletionJobLease(active(), client())).toMatchObject({ state: 'leased' })
  })

  it.each([
    ['retry_wait', 1], ['retry_wait', 2], ['failed', 3],
    ['outcome_unknown', 1], ['outcome_unknown', 2], ['outcome_unknown', 3],
  ] as const)('recovers %s at attempt %i with null SQL fields and no local deadline', async (state, attempt) => {
    const data = { ...receipt, state, attempt, workerId: null, leaseExpiresAt: null }, c = client(data)
    const value: MediaDeletionLeaseReceipt = await recoverMediaDeletionJob(requestId, c)
    expect(value).toEqual(data); expect(Object.keys(value)).toHaveLength(14); expect(Object.isFrozen(value)).toBe(true)
    expect(c.rpc).toHaveBeenCalledWith('media_deletion_job_lease', {
      p_request_id: requestId, p_action: 'recover', p_worker_id: null, p_attempt: null, p_lease_ms: null,
    })
  })

  it.each([
    ['failed', 1], ['failed', 2], ['retry_wait', 3],
  ] as const)('rejects impossible recovered %s at attempt %i', async (state, attempt) => {
    const c = client({ ...receipt, state, attempt, workerId: null, leaseExpiresAt: null })
    await expect(recoverMediaDeletionJob(requestId, c)).rejects.toMatchObject(failure)
  })

  it.each([
    { extra: true }, { deadline: 999999 }, { schemaVersion: 2 }, { requestId: projectId },
    { projectId: projectId.toUpperCase() }, { subjectId: 'private/path' }, { subjectType: 'recording' },
    { captureTargetsSha256: 'A'.repeat(64) }, { captureTargetsSha256: 'a'.repeat(63) },
    { targetCount: 0 }, { targetCount: -1 }, { targetCount: 1.1 }, { targetCount: '4' }, { targetCount: Number.MAX_SAFE_INTEGER + 1 },
    { state: 'completed' }, { state: 'running' }, { state: 'cancelled' },
    { workerId: null }, { workerId: 'bad worker' }, { workerId: 'worker-2' }, { workerId: 'x'.repeat(129) },
    { attempt: 0 }, { attempt: 4 }, { attempt: 1.1 }, { attempt: '1' },
    { canDeleteStorage: true }, { physicalDeletionComplete: true }, { leaseExpiresAt: null },
    { leaseExpiresAt: 'infinity' }, { serverNow: 'yesterday' },
    { serverNow: '2026-02-30T00:00:00Z' }, { serverNow: '2026-11-06T24:00:00Z' },
    { serverNow: '2026-11-06 00:00:00+00' }, { serverNow: '2026-11-06T00:00:00+01:00' },
    { serverNow: '0001-01-01T00:00:00+00:00 BC' }, { serverNow: '10000-01-01T00:00:00Z' },
    { serverNow: '2026-11-06T00:00:00.1234567Z' },
    { leaseExpiresAt: '2026-11-06T00:00:00.123455Z' },
    { leaseExpiresAt: receipt.serverNow }, { leaseExpiresAt: '2026-11-06T00:01:00.123457Z' },
  ])('rejects malformed, overlong or overprivileged claim receipt %j', async mutation => {
    await expect(claimMediaDeletionJob(requestId, 'worker-1', 60000, client({ ...receipt, ...mutation }))).rejects.toMatchObject(failure)
  })

  it('rejects every missing receipt key and all nonobject receipts', async () => {
    const missing = Object.keys(receipt).map(key => Object.fromEntries(Object.entries(receipt).filter(([k]) => k !== key)))
    for (const data of [null, undefined, [], 'receipt', 1, {}, ...missing]) {
      await expect(claimMediaDeletionJob(requestId, 'worker-1', 60000, client(data))).rejects.toMatchObject(failure)
    }
  })

  it('compares exact UTC microseconds even for dates beyond safe integer epoch microseconds', async () => {
    jest.spyOn(performance, 'now').mockReturnValue(100)
    const data = { ...receipt, serverNow: '9999-12-31T00:00:00.123455Z', leaseExpiresAt: '9999-12-31T00:00:00.123456+00:00' }
    expect((await claimMediaDeletionJob(requestId, 'worker-1', 1000, client(data))).deadline).toBeCloseTo(100.001, 9)
    await expect(claimMediaDeletionJob(requestId, 'worker-1', 1000, client({ ...data, serverNow: data.leaseExpiresAt, leaseExpiresAt: data.serverNow }))).rejects.toMatchObject(failure)
  })

  it('accepts canonical historical years without depending on client wall-clock synchronization', async () => {
    for (const year of ['0001', '0099', '1900']) {
      const data = { ...receipt, serverNow: `${year}-01-01T00:00:00Z`, leaseExpiresAt: `${year}-01-01T00:01:00Z` }
      expect(await claimMediaDeletionJob(requestId, 'worker-1', 60000, client(data))).toMatchObject(data)
    }
  })

  it.each(['requestId', 'projectId', 'subjectId', 'subjectType', 'captureTargetsSha256', 'targetCount', 'workerId', 'attempt'])('pins %s on every active operation', async key => {
    const changes: Record<string, unknown> = { requestId: projectId, projectId: subjectId, subjectId: projectId, subjectType: 'media_asset', captureTargetsSha256: 'b'.repeat(64), targetCount: 5, workerId: 'worker-2', attempt: 2 }
    for (const operation of [startMediaDeletionJob, checkMediaDeletionJobLease, (l: MediaDeletionLease, c: ReturnType<typeof client>) => heartbeatMediaDeletionJob(l, 60000, c)]) {
      const c = client(), deliver = deferred(c), input = active({ state: 'running' })
      const pending = operation(input, c)
      Object.assign(input, { [key]: changes[key] })
      deliver({ ...receipt, state: 'running', [key]: changes[key] })
      await expect(pending).rejects.toMatchObject(failure)
    }
  })

  it('uses the original cloned lease and options when caller objects are mutated during transport', async () => {
    const c = client(), deliver = deferred(c), input = active(), controller = new AbortController()
    const options = { ...c, signal: controller.signal, timeoutMs: 5000 }
    const pending = startMediaDeletionJob(input, options)
    Object.assign(input, { requestId: projectId, state: 'failed', deadline: 0, workerId: 'other' })
    options.timeoutMs = 0; options.signal = new AbortController().signal
    deliver({ ...receipt, state: 'running' })
    expect(await pending).toMatchObject({ requestId, state: 'running', workerId: 'worker-1' })
  })

  it('clones the transport receipt before returning the immutable lease', async () => {
    const data = { ...receipt }, value = await claimMediaDeletionJob(requestId, 'worker-1', 60000, client(data))
    data.targetCount = 99 as 4
    expect(value.targetCount).toBe(4); expect(value).not.toBe(data)
  })

  it('rejects state regressions, heartbeat before start and active recovery receipts', async () => {
    await expect(checkMediaDeletionJobLease(active({ state: 'running' }), client())).rejects.toMatchObject(failure)
    await expect(startMediaDeletionJob(active(), client())).rejects.toMatchObject(failure)
    const c = client(); await expect(heartbeatMediaDeletionJob(active(), 1000, c)).rejects.toMatchObject(failure); expect(c.rpc).not.toHaveBeenCalled()
    await expect(recoverMediaDeletionJob(requestId, client())).rejects.toMatchObject(failure)
    for (const mutation of [{ workerId: 'worker-1' }, { leaseExpiresAt: receipt.leaseExpiresAt }, { requestId: projectId }, { deadline: 100 }]) {
      await expect(recoverMediaDeletionJob(requestId, client({ ...receipt, state: 'retry_wait', workerId: null, leaseExpiresAt: null, ...mutation }))).rejects.toMatchObject(failure)
    }
  })

  it('allows shorter heartbeat requests without shortening server expiry and rejects TTL above 120000 ms', async () => {
    const input = active({ state: 'running' }), data = { ...receipt, state: 'running' }
    expect(await heartbeatMediaDeletionJob(input, 1000, client(data))).toMatchObject(data)
    await expect(heartbeatMediaDeletionJob(input, 1000, client({ ...data, leaseExpiresAt: '2026-11-06T00:00:59.123456Z' }))).rejects.toMatchObject(failure)
    await expect(heartbeatMediaDeletionJob(input, 120000, client({ ...data, leaseExpiresAt: '2026-11-06T00:02:00.123457Z' }))).rejects.toMatchObject(failure)
  })

  it('rejects bad request/worker/duration/options values before transport', async () => {
    for (const id of [null, undefined, '', requestId.toUpperCase(), 'x', {}, 1]) {
      const c = client(); await expect(claimMediaDeletionJob(id as string, 'worker-1', 60000, c)).rejects.toMatchObject(failure); expect(c.rpc).not.toHaveBeenCalled()
      await expect(recoverMediaDeletionJob(id as string, c)).rejects.toMatchObject(failure); expect(c.rpc).not.toHaveBeenCalled()
    }
    for (const worker of ['', 'bad worker', 'a'.repeat(129), null, {}, 1]) {
      const c = client(); await expect(claimMediaDeletionJob(requestId, worker as string, 60000, c)).rejects.toMatchObject(failure); expect(c.rpc).not.toHaveBeenCalled()
    }
    for (const duration of [0, 999, 120001, 1000.1, NaN, Infinity, '1000', null]) {
      const c = client(); await expect(claimMediaDeletionJob(requestId, 'worker-1', duration as number, c)).rejects.toMatchObject(failure); expect(c.rpc).not.toHaveBeenCalled()
      await expect(heartbeatMediaDeletionJob(active({ state: 'running' }), duration as number, c)).rejects.toMatchObject(failure); expect(c.rpc).not.toHaveBeenCalled()
    }
    for (const timeoutMs of [0, 60001, 1.1, NaN, Infinity, null, '1000']) {
      const c = client(); await expect(claimMediaDeletionJob(requestId, 'worker-1', 60000, { ...c, timeoutMs: timeoutMs as number })).rejects.toMatchObject(failure); expect(c.rpc).not.toHaveBeenCalled()
    }
  })

  it.each(['start', 'heartbeat', 'check'] as const)('rejects expired or malformed %s input before transport', async action => {
    const operation = (value: MediaDeletionLease, c: ReturnType<typeof client>) => action === 'start' ? startMediaDeletionJob(value, c)
      : action === 'heartbeat' ? heartbeatMediaDeletionJob(value, 60000, c) : checkMediaDeletionJobLease(value, c)
    for (const input of [null, undefined, {}, active({ state: 'running', deadline: 0 }), active({ deadline: NaN }), active({ deadline: Infinity }), active({ extra: true }), active({ state: 'failed' }), active({ physicalDeletionComplete: true })]) {
      const c = client(); await expect(operation(input as MediaDeletionLease, c)).rejects.toMatchObject(failure); expect(c.rpc).not.toHaveBeenCalled()
    }
  })

  it('counts transport waiting against the returned local deadline and rejects a reply after local expiry', async () => {
    let now = 100
    jest.spyOn(performance, 'now').mockImplementation(() => now)
    const c = client(), deliver = deferred(c), pending = claimMediaDeletionJob(requestId, 'worker-1', 60000, c)
    now = 400; deliver(receipt)
    expect((await pending).deadline).toBe(60100)
    const late = client(), reply = deferred(late), waiting = claimMediaDeletionJob(requestId, 'worker-1', 60000, late)
    now = 60400; reply(receipt)
    await expect(waiting).rejects.toMatchObject(failure)
  })

  it('bounds a hung transport by the pinned active deadline even if caller mutates it', async () => {
    jest.useFakeTimers()
    const c = client(), input = active({ state: 'running', deadline: performance.now() + 5 })
    c.retry.mockImplementation(() => new Promise(() => {}))
    const pending = heartbeatMediaDeletionJob(input, 60000, { ...c, timeoutMs: 5000 })
    const checked = expect(pending).rejects.toMatchObject(failure)
    Object.assign(input, { deadline: performance.now() + 120000 })
    await jest.advanceTimersByTimeAsync(5); await checked
    expect(c.rpc).toHaveBeenCalledTimes(1); expect(c.abortSignal.mock.calls[0][0].aborted).toBe(true)
  })

  it.each([false, true])('rejects ignored cancellation promptly (caller=%s) with no retry', async caller => {
    jest.useFakeTimers()
    const c = client(), controller = new AbortController()
    c.retry.mockImplementation(() => new Promise(() => {}))
    const options = { ...c, timeoutMs: 10, signal: controller.signal }
    const pending = claimMediaDeletionJob(requestId, 'worker-1', 60000, options)
    const checked = expect(pending).rejects.toMatchObject(failure)
    options.signal = new AbortController().signal
    if (caller) controller.abort(); else await jest.advanceTimersByTimeAsync(10)
    await checked
    expect(c.rpc).toHaveBeenCalledTimes(1); expect(c.retry).toHaveBeenCalledTimes(1)
    expect(c.abortSignal.mock.calls[0][0].aborted).toBe(true)
  })

  it('rejects pre-abort before transport and expiry after response even when timers have not fired', async () => {
    const controller = new AbortController(); controller.abort(); const c = client()
    await expect(claimMediaDeletionJob(requestId, 'worker-1', 60000, { ...c, signal: controller.signal })).rejects.toMatchObject(failure)
    expect(c.rpc).not.toHaveBeenCalled()
    let now = 0; jest.spyOn(performance, 'now').mockImplementation(() => now)
    const slow = client(), deliver = deferred(slow), pending = claimMediaDeletionJob(requestId, 'worker-1', 60000, { ...slow, timeoutMs: 5 })
    now = 5; deliver(receipt); await expect(pending).rejects.toMatchObject(failure)
  })

  it('also enforces the timeout after validating a recovery receipt', async () => {
    let now = 0
    jest.spyOn(performance, 'now').mockImplementation(() => now)
    const data = { ...receipt, state: 'retry_wait', workerId: null, leaseExpiresAt: null,
      get serverNow() { now = 5; return receipt.serverNow },
    }
    await expect(recoverMediaDeletionJob(requestId, { ...client(data), timeoutMs: 5 })).rejects.toMatchObject(failure)
  })

  it.each(['42501', '23505', '22023', '55P03', 'XX000'])('hides SQL %s details with a single no-retry call', async code => {
    const c = client(); c.retry.mockResolvedValue({ error: { code, message: 'private/path' }, data: null })
    await expect(claimMediaDeletionJob(requestId, 'worker-1', 60000, c)).rejects.toMatchObject(failure)
    expect(c.rpc).toHaveBeenCalledTimes(1); expect(c.retry).toHaveBeenCalledTimes(1)
  })

  it('lost claim/start responses fail generically, allow explicit observation, and never auto-retry', async () => {
    for (const start of [false, true]) {
      const c = client(); c.retry.mockRejectedValue(new Error('lost private/path response'))
      await expect(start ? startMediaDeletionJob(active(), c) : claimMediaDeletionJob(requestId, 'worker-1', 60000, c)).rejects.toMatchObject(failure)
      expect(c.rpc).toHaveBeenCalledTimes(1); expect(c.retry).toHaveBeenCalledTimes(1)
    }
    expect(await checkMediaDeletionJobLease(active(), client({ ...receipt, state: 'running' }))).toMatchObject({ state: 'running' })
    expect(await recoverMediaDeletionJob(requestId, client({ ...receipt, state: 'outcome_unknown', workerId: null, leaseExpiresAt: null }))).toMatchObject({ state: 'outcome_unknown' })
  })
})
