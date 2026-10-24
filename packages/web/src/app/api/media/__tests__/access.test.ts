/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { POST as sign } from '../signed-url/route'
import { POST as transcribe } from '../../ai/transcribe/route'
import { POST as uploadImage } from '../upload-image/route'

const mockAuth = jest.fn()
let mockDatabaseUnavailable = false
let mockLookupError = false
let mockDownloaded: Blob | null
let mockDownloadStream: ReadableStream<Uint8Array> | undefined
const mockInfo = jest.fn()
const mockSign = jest.fn()
const mockDownload = jest.fn()
const mockUpload = jest.fn()
const mockStorageBucket = jest.fn()
const mockSharp = jest.fn()
const projects = [
  { id: 'family-a', facilitator_id: 'organizer-a' },
  { id: 'family-b', facilitator_id: 'organizer-b' },
]
const roles = [
  { id: 'role-a', project_id: 'family-a', user_id: 'alice', status: 'active' },
  { id: 'role-b', project_id: 'family-b', user_id: 'alice', status: 'removed' },
]
const stories = [
  { id: 'story-a', project_id: 'family-a' },
  { id: 'story-b', project_id: 'family-b' },
]

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => {
    if (mockDatabaseUnavailable) throw new Error('not configured')
    return {
      auth: { getUser: async () => ({ data: { user: null } }) },
      storage: { from: (...args: unknown[]) => mockStorageBucket(...args) },
      from: (table: string) => {
        const filters: Record<string, unknown> = {}
        const query = {
          select: () => query,
          eq: (field: string, value: unknown) => { filters[field] = value; return query },
          maybeSingle: async () => {
            const rows = table === 'projects' ? projects : table === 'project_roles' ? roles : table === 'stories' ? stories : []
            return {
              data: mockLookupError ? null : rows.find(row => Object.entries(filters).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
              error: mockLookupError ? { message: 'database unavailable' } : null,
            }
          },
        }
        return query
      },
    }
  },
}))
jest.mock('sharp', () => ({ __esModule: true, default: (...args: unknown[]) => mockSharp(...args) }))

const originalFetch = global.fetch
const originalKey = process.env.SILICONFLOW_API_KEY
const mockProvider = jest.fn()
const headers = () => new Headers({ 'Set-Cookie': 'session=refreshed' })
const request = (body: unknown) => new NextRequest('http://localhost/api/media/signed-url', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
})
const multipart = (values: Record<string, string | Blob>) => {
  const form = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value instanceof Blob) form.append(key, value, key === 'audio' ? 'voice.mp3' : 'photo.png')
    else form.append(key, value)
  }
  return new NextRequest('http://localhost/api/media/test', { method: 'POST', body: form })
}
const noStorage = () => expect(mockStorageBucket).not.toHaveBeenCalled()

beforeEach(() => {
  jest.clearAllMocks()
  mockDatabaseUnavailable = false
  mockLookupError = false
  mockAuth.mockResolvedValue({ ok: true, user: { id: 'alice' }, headers: headers() })
  mockDownloaded = new Blob(['original audio'], { type: 'audio/mpeg' })
  mockSign.mockResolvedValue({ data: { signedUrl: 'https://storage.example/signed' }, error: null })
  mockDownloadStream = undefined
  mockInfo.mockImplementation(async () => ({
    data: mockDownloaded ? { size: mockDownloaded.size, contentType: mockDownloaded.type } : null,
    error: mockDownloaded ? null : { message: 'missing' },
  }))
  mockDownload.mockImplementation(() => Object.assign(
    Promise.resolve({ data: mockDownloaded, error: mockDownloaded ? null : { message: 'missing' } }),
    { asStream: async () => ({
      data: mockDownloadStream ?? mockDownloaded?.stream() ?? null,
      error: mockDownloaded ? null : { message: 'missing' },
    }) },
  ))
  mockUpload.mockImplementation(async (path: string) => ({ data: { path }, error: null }))
  mockStorageBucket.mockReturnValue({ createSignedUrl: mockSign, download: mockDownload, info: mockInfo, upload: mockUpload })
  const sharpChain = { resize: jest.fn(), toFormat: jest.fn(), jpeg: jest.fn(), png: jest.fn(), toBuffer: jest.fn(async () => Buffer.from('thumbnail')) }
  for (const method of ['resize', 'toFormat', 'jpeg', 'png'] as const) sharpChain[method].mockReturnValue(sharpChain)
  mockSharp.mockReturnValue(sharpChain)
  mockProvider.mockResolvedValue(new Response(JSON.stringify({ text: 'Original words' }), { status: 200 }))
  global.fetch = mockProvider
  process.env.SILICONFLOW_API_KEY = 'test-only'
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  global.fetch = originalFetch
  if (originalKey === undefined) delete process.env.SILICONFLOW_API_KEY
  else process.env.SILICONFLOW_API_KEY = originalKey
  jest.restoreAllMocks()
})

