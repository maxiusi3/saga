/** @jest-environment node */
import {
  readCollectorBuildHash,
  sealDeploymentCollectionCoverage,
} from '../deployment-collection-coverage'

const mockAdmin = jest.fn()
const mockRpc = jest.fn()
const mockAbort = jest.fn()
const mockRetry = jest.fn()
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => mockAdmin() }))

const releaseHash = 'a'.repeat(64)
const cutoverAt = '2026-10-30T08:00:00.123456Z'
const receipt = (scope: 'synchronous_archive_assembly' | 'project_hub_audio_put_reports' = 'synchronous_archive_assembly') => ({
  schemaVersion: 1 as const,
  scope,
  releaseHash,
  cutoverAt,
})

const originalEnv = process.env

beforeEach(() => {
  jest.useFakeTimers()
  jest.resetAllMocks()
  process.env = { ...originalEnv }
  delete process.env.OPERATIONAL_COLLECTOR_BUILD_HASH
  mockAdmin.mockReturnValue({ rpc: mockRpc })
  mockRpc.mockReturnValue({ abortSignal: mockAbort })
  mockAbort.mockReturnValue({ retry: mockRetry })
  mockRetry.mockResolvedValue({ data: receipt(), error: null })
})

afterEach(() => {
  process.env = originalEnv
  jest.useRealTimers()
})

it('distinguishes unconfigured, valid lowercase SHA-256 and malformed collector build hashes', () => {
  expect(readCollectorBuildHash()).toEqual({ configured: false })
  process.env.OPERATIONAL_COLLECTOR_BUILD_HASH = releaseHash
  expect(readCollectorBuildHash()).toEqual({ configured: true, valid: true, buildHash: releaseHash })
  for (const invalid of ['', '   ', 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), 'g'.repeat(64), `${releaseHash}\n`]) {
    process.env.OPERATIONAL_COLLECTOR_BUILD_HASH = invalid
    expect(readCollectorBuildHash()).toEqual({ configured: true, valid: false })
    expect(readCollectorBuildHash(invalid)).toEqual({ configured: true, valid: false })
  }
})

it.each(['synchronous_archive_assembly', 'project_hub_audio_put_reports'] as const)(
  'seals deployment collection coverage once with bounded non-retrying RPC for %s',
  async scope => {
    mockRetry.mockResolvedValue({ data: receipt(scope), error: null })
    expect(await sealDeploymentCollectionCoverage(scope, releaseHash)).toEqual(receipt(scope))
    expect(mockRpc).toHaveBeenCalledWith('seal_deployment_collection_coverage', {
      p_scope: scope,
      p_release_hash: releaseHash,
    })
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockAbort).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(mockRetry).toHaveBeenCalledWith(false)
    expect(jest.getTimerCount()).toBe(0)
  },
)

it.each([
  null,
  [],
  {},
  { ...receipt(), schemaVersion: 2 },
  { ...receipt(), scope: 'project_hub_audio_put_reports' },
  { ...receipt(), releaseHash: 'b'.repeat(64) },
  { ...receipt(), cutoverAt: '2026-10-30T08:00:00Z' },
  { ...receipt(), cutoverAt: '0000-01-01T00:00:00.000000Z' },
  { ...receipt(), cutoverAt: '2026-02-30T00:00:00.000000Z' },
  { ...receipt(), extra: 'private' },
])('rejects malformed or mismatched seal receipts %j', async data => {
  mockRetry.mockResolvedValue({ data, error: null })
  expect(await sealDeploymentCollectionCoverage('synchronous_archive_assembly', releaseHash)).toBeNull()
})

it('rejects invalid scopes, invalid hashes and pre-aborted callers without creating a DB client', async () => {
  expect(await sealDeploymentCollectionCoverage('invalid_scope' as any, releaseHash)).toBeNull()
  for (const hash of ['', 'a'.repeat(63), 'A'.repeat(64), `${releaseHash}\n`]) {
    expect(await sealDeploymentCollectionCoverage('synchronous_archive_assembly', hash)).toBeNull()
  }
  const caller = new AbortController()
  caller.abort()
  expect(await sealDeploymentCollectionCoverage('synchronous_archive_assembly', releaseHash, caller.signal)).toBeNull()
  expect(mockAdmin).not.toHaveBeenCalled()
})

it('bounds an abort-ignoring seal RPC and sanitizes database/configuration errors', async () => {
  mockRetry.mockImplementationOnce(() => new Promise(() => {}))
  const pending = sealDeploymentCollectionCoverage('synchronous_archive_assembly', releaseHash)
  await jest.advanceTimersByTimeAsync(5000)
  expect(await pending).toBeNull()
  expect(mockRpc).toHaveBeenCalledTimes(1)
  expect(mockAbort.mock.calls[0][0].aborted).toBe(true)

  mockRetry.mockResolvedValueOnce({ data: receipt(), error: { message: 'private error' } })
  expect(await sealDeploymentCollectionCoverage('synchronous_archive_assembly', releaseHash)).toBeNull()

  mockAdmin.mockImplementationOnce(() => { throw new Error('private key') })
  expect(await sealDeploymentCollectionCoverage('synchronous_archive_assembly', releaseHash)).toBeNull()
  expect(jest.getTimerCount()).toBe(0)
})
