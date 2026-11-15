/** @jest-environment node */
import { claimRecordingJob, startRecordingJob, heartbeatRecordingJob, checkRecordingJobLease, type RecordingJobLease } from '../recording-job-lease'
import { verifyRecordingJobInput, withVerifiedRecordingJobInput } from '../recording-job-verifier'
import { verifyLeasedRecordingJobInput } from '../recording-job-worker'
import { prepareLeasedRecordingJobCandidate } from '../recording-candidate-worker'
import { reserveRecordingOutputCandidate, prepareRecordingOutputCandidate } from '../recording-output-candidate'
import { uploadAndVerifyRecordingCandidate } from '../recording-candidate-storage'

jest.mock('../recording-job-lease', () => ({ claimRecordingJob: jest.fn(), startRecordingJob: jest.fn(),
  heartbeatRecordingJob: jest.fn(), checkRecordingJobLease: jest.fn() }))
jest.mock('../recording-job-verifier', () => ({ verifyRecordingJobInput: jest.fn(), withVerifiedRecordingJobInput: jest.fn() }))
jest.mock('../recording-output-candidate', () => ({ reserveRecordingOutputCandidate: jest.fn(), prepareRecordingOutputCandidate: jest.fn() }))
jest.mock('../recording-candidate-storage', () => ({ uploadAndVerifyRecordingCandidate: jest.fn() }))
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
beforeEach(() => jest.resetAllMocks())

function fixture() {
  const events: string[] = []
  const lease: RecordingJobLease = { schemaVersion: 1, jobId: 'job-1', projectId: 'p1', assetId: 'a1', sessionId: 's1',
    manifestSha256: 'a'.repeat(64), state: 'leased', attempt: 1, workerId: 'worker-1',
    leaseExpiresAt: new Date(Date.now() + 1000).toISOString(), serverNow: new Date().toISOString(),
    canClearLocalDrafts: false, deadline: performance.now() + 1000 }
  jest.mocked(claimRecordingJob).mockImplementation(async () => { events.push('claim'); return lease })
  jest.mocked(startRecordingJob).mockImplementation(async input => { events.push('start'); return { ...input, state: 'running' } })
  jest.mocked(heartbeatRecordingJob).mockImplementation(async input => {
    events.push('heartbeat'); return { ...input, deadline: performance.now() + 1000 }
  })
  jest.mocked(checkRecordingJobLease).mockImplementation(async input => { events.push('check'); return input })
  const result = { status: 'input_verified' as const, jobId: 'job-1', canClearLocalDrafts: false as const,
    completion: {} as Awaited<ReturnType<typeof verifyRecordingJobInput>>['completion'] }
  jest.mocked(verifyRecordingJobInput).mockImplementation(async () => { events.push('verify'); return result })
  const options = { admin: {} as Parameters<typeof verifyRecordingJobInput>[1]['admin'], storageUrl: 'https://storage.invalid',
    serviceRoleKey: 'synthetic-key', ffmpeg: { executable: '/test/ffmpeg', timeoutMs: 1000, maxDurationMs: 1000 },
    workerId: 'worker-1', leaseMs: 1000, heartbeatMs: 15, rpcTimeoutMs: 100 }
  function waitForAbort() {
    jest.mocked(verifyRecordingJobInput).mockImplementation((_job, input) => new Promise((_, reject) => {
      const aborted = () => { events.push('cleaned'); reject(new Error('aborted')) }
      if (input.signal?.aborted) aborted()
      else input.signal?.addEventListener('abort', aborted, { once: true })
    }))
  }
  return { events, lease, options, result, waitForAbort }
}

it('claims and starts before actual verification, then checks without publishing or cleanup permission', async () => {
  const f = fixture()
  expect(await verifyLeasedRecordingJobInput('job-1', f.options)).toMatchObject({ ...f.result, lease: { state: 'running', attempt: 1 } })
  expect(f.events).toEqual(['claim', 'start', 'verify', 'check'])
  expect(verifyRecordingJobInput).toHaveBeenCalledWith('job-1', expect.objectContaining({ lease: expect.objectContaining({ state: 'running' }), signal: expect.any(AbortSignal) }))
  await pause(35)
  expect(heartbeatRecordingJob).not.toHaveBeenCalled()
})

it('renews serially during a long verification and stops all heartbeats before returning', async () => {
  const f = fixture(); let active = 0; let maximum = 0
  jest.mocked(heartbeatRecordingJob).mockImplementation(async input => {
    active++; maximum = Math.max(maximum, active); await pause(20); active--
    return { ...input, deadline: performance.now() + 1000 }
  })
  jest.mocked(verifyRecordingJobInput).mockImplementation(async () => { await pause(95); return f.result })
  await verifyLeasedRecordingJobInput('job-1', f.options)
  expect(jest.mocked(heartbeatRecordingJob).mock.calls.length).toBeGreaterThanOrEqual(2)
  expect(maximum).toBe(1); expect(active).toBe(0)
  const count = jest.mocked(heartbeatRecordingJob).mock.calls.length
  await pause(40)
  expect(heartbeatRecordingJob).toHaveBeenCalledTimes(count)
})

