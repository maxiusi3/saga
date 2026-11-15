/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'
const mockAuth = jest.fn(), mockProjectAccess = jest.fn(), mockFrom = jest.fn(), mockRpc = jest.fn()
jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/server/project-access', () => ({ requireProjectAccess: (...args: unknown[]) => mockProjectAccess(...args) }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({ from: mockFrom, rpc: mockRpc }) }))
const actorId = '11111111-1111-4111-8111-111111111111', projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const assetId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', storyId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const headers = new Headers({ 'Set-Cookie': 'session=refreshed' })
function request(body: unknown) { return new NextRequest('http://localhost/api/media/delete-request', { method: 'POST', body: JSON.stringify(body) }) }
function receipt(id = requestId, subjectId = assetId, subjectType = 'media_asset') { return { id, projectId, subjectId, subjectType, state: 'requested', tombstoneAt: '2026-11-06T00:00:00.000Z', targetCount: 4, physicalDeletionComplete: false } }
describe('atomic media deletion route', () => {
  beforeEach(() => {
    jest.clearAllMocks(); process.env.MEDIA_ASSETS_ENABLED = 'true'
    mockAuth.mockResolvedValue({ ok: true, user: { id: actorId }, headers }); mockProjectAccess.mockResolvedValue({ ok: true })
    mockRpc.mockImplementation((_name, args) => { const q = { abortSignal: jest.fn(() => q), retry: jest.fn(() => Promise.resolve({ data: receipt(args.p_request_id, args.p_subject_id, args.p_subject_type), error: null })) }; return q })
  })
  afterEach(() => { delete process.env.MEDIA_ASSETS_ENABLED })
  it('uses only one atomic RPC, preserves auth headers and returns the closed 202 receipt', async () => {
    const response = await POST(request({ projectId, assetId, requestId }))
    expect(response.status).toBe(202); expect(await response.json()).toEqual({ deletionRequest: receipt() })
    expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('set-cookie')).toBe('session=refreshed')
    expect(mockFrom).not.toHaveBeenCalled(); expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('request_media_deletion', { p_actor_id: actorId, p_project_id: projectId, p_subject_id: assetId, p_subject_type: 'media_asset', p_request_id: requestId })
  })
  it('generates a UUID for a story request', async () => {
    const response = await POST(request({ projectId, storyId })); expect(response.status).toBe(202)
    expect((await response.json()).deletionRequest).toMatchObject({ subjectId: storyId, subjectType: 'story', id: expect.stringMatching(/^[0-9a-f-]{36}$/) })
  })
  it.each([{ projectId, assetId, storyId }, { projectId }, { projectId, assetId, storyId: null }, { projectId, assetId, requestId: null }, { projectId, assetId, requestId: '' }, { projectId, assetId: 7 }, { projectId: ` ${projectId}`, assetId }])('rejects malformed or ambiguous request %j', async body => {
    const response = await POST(request(body)); expect(response.status).toBe(400); expect(mockRpc).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled()
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('keeps access checks before SQL', async () => {
    mockProjectAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
    const response = await POST(request({ projectId, assetId })); expect(response.status).toBe(403); expect(mockRpc).not.toHaveBeenCalled()
  })
  it('disables endpoint without table or RPC access', async () => {
    delete process.env.MEDIA_ASSETS_ENABLED; expect((await POST(request({ projectId, assetId }))).status).toBe(404); expect(mockRpc).not.toHaveBeenCalled()
  })
  it('returns no-store and refreshed headers on authentication rejection', async () => {
    mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers }) })
    const response = await POST(request({ projectId, assetId })); expect(response.status).toBe(401); expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('set-cookie')).toBe('session=refreshed')
  })
  it('reports SQL reauthorization failure without fallback table writes', async () => {
    mockRpc.mockImplementation(() => { const q = { abortSignal: () => q, retry: () => Promise.resolve({ data: null, error: { code: '42501', message: 'private coordinates' } }) }; return q })
    const response = await POST(request({ projectId, assetId })); expect(response.status).toBe(403)
    expect(JSON.stringify(await response.json())).not.toContain('private coordinates'); expect(mockFrom).not.toHaveBeenCalled()
  })
})
