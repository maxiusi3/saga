/** @jest-environment node */
import { createClient } from '@supabase/supabase-js'
import {
  claimRecordingJob, startRecordingJob, heartbeatRecordingJob, checkRecordingJobLease, recoverRecordingJob,
} from '../recording-job-lease'

const JOB = '11111111-1111-4111-8111-111111111111'
const PROJECT = '22222222-2222-4222-8222-222222222222'
const ASSET = '33333333-3333-4333-8333-333333333333'
const SESSION = '44444444-4444-4444-8444-444444444444'

function fixture() {
  let state = 'leased'
  let overrides: Record<string, unknown> = {}
  const fetcher = jest.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
    const now = Date.now()
    return new Response(JSON.stringify({ schemaVersion: 1, jobId: JOB, projectId: PROJECT, assetId: ASSET,
      sessionId: SESSION, manifestSha256: 'a'.repeat(64), state, attempt: 1, workerId: 'worker-1',
      leaseExpiresAt: new Date(now + 10000).toISOString(), serverNow: new Date(now).toISOString(),
      canClearLocalDrafts: false, ...overrides }), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  const admin = createClient('https://lease.invalid', 'synthetic-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetcher },
  })
  return { options: { admin, timeoutMs: 100 }, fetcher,
    state: (next: string) => { state = next }, override: (next: Record<string, unknown>) => { overrides = next } }
}

it('uses a single POST with exact arguments and pins the claim receipt', async () => {
  const f = fixture()
  const lease = await claimRecordingJob(JOB, 'worker-1', 10000, f.options)
  expect(f.fetcher).toHaveBeenCalledTimes(1)
  const [url, init] = f.fetcher.mock.calls[0]
  expect(String(url)).toBe('https://lease.invalid/rest/v1/rpc/recording_job_lease')
  expect(init?.method).toBe('POST')
  expect(JSON.parse(String(init?.body))).toEqual({ p_job_id: JOB, p_action: 'claim', p_worker_id: 'worker-1',
    p_attempt: null, p_lease_ms: 10000 })
  expect(lease).toMatchObject({ jobId: JOB, workerId: 'worker-1', attempt: 1, state: 'leased', canClearLocalDrafts: false })
  expect(lease.deadline).toBeGreaterThan(performance.now())
  expect(Object.isFrozen(lease)).toBe(true)
})

it('starts, checks and renews the exact owner and attempt without trusting renewed identity', async () => {
  const f = fixture()
  const claimed = await claimRecordingJob(JOB, 'worker-1', 10000, f.options)
  f.state('running')
  const started = await startRecordingJob(claimed, f.options)
  await checkRecordingJobLease(started, f.options)
  await heartbeatRecordingJob(started, 10000, f.options)
  expect(f.fetcher.mock.calls.slice(1).map(([, init]) => JSON.parse(String(init?.body))))
    .toEqual(['start', 'check', 'heartbeat'].map(action => ({ p_job_id: JOB, p_action: action,
      p_worker_id: 'worker-1', p_attempt: 1, p_lease_ms: action === 'heartbeat' ? 10000 : null })))
  f.override({ manifestSha256: 'b'.repeat(64) })
  await expect(checkRecordingJobLease(started, f.options)).rejects.toThrow('recording_lease_unavailable')
})

it.each([
  { jobId: PROJECT }, { workerId: 'worker-2' }, { schemaVersion: 2 }, { attempt: 0 }, { attempt: 1.5 }, { attempt: 4 },
  { canClearLocalDrafts: true }, { leaseExpiresAt: null }, { leaseExpiresAt: 'infinity' },
  { serverNow: 'not-a-date' }, { manifestSha256: 'bad' }, { state: 'succeeded' }, { extra: true },
])('rejects malformed or contradictory receipt %j', async override => {
  const f = fixture(); f.override(override)
  await expect(claimRecordingJob(JOB, 'worker-1', 10000, f.options)).rejects.toThrow('recording_lease_unavailable')
  expect(f.fetcher).toHaveBeenCalledTimes(1)
})

it.each(['job/other', '', 'UPPERCASE'])('rejects invalid job %s before sending', async jobId => {
  const f = fixture()
  await expect(claimRecordingJob(jobId, 'worker-1', 10000, f.options)).rejects.toThrow()
  expect(f.fetcher).not.toHaveBeenCalled()
})

