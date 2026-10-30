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
const storedIdentity = { bucket: 'saga', object_key: 'alice/projects/family-a/assets/asset-existing/original', version: 1 }

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
    in: jest.fn(() => chain),
    not: jest.fn(() => chain),
    then: (resolve: any) => Promise.resolve({ data, error }).then(resolve),
    maybeSingle: jest.fn(async () => ({ data, error })),
    insert: jest.fn(() => chain),
    single: jest.fn(async () => ({ data, error })),
  }
  return chain
}

function assetStore(initial: Record<string, unknown> | null = null) {
  const store = { current: initial, tombstones: [] as unknown[], error: null as unknown, inserts: jest.fn(), story: query({ id: 'story-1', project_id: 'family-a' }) }
  mockFrom.mockImplementation(table => {
    if (table === 'stories') return store.story
    if (table === 'deletion_requests') return query(store.tombstones, store.error)
    const chain = query(store.current && { ...store.current })
    chain.insert.mockImplementation((payload: Record<string, unknown>) => {
      store.inserts(payload)
      store.current = { ...payload }
      chain.single.mockImplementation(async () => ({ data: { ...store.current }, error: null }))
      return chain
    })
    return chain
  })
  return store
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.MEDIA_ASSETS_ENABLED = 'true'
  mockAuth.mockResolvedValue({ ok: true, user, headers: authHeaders })
  mockProjectAccess.mockResolvedValue({ ok: true })
  mockFrom.mockImplementation(table => query(table === 'deletion_requests' ? [] : null))
  mockStorageFrom.mockReturnValue({ createSignedUploadUrl: mockCreateSignedUploadUrl })
  mockCreateSignedUploadUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.example/upload', token: 'upload-token', path: 'ignored' }, error: null })
})

afterEach(() => {
  delete process.env.MEDIA_ASSETS_ENABLED
})

