/** @jest-environment node */
import { requestPublication, readPublication, retryPublication } from '../publication-client'

const mockToken = jest.fn()
let mockActor = '11111111-1111-4111-8111-111111111111'
jest.mock('@/stores/auth-store', () => ({ useAuthStore: { getState: () => ({ user: { id: mockActor }, getAccessToken: mockToken }) } }))
const project = '22222222-2222-4222-8222-222222222222'
const job = '33333333-3333-4333-8333-333333333333'
const base = `/api/projects/${project}/export/jobs/${job}`
const receipt = { jobId: job, snapshotId: job, snapshotVersion: 1, status: 'queued', attempt: 0, errorCode: null, statusUrl: base, downloadUrl: `${base}/download` }
const originalFetch = global.fetch
const mockFetch = jest.fn()
beforeEach(() => { mockActor = '11111111-1111-4111-8111-111111111111'; mockToken.mockReset().mockResolvedValue('local-token'); mockFetch.mockReset(); global.fetch = mockFetch })
afterEach(() => { global.fetch = originalFetch })

it('creates a durable job without fetching or buffering the archive in browser memory', async () => {
  mockFetch.mockResolvedValue(Response.json(receipt, { status: 202 }))
  await expect(requestPublication(project)).resolves.toEqual(receipt)
  expect(mockFetch).toHaveBeenCalledTimes(1)
  expect(mockFetch.mock.calls[0][0]).toBe(`/api/projects/${project}/export?durable=true`)
  expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'POST', redirect: 'error', cache: 'no-store' })
  expect(new Headers(mockFetch.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer local-token')
})
it('reads and retries only the same project and job', async () => {
  mockFetch.mockImplementation(async () => Response.json({ ...receipt, status: 'ready', attempt: 1 }))
  await expect(readPublication(project, job)).resolves.toMatchObject({ status: 'ready' })
  expect(mockFetch.mock.calls[0][0]).toBe(base)
  await retryPublication(project, job)
  expect(mockFetch.mock.calls[1][1].method).toBe('POST')
})
it.each([
  { downloadUrl: 'https://outside.example/private.zip' }, { statusUrl: '/api/projects/other/export/jobs/other' },
  { jobId: project }, { snapshotVersion: 0 }, { attempt: -1 }, { status: 'delivered' }, { errorCode: { raw: 'private' } },
])('rejects malformed or cross-context job receipts %j', async override => {
  mockFetch.mockResolvedValue(Response.json({ ...receipt, ...override }))
  await expect(readPublication(project, job)).rejects.toThrow('Invalid publication response')
})
it('does not dispatch after the actor changes while obtaining a token', async () => {
  mockToken.mockImplementation(async () => { mockActor = 'different'; return 'old-token' })
  await expect(requestPublication(project)).rejects.toThrow('Publication session changed')
  expect(mockFetch).not.toHaveBeenCalled()
})
it('rejects a late response after the actor changes', async () => {
  mockFetch.mockImplementation(async () => { mockActor = 'different'; return Response.json(receipt) })
  await expect(requestPublication(project)).rejects.toThrow('Publication session changed')
})
it('does not claim ready for failed, unauthorized or non-JSON responses', async () => {
  mockFetch.mockResolvedValue(Response.json({ error: 'private diagnostic' }, { status: 403 }))
  await expect(requestPublication(project)).rejects.toThrow('Publication request failed')
  mockFetch.mockResolvedValue(new Response('zip bytes'))
  await expect(requestPublication(project)).rejects.toThrow('Invalid publication response')
})
