/** @jest-environment node */
import { beginArchiveAssemblyAttempt, finishArchiveAssemblyAttempt } from '../archive-observations'

const mockAdmin = jest.fn()
const mockRpc = jest.fn()
const mockAbort = jest.fn()
const mockRetry = jest.fn()
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => mockAdmin() }))
const id = '11111111-1111-4111-8111-111111111111'
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

it('starts a server-generated attempt with only its ID, cancellation and no retry', async () => {
  expect(await beginArchiveAssemblyAttempt(id)).toBe(true)
  expect(mockRpc).toHaveBeenCalledWith('begin_archive_assembly_attempt', { p_attempt_id: id })
  expect(mockRpc).toHaveBeenCalledTimes(1)
  expect(mockAbort).toHaveBeenCalledWith(expect.any(AbortSignal))
  expect(mockRetry).toHaveBeenCalledWith(false)
  expect(jest.getTimerCount()).toBe(0)
})

it.each(['verified', 'integrity_failed', 'failed', 'cancelled', 'limit_exceeded'] as const)('confirms only the matching durable terminal receipt: %s', async outcome => {
  mockRetry.mockResolvedValue({ data: receipt(outcome), error: null })
  expect(await finishArchiveAssemblyAttempt(id, outcome)).toBe(true)
  expect(mockRpc).toHaveBeenCalledWith('finish_archive_assembly_attempt', { p_attempt_id: id, p_outcome: outcome })
})

it.each([null, [], {}, { ...receipt(), schemaVersion: 2 }, { ...receipt(), attemptId: 'other' },
  { ...receipt(), privateText: 'must not be accepted' }, receipt('verified')])('rejects an ambiguous/replayed start receipt %j', async data => {
  mockRetry.mockResolvedValue({ data, error: null })
  expect(await beginArchiveAssemblyAttempt(id)).toBe(false)
})

it('does not acknowledge a conflicting or unfinished terminal result', async () => {
  mockRetry.mockResolvedValue({ data: receipt('started'), error: null })
  expect(await finishArchiveAssemblyAttempt(id, 'verified')).toBe(false)
  mockRetry.mockResolvedValue({ data: receipt('failed'), error: null })
  expect(await finishArchiveAssemblyAttempt(id, 'verified')).toBe(false)
})

it('fails closed on invalid arguments without creating a database client', async () => {
  expect(await beginArchiveAssemblyAttempt('not-uuid')).toBe(false)
  expect(await finishArchiveAssemblyAttempt(id, 'private-error-message' as any)).toBe(false)
  expect(mockAdmin).not.toHaveBeenCalled()
})

it('does not dispatch a pre-aborted start', async () => {
  const caller = new AbortController(); caller.abort()
  expect(await beginArchiveAssemblyAttempt(id, caller.signal)).toBe(false)
  expect(mockAdmin).not.toHaveBeenCalled()
})

it('bounds an abort-ignoring writer and does not replay an unknown commit', async () => {
  mockRetry.mockImplementation(() => new Promise(() => {}))
  const pending = finishArchiveAssemblyAttempt(id, 'integrity_failed')
  await jest.advanceTimersByTimeAsync(5000)
  expect(await pending).toBe(false)
  expect(mockRpc).toHaveBeenCalledTimes(1)
  expect(mockAbort.mock.calls[0][0].aborted).toBe(true)
  expect(jest.getTimerCount()).toBe(0)
})

it('propagates a cancelled start but can still independently persist cancellation', async () => {
  const caller = new AbortController()
  mockRetry.mockImplementationOnce(() => new Promise(() => {}))
  const start = beginArchiveAssemblyAttempt(id, caller.signal)
  caller.abort()
  expect(await start).toBe(false)
  mockRetry.mockResolvedValue({ data: receipt('cancelled'), error: null })
  expect(await finishArchiveAssemblyAttempt(id, 'cancelled')).toBe(true)
  expect(mockRpc).toHaveBeenCalledTimes(2)
})

it('sanitizes errors, missing configuration and receipt failure without a table fallback', async () => {
  mockRetry.mockResolvedValue({ data: null, error: { message: 'private details' } })
  expect(await beginArchiveAssemblyAttempt(id)).toBe(false)
  mockRetry.mockRejectedValue(new Error('private details'))
  expect(await finishArchiveAssemblyAttempt(id, 'failed')).toBe(false)
  mockAdmin.mockImplementation(() => { throw new Error('private key') })
  expect(await beginArchiveAssemblyAttempt(id)).toBe(false)
  expect(jest.getTimerCount()).toBe(0)
})
