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
    not: jest.fn(() => chain),
    in: jest.fn(() => chain),
    then: (resolve: any) => Promise.resolve({ data, error }).then(resolve),
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
  mockFrom.mockImplementation(table => query(table === 'media_assets' ? audio : []))
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
    mockFrom.mockImplementation(table => table === 'deletion_requests' ? query([]) : mockFrom.mock.calls.filter(([name]) => name === 'media_assets').length === 1 ? query(audio) : update)
    mockInfo.mockResolvedValue({ data: { size: 4, contentType: 'audio/webm' }, error: null })
    const response = await POST(request(), { params: Promise.resolve({ assetId: 'asset-audio' }) })
    expect(response.status).toBe(409)
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ state: 'quarantined', verification_error: 'integrity_mismatch' }))
    expect((await response.json()).asset.state).toBe('quarantined')
  })

  it('keeps verified audio in verifying state until T04 decoder confirmation', async () => {
    const update = query({ ...audio, state: 'verifying', content_verified_at: '2026-10-13T00:00:00.000Z' })
    mockFrom.mockImplementation(table => table === 'deletion_requests' ? query([]) : mockFrom.mock.calls.filter(([name]) => name === 'media_assets').length === 1 ? query(audio) : update)
    const response = await POST(request(), { params: Promise.resolve({ assetId: 'asset-audio' }) })
    expect(response.status).toBe(202)
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ state: 'verifying', sha256: audio.sha256, byte_size: 11 }))
  })

  it('marks a verified image ready and uses the stored exact bucket and key', async () => {
    const update = query({ ...image, state: 'ready' })
    mockFrom.mockImplementation(table => table === 'deletion_requests' ? query([]) : mockFrom.mock.calls.filter(([name]) => name === 'media_assets').length === 1 ? query(image) : update)
    mockInfo.mockResolvedValue({ data: { size: 11, contentType: 'image/png' }, error: null })
    const response = await POST(request(), { params: Promise.resolve({ assetId: 'asset-image' }) })
    expect(response.status).toBe(200)
    expect(mockProjectAccess).toHaveBeenCalledWith('family-a', user)
    expect(mockStorageFrom).toHaveBeenCalledWith('saga')
    expect(mockInfo).toHaveBeenCalledWith(image.object_key)
    expect(mockDownload).toHaveBeenCalledWith(image.object_key)
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ state: 'ready', sha256: expect.any(String), byte_size: 11 }))
    expect(update.eq).toHaveBeenCalledWith('state', 'uploaded')
    expect(update.eq).toHaveBeenCalledWith('version', 1)
  })

  it.each(['ready', 'verifying'])('replays a %s asset without downloading or downgrading', async state => {
    const current = { ...audio, state }
    mockFrom.mockImplementation(table => query(table === 'media_assets' ? current : []))
    const response = await POST(request(), { params: Promise.resolve({ assetId: audio.id }) })
    expect(response.status).toBe(state === 'ready' ? 200 : 202)
    expect(await response.json()).toEqual({ asset: current })
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it.each(['deleting', 'deleted', 'quarantined', 'tombstone'])('rejects %s verification without touching storage', async state => {
    mockFrom.mockImplementation(table => query(table === 'media_assets' ? { ...audio, state: state === 'tombstone' ? 'pending_upload' : state, tombstone_at: state === 'tombstone' ? '2026-10-29' : null } : []))
    expect((await POST(request(), { params: Promise.resolve({ assetId: audio.id }) })).status).toBe(409)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('fails closed on story deletion evidence before verifying or replaying ready', async () => {
    mockFrom.mockImplementation(table => query(table === 'media_assets' ? { ...audio, story_id: 'story-1', state: 'ready' } : [{ subject_id: 'story-1', tombstone_at: '2026-10-29' }]))
    expect((await POST(request(), { params: Promise.resolve({ assetId: audio.id }) })).status).toBe(409)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('fails closed when deletion status cannot be checked', async () => {
    mockFrom.mockImplementation(table => query(table === 'media_assets' ? audio : null, table === 'deletion_requests' ? { message: 'private detail' } : null))
    expect((await POST(request(), { params: Promise.resolve({ assetId: audio.id }) })).status).toBe(500)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('does not synthesize a quarantine success when the CAS update loses a race', async () => {
    const update = query(null, { message: 'no rows' })
    mockFrom.mockImplementation(table => table === 'deletion_requests' ? query([]) : mockFrom.mock.calls.filter(([name]) => name === 'media_assets').length === 1 ? query(audio) : update)
    mockInfo.mockResolvedValue({ data: { size: 4, contentType: 'audio/webm' }, error: null })
    const response = await POST(request(), { params: Promise.resolve({ assetId: audio.id }) })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Asset changed while verification was running' })
    expect(update.eq).toHaveBeenCalledWith('version', 1)
  })
})
