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
  story_id: 'story-1',
  object_key: 'alice/projects/family-a/assets/asset-ready/original', state: 'ready',
  kind: 'original_image', version: 1,
}

function query(data: unknown, error: unknown = null) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    not: jest.fn(() => chain),
    in: jest.fn(() => chain),
    then: (resolve: any) => Promise.resolve({ data, error }).then(resolve),
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
  mockFrom.mockImplementation(table => query(table === 'media_assets' ? ready : []))
  mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl })
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.example/asset' }, error: null })
})

afterEach(() => delete process.env.MEDIA_ASSETS_ENABLED)

describe('GET /api/media/assets/[assetId]/access', () => {
  it.each([
    ['revocation', 403], ['asset deletion', 409], ['story deletion', 409],
    ['missing asset', 404], ['own tombstone', 409], ['id', 409], ['project_id', 409],
    ['story_id', 409], ['bucket', 409], ['object_key', 409], ['kind', 409],
    ['state', 409], ['version', 409], ['asset query error', 500],
    ['deletion query error', 500], ['permission error', 500],
  ])('discards a signed URL after %s during signing', async (change, status) => {
    let current: Record<string, unknown> | null = { ...ready }
    let tombstones: unknown[] = []
    let assetError: unknown = null
    let deletionError: unknown = null
    let release!: (value: unknown) => void
    let started!: () => void
    const waiting = new Promise<void>(resolve => { started = resolve })
    const signed = new Promise(resolve => { release = resolve })
    mockFrom.mockImplementation(table => table === 'media_assets'
      ? query(current && { ...current }, assetError) : query(tombstones, deletionError))
    mockCreateSignedUrl.mockImplementation(() => { started(); return signed })

    const pending = GET(request(), { params: Promise.resolve({ assetId: ready.id }) })
    await waiting
    if (change === 'revocation') mockProjectAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
    else if (change === 'permission error') mockProjectAccess.mockRejectedValue(new Error('private provider failure'))
    else if (change === 'asset deletion' || change === 'story deletion') tombstones = [{ subject_id: change === 'asset deletion' ? ready.id : ready.story_id, tombstone_at: '2026-10-30' }]
    else if (change === 'missing asset') current = null
    else if (change === 'own tombstone') current = { ...current, tombstone_at: '2026-10-30' }
    else if (change === 'asset query error') assetError = { message: 'private provider failure' }
    else if (change === 'deletion query error') deletionError = { message: 'private provider failure' }
    else current = { ...current, [change]: change === 'version' ? 2 : 'changed' }
    release({ data: { signedUrl: 'https://storage.example/private-signed-url' }, error: null })

    const response = await pending
    const body = await response.text()
    expect(response.status).toBe(status)
    expect(body).not.toMatch(/private-signed-url|signedUrl|private provider failure/)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1)
  })

  it('requires authentication before loading asset or storage', async () => {
    mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const response = await GET(request(), { params: Promise.resolve({ assetId: 'asset-ready' }) })
    expect(response.status).toBe(401)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it.each([undefined, 'false', 'TRUE', '1'])('keeps the exact true gate for %j', async flag => {
    if (flag === undefined) delete process.env.MEDIA_ASSETS_ENABLED
    else process.env.MEDIA_ASSETS_ENABLED = flag
    const response = await GET(request(), { params: Promise.resolve({ assetId: ready.id }) })
    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('preserves each refreshed cookie', async () => {
    const cookies = new Headers()
    cookies.append('Set-Cookie', 'session-a=refreshed; Path=/')
    cookies.append('Set-Cookie', 'session-b=refreshed; Path=/')
    mockAuth.mockResolvedValue({ ok: true, user, headers: cookies })
    const response = await GET(request(), { params: Promise.resolve({ assetId: ready.id }) })
    expect(response.status).toBe(200)
    expect(response.headers.getSetCookie()).toEqual(cookies.getSetCookie())
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
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(ready.object_key, 300)
  })

  it('fails closed when storage cannot sign', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'missing object' } })
    const response = await GET(request(), { params: Promise.resolve({ assetId: 'asset-ready' }) })
    expect(response.status).toBe(404)
  })

  it('rejects a ready asset when deletion tombstone exists', async () => {
    mockFrom.mockReturnValue(query({ ...ready, tombstone_at: '2026-10-24T10:00:00.000Z' }))
    const response = await GET(request(), { params: Promise.resolve({ assetId: 'asset-ready' }) })
    expect(response.status).toBe(409)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('loads optional tombstone evidence without assuming an unshipped asset column', async () => {
    const assetQuery = query(ready)
    mockFrom.mockImplementation(table => table === 'media_assets' ? assetQuery : query([]))
    expect((await GET(request(), { params: Promise.resolve({ assetId: 'asset-ready' }) })).status).toBe(200)
    expect(assetQuery.select).toHaveBeenCalledWith('*')
  })

  it.each(['story-1', 'asset-ready'])('blocks signing for deleted subject %s', async subjectId => {
    mockFrom.mockImplementation(table => query(table === 'media_assets' ? ready : [{ subject_id: subjectId, tombstone_at: '2026-10-29' }]))
    expect((await GET(request(), { params: Promise.resolve({ assetId: 'asset-ready' }) })).status).toBe(409)
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('fails closed when deletion evidence cannot be loaded', async () => {
    mockFrom.mockImplementation(table => query(table === 'media_assets' ? ready : null, table === 'deletion_requests' ? { message: 'private failure' } : null))
    const response = await GET(request(), { params: Promise.resolve({ assetId: 'asset-ready' }) })
    expect(response.status).toBe(500)
    expect(mockStorageFrom).not.toHaveBeenCalled()
    expect(await response.text()).not.toContain('private failure')
  })
})


describe('published recording candidate access', () => {
  const uuid = (d: string) => `${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`
  const lineage = { id: uuid('1'), job_id: uuid('2'), project_id: uuid('3'), asset_id: uuid('4'), session_id: uuid('5'),
    manifest_sha256: 'a'.repeat(64), worker_id: 'worker-1', attempt_no: 1, bucket: 'recording-candidates',
    object_key: `jobs/${uuid('2')}/attempts/1/${uuid('1')}`, state: 'prepared', byte_size: 20, sha256: 'b'.repeat(64),
    mime_type: 'audio/webm', duration_ms: 1000, created_at: '2026-11-04T00:00:00.000001Z', prepared_at: '2026-11-04T00:00:00.000002Z' }
  const published = { ...ready, id: lineage.asset_id, project_id: lineage.project_id, bucket: lineage.bucket, object_key: lineage.object_key,
    kind: 'original_audio', byte_size: lineage.byte_size, sha256: lineage.sha256, mime_type: lineage.mime_type, duration_ms: lineage.duration_ms }
  const access = () => GET(request(), { params: Promise.resolve({ assetId: published.id }) })
  function setup() {
    const events: string[] = []
    let deleted: string | null = null
    let candidate: unknown = lineage
    mockFrom.mockImplementation(table => {
      if (table === 'media_assets') { events.push(table); return query(published) }
      if (table === 'recording_output_candidates') { events.push(table); return query(candidate) }
      let subjects: string[] = []
      const chain = query([])
      chain.in.mockImplementation((_column: string, ids: string[]) => { subjects = ids; return chain })
      chain.then = (resolve: (value: unknown) => unknown) => {
        events.push('deletion_requests')
        return Promise.resolve({ data: deleted && subjects.includes(deleted) ? [{ subject_id: deleted, tombstone_at: '2026-11-04' }] : [], error: null }).then(resolve)
      }
      return chain
    })
    return { events, remove: (id: string) => { deleted = id }, candidate: (row: unknown) => { candidate = row } }
  }
  it('validates lineage before signing and again before the final deletion read', async () => {
    const f = setup()
    expect((await access()).status).toBe(200)
    expect(mockStorageFrom).toHaveBeenCalledWith('recording-candidates')
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(lineage.object_key, 300)
    expect(f.events).toEqual(['media_assets', 'recording_output_candidates', 'deletion_requests', 'media_assets', 'recording_output_candidates', 'deletion_requests'])
  })
  it.each(['project', 'session'])('blocks signing when candidate %s is already deleted', async subject => {
    const f = setup(); f.remove(subject === 'project' ? lineage.project_id : lineage.session_id)
    expect((await access()).status).toBe(409)
    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
  })
  it.each(['project', 'session'])('discards signed URL when candidate %s is deleted during signing', async subject => {
    const f = setup()
    mockCreateSignedUrl.mockImplementation(async () => {
      f.remove(subject === 'project' ? lineage.project_id : lineage.session_id)
      return { data: { signedUrl: 'https://storage.example/SECRET' }, error: null }
    })
    const response = await access()
    expect(response.status).toBe(409); expect(await response.text()).not.toMatch(/signedUrl|SECRET/)
    expect(f.events.at(-1)).toBe('deletion_requests')
  })
  it.each([null, { ...lineage, session_id: '../SECRET' }, { ...lineage, sha256: 'c'.repeat(64) }])('rejects missing or corrupt lineage before signing %#', async row => {
    const f = setup(); f.candidate(row)
    expect((await access()).status).toBe(500); expect(mockCreateSignedUrl).not.toHaveBeenCalled()
  })
  it('discards URL if lineage disappears during signing', async () => {
    const f = setup()
    mockCreateSignedUrl.mockImplementation(async () => { f.candidate(null); return { data: { signedUrl: 'SECRET' }, error: null } })
    const response = await access()
    expect(response.status).toBe(500); expect(await response.text()).not.toMatch(/signedUrl|SECRET/)
  })
})