it.each(['claim', 'start'])('does not retry or dispatch after an unknown %s response', async phase => {
  const f = fixture()
  jest.mocked(phase === 'claim' ? claimRecordingJob : startRecordingJob).mockRejectedValue(new Error('SECRET unknown commit'))
  await expect(verifyLeasedRecordingJobInput('job-1', f.options)).rejects.toThrow('recording_worker_unavailable')
  expect(claimRecordingJob).toHaveBeenCalledTimes(1)
  expect(startRecordingJob).toHaveBeenCalledTimes(phase === 'claim' ? 0 : 1)
  expect(verifyRecordingJobInput).not.toHaveBeenCalled()
  expect(heartbeatRecordingJob).not.toHaveBeenCalled()
})

it('aborts verification and awaits its cleanup when the heartbeat loses the fence', async () => {
  const f = fixture(); f.waitForAbort()
  jest.mocked(heartbeatRecordingJob).mockRejectedValue(new Error('SECRET stale owner'))
  await expect(verifyLeasedRecordingJobInput('job-1', f.options)).rejects.toThrow('recording_worker_unavailable')
  expect(f.events).toContain('cleaned')
  expect(checkRecordingJobLease).not.toHaveBeenCalled()
  expect(jest.mocked(verifyRecordingJobInput).mock.calls[0][1].signal?.aborted).toBe(true)
})

it('waits for asynchronous verifier cleanup after caller cancellation', async () => {
  const f = fixture(); const controller = new AbortController()
  let release!: () => void
  let began!: () => void
  const started = new Promise<void>(resolve => { began = resolve })
  jest.mocked(verifyRecordingJobInput).mockImplementation((_job, input) => new Promise((_, reject) => {
    input.signal!.addEventListener('abort', () => {
      release = () => { f.events.push('cleaned'); reject(new Error('cleaned')) }
      began()
    }, { once: true })
  }))
  let settled = false
  const pending = verifyLeasedRecordingJobInput('job-1', { ...f.options, signal: controller.signal })
  const rejected = expect(pending).rejects.toThrow('recording_worker_unavailable')
  void pending.then(() => { settled = true }, () => { settled = true })
  await pause(5); controller.abort(); await started; await pause(5)
  expect(settled).toBe(false)
  release(); await rejected
  expect(f.events).toContain('cleaned')
})

it('uses the conservative lease deadline even when no heartbeat has started yet', async () => {
  const f = fixture(); f.waitForAbort()
  jest.mocked(startRecordingJob).mockResolvedValue({ ...f.lease, state: 'running', deadline: performance.now() + 35 })
  await expect(verifyLeasedRecordingJobInput('job-1', { ...f.options, heartbeatMs: 100 })).rejects.toThrow()
  expect(f.events).toContain('cleaned')
  expect(heartbeatRecordingJob).not.toHaveBeenCalled()
})

it('rejects rather than returning evidence when the final fence check fails', async () => {
  const f = fixture(); jest.mocked(checkRecordingJobLease).mockRejectedValue(new Error('revoked'))
  await expect(verifyLeasedRecordingJobInput('job-1', f.options)).rejects.toThrow()
})

it('drains an in-flight heartbeat before the final check', async () => {
  const f = fixture()
  let release!: () => void
  let began!: () => void
  const started = new Promise<void>(resolve => { began = resolve })
  jest.mocked(heartbeatRecordingJob).mockImplementation(async input => {
    began(); await new Promise<void>(resolve => { release = resolve }); return input
  })
  jest.mocked(verifyRecordingJobInput).mockImplementation(async () => { await started; return f.result })
  const pending = verifyLeasedRecordingJobInput('job-1', f.options)
  await started; await pause(5)
  expect(checkRecordingJobLease).not.toHaveBeenCalled()
  release(); await expect(pending).resolves.toMatchObject(f.result)
})

it('refuses evidence if a drained heartbeat fails after verification finishes', async () => {
  const f = fixture()
  let began!: () => void
  const started = new Promise<void>(resolve => { began = resolve })
  jest.mocked(heartbeatRecordingJob).mockImplementation(async () => {
    began(); await pause(20); throw new Error('SECRET unknown heartbeat commit')
  })
  jest.mocked(verifyRecordingJobInput).mockImplementation(async () => { await started; return f.result })
  await expect(verifyLeasedRecordingJobInput('job-1', f.options)).rejects.toThrow('recording_worker_unavailable')
  expect(checkRecordingJobLease).not.toHaveBeenCalled()
  const count = jest.mocked(heartbeatRecordingJob).mock.calls.length
  await pause(40)
  expect(heartbeatRecordingJob).toHaveBeenCalledTimes(count)
})

it.each(['before', 'during'])('honors caller cancellation %s processing', async phase => {
  const f = fixture(); const controller = new AbortController()
  if (phase === 'before') controller.abort()
  else { f.waitForAbort(); setTimeout(() => controller.abort(), 5) }
  await expect(verifyLeasedRecordingJobInput('job-1', { ...f.options, signal: controller.signal })).rejects.toThrow()
  if (phase === 'before') expect(claimRecordingJob).not.toHaveBeenCalled()
  else expect(f.events).toContain('cleaned')
})

