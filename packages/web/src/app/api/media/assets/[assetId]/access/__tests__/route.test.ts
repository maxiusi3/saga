/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { GET } from '../route'

const mockAuth = jest.fn()
const mockProjectAccess = jest.fn()
const mockFrom = jest.fn()
const mockStorageFrom = jest.fn()
const mockCreateSignedUrl = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/server/project-access', () => ({ requireProjectAccess: (...args: unknown[]) => mockProjectAccess(...args) }))
jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
    storage: { from: (...args: unknown[]) => mockStorageFrom(...args) },
  }),
}))

const user = { id: 'alice' } as any
const headers = new Headers({ 'Set-Cookie': 'session=refreshed' })
const ready = {
  id: 'asset-ready', project_id: 'family-a', created_by: 'alice', bucket: 'saga',
  object_key: 'alice/projects/family-a/assets/asset-ready/original', state: 'ready',
}

function query(data: unknown, error: unknown = null) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => ({ data, error })),
  }
  return chain
}

function request() {
  return new NextRequest('http://localhost/api/media/assets/asset-ready/access')
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.MEDIA_ASSETS_ENABLED = 'true'
  mockAuth.mockResolvedValue({ ok: true, user, headers })
  mockProjectAccess.mockResolvedValue({ ok: true })
  mockFrom.mockReturnValue(query(ready))
  mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl })
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.example/asset' }, error: null })
})

afterEach(() => delete process.env.MEDIA_ASSETS_ENABLED)

describe('GET /api/media/assets/[assetId]/access', () => {
  it('requires authentication before loading asset or storage', async () => {
    mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const response = await GET(request(), { params: Promise.resolve({ assetId: 'asset-ready' }) })
    expect(response.status).toBe(401)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it.each([
    { state: 'pending_upload' },
    { state: 'verifying' },
    { state: 'quarantined' },
    { state: 'deleted' },
    { state: 'deleting' },
  ])('rejects non-ready asset state %j', async ({ state }) => {
    mockFrom.mockReturnValue(query({ ...ready, state }))
    const response = await GET(request(), { params: Promise.resolve({ assetId: 'asset-ready' }) })
    expect(response.status).toBe(409)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('denies a user who no longer has project access', async () => {
    mockProjectAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
    const response = await GET(request(), { params: Promise.resolve({ assetId: 'asset-ready' }) })
    expect(response.status).toBe(403)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('signs only the exact stored bucket and key and sends no-store headers', async () => {
    const response = await GET(request(), { params: Promise.resolve({ assetId: 'asset-ready' }) })
    expect(response.status).toBe(200)
    expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ signedUrl: 'https://storage.example/asset' })
    expect(mockStorageFrom).toHaveBeenCalledWith('saga')
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(ready.object_key, 3600)
  })

  it('fails closed when storage cannot sign', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'missing object' } })
    const response = await GET(request(), { params: Promise.resolve({ assetId: 'asset-ready' }) })
    expect(response.status).toBe(404)
  })
})
