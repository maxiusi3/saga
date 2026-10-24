/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const mockAuth = jest.fn()
const mockProjectAccess = jest.fn()
const mockFrom = jest.fn()
const mockStorageFrom = jest.fn()
const mockCreateSignedUploadUrl = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/server/project-access', () => ({ requireProjectAccess: (...args: unknown[]) => mockProjectAccess(...args) }))
jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
    storage: { from: (...args: unknown[]) => mockStorageFrom(...args) },
  }),
}))

const authHeaders = new Headers({ 'Set-Cookie': 'session=refreshed' })
const user = { id: 'alice' } as any

function request(body: unknown) {
  return new NextRequest('http://localhost/api/media/assets', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function query(data: unknown, error: unknown = null) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    is: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => ({ data, error })),
    insert: jest.fn(() => chain),
    single: jest.fn(async () => ({ data, error })),
  }
  return chain
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.MEDIA_ASSETS_ENABLED = 'true'
  mockAuth.mockResolvedValue({ ok: true, user, headers: authHeaders })
  mockProjectAccess.mockResolvedValue({ ok: true })
  mockFrom.mockReturnValue(query(null))
  mockStorageFrom.mockReturnValue({ createSignedUploadUrl: mockCreateSignedUploadUrl })
  mockCreateSignedUploadUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.example/upload', token: 'upload-token', path: 'ignored' }, error: null })
})

afterEach(() => {
  delete process.env.MEDIA_ASSETS_ENABLED
})

describe('POST /api/media/assets', () => {
  it('requires authentication before touching the database or storage', async () => {
    mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const response = await POST(request({ projectId: 'family-a', kind: 'original_audio', mimeType: 'audio/webm' }))
    expect(response.status).toBe(401)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('rejects client-controlled bucket, state, hash and invalid metadata', async () => {
    const response = await POST(request({
      projectId: 'family-a',
      kind: 'original_audio',
      bucket: 'saga',
      state: 'ready',
      sha256: 'a'.repeat(64),
      mimeType: 'text/plain',
      expectedBytes: -1,
    }))
    expect(response.status).toBe(400)
    expect(mockProjectAccess).not.toHaveBeenCalled()
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('denies users without project access before creating an upload target', async () => {
    mockProjectAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
    const response = await POST(request({ projectId: 'family-a', kind: 'original_audio', mimeType: 'audio/webm' }))
    expect(response.status).toBe(403)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('creates a server-owned pending asset path and signed upload target', async () => {
    const inserted = {
      id: 'asset-1',
      project_id: 'family-a',
      created_by: 'alice',
      bucket: 'audio-recordings',
      object_key: 'alice/projects/family-a/assets/asset-1/original',
      state: 'pending_upload',
    }
    const existingQuery = query(null)
    const insertQuery = query(inserted)
    mockFrom.mockReturnValueOnce(existingQuery).mockReturnValueOnce(insertQuery)

    const response = await POST(request({
      projectId: 'family-a',
      kind: 'original_audio',
      mimeType: 'audio/webm',
      originalFilename: '../grandma.webm',
      expectedBytes: 123,
      idempotencyKey: 'capture-1',
    }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
    const body = await response.json()
    expect(body).toMatchObject({
      asset: inserted,
      upload: { signedUrl: 'https://storage.example/upload', token: 'upload-token' },
    })
    expect(mockStorageFrom).toHaveBeenCalledWith('audio-recordings')
    expect(mockCreateSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^alice\/projects\/family-a\/assets\/[0-9a-f-]+\/original$/),
      { upsert: false },
    )
    expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 'family-a',
      created_by: 'alice',
      bucket: 'audio-recordings',
      state: 'pending_upload',
      mime_type: 'audio/webm',
      byte_size: 123,
      original_filename: 'grandma.webm',
      idempotency_key: 'capture-1',
    }))
  })

  it('creates a project-scoped asset for an existing story and persists story_id', async () => {
    const storyQuery = query({ id: 'story-1', project_id: 'family-a' })
    const existingQuery = query(null)
    const insertQuery = query({ id: 'asset-story-1', project_id: 'family-a', story_id: 'story-1' })
    mockFrom.mockReturnValueOnce(storyQuery).mockReturnValueOnce(existingQuery).mockReturnValueOnce(insertQuery)

    const response = await POST(request({
      projectId: 'family-a',
      storyId: 'story-1',
      kind: 'original_audio',
      mimeType: 'audio/webm',
      idempotencyKey: 'story-capture-1',
    }))

    expect(response.status).toBe(200)
    expect(storyQuery.select).toHaveBeenCalledWith('id, project_id')
    expect(storyQuery.eq).toHaveBeenCalledWith('id', 'story-1')
    expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 'family-a',
      story_id: 'story-1',
    }))
  })

  it('rejects an unknown story before creating an asset', async () => {
    const storyQuery = query(null)
    mockFrom.mockReturnValueOnce(storyQuery)

    const response = await POST(request({
      projectId: 'family-a',
      storyId: 'missing-story',
      kind: 'original_audio',
      mimeType: 'audio/webm',
    }))

    expect(response.status).toBe(404)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('rejects a story belonging to another project', async () => {
    const storyQuery = query({ id: 'story-b', project_id: 'family-b' })
    mockFrom.mockReturnValueOnce(storyQuery)

    const response = await POST(request({
      projectId: 'family-a',
      storyId: 'story-b',
      kind: 'original_image',
      mimeType: 'image/png',
    }))

    expect(response.status).toBe(400)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('uses SQL NULL semantics when no idempotency key is supplied', async () => {
    const existingQuery = query(null)
    const insertQuery = query({ id: 'asset-null-key', project_id: 'family-a' })
    mockFrom.mockReturnValueOnce(existingQuery).mockReturnValueOnce(insertQuery)

    const response = await POST(request({
      projectId: 'family-a',
      kind: 'original_image',
      mimeType: 'image/png',
    }))

    expect(response.status).toBe(200)
    expect(existingQuery.is).toHaveBeenCalledWith('idempotency_key', null)
    expect(existingQuery.eq).toHaveBeenCalledWith('created_by', 'alice')
  })

  it('returns an existing project-scoped idempotent asset without creating another target', async () => {
    const existing = {
      id: 'asset-existing',
      project_id: 'family-a',
      created_by: 'alice',
      bucket: 'saga',
      object_key: 'alice/projects/family-a/assets/asset-existing/original',
      state: 'pending_upload',
    }
    mockFrom.mockReturnValue(query(existing))
    const response = await POST(request({
      projectId: 'family-a',
      kind: 'original_image',
      mimeType: 'image/png',
      idempotencyKey: 'photo-1',
    }))
    expect(response.status).toBe(200)
    expect((await response.json()).asset).toEqual(existing)
    expect(mockStorageFrom).not.toHaveBeenCalled()
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })
})