it.each([{ leaseMs: 999 }, { heartbeatMs: 0 }, { heartbeatMs: 500 }, { rpcTimeoutMs: 0 }, { rpcTimeoutMs: 600 }])
('rejects unsafe timing %j before claiming', async values => {
  const f = fixture()
  await expect(verifyLeasedRecordingJobInput('job-1', { ...f.options, ...values })).rejects.toThrow()
  expect(claimRecordingJob).not.toHaveBeenCalled()
})

function candidateFixture() {
  const f = fixture()
  const candidate = { candidateId: 'candidate-1', state: 'reserved', canClearLocalDrafts: false } as Awaited<ReturnType<typeof reserveRecordingOutputCandidate>>
  jest.mocked(withVerifiedRecordingJobInput).mockImplementation(async (_job, _options, consume) => {
    f.events.push('merge')
    try { return await consume({ filePath: '/internal/only', mimeType: 'audio/webm', completion: {
      ...f.result.completion, durationMs: 2000, outputByteSize: 10, outputSha256: 'a'.repeat(64) } }, { revalidate: async () => {} }) }
    finally { f.events.push('local-cleaned') }
  })
  jest.mocked(reserveRecordingOutputCandidate).mockImplementation(async () => { f.events.push('reserve'); return candidate })
  jest.mocked(uploadAndVerifyRecordingCandidate).mockImplementation(async () => { f.events.push('upload-readback') })
  jest.mocked(prepareRecordingOutputCandidate).mockImplementation(async () => { f.events.push('prepare'); return { ...candidate, state: 'prepared' } })
  return { ...f, candidate }
}

it('prepares only inside the supervised artifact scope and never authorizes cleanup or publication', async () => {
  const f = candidateFixture()
  expect(await prepareLeasedRecordingJobCandidate('job-1', f.options)).toMatchObject({ status: 'candidate_prepared', jobId: 'job-1',
    candidate: { state: 'prepared' }, canClearLocalDrafts: false, lease: { state: 'running' } })
  expect(f.events).toEqual(['claim', 'start', 'merge', 'reserve', 'upload-readback', 'prepare', 'local-cleaned', 'check'])
  expect(verifyRecordingJobInput).not.toHaveBeenCalled()
  expect(reserveRecordingOutputCandidate).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^[0-9a-f-]{36}$/),
    { byteSize: 10, sha256: 'a'.repeat(64), durationMs: 2000, mimeType: 'audio/webm' }, expect.objectContaining({ signal: expect.any(AbortSignal) }))
})

it.each(['reserve', 'upload', 'prepare'])('retains unknown %s outcome without later writes or automatic replay', async phase => {
  const f = candidateFixture()
  jest.mocked(phase === 'reserve' ? reserveRecordingOutputCandidate : phase === 'prepare' ? prepareRecordingOutputCandidate : uploadAndVerifyRecordingCandidate)
    .mockRejectedValue(new Error('SECRET outcome unknown'))
  await expect(prepareLeasedRecordingJobCandidate('job-1', f.options)).rejects.toThrow('recording_worker_unavailable')
  expect(reserveRecordingOutputCandidate).toHaveBeenCalledTimes(1)
  expect(uploadAndVerifyRecordingCandidate).toHaveBeenCalledTimes(phase === 'reserve' ? 0 : 1)
  expect(prepareRecordingOutputCandidate).toHaveBeenCalledTimes(phase === 'prepare' ? 1 : 0)
  expect(checkRecordingJobLease).not.toHaveBeenCalled()
  expect(f.events).toContain('local-cleaned')
})

it('keeps heartbeats alive during upload and uses a fresh renewed fence for prepare', async () => {
  const f = candidateFixture(); let renewed = 0
  jest.mocked(heartbeatRecordingJob).mockImplementation(async input => { renewed++; return { ...input, deadline: performance.now() + 4000 } })
  jest.mocked(uploadAndVerifyRecordingCandidate).mockImplementation(async () => { await pause(65) })
  await prepareLeasedRecordingJobCandidate('job-1', f.options)
  expect(renewed).toBeGreaterThan(0)
  expect(jest.mocked(prepareRecordingOutputCandidate).mock.calls[0][0].deadline).toBeGreaterThan(f.lease.deadline)
})

it('aborts storage and waits for cleanup when the lease fails during upload', async () => {
  const f = candidateFixture()
  jest.mocked(heartbeatRecordingJob).mockRejectedValue(new Error('revoked'))
  jest.mocked(uploadAndVerifyRecordingCandidate).mockImplementation(async (_a, _c, options) => {
    await new Promise<void>(resolve => options.signal!.addEventListener('abort', () => resolve(), { once: true }))
    await pause(10); f.events.push('storage-cleaned'); throw new Error('aborted')
  })
  await expect(prepareLeasedRecordingJobCandidate('job-1', f.options)).rejects.toThrow()
  expect(f.events).toContain('storage-cleaned'); expect(f.events).toContain('local-cleaned')
  expect(prepareRecordingOutputCandidate).not.toHaveBeenCalled()
})
