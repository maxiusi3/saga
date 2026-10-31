/** @jest-environment node */
import { beginBrowserUploadAttempt, finishBrowserUploadAttempt } from '../upload-observations'

const mockAdmin = jest.fn()
const mockRpc = jest.fn()
const mockAbort = jest.fn()
const mockRetry = jest.fn()
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => mockAdmin() }))
const id = '11111111-1111-4111-8111-111111111111'
const binding = 'a'.repeat(64)
const receipt = (state = 'started') => ({ schemaVersion: 1, attemptId: id, state })

beforeEach(() => {
  jest.useFakeTimers()
  jest.resetAllMocks()
  mockAdmin.mockReturnValue({ rpc: mockRpc })
  mockRpc.mockReturnValue({ abortSignal: mockAbort })
  mockAbort.mockReturnValue({ retry: mockRetry })
  mockRetry.mockResolvedValue({ data: receipt(), error: null })
})
afterEach(() => jest.useRealTimers())

it('starts exactly once with only the random ID and opaque binding', async () => {
  expect(await beginBrowserUploadAttempt(id, binding)).toEqual(receipt())
  expect(mockRpc).toHaveBeenCalledWith('begin_browser_upload_attempt', { p_attempt_id: id, p_binding_hash: binding })
  expect(mockRpc).toHaveBeenCalledTimes(1)
  expect(mockAbort).toHaveBeenCalledWith(expect.any(AbortSignal))
  expect(mockRetry).toHaveBeenCalledWith(false)
  expect(jest.getTimerCount()).toBe(0)
})

it.each(['client_succeeded', 'client_failed', 'client_conflict', 'client_cancelled'] as const)('confirms the exact terminal receipt: %s', async outcome => {
  mockRetry.mockResolvedValue({ data: receipt(outcome), error: null })
  expect(await finishBrowserUploadAttempt(id, binding, outcome)).toEqual(receipt(outcome))
  expect(mockRpc).toHaveBeenCalledWith('finish_browser_upload_attempt', {
    p_attempt_id: id, p_binding_hash: binding, p_outcome: outcome,
  })
})

it.each([null, [], {}, { ...receipt(), schemaVersion: 2 }, { ...receipt(), attemptId: 'other' },
  { ...receipt(), privateText: 'private' }, receipt('client_succeeded')])('rejects ambiguous/replayed starts %j', async data => {
  mockRetry.mockResolvedValue({ data, error: null })
  expect(await beginBrowserUploadAttempt(id, binding)).toBeNull()
})

it.each([receipt(), receipt('client_failed'), { ...receipt('client_succeeded'), extra: true }])('rejects conflicting terminal receipts %j', async data => {
  mockRetry.mockResolvedValue({ data, error: null })
  expect(await finishBrowserUploadAttempt(id, binding, 'client_succeeded')).toBeNull()
})

it.each(['', 'a'.repeat(63), 'A'.repeat(64), 'a'.repeat(64) + '\n'])('rejects invalid bindings without dispatch %j', async hash => {
  expect(await beginBrowserUploadAttempt(id, hash)).toBeNull()
  expect(await finishBrowserUploadAttempt(id, hash, 'client_failed')).toBeNull()
  expect(mockAdmin).not.toHaveBeenCalled()
})

it('rejects invalid IDs/outcomes and pre-aborted starts without dispatch', async () => {
  expect(await beginBrowserUploadAttempt('invalid', binding)).toBeNull()
  expect(await finishBrowserUploadAttempt(id, binding, 'private text' as any)).toBeNull()
  const caller = new AbortController(); caller.abort()
  expect(await beginBrowserUploadAttempt(id, binding, caller.signal)).toBeNull()
  expect(mockAdmin).not.toHaveBeenCalled()
})

it('bounds an abort-ignoring writer and never replays an unknown commit', async () => {
  let reject!: (error: Error) => void
  mockRetry.mockImplementation(() => new Promise((_, fail) => { reject = fail }))
  const pending = finishBrowserUploadAttempt(id, binding, 'client_failed')
  await jest.advanceTimersByTimeAsync(5000)
  expect(await pending).toBeNull()
  reject(new Error('late private diagnostic'))
  await Promise.resolve()
  expect(mockRpc).toHaveBeenCalledTimes(1)
  expect(mockAbort.mock.calls[0][0].aborted).toBe(true)
  expect(jest.getTimerCount()).toBe(0)
})

it('allows independent cancellation reporting after a cancelled begin', async () => {
  const caller = new AbortController()
  mockRetry.mockImplementationOnce(() => new Promise(() => {}))
  const start = beginBrowserUploadAttempt(id, binding, caller.signal)
  caller.abort()
  expect(await start).toBeNull()
  mockRetry.mockResolvedValue({ data: receipt('client_cancelled'), error: null })
  expect(await finishBrowserUploadAttempt(id, binding, 'client_cancelled')).toEqual(receipt('client_cancelled'))
})

it('sanitizes database errors, exceptions and missing configuration', async () => {
  mockRetry.mockResolvedValue({ data: receipt(), error: { message: 'private' } })
  expect(await beginBrowserUploadAttempt(id, binding)).toBeNull()
  mockRetry.mockRejectedValue(new Error('private'))
  expect(await finishBrowserUploadAttempt(id, binding, 'client_failed')).toBeNull()
  mockAdmin.mockImplementation(() => { throw new Error('secret') })
  expect(await beginBrowserUploadAttempt(id, binding)).toBeNull()
})

it('uses v2 build attribution RPC when OPERATIONAL_COLLECTOR_BUILD_HASH is configured and fails closed when malformed', async () => {
  const buildHash = 'c'.repeat(64)
  process.env.OPERATIONAL_COLLECTOR_BUILD_HASH = buildHash
  try {
    expect(await beginBrowserUploadAttempt(id, binding)).toEqual(receipt())
    expect(mockRpc).toHaveBeenCalledWith('begin_browser_upload_attempt_v2', {
      p_attempt_id: id,
      p_binding_hash: binding,
      p_build_hash: buildHash,
    })
    mockAdmin.mockClear()
    process.env.OPERATIONAL_COLLECTOR_BUILD_HASH = 'INVALID'
    expect(await beginBrowserUploadAttempt(id, binding)).toBeNull()
    expect(mockAdmin).not.toHaveBeenCalled()
  } finally {
    delete process.env.OPERATIONAL_COLLECTOR_BUILD_HASH
  }
})