describe('private media signing', () => {
  it.each(['other/projects/family-b/stories/temp/audio.mp3', 'alice/projects/family-b/stories/temp/audio.mp3'])('denies another family or removed uploader: %s', async path => {
    const response = await sign(request({ bucket: 'audio-recordings', path }))
    expect(response.status).toBe(403)
    expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
    noStorage()
  })
  it('signs the exact project key for an active member and preserves auth headers', async () => {
    const path = 'other/projects/family-a/stories/temp/été memory.mp3'
    const response = await sign(request({ bucket: 'audio-recordings', path, expiresIn: 9000 }))
    expect(response.status).toBe(200)
    expect(mockStorageBucket).toHaveBeenCalledWith('audio-recordings')
    expect(mockSign).toHaveBeenCalledWith(path, 3600)
    expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
  it('preserves separate refreshed session cookie chunks', async () => {
    const authHeaders = new Headers()
    authHeaders.append('Set-Cookie', 'session.0=first; Path=/; HttpOnly')
    authHeaders.append('Set-Cookie', 'session.1=second; Path=/; HttpOnly')
    mockAuth.mockResolvedValue({ ok: true, user: { id: 'alice' }, headers: authHeaders })
    const response = await sign(request({ bucket: 'saga', path: 'alice/images/photo.png' }))
    expect(response.headers.getSetCookie()).toEqual([
      'session.0=first; Path=/; HttpOnly', 'session.1=second; Path=/; HttpOnly',
    ])
  })
  it.each(['other/images/stories/story-a/photo.png', 'other/images/interactions/story-a/photo.png'])('checks actual story project for legacy image %s', async path => {
    expect((await sign(request({ bucket: 'saga', path }))).status).toBe(200)
    expect(mockSign).toHaveBeenCalledWith(path, 3600)
  })
  it('does not treat ownership prefix as story permission', async () => {
    expect((await sign(request({ bucket: 'saga', path: 'alice/images/stories/story-b/photo.png' }))).status).toBe(403)
    noStorage()
  })
  it('allows only the owner of a non-project personal file', async () => {
    expect((await sign(request({ bucket: 'saga', path: 'alice/images/photo.png' }))).status).toBe(200)
    mockStorageBucket.mockClear()
    expect((await sign(request({ bucket: 'saga', path: 'other/images/photo.png' }))).status).toBe(403)
    noStorage()
  })
  it.each([
    'alice/projects/family-a/../family-b/a.mp3', 'alice/projects/family-a/%2e%2e/a.mp3',
    'alice/projects/family-a/%252f/a.mp3', '/alice/projects/family-a/a.mp3',
    'alice/projects//a.mp3', 'alice/projects/family-a/a\\b.mp3',
    'https://example.com/alice/projects/family-a/a.mp3', 'alice/foo/projects/family-a/a.mp3',
    'alice/images/stories', 'alice/projects/family-a/a.mp3?token=foo',
    'alice/projects/family-a/control\u0085.mp3',
  ])('rejects ambiguous key before storage: %s', async path => {
    expect((await sign(request({ bucket: 'saga', path }))).status).toBe(400)
    noStorage()
  })
  it.each(['900', 0, -5, null])('rejects invalid expiry %s', async expiresIn => {
    expect((await sign(request({ bucket: 'saga', path: 'alice/images/photo.png', expiresIn }))).status).toBe(400)
    noStorage()
  })
  it('fails closed on project lookup error', async () => {
    mockLookupError = true
    expect((await sign(request({ bucket: 'saga', path: 'alice/projects/family-a/a.mp3' }))).status).toBe(500)
    noStorage()
  })
  it('returns service unavailable instead of signing when admin configuration is absent', async () => {
    mockDatabaseUnavailable = true
    expect((await sign(request({ bucket: 'saga', path: 'alice/images/photo.png' }))).status).toBe(503)
    noStorage()
  })
  it('rejects malformed JSON without an unhandled route failure', async () => {
    const response = await sign(new NextRequest('http://localhost/api/media/signed-url', { method: 'POST', body: '{' }))
    expect(response.status).toBe(400)
    noStorage()
  })
})

describe('stored audio transcription', () => {
  it.each([undefined, 'saga'])('uses exact path and explicit/default bucket %s with original MIME/name', async storageBucket => {
    const storagePath = 'other/projects/family-a/stories/temp/memory.mp3'
    const response = await transcribe(multipart({ storagePath, ...(storageBucket ? { storageBucket } : {}) }))
    expect(response.status).toBe(200)
    expect(mockStorageBucket).toHaveBeenCalledWith(storageBucket ?? 'audio-recordings')
    expect(mockDownload).toHaveBeenCalledWith(storagePath)
    const file = mockProvider.mock.calls[0][1].body.get('file') as File
    expect(file.name).toBe('memory.mp3')
    expect(file.type).toBe('audio/mpeg')
    expect(await file.text()).toBe('original audio')
  })
  it('rejects a removed uploader before downloading or calling the provider', async () => {
    const response = await transcribe(multipart({ storagePath: 'alice/projects/family-b/stories/temp/memory.mp3' }))
    expect(response.status).toBe(403)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('30')
    expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
    noStorage()
    expect(mockProvider).not.toHaveBeenCalled()
  })
  it('does not search another bucket when an authorized object is missing', async () => {
    mockDownloaded = null
    expect((await transcribe(multipart({ storagePath: 'alice/projects/family-a/temp/memory.mp3' }))).status).toBe(404)
    expect(mockStorageBucket.mock.calls).toEqual([['audio-recordings']])
    expect(mockProvider).not.toHaveBeenCalled()
  })
  it.each([
    { storagePath: '' }, { audio: 'not a file' }, { storagePath: 'alice/temp/a.mp3', storageBucket: 'unknown' },
    { storagePath: 'alice/temp/a.mp3', audio: new Blob(['a'], { type: 'audio/mpeg' }) },
  ])('rejects malformed or conflicting inputs %j', async fields => {
    expect((await transcribe(multipart(fields))).status).toBe(400)
    noStorage()
    expect(mockProvider).not.toHaveBeenCalled()
  })
  it('retains the actual name and MIME of a direct upload', async () => {
    expect((await transcribe(multipart({ audio: new Blob(['a'], { type: 'audio/mpeg' }) }))).status).toBe(200)
    const file = mockProvider.mock.calls[0][1].body.get('file') as File
    expect(file.name).toBe('voice.mp3')
    expect(file.type).toBe('audio/mpeg')
  })
  it.each(['constructor', '__proto__'])('uses octet-stream for unknown extension %s', async extension => {
    mockDownloaded = new Blob(['original audio'])
    expect((await transcribe(multipart({ storagePath: `alice/temp/audio.${extension}` }))).status).toBe(200)
    const file = mockProvider.mock.calls[0][1].body.get('file') as File
    expect(file.type).toBe('application/octet-stream')
  })
  it.each([undefined, 1])('stops an oversized stream when metadata size is %s', async size => {
    mockInfo.mockResolvedValue({ data: { size, contentType: 'audio/mpeg' }, error: null })
    const cancel = jest.fn()
    let reads = 0
    const chunk = new Uint8Array(1024 * 1024)
    mockDownloadStream = new ReadableStream({
      pull(controller) { reads += 1; controller.enqueue(chunk) },
      cancel,
    }, { highWaterMark: 0 })
    const response = await transcribe(multipart({ storagePath: 'alice/temp/large.mp3' }))
    expect(response.status).toBe(413)
    expect(reads).toBe(101)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(mockProvider).not.toHaveBeenCalled()
  })
  it('rejects an oversized stored object before downloading or calling the provider', async () => {
    Object.defineProperty(mockDownloaded, 'size', { value: 101 * 1024 * 1024 })
    const read = jest.spyOn(mockDownloaded!, 'arrayBuffer')
    expect((await transcribe(multipart({ storagePath: 'alice/temp/large.mp3' }))).status).toBe(413)
    expect(read).not.toHaveBeenCalled()
    expect(mockDownload).not.toHaveBeenCalled()
    expect(mockProvider).not.toHaveBeenCalled()
  })
})

describe('authenticated image upload', () => {
  it('requires authentication before parsing or processing the image', async () => {
    mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const formData = jest.fn()
    const response = await uploadImage({ formData } as unknown as NextRequest)
    expect(response.status).toBe(401)
    expect(formData).not.toHaveBeenCalled()
    expect(mockSharp).not.toHaveBeenCalled()
    noStorage()
  })
  it.each(['images', 'images/stories/story-a', 'images/interactions/story-a', 'projects/family-a/images'])('preserves original bytes in authenticated folder %s', async folder => {
    const response = await uploadImage(multipart({ folder, file: new Blob(['original photo'], { type: 'image/png' }) }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mockUpload.mock.calls[0][0]).toMatch(new RegExp(`^alice/${folder}/[^/]+\\.png$`))
    expect(mockUpload.mock.calls[0][1]).toEqual(Buffer.from('original photo'))
    expect(mockUpload.mock.calls[1][1]).toEqual(Buffer.from('thumbnail'))
    expect(mockUpload.mock.calls.some(([path]) => path.startsWith('anonymous/'))).toBe(false)
  })
  it.each(['images/stories/story-b', 'projects/family-b/images'])('denies another family folder %s before processing', async folder => {
    expect((await uploadImage(multipart({ folder, file: new Blob(['a'], { type: 'image/png' }) }))).status).toBe(403)
    expect(mockSharp).not.toHaveBeenCalled()
    noStorage()
  })
  it.each(['images/../projects/family-b', 'images/%2e%2e/family-b', 'other/folder', 'images/stories'])('rejects invalid folder %s', async folder => {
    expect((await uploadImage(multipart({ folder, file: new Blob(['a'], { type: 'image/png' }) }))).status).toBe(400)
    noStorage()
  })
  it('does not return success if thumbnail upload fails', async () => {
    mockUpload.mockResolvedValueOnce({ data: { path: 'alice/images/photo.png' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'upload failed' } })
    const response = await uploadImage(multipart({ file: new Blob(['a'], { type: 'image/png' }) }))
    expect(response.status).toBe(500)
    expect((await response.json()).success).not.toBe(true)
    expect(mockSign).not.toHaveBeenCalled()
  })
})