it.each(['', ' worker', '../worker', 'x'.repeat(129)])('rejects invalid worker %s before sending', async worker => {
  const f = fixture()
  await expect(claimRecordingJob(JOB, worker, 10000, f.options)).rejects.toThrow()
  expect(f.fetcher).not.toHaveBeenCalled()
})

it.each([0, 999, 120001, NaN, 1000.1])('rejects invalid lease duration %s', async leaseMs => {
  const f = fixture()
  await expect(claimRecordingJob(JOB, 'worker-1', leaseMs, f.options)).rejects.toThrow()
  expect(f.fetcher).not.toHaveBeenCalled()
})

it.each(['retry_wait', 'failed', 'outcome_unknown', 'cancelled'])('accepts explicit recovery into %s without a new lease', async state => {
  const f = fixture(); f.state(state); f.override({ workerId: null, leaseExpiresAt: null })
  expect(await recoverRecordingJob(JOB, f.options)).toMatchObject({ state, canClearLocalDrafts: false })
  expect(JSON.parse(String(f.fetcher.mock.calls[0][1]?.body))).toEqual({ p_job_id: JOB, p_action: 'recover',
    p_worker_id: null, p_attempt: null, p_lease_ms: null })
})

it('sanitizes RPC errors and never retries a possibly committed mutation', async () => {
  const f = fixture()
  f.fetcher.mockImplementation(async () => new Response(JSON.stringify({ message: 'SECRET token/path' }), { status: 503 }))
  await expect(claimRecordingJob(JOB, 'worker-1', 10000, f.options)).rejects.toThrow('recording_lease_unavailable')
  expect(f.fetcher).toHaveBeenCalledTimes(1)
})

it('bounds an uncooperative transport and aborts it without dispatching a follow-up', async () => {
  const f = fixture()
  f.fetcher.mockImplementation(() => new Promise(() => {}))
  await expect(claimRecordingJob(JOB, 'worker-1', 10000, { ...f.options, timeoutMs: 15 })).rejects.toThrow()
  expect(f.fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true)
  expect(f.fetcher).toHaveBeenCalledTimes(1)
})

it('honors caller abort both before and during an RPC', async () => {
  const f = fixture(); const controller = new AbortController(); controller.abort()
  await expect(claimRecordingJob(JOB, 'worker-1', 10000, { ...f.options, signal: controller.signal })).rejects.toThrow()
  expect(f.fetcher).not.toHaveBeenCalled()
  const live = new AbortController()
  f.fetcher.mockImplementation(async () => { live.abort(); return new Response('{}') })
  await expect(claimRecordingJob(JOB, 'worker-1', 10000, { ...f.options, signal: live.signal })).rejects.toThrow()
  expect(f.fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true)
})

it('refuses an already-expired server lease', async () => {
  const f = fixture(); f.override({ leaseExpiresAt: '2020-01-01T00:00:00.000Z' })
  await expect(claimRecordingJob(JOB, 'worker-1', 10000, f.options)).rejects.toThrow()
})

it.each(['projectId', 'assetId', 'sessionId', 'attempt', 'workerId'])('rejects a changed %s in a renewal', async field => {
  const f = fixture(); const claim = await claimRecordingJob(JOB, 'worker-1', 10000, f.options)
  f.state('running'); const running = await startRecordingJob(claim, f.options)
  f.override({ [field]: field === 'attempt' ? 2 : field === 'workerId' ? 'worker-2' : JOB })
  await expect(heartbeatRecordingJob(running, 10000, f.options)).rejects.toThrow('recording_lease_unavailable')
  expect(f.fetcher).toHaveBeenCalledTimes(3)
})

it('subtracts transport delay from the usable monotonic deadline', async () => {
  const f = fixture(); const original = f.fetcher.getMockImplementation()!
  f.fetcher.mockImplementation(async (...args) => {
    await new Promise(resolve => setTimeout(resolve, 25))
    return original(...args)
  })
  const lease = await claimRecordingJob(JOB, 'worker-1', 10000, f.options)
  expect(lease.deadline - performance.now()).toBeLessThan(9990)
})

it('refuses to start on an expired local deadline without another mutation', async () => {
  const f = fixture(); const claim = await claimRecordingJob(JOB, 'worker-1', 10000, f.options)
  await expect(startRecordingJob({ ...claim, deadline: 0 }, f.options)).rejects.toThrow()
  expect(f.fetcher).toHaveBeenCalledTimes(1)
})