describe('POST /api/media/assets', () => {
  describe.each(['new registration', 'pending replay'])('%s during signing', mode => {
    it.each([
      ['revocation', 403], ['asset deletion', 409], ['story deletion', 409],
      ['missing asset', 404], ['identity change', 409], ['query failure', 500],
    ])('does not release credentials after %s', async (change, status) => {
      const existing = { ...storedIdentity, id: 'asset-existing', project_id: 'family-a', story_id: 'story-1', created_by: 'alice',
        bucket: 'saga', object_key: 'alice/projects/family-a/assets/asset-existing/original',
        kind: 'original_image', state: 'pending_upload', version: 1, mime_type: 'image/png',
        byte_size: null, original_filename: 'unnamed-asset' }
      const store = assetStore(mode === 'pending replay' ? existing : null)
      let release!: (value: unknown) => void
      let started!: () => void
      const waiting = new Promise<void>(resolve => { started = resolve })
      const signing = new Promise(resolve => { release = resolve })
      mockCreateSignedUploadUrl.mockImplementation(() => { started(); return signing })
      const pending = POST(request({ projectId: 'family-a', storyId: 'story-1', kind: 'original_image', mimeType: 'image/png', idempotencyKey: 'photo-1' }))
      await waiting
      if (change === 'revocation') mockProjectAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
      else if (change === 'asset deletion' || change === 'story deletion') store.tombstones = [{ subject_id: change === 'asset deletion' ? store.current!.id : 'story-1', tombstone_at: '2026-10-30' }]
      else if (change === 'missing asset') store.current = null
      else if (change === 'identity change') store.current = { ...store.current, object_key: 'changed/key' }
      else store.error = { message: 'private provider failure' }
      release({ data: { signedUrl: 'https://storage.example/private-upload', token: 'private-token' }, error: null })

      const response = await pending
      expect(response.status).toBe(status)
      expect(await response.text()).not.toMatch(/private-upload|private-token|"asset"|private provider failure/)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
      expect(store.inserts).toHaveBeenCalledTimes(mode === 'new registration' ? 1 : 0)
    })
  })

  it.each(['ready', 'verifying'])('rechecks permission before replaying a %s asset without storage', async state => {
    assetStore({ id: 'asset-existing', project_id: 'family-a', created_by: 'alice', story_id: null,
      bucket: 'saga', object_key: 'stored/key', kind: 'original_image', mime_type: 'image/png',
      byte_size: null, original_filename: 'unnamed-asset', state, version: 1 })
    let release!: (value: unknown) => void
    let started!: () => void
    const waiting = new Promise<void>(resolve => { started = resolve })
    mockProjectAccess.mockImplementationOnce(() => { started(); return new Promise(resolve => { release = resolve }) })
    const pending = POST(request({ projectId: 'family-a', kind: 'original_image', mimeType: 'image/png', idempotencyKey: 'photo-1' }))
    await waiting
    mockProjectAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
    release({ ok: true })
    const response = await pending
    expect(response.status).toBe(403)
    expect(await response.text()).not.toContain('"asset"')
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('requires authentication before touching the database or storage', async () => {
    mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const response = await POST(request({ projectId: 'family-a', kind: 'original_audio', mimeType: 'audio/webm' }))
    expect(response.status).toBe(401)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it.each([undefined, 'false', 'TRUE', '1'])('keeps the exact true gate for %j', async flag => {
    if (flag === undefined) delete process.env.MEDIA_ASSETS_ENABLED
    else process.env.MEDIA_ASSETS_ENABLED = flag
    const response = await POST(request({ projectId: 'family-a', kind: 'original_image', mimeType: 'image/png' }))
    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('keeps a registration retryable after an unknown signing failure without replacing the asset', async () => {
    const store = assetStore()
    const metadata = { projectId: 'family-a', kind: 'original_image', mimeType: 'image/png', idempotencyKey: 'photo-1' }
    mockCreateSignedUploadUrl.mockRejectedValueOnce(new Error('private provider detail'))
    const failed = await POST(request(metadata))
    expect(failed.status).toBe(500)
    expect(await failed.text()).not.toContain('private provider detail')
    const registered = { ...store.current }
    const retried = await POST(request(metadata))
    expect(retried.status).toBe(200)
    expect((await retried.json()).asset).toEqual(registered)
    expect(store.inserts).toHaveBeenCalledTimes(1)
    expect(mockCreateSignedUploadUrl).toHaveBeenLastCalledWith(registered.object_key, { upsert: false })
  })

  it('rechecks permission after insert before requesting any upload signature', async () => {
    const store = assetStore()
    store.inserts.mockImplementation(() => {
      mockProjectAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
    })
    const response = await POST(request({ projectId: 'family-a', kind: 'original_image', mimeType: 'image/png' }))
    expect(response.status).toBe(403)
    expect(await response.text()).not.toContain('"asset"')
    expect(store.current).not.toBeNull()
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
    const store = assetStore()

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
      asset: store.current,
      upload: { signedUrl: 'https://storage.example/upload', token: 'upload-token' },
    })
    expect(mockStorageFrom).toHaveBeenCalledWith('audio-recordings')
    expect(mockCreateSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^alice\/projects\/family-a\/assets\/[0-9a-f-]+\/original$/),
      { upsert: false },
    )
    expect(store.inserts).toHaveBeenCalledWith(expect.objectContaining({
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
    const store = assetStore()

    const response = await POST(request({
      projectId: 'family-a',
      storyId: 'story-1',
      kind: 'original_audio',
      mimeType: 'audio/webm',
      idempotencyKey: 'story-capture-1',
    }))

    expect(response.status).toBe(200)
    expect(store.story.select).toHaveBeenCalledWith('id, project_id')
    expect(store.story.eq).toHaveBeenCalledWith('id', 'story-1')
    expect(store.inserts).toHaveBeenCalledWith(expect.objectContaining({
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

  it('always creates a new asset without an idempotency key', async () => {
    const store = assetStore()

    const response = await POST(request({
      projectId: 'family-a',
      kind: 'original_image',
      mimeType: 'image/png',
    }))

    expect(response.status).toBe(200)
    expect(store.inserts).toHaveBeenCalledTimes(1)
    expect(store.current!.idempotency_key).toBeNull()
  })

  it('reissues a non-upsert upload target for a matching pending idempotent request', async () => {
    const existing = { ...storedIdentity,
      id: 'asset-existing',
      project_id: 'family-a',
      created_by: 'alice',
      bucket: 'saga',
      object_key: 'alice/projects/family-a/assets/asset-existing/original',
      state: 'pending_upload',
      kind: 'original_image', mime_type: 'image/png', byte_size: null,
      original_filename: 'unnamed-asset', story_id: null,
    }
    mockFrom.mockImplementation(table => query(table === 'media_assets' ? existing : []))
    const response = await POST(request({
      projectId: 'family-a',
      kind: 'original_image',
      mimeType: 'image/png',
      idempotencyKey: 'photo-1',
    }))
    expect(response.status).toBe(200)
    expect((await response.json()).asset).toEqual(existing)
    expect(mockCreateSignedUploadUrl).toHaveBeenCalledWith(existing.object_key, { upsert: false })
  })

  it.each([
    { created_by: 'bob' }, { project_id: 'family-b' }, { kind: 'original_audio' },
    { mime_type: 'image/jpeg' }, { byte_size: 999 }, { original_filename: 'other.png' }, { story_id: 'other-story' },
  ])('rejects idempotency-key conflicts in stored metadata %j', async mismatch => {
    mockFrom.mockReturnValue(query({ ...storedIdentity, id: 'asset-existing', project_id: 'family-a', created_by: 'alice',
      kind: 'original_image', mime_type: 'image/png', byte_size: 123, original_filename: 'photo.png', story_id: null,
      state: 'pending_upload', ...mismatch }))
    const response = await POST(request({ projectId: 'family-a', kind: 'original_image', mimeType: 'image/png',
      expectedBytes: 123, originalFilename: 'photo.png', idempotencyKey: 'photo-1' }))
    expect(response.status).toBe(409)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it.each(['ready', 'verifying'])('returns matching %s assets without any overwrite target', async state => {
    const existing = { ...storedIdentity, id: 'asset-existing', project_id: 'family-a', created_by: 'alice',
      kind: 'original_image', mime_type: 'image/png', byte_size: 123, original_filename: 'photo.png', story_id: null, state }
    mockFrom.mockImplementation(table => query(table === 'media_assets' ? existing : []))
    const response = await POST(request({ projectId: 'family-a', kind: 'original_image', mimeType: 'image/png',
      expectedBytes: 123, originalFilename: 'photo.png', idempotencyKey: 'photo-1' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ asset: existing })
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it.each(['ready', 'verifying'])('replays an omitted byte-size expectation after verification sets %s asset size', async state => {
    const metadata = { projectId: 'family-a', kind: 'original_image', mimeType: 'image/png',
      originalFilename: 'photo.png', idempotencyKey: 'photo-without-size' }
    const store = assetStore()
    expect((await POST(request(metadata))).status).toBe(200)
    expect(store.inserts).toHaveBeenCalledWith(expect.objectContaining({ byte_size: null }))

    // Completion replaces the unknown byte size with a measured value, not a
    // new caller expectation. The unchanged registration must still replay.
    const verified = { ...store.current, byte_size: 123, state }
    mockFrom.mockImplementation(table => query(table === 'media_assets' ? verified : []))
    mockStorageFrom.mockClear()
    const response = await POST(request(metadata))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ asset: verified })
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it.each([
    { created_by: 'bob' }, { project_id: 'family-b' }, { kind: 'original_audio' },
    { mime_type: 'image/jpeg' }, { original_filename: 'other.png' }, { story_id: 'other-story' },
  ])('keeps identity and metadata guards when the byte-size expectation is omitted: %j', async mismatch => {
    const existing = { ...storedIdentity, id: 'asset-existing', project_id: 'family-a', created_by: 'alice',
      kind: 'original_image', mime_type: 'image/png', byte_size: 123, original_filename: 'photo.png', story_id: null,
      state: 'ready', ...mismatch }
    mockFrom.mockImplementation(table => query(table === 'media_assets' ? existing : []))
    const response = await POST(request({ projectId: 'family-a', kind: 'original_image', mimeType: 'image/png',
      originalFilename: 'photo.png', idempotencyKey: 'photo-1' }))
    expect(response.status).toBe(409)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it.each([null, 0, 999])('still rejects supplied expectedBytes when stored size is %j', async byteSize => {
    const existing = { ...storedIdentity, id: 'asset-existing', project_id: 'family-a', created_by: 'alice',
      kind: 'original_image', mime_type: 'image/png', byte_size: byteSize, original_filename: 'photo.png', story_id: null, state: 'ready' }
    mockFrom.mockImplementation(table => query(table === 'media_assets' ? existing : []))
    const response = await POST(request({ projectId: 'family-a', kind: 'original_image', mimeType: 'image/png',
      expectedBytes: 123, originalFilename: 'photo.png', idempotencyKey: 'photo-1' }))
    expect(response.status).toBe(409)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it.each(['deleting', 'deleted', 'quarantined', 'tombstone'])('does not revive a %s asset', async state => {
    const existing = { ...storedIdentity, id: 'asset-existing', project_id: 'family-a', created_by: 'alice',
      kind: 'original_image', mime_type: 'image/png', byte_size: 123, original_filename: 'photo.png', story_id: null,
      state: state === 'tombstone' ? 'pending_upload' : state, tombstone_at: state === 'tombstone' ? '2026-10-29' : null }
    mockFrom.mockImplementation(table => query(table === 'media_assets' ? existing : []))
    const response = await POST(request({ projectId: 'family-a', kind: 'original_image', mimeType: 'image/png',
      expectedBytes: 123, originalFilename: 'photo.png', idempotencyKey: 'photo-1' }))
    expect(response.status).toBe(409)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('fails closed before reissuing a token if deletion evidence is unavailable', async () => {
    const existing = { ...storedIdentity, id: 'asset-existing', project_id: 'family-a', created_by: 'alice',
      kind: 'original_image', mime_type: 'image/png', byte_size: null, original_filename: 'unnamed-asset', story_id: null, state: 'pending_upload' }
    mockFrom.mockImplementation(table => query(table === 'media_assets' ? existing : null, table === 'deletion_requests' ? { message: 'private detail' } : null))
    const response = await POST(request({ projectId: 'family-a', kind: 'original_image', mimeType: 'image/png', idempotencyKey: 'photo-1' }))
    expect(response.status).toBe(500)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('replays the winner of a concurrent same-key insert without overwriting it', async () => {
    const existing = { ...storedIdentity, id: 'asset-existing', project_id: 'family-a', created_by: 'alice', bucket: 'saga',
      object_key: 'alice/projects/family-a/assets/asset-existing/original', kind: 'original_image',
      mime_type: 'image/png', byte_size: 123, original_filename: 'photo.png', story_id: null, state: 'pending_upload' }
    const mediaQueries = [query(null), query(null, { code: '23505' }), query(existing)]
    mockFrom.mockImplementation(table => table === 'media_assets' ? mediaQueries.shift() ?? query(existing) : query([]))
    const response = await POST(request({ projectId: 'family-a', kind: 'original_image', mimeType: 'image/png',
      expectedBytes: 123, originalFilename: 'photo.png', idempotencyKey: 'photo-1' }))
    expect(response.status).toBe(200)
    expect((await response.json()).asset).toEqual(existing)
    expect(mockCreateSignedUploadUrl).toHaveBeenCalledWith(existing.object_key, { upsert: false })
  })
})
