/** @jest-environment node */
import { createClient } from '@supabase/supabase-js'
import { runRecordingWorkerOnce, runRecordingWorker } from '../recording-worker-host'
import { finalizeLeasedRecordingJob } from '../recording-terminal-worker'

// Selection and lease recovery use the actual SDK and lease receipt validator.
// Only the expensive terminal pipeline is controlled to observe drain/replay.
jest.mock('../recording-terminal-worker', () => ({ finalizeLeasedRecordingJob: jest.fn() }))
const id = (n: number) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`
const now = '2026-11-06T00:00:00.000Z'
const row = (n: number, state = 'queued') => ({ id: id(n), state, not_before: null,
  lease_expires_at: state === 'running' || state === 'leased' ? '2026-11-05T23:59:59.000Z' : null })
function fixture(rows = [row(1)]) {
  const requests: URL[] = []
  const rpcCalls: Record<string, unknown>[] = []
  let responseState = 'retry_wait'
  let queryFailure = false
  let queryGate: Promise<void> | undefined
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); requests.push(url)
    if (url.pathname.endsWith('/rpc/recording_job_lease')) {
      const body = JSON.parse(String(init?.body)); rpcCalls.push(body)
      return Response.json({ schemaVersion: 1, jobId: body.p_job_id, projectId: id(50), assetId: id(51), sessionId: id(52),
        manifestSha256: 'a'.repeat(64), state: responseState, attempt: 1, workerId: null, leaseExpiresAt: null,
        serverNow: now, canClearLocalDrafts: false })
    }
    await queryGate
    if (queryFailure) return Response.json({ message: 'SECRET source path' }, { status: 503 })
    const cursor = url.searchParams.get('id')?.slice(3)
    return Response.json(rows.filter(value => !cursor || value.id > cursor).slice(0, 1))
  }
  const options = { admin: createClient('https://storage.invalid', 'synthetic-key', {
    global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }), storageUrl: 'https://storage.invalid', serviceRoleKey: 'synthetic-key', fetch: transport, workerId: 'worker_1',
  ffmpeg: { executable: '/synthetic/ffmpeg', timeoutMs: 1000, maxDurationMs: 1000 } }
  jest.mocked(finalizeLeasedRecordingJob).mockResolvedValue({ state: 'succeeded' } as Awaited<ReturnType<typeof finalizeLeasedRecordingJob>>)
  return { options, requests, rpcCalls, setRecovery: (state: string) => { responseState = state },
    failQuery: () => { queryFailure = true }, gateQuery: (gate: Promise<void>) => { queryGate = gate } }
}
beforeEach(() => { jest.resetAllMocks(); jest.useFakeTimers({ now: new Date(now) }) })
afterEach(() => { jest.useRealTimers() })

it.each(['queued', 'retry_wait'])('selects one %s recording through bounded eligibility query and actual terminal entry', async state => {
  const f = fixture([row(1, state), row(2)])
  expect(await runRecordingWorkerOnce(f.options)).toEqual({ status: 'processed', jobId: id(1), nextCursor: id(1), outcome: 'succeeded', canClearLocalDrafts: false })
  const query = f.requests[0].searchParams
  expect(query.get('select')).toBe('id,state,not_before,lease_expires_at')
  expect(query.get('job_type')).toBe('eq.recording_merge')
  expect(query.get('or')).toBe(`(and(state.in.(queued,retry_wait),or(not_before.is.null,not_before.lte.${now})),and(state.in.(leased,running),lease_expires_at.lte.${now}))`)
  expect(query.get('order')).toBe('id.asc'); expect(query.get('limit')).toBe('1')
  expect(finalizeLeasedRecordingJob).toHaveBeenCalledTimes(1)
  expect(finalizeLeasedRecordingJob).toHaveBeenCalledWith(id(1), expect.objectContaining({ workerId: 'worker_1', fetch: f.options.fetch, admin: f.options.admin }))
})

it('advances past an invalid older job without replaying an uncertain attempt within the iteration', async () => {
  const f = fixture([row(1), row(2)])
  jest.mocked(finalizeLeasedRecordingJob).mockRejectedValueOnce(new Error('SECRET committed response lost'))
  const first = await runRecordingWorkerOnce(f.options)
  expect(first).toEqual({ status: 'unavailable', jobId: id(1), nextCursor: id(1), canClearLocalDrafts: false })
  expect(await runRecordingWorkerOnce({ ...f.options, cursor: first.nextCursor })).toMatchObject({ status: 'processed', jobId: id(2) })
  expect(finalizeLeasedRecordingJob).toHaveBeenCalledTimes(2)
  expect(jest.mocked(finalizeLeasedRecordingJob).mock.calls.map(call => call[0])).toEqual([id(1), id(2)])
  expect(f.requests[1].searchParams.get('id')).toBe(`gt.${id(1)}`)
  expect(await runRecordingWorkerOnce({ ...f.options, cursor: id(2) })).toEqual({ status: 'idle', nextCursor: null, canClearLocalDrafts: false })
})

it.each(['retry_wait', 'outcome_unknown', 'failed', 'cancelled'])('recovers expired leases through the lease RPC and leaves %s undispatched', async state => {
  const f = fixture([row(1, state === 'outcome_unknown' ? 'running' : 'leased')]); f.setRecovery(state)
  expect(await runRecordingWorkerOnce(f.options)).toEqual({ status: 'recovered', jobId: id(1), nextCursor: id(1), recoveryState: state, canClearLocalDrafts: false })
  expect(f.rpcCalls).toEqual([{ p_job_id: id(1), p_action: 'recover', p_worker_id: null, p_attempt: null, p_lease_ms: null }])
  expect(finalizeLeasedRecordingJob).not.toHaveBeenCalled()
})

it.each([
  { ...row(1), state: 'outcome_unknown' }, { ...row(1), state: 'succeeded' },
  { ...row(1), not_before: '2026-11-07T00:00:00.000Z' },
  { ...row(1, 'running'), lease_expires_at: '2026-11-07T00:00:00.000Z' },
  { ...row(1), not_before: 'invalid' },
])('rejects inconsistent or no-longer-eligible selected rows without any mutation %#', async value => {
  const f = fixture([value])
  expect(await runRecordingWorkerOnce(f.options)).toMatchObject({ status: 'unavailable', nextCursor: id(1) })
  expect(finalizeLeasedRecordingJob).not.toHaveBeenCalled(); expect(f.rpcCalls).toEqual([])
})

it('reports a bounded selection failure without leaking response body or SDK automatic GET retries', async () => {
  const f = fixture(); f.failQuery()
  await expect(runRecordingWorkerOnce(f.options)).rejects.toEqual(new Error('recording_worker_host_unavailable'))
  expect(f.requests).toHaveLength(1); expect(finalizeLeasedRecordingJob).not.toHaveBeenCalled()
})

it('times out a non-cooperative selection without late dispatch', async () => {
  const f = fixture(); let finish!: () => void
  f.gateQuery(new Promise(resolve => { finish = resolve }))
  const pending = runRecordingWorkerOnce({ ...f.options, selectionTimeoutMs: 100 })
  const rejected = expect(pending).rejects.toEqual(new Error('recording_worker_host_unavailable'))
  await jest.advanceTimersByTimeAsync(100); await rejected
  finish(); await jest.advanceTimersByTimeAsync(0)
  expect(finalizeLeasedRecordingJob).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0)
})

it('stops before selection when already aborted', async () => {
  const f = fixture(); const controller = new AbortController(); controller.abort()
  expect(await runRecordingWorkerOnce({ ...f.options, signal: controller.signal })).toMatchObject({ status: 'stopped' })
  expect(f.requests).toEqual([])
})

it('aborts owned work and waits for its cleanup without selecting another job', async () => {
  const f = fixture(); const controller = new AbortController(); let drain!: () => void
  let ownedSignal: AbortSignal | undefined; let settled = false
  jest.mocked(finalizeLeasedRecordingJob).mockImplementation(async (_id, options) => {
    ownedSignal = options.signal
    await new Promise<void>(resolve => { drain = resolve })
    throw new Error('SECRET aborted')
  })
  const running = runRecordingWorker({ ...f.options, signal: controller.signal, pollMs: 250 }).then(() => { settled = true })
  await jest.advanceTimersByTimeAsync(0); controller.abort(); await jest.advanceTimersByTimeAsync(0)
  expect(ownedSignal?.aborted).toBe(true); expect(settled).toBe(false)
  drain(); await running
  expect(f.requests).toHaveLength(1); expect(jest.getTimerCount()).toBe(0)
})

it('polls both empty queues and errors at a bounded rate and cancels idle wait immediately', async () => {
  const f = fixture([]); const controller = new AbortController()
  const running = runRecordingWorker({ ...f.options, signal: controller.signal, pollMs: 250 })
  await jest.advanceTimersByTimeAsync(249); expect(f.requests).toHaveLength(1)
  f.failQuery(); await jest.advanceTimersByTimeAsync(1); expect(f.requests).toHaveLength(2)
  await jest.advanceTimersByTimeAsync(249); expect(f.requests).toHaveLength(2)
  controller.abort(); await running; expect(jest.getTimerCount()).toBe(0)
})

it.each([{ cursor: 'bad,or(state.eq.queued)' }, { selectionTimeoutMs: 0 }, { selectionTimeoutMs: 60001 }])('validates query controls before I/O %#', async controls => {
  const f = fixture()
  await expect(runRecordingWorkerOnce({ ...f.options, ...controls })).rejects.toThrow('recording_worker_host_configuration')
  expect(f.requests).toEqual([])
})

it('snapshots processing options before waiting for queue selection', async () => {
  const f = fixture(); let release!: () => void
  const controller = new AbortController(), alien = new AbortController()
  f.gateQuery(new Promise(resolve => { release = resolve }))
  const options = { ...f.options, signal: controller.signal }
  const pending = runRecordingWorkerOnce(options)
  options.workerId = 'alien'; options.ffmpeg.executable = '/alien/ffmpeg'; options.signal = alien.signal
  alien.abort(); release()
  expect(await pending).toMatchObject({ status: 'processed' })
  expect(finalizeLeasedRecordingJob).toHaveBeenCalledWith(id(1), expect.objectContaining({
    workerId: 'worker_1', signal: controller.signal, ffmpeg: expect.objectContaining({ executable: '/synthetic/ffmpeg' }),
  }))
})

it('rejects invalid continuous selection configuration before starting a repeating loop', async () => {
  const f = fixture(); const controller = new AbortController()
  const pending = runRecordingWorker({ ...f.options, cursor: 'invalid', signal: controller.signal })
  const assertion = expect(pending).rejects.toThrow('recording_worker_host_configuration')
  // Avoid leaving a broken implementation's loop alive after this assertion.
  await jest.advanceTimersByTimeAsync(0); controller.abort(); await assertion
  expect(f.requests).toEqual([])
})
