/** @jest-environment node */
import { ReadableStream } from 'node:stream/web'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const mockAuth = jest.fn()
const mockProjectAccess = jest.fn()
const mockFrom = jest.fn()
const mockStorageFrom = jest.fn()
const mockInfo = jest.fn()
const mockDownload = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/server/project-access', () => ({ requireProjectAccess: (...args: unknown[]) => mockProjectAccess(...args) }))
jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
    storage: { from: (...args: unknown[]) => mockStorageFrom(...args) },
  }),
}))

const user = { id: 'alice' } as any
const authHeaders = new Headers({ 'Set-Cookie': 'session=refreshed' })
const audio = {
  id: 'asset-audio', project_id: 'family-a', created_by: 'alice', bucket: 'audio-recordings',
  object_key: 'alice/projects/family-a/assets/asset-audio/original', kind: 'original_audio',
  mime_type: 'audio/webm', byte_size: 11,
  sha256: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
  state: 'pending_upload', version: 1,
}
const image = {
  ...audio, id: 'asset-image', bucket: 'saga', kind: 'original_image', mime_type: 'image/png',
  state: 'uploaded',
}

function query(data: unknown, error: unknown = null) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    update: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => ({ data, error })),
    single: jest.fn(async () => ({ data, error })),
  }
  return chain
}

function request() {
  return new NextRequest('http://localhost/api/media/assets/asset-audio/complete', { method: 'POST', body: '{}' })
}

function streamOf(...chunks: string[]) {
  const encoded = chunks.map(chunk => Uint8Array.from(Buffer.from(chunk)))
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= encoded.length) return controller.close()
      controller.enqueue(encoded[index++])
    },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.MEDIA_ASSETS_ENABLED = 'true'
  mockAuth.mockResolvedValue({ ok: true, user, headers: authHeaders })
  mockProjectAccess.mockResolvedValue({ ok: true })
  mockFrom.mockReturnValue(query(audio))
  mockStorageFrom.mockReturnValue({ info: mockInfo, download: mockDownload })
  mockInfo.mockResolvedValue({ data: { size: 11, contentType: 'audio/webm' }, error: null })
  mockDownload.mockReturnValue({ asStream: async () => ({ data: streamOf('hello', ' world'), error: null }) })
})

afterEach(() => delete process.env.MEDIA_ASSETS_ENABLED)

describe('POST /api/media/assets/[assetId]/complete', () => {
  it('requires authentication before loading the asset or storage object', async () => {
    mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const response = await POST(request(), { params: Promise.resolve({ assetId: 'asset-audio' }) })
    expect(response.status).toBe(401)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('returns 404 for a missing asset without touching storage', async () => {
    mockFrom.mockReturnValue(query(null))
    const response = await POST(request(), { params: Promise.resolve({ assetId: 'asset-missing' }) })
    expect(response.status).toBe(404)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('quarantines an object when byte count or hash differs', async () => {
    const update = query({ ...audio, state: 'quarantined' })
    mockFrom.mockReturnValueOnce(query(audio)).mockReturnValueOnce(update)
    mockInfo.mockResolvedValue({ data: { size: 4, contentType: 'audio/webm' }, error: null })
    const response = await POST(request(), { params: Promise.resolve({ assetId: 'asset-audio' }) })
    expect(response.status).toBe(409)
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ state: 'quarantined', verification_error: 'integrity_mismatch' }))
    expect((await response.json()).asset.state).toBe('quarantined')
  })

  it('keeps verified audio in verifying state until T04 decoder confirmation', async () => {
    const update = query({ ...audio, state: 'verifying', content_verified_at: '2026-10-13T00:00:00.000Z' })
    mockFrom.mockReturnValueOnce(query(audio)).mockReturnValueOnce(update)
    const response = await POST(request(), { params: Promise.resolve({ assetId: 'asset-audio' }) })
    expect(response.status).toBe(202)
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ state: 'verifying', sha256: audio.sha256, byte_size: 11 }))
  })

  it('marks a verified image ready and uses the stored exact bucket and key', async () => {
    const update = query({ ...image, state: 'ready' })
    mockFrom.mockReturnValueOnce(query(image)).mockReturnValueOnce(update)
    mockInfo.mockResolvedValue({ data: { size: 11, contentType: 'image/png' }, error: null })
    const response = await POST(request(), { params: Promise.resolve({ assetId: 'asset-image' }) })
    expect(response.status).toBe(200)
    expect(mockProjectAccess).toHaveBeenCalledWith('family-a', user)
    expect(mockStorageFrom).toHaveBeenCalledWith('saga')
    expect(mockInfo).toHaveBeenCalledWith(image.object_key)
    expect(mockDownload).toHaveBeenCalledWith(image.object_key)
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ state: 'ready', sha256: expect.any(String), byte_size: 11 }))
  })
})
