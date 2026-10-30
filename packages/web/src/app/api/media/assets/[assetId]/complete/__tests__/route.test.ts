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
    is: jest.fn(() => chain),
    not: jest.fn(() => chain),
    in: jest.fn(() => chain),
    then: (resolve: any) => Promise.resolve({ data, error }).then(resolve),
    update: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => ({ data, error })),
    single: jest.fn(async () => ({ data, error })),
  }
  return chain
}

function assetStore(initial: Record<string, any> = audio) {
  const store = {
    current: { ...initial } as Record<string, any> | null,
    tombstones: [] as unknown[], error: null as unknown, assetError: null as unknown,
    updates: jest.fn(), beforeCommit: () => {}, beforeReturn: async () => {},
    queries: [] as ReturnType<typeof query>[],
  }
  mockFrom.mockImplementation(table => {
    if (table === 'deletion_requests') return query(store.tombstones, store.error)
    const chain = query(store.current && { ...store.current }, store.assetError)
    store.queries.push(chain)
    chain.update.mockImplementation((patch: Record<string, unknown>) => {
      store.updates(patch)
      chain.single.mockImplementation(async () => {
        store.beforeCommit()
        const filters = [...chain.eq.mock.calls, ...chain.is.mock.calls]
        if (!store.current || filters.some(([key, value]) => (store.current![key] ?? null) !== value)) {
          return { data: null, error: { message: 'CAS conflict' } }
        }
        store.current = { ...store.current, ...patch, version: store.current.version + 1 }
        const committed = { ...store.current }
        await store.beforeReturn()
        return { data: committed, error: null }
      })
      return chain
    })
    return chain
  })
  return store
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
  describe.each(['info mismatch', 'valid stream', 'invalid stream'])('%s async boundary', stage => {
    it.each([
      ['revocation', 403], ['asset deletion', 409], ['story deletion', 409],
      ['missing asset', 404], ['identity change', 409], ['query failure', 500],
      ['asset query failure', 500], ['own tombstone', 409],
    ])('does not write or publish after %s', async (change, status) => {
      const store = assetStore({ ...audio, story_id: 'story-1' })
      let release!: () => void
      let started!: () => void
      const waiting = new Promise<void>(resolve => { started = resolve })
      const gate = new Promise<void>(resolve => { release = resolve })
      if (stage === 'info mismatch') {
        mockInfo.mockImplementation(async () => { started(); await gate; return { data: { size: 4, contentType: 'audio/webm' }, error: null } })
      } else {
        mockDownload.mockReturnValue({ asStream: async () => ({ data: new ReadableStream<Uint8Array>({
          async start(controller) {
            started()
            await gate
            controller.enqueue(Uint8Array.from(Buffer.from(stage === 'valid stream' ? 'hello world' : 'bad bytes')))
            controller.close()
          },
        }), error: null }) })
      }
      const pending = POST(request(), { params: Promise.resolve({ assetId: audio.id }) })
      await waiting
      if (change === 'revocation') mockProjectAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
      else if (change === 'asset deletion' || change === 'story deletion') store.tombstones = [{ subject_id: change === 'asset deletion' ? audio.id : 'story-1', tombstone_at: '2026-10-30' }]
      else if (change === 'missing asset') store.current = null
      else if (change === 'identity change') store.current = { ...store.current, project_id: 'family-b' }
      else if (change === 'own tombstone') store.current = { ...store.current, tombstone_at: '2026-10-30' }
      else if (change === 'asset query failure') store.assetError = { message: 'private provider failure' }
      else store.error = { message: 'private provider failure' }
      release()
      const response = await pending
      expect(store.updates).not.toHaveBeenCalled()
      expect(response.status).toBe(status)
      expect(await response.text()).not.toMatch(/"asset"|private provider failure/)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
    })
  })

  it.each(['ready', 'verifying', 'quarantined'])('withholds a committed %s result after revocation while CAS returns', async state => {
    const store = assetStore(state === 'ready' ? image : audio)
    mockInfo.mockResolvedValue({ data: { size: state === 'quarantined' ? 4 : 11, contentType: state === 'ready' ? 'image/png' : 'audio/webm' }, error: null })
    let release!: () => void
    let started!: () => void
    const waiting = new Promise<void>(resolve => { started = resolve })
    store.beforeReturn = async () => { started(); await new Promise<void>(resolve => { release = resolve }) }
    const pending = POST(request(), { params: Promise.resolve({ assetId: store.current!.id }) })
    await waiting
    mockProjectAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
    release()
    const response = await pending
    expect(response.status).toBe(403)
    expect(await response.text()).not.toContain('"asset"')
    expect(store.current!.state).toBe(state)
    expect(store.updates).toHaveBeenCalledTimes(1)
  })

  describe.each(['ready', 'verifying', 'quarantined'])('committed %s response', state => {
    it.each([
      ['asset deletion', 409], ['story deletion', 409], ['changed identity', 409],
      ['missing asset', 404], ['query failure', 500], ['asset query failure', 500],
    ])('withholds the result after %s during CAS return', async (change, status) => {
      const store = assetStore({ ...(state === 'ready' ? image : audio), story_id: 'story-1' })
      mockInfo.mockResolvedValue({ data: { size: state === 'quarantined' ? 4 : 11, contentType: state === 'ready' ? 'image/png' : 'audio/webm' }, error: null })
      let release!: () => void
      let started!: () => void
      const waiting = new Promise<void>(resolve => { started = resolve })
      store.beforeReturn = async () => { started(); await new Promise<void>(resolve => { release = resolve }) }
      const pending = POST(request(), { params: Promise.resolve({ assetId: store.current!.id }) })
      await waiting
      if (change === 'asset deletion' || change === 'story deletion') store.tombstones = [{ subject_id: change === 'asset deletion' ? store.current!.id : 'story-1', tombstone_at: '2026-10-30' }]
      else if (change === 'changed identity') store.current = { ...store.current, object_key: 'changed/key' }
      else if (change === 'missing asset') store.current = null
      else if (change === 'asset query failure') store.assetError = { message: 'private provider detail' }
      else store.error = { message: 'private provider detail' }
      release()
      const response = await pending
      expect(response.status).toBe(status)
      expect(await response.text()).not.toMatch(/"asset"|private provider detail/)
      expect(store.updates).toHaveBeenCalledTimes(1)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
    })
  })

  it.each(['ready', 'verifying'])('rechecks before a no-storage %s replay', async state => {
    assetStore({ ...audio, state })
    let release!: (value: unknown) => void
    let started!: () => void
    const waiting = new Promise<void>(resolve => { started = resolve })
    mockProjectAccess.mockImplementationOnce(() => { started(); return new Promise(resolve => { release = resolve }) })
    const pending = POST(request(), { params: Promise.resolve({ assetId: audio.id }) })
    await waiting
    mockProjectAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
    release({ ok: true })
    const response = await pending
    expect(response.status).toBe(403)
    expect(await response.text()).not.toContain('"asset"')
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('requires authentication before loading the asset or storage object', async () => {
    mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const response = await POST(request(), { params: Promise.resolve({ assetId: 'asset-audio' }) })
    expect(response.status).toBe(401)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it.each([undefined, 'false', 'TRUE', '1'])('keeps the exact true gate for %j', async flag => {
    if (flag === undefined) delete process.env.MEDIA_ASSETS_ENABLED
    else process.env.MEDIA_ASSETS_ENABLED = flag
    const response = await POST(request(), { params: Promise.resolve({ assetId: audio.id }) })
    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
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
    const store = assetStore()
    mockInfo.mockResolvedValue({ data: { size: 4, contentType: 'audio/webm' }, error: null })
    const response = await POST(request(), { params: Promise.resolve({ assetId: 'asset-audio' }) })
    expect(response.status).toBe(409)
    expect(store.updates).toHaveBeenCalledWith(expect.objectContaining({ state: 'quarantined', verification_error: 'integrity_mismatch' }))
    expect((await response.json()).asset.state).toBe('quarantined')
  })

  it('keeps verified audio in verifying state until T04 decoder confirmation', async () => {
    const store = assetStore()
    const response = await POST(request(), { params: Promise.resolve({ assetId: 'asset-audio' }) })
    expect(response.status).toBe(202)
    expect(store.updates).toHaveBeenCalledWith(expect.objectContaining({ state: 'verifying', sha256: audio.sha256, byte_size: 11, content_verified_at: null }))
    expect((await response.json()).asset).toMatchObject({ state: 'verifying', version: 2 })
  })

  it('marks a verified image ready and uses the stored exact bucket and key', async () => {
    const store = assetStore(image)
    mockInfo.mockResolvedValue({ data: { size: 11, contentType: 'image/png' }, error: null })
    const response = await POST(request(), { params: Promise.resolve({ assetId: 'asset-image' }) })
    expect(response.status).toBe(200)
    expect(mockProjectAccess).toHaveBeenCalledWith('family-a', user)
    expect(mockStorageFrom).toHaveBeenCalledWith('saga')
    expect(mockInfo).toHaveBeenCalledWith(image.object_key)
    expect(mockDownload).toHaveBeenCalledWith(image.object_key)
    expect(store.updates).toHaveBeenCalledWith(expect.objectContaining({ state: 'ready', sha256: expect.any(String), byte_size: 11 }))
    const update = store.queries.find(chain => chain.update.mock.calls.length)
    expect(update.eq).toHaveBeenCalledWith('state', 'uploaded')
    expect(update.eq).toHaveBeenCalledWith('version', 1)
    expect(update.is).toHaveBeenCalledWith('story_id', null)
    expect(update.is).not.toHaveBeenCalledWith('tombstone_at', null)
    expect((await response.json()).asset).toMatchObject({ state: 'ready', version: 2 })
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

  it.each(['state', 'version', 'id', 'project_id', 'story_id', 'bucket', 'object_key', 'kind'])('does not synthesize a quarantine success when CAS loses a %s race', async field => {
    const store = assetStore()
    store.beforeCommit = () => { store.current![field] = field === 'version' ? 2 : 'changed' }
    mockInfo.mockResolvedValue({ data: { size: 4, contentType: 'audio/webm' }, error: null })
    const response = await POST(request(), { params: Promise.resolve({ assetId: audio.id }) })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Asset changed while verification was running' })
    expect(store.queries.find(chain => chain.update.mock.calls.length).eq).toHaveBeenCalledWith('version', 1)
  })
})
