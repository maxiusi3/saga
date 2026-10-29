/** @jest-environment node */
import { createHash } from 'crypto'
import { ReadableStream } from 'node:stream/web'
import JSZip from 'jszip'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const mockAuth = jest.fn()
const mockAccess = jest.fn()
const mockFrom = jest.fn()
const mockDownload = jest.fn()
const mockStorageFrom = jest.fn()
const mockBegin = jest.fn()
const mockFinish = jest.fn()
jest.mock('@/lib/server/archive-observations', () => ({
  beginArchiveAssemblyAttempt: (...args: unknown[]) => mockBegin(...args),
  finishArchiveAssemblyAttempt: (...args: unknown[]) => mockFinish(...args),
}))
jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/server/project-access', () => ({ requireProjectAccess: (...args: unknown[]) => mockAccess(...args) }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({ from: (...args: unknown[]) => mockFrom(...args), storage: { from: (...args: unknown[]) => mockStorageFrom(...args) } }) }))
// The legacy route must not be used to bypass the central authentication result.
jest.mock('@supabase/auth-helpers-nextjs', () => ({ createRouteHandlerClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'alice' } }, error: null }) }, from: (...args: unknown[]) => mockFrom(...args) }) }))

const project = { id: '11111111-1111-4111-8111-111111111111', name: 'Family', description: 'Private family archive', facilitator_id: 'alice' }
const story = { id: '22222222-2222-4222-8222-222222222222', project_id: project.id, storyteller_id: '33333333-3333-4333-8333-333333333333', title: 'Kept memory', transcript: 'Family transcript', summary: 'Our memory', created_at: '2026-10-29' }
const bytes = Buffer.from('verified original')
const asset = {
  id: '44444444-4444-4444-8444-444444444444', project_id: project.id, story_id: story.id,
  state: 'ready', kind: 'original_audio', bucket: 'audio-recordings', object_key: 'alice/original.webm',
  mime_type: 'audio/webm', original_filename: 'recording.webm', byte_size: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'), version: 1,
}
let stories: any[]
let assets: any[]
let versions: any[]
let tombstones: any[]
let errors: Record<string, unknown>
let queries: Record<string, any>

function query(data: unknown, error: unknown = null, count = Array.isArray(data) ? data.length : null) {
  const result = { data, error, count }
  const chain: any = { then: (resolve: any) => Promise.resolve(result).then(resolve) }
  for (const method of ['select', 'eq', 'not', 'in', 'or', 'order', 'limit']) chain[method] = jest.fn(() => chain)
  chain.single = chain.maybeSingle = jest.fn(async () => result)
  return chain
}
const run = (signal?: AbortSignal) => POST(new NextRequest(`http://localhost/api/projects/${project.id}/export`, { method: 'POST', signal }), { params: Promise.resolve({ id: project.id }) })

beforeEach(() => {
  jest.clearAllMocks()
  process.env.MEDIA_ASSETS_ENABLED = 'true'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://private.example'
  mockAuth.mockResolvedValue({ ok: true, user: { id: 'alice' }, headers: new Headers({ 'Set-Cookie': 'session=refreshed' }) })
  mockAccess.mockResolvedValue({ ok: true })
  mockBegin.mockReset().mockResolvedValue(true)
  mockFinish.mockReset().mockResolvedValue(true)
  stories = [{ ...story }]; assets = [{ ...asset }]; tombstones = []; errors = {}; queries = {}
  versions = [{ id: 'version-1', project_id: project.id, story_id: story.id, asset_id: asset.id }]
  mockFrom.mockImplementation(table => {
    const data = table === 'projects' ? project : table === 'stories' ? stories : table === 'media_assets' ? assets : table === 'transcript_versions' ? versions : table === 'deletion_requests' ? tombstones : []
    const chain = query(data, errors[table] ?? null)
    queries[table] = chain
    return chain
  })
  mockStorageFrom.mockReturnValue({ download: mockDownload })
  mockDownload.mockImplementation(() => Object.assign(Promise.resolve({ data: new Blob([bytes]), error: null }), {
    asStream: async () => ({ data: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(bytes)); controller.close() } }), error: null }),
  }))
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { delete process.env.MEDIA_ASSETS_ENABLED; delete process.env.NEXT_PUBLIC_SUPABASE_URL; jest.restoreAllMocks() })

describe('bounded synchronous archival export', () => {
  it('requires the feature flag before reading any data or emitting a legacy archive', async () => {
    delete process.env.MEDIA_ASSETS_ENABLED
    expect((await run()).status).toBe(503)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockBegin).not.toHaveBeenCalled()
  })

  it('obeys central authentication and membership denial before data access', async () => {
    mockAuth.mockResolvedValueOnce({ ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    expect((await run()).status).toBe(401)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockBegin).not.toHaveBeenCalled()
    mockAccess.mockResolvedValueOnce({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
    expect((await run()).status).toBe(403)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockBegin).not.toHaveBeenCalled()
  })

  it('emits only a complete verified assembler archive with auth headers', async () => {
    const response = await run()
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/zip')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
    expect(mockAccess).toHaveBeenCalledWith(project.id, { id: 'alice' })
    expect(queries.projects.select).toHaveBeenCalledWith('id, name, description, facilitator_id')
    const zip = await JSZip.loadAsync(await response.arrayBuffer())
    for (const name of ['manifest.json', 'index.html', 'biography-booklet.pdf', 'chapters.json', 'publication-snapshot.json']) expect(zip.file(name)).not.toBeNull()
    expect(zip.file('stories.json')).toBeNull()
    expect(zip.file('project-info.json')).toBeNull()
    expect(await zip.file(`media/${asset.id}/recording.webm`)!.async('nodebuffer')).toEqual(bytes)
    expect(mockFrom).not.toHaveBeenCalledWith('project_roles')
    expect(mockBegin).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9-]{36}$/), expect.any(AbortSignal))
    const attemptId = mockBegin.mock.calls[0][0]
    expect(attemptId).not.toBe(project.id)
    expect(mockFinish).toHaveBeenCalledWith(attemptId, 'verified')
    expect(mockBegin.mock.invocationCallOrder[0]).toBeLessThan(mockDownload.mock.invocationCallOrder[0])
    expect(mockFinish.mock.invocationCallOrder[0]).toBeLessThan(mockAccess.mock.invocationCallOrder[1])
  })

  it.each(['projects', 'stories', 'media_assets', 'deletion_requests', 'transcript_versions'])('fails closed on required %s errors', async table => {
    errors[table] = { message: 'private storage locator or SQL detail' }
    const response = await run()
    expect(response.status).toBe(500)
    expect(mockDownload).not.toHaveBeenCalled()
    expect(mockBegin).not.toHaveBeenCalled()
    expect(response.headers.get('Content-Type')).not.toBe('application/zip')
    expect(await response.text()).not.toContain('private storage locator')
  })

  it('never reintroduces tombstoned stories or their media in any ZIP file', async () => {
    const deletedStory = { ...story, id: '55555555-5555-4555-8555-555555555555', title: 'DELETED_SECRET', transcript: 'DELETED_SECRET', audio_url: 'unmapped legacy deleted source' }
    stories.push(deletedStory)
    assets.push({ ...asset, id: '66666666-6666-4666-8666-666666666666', story_id: deletedStory.id, original_filename: 'DELETED_SECRET.webm' })
    tombstones.push({ subject_id: deletedStory.id, tombstone_at: '2026-10-29' })
    const response = await run()
    expect(response.status).toBe(200)
    const zip = await JSZip.loadAsync(await response.arrayBuffer())
    for (const file of Object.values(zip.files).filter(file => !file.dir)) expect(await file.async('string')).not.toContain('DELETED_SECRET')
    expect(mockDownload).toHaveBeenCalledTimes(1)
  })

  it.each(['tombstone', 'deleted', 'deleting'])('strips %s media instead of copying its references', async state => {
    assets.push({ ...asset, story_id: null, id: '66666666-6666-4666-8666-666666666666', state: state === 'tombstone' ? 'ready' : state, tombstone_at: state === 'tombstone' ? '2026-10-29' : null })
    const response = await run()
    expect(response.status).toBe(200)
    expect(mockDownload).toHaveBeenCalledTimes(1)
  })

  it.each(['verifying', 'quarantined', 'pending_upload'])('refuses incomplete %s originals before download', async state => {
    assets[0].state = state
    expect((await run()).status).toBe(409)
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it.each(['assets', 'stories', 'bytes', 'text'])('returns 413 for oversized %s before any download', async size => {
    if (size === 'assets') assets = Array.from({ length: 101 }, (_, i) => ({ ...asset, id: `asset-${i}` }))
    if (size === 'stories') stories = Array.from({ length: 201 }, (_, i) => ({ ...story, id: `story-${i}` }))
    if (size === 'bytes') assets[0].byte_size = 25 * 1024 * 1024 + 1
    if (size === 'text') stories[0].transcript = 'x'.repeat(2 * 1024 * 1024 + 1)
    expect((await run()).status).toBe(413)
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it.each([{ audio_url: 'https://untrusted.example/audio.webm' }, { images: ['unmapped.jpg'] }, { photo_urls: ['unmapped.jpg'] }])('does not silently omit unmapped legacy media %j', async refs => {
    stories[0] = { ...story, ...refs }
    expect((await run()).status).toBe(409)
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('accepts only an exact verified story-scoped legacy locator and never stores its URL', async () => {
    stories[0].audio_url = `https://private.example/storage/v1/object/sign/${asset.bucket}/${asset.object_key}?token=private-token`
    const response = await run()
    expect(response.status).toBe(200)
    const zip = await JSZip.loadAsync(await response.arrayBuffer())
    for (const file of Object.values(zip.files).filter(file => !file.dir)) expect(await file.async('string')).not.toContain('private-token')
  })

  it('rejects corrupt downloads instead of sending a partial ZIP', async () => {
    assets[0].sha256 = 'a'.repeat(64)
    const response = await run()
    expect(response.status).toBe(409)
    expect(response.headers.get('Content-Type')).not.toBe('application/zip')
    expect(await response.text()).not.toContain(asset.object_key)
    expect(mockFinish).toHaveBeenCalledWith(mockBegin.mock.calls[0][0], 'integrity_failed')
  })

  it('does not read Storage if the durable start is missing or ambiguous', async () => {
    mockBegin.mockResolvedValue(false)
    const response = await run()
    expect(response.status).toBe(503)
    expect(mockDownload).not.toHaveBeenCalled()
    expect(mockFinish).not.toHaveBeenCalled()
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it.each(['verified', 'integrity_failed'])('does not return ZIP or a confirmed outcome when %s persistence is unknown', async outcome => {
    if (outcome === 'integrity_failed') assets[0].sha256 = 'a'.repeat(64)
    mockFinish.mockResolvedValue(false)
    const response = await run()
    expect(response.status).toBe(503)
    expect(response.headers.get('Content-Type')).not.toBe('application/zip')
    expect(mockFinish).toHaveBeenCalledTimes(1)
    expect(mockFinish).toHaveBeenCalledWith(mockBegin.mock.calls[0][0], outcome)
  })

  it('records an ordinary Storage error as failed, not as corrupt media based on its message', async () => {
    mockDownload.mockReturnValue({ asStream: async () => { throw new Error('Media asset failed export verification: private locator') } })
    const response = await run()
    expect(response.status).toBe(409)
    expect(mockFinish).toHaveBeenCalledWith(mockBegin.mock.calls[0][0], 'failed')
    expect(await response.text()).not.toContain('private locator')
  })

  it('records a compression failure without claiming an integrity mismatch or delivering bytes', async () => {
    jest.spyOn(JSZip.prototype, 'generateAsync').mockRejectedValue(new Error('private compression failure'))
    const response = await run()
    expect(response.status).toBe(500)
    expect(mockFinish).toHaveBeenCalledWith(mockBegin.mock.calls[0][0], 'failed')
    expect(await response.text()).not.toContain('private compression failure')
  })

  it('records an overlong individual object as an integrity failure before the total byte ceiling', async () => {
    assets[0].byte_size = bytes.length - 1
    expect((await run()).status).toBe(409)
    expect(mockFinish).toHaveBeenCalledWith(mockBegin.mock.calls[0][0], 'integrity_failed')
  })

  it('cancels a pending reader and persists cancellation independently of the HTTP signal', async () => {
    const caller = new AbortController()
    let started!: () => void
    const reading = new Promise<void>(resolve => { started = resolve })
    const cancel = jest.fn()
    mockDownload.mockReturnValue({ asStream: async () => ({ data: new ReadableStream({ pull() { started() }, cancel }), error: null }) })
    const pending = run(caller.signal)
    await reading
    caller.abort()
    const response = await pending
    expect(response.status).toBe(409)
    expect(cancel).toHaveBeenCalled()
    expect(mockFinish).toHaveBeenCalledWith(mockBegin.mock.calls[0][0], 'cancelled')
  })

  it.each(['deleted', 'revoked', 'cancelled'])('rechecks privacy and cancellation after a delayed event finish: %s', async outcome => {
    const caller = new AbortController()
    let finish!: (confirmed: boolean) => void
    let started!: () => void
    const writing = new Promise<void>(resolve => { started = resolve })
    mockFinish.mockImplementation(() => { started(); return new Promise<boolean>(resolve => { finish = resolve }) })
    const pending = run(caller.signal)
    await writing
    if (outcome === 'deleted') tombstones.push({ subject_id: story.id, tombstone_at: '2026-10-29' })
    if (outcome === 'revoked') mockAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
    if (outcome === 'cancelled') caller.abort()
    finish(true)
    const response = await pending
    expect(response.status).toBe(outcome === 'revoked' ? 403 : 409)
    expect(response.headers.get('Content-Type')).not.toBe('application/zip')
    // Verified means assembly, not delivery: no attempt to rewrite its immutable terminal state.
    expect(mockFinish).toHaveBeenCalledTimes(1)
    expect(mockFinish).toHaveBeenCalledWith(mockBegin.mock.calls[0][0], 'verified')
  })

  it('fails closed on truncated database results rather than declaring a partial package complete', async () => {
    const defaultFrom = mockFrom.getMockImplementation()!
    mockFrom.mockImplementation(table => table === 'stories' ? query(stories, null, 2) : defaultFrom(table))
    expect((await run()).status).toBe(500)
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it.each(['deleted', 'unavailable'])('withholds the whole ZIP if final deletion evidence becomes %s', async outcome => {
    const defaultFrom = mockFrom.getMockImplementation()!
    let deletionChecks = 0
    mockFrom.mockImplementation(table => {
      if (table === 'deletion_requests' && ++deletionChecks === 2) {
        return outcome === 'deleted' ? query([{ subject_id: story.id, tombstone_at: '2026-10-29' }])
          : query(null, { message: 'private outage details' })
      }
      return defaultFrom(table)
    })
    const response = await run()
    expect(response.status).toBe(outcome === 'deleted' ? 409 : 500)
    expect(response.headers.get('Content-Type')).not.toBe('application/zip')
  })

  it('blocks a deletion accepted while asynchronous ZIP compression is pending', async () => {
    let finishCompression!: (bytes: Buffer) => void
    let signalCompressionStarted!: () => void
    const compressed = new Promise<Buffer>(resolve => { finishCompression = resolve })
    const compressionStarted = new Promise<void>(resolve => { signalCompressionStarted = resolve })
    jest.spyOn(JSZip.prototype, 'generateAsync').mockImplementation(() => {
      signalCompressionStarted()
      return compressed as any
    })

    const pendingResponse = run()
    await compressionStarted
    tombstones.push({ subject_id: story.id, tombstone_at: '2026-10-29' })
    finishCompression(Buffer.from('compressed archive must not be returned'))

    const response = await pendingResponse
    expect(response.status).toBe(409)
    expect(response.headers.get('Content-Type')).not.toBe('application/zip')
    expect(await response.text()).not.toContain('compressed archive')
  })

  it('rechecks membership after compression before releasing private archive bytes', async () => {
    let finishCompression!: (bytes: Buffer) => void
    let signalCompressionStarted!: () => void
    const compressed = new Promise<Buffer>(resolve => { finishCompression = resolve })
    const compressionStarted = new Promise<void>(resolve => { signalCompressionStarted = resolve })
    jest.spyOn(JSZip.prototype, 'generateAsync').mockImplementation(() => {
      signalCompressionStarted()
      return compressed as any
    })

    const pendingResponse = run()
    await compressionStarted
    mockAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
    finishCompression(Buffer.from('compressed archive must not be returned'))

    const response = await pendingResponse
    expect(response.status).toBe(403)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
    expect(response.headers.get('Content-Type')).not.toBe('application/zip')
    expect(await response.text()).not.toContain('compressed archive')
  })

  it('cancels an unexpectedly oversized stream without returning a partial archive', async () => {
    const cancel = jest.fn()
    mockDownload.mockReturnValue({ asStream: async () => ({ data: new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(25 * 1024 * 1024 + 1)) }, cancel,
    }), error: null }) })
    const response = await run()
    expect(response.status).toBe(413)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(response.headers.get('Content-Type')).not.toBe('application/zip')
    expect(mockFinish).toHaveBeenCalledWith(mockBegin.mock.calls[0][0], 'limit_exceeded')
  })

  it('cannot use an exact locator attached to another story as proof of legacy representation', async () => {
    stories[0].audio_url = asset.object_key
    assets[0].story_id = '55555555-5555-4555-8555-555555555555'
    expect((await run()).status).toBe(409)
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('blocks legacy text when its exact audio source was deleted', async () => {
    stories[0].audio_url = `https://private.example/storage/v1/object/sign/${asset.bucket}/${asset.object_key}?token=private-token`
    assets[0].state = 'deleted'
    versions = []
    expect((await run()).status).toBe(409)
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it.each(['tombstone', 'deleted', 'deleting'])('does not export text derived from %s audio', async state => {
    stories[0].transcript = 'DELETED_SOURCE_TEXT'
    stories[0].summary = 'DELETED_SOURCE_TEXT'
    if (state === 'tombstone') tombstones.push({ subject_id: asset.id, tombstone_at: '2026-10-29' })
    else assets[0].state = state
    const response = await run()
    expect(response.status).toBe(409)
    expect(response.headers.get('Content-Type')).not.toBe('application/zip')
    expect(await response.text()).not.toContain('DELETED_SOURCE_TEXT')
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('uses transcript lineage even when source audio has no legacy story link', async () => {
    assets[0].story_id = null
    tombstones.push({ subject_id: asset.id, tombstone_at: '2026-10-29' })
    expect((await run()).status).toBe(409)
    expect(queries.transcript_versions.eq).toHaveBeenCalledWith('project_id', project.id)
    expect(queries.transcript_versions.in).toHaveBeenCalledWith('story_id', [story.id])
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it.each(['missing', 'null', 'other-project', 'other-story'])('rejects unresolved %s transcript sources', async condition => {
    if (condition === 'missing') versions[0].asset_id = 'missing-source'
    if (condition === 'null') versions[0].asset_id = null
    if (condition === 'other-project') versions[0].project_id = 'another-project'
    if (condition === 'other-story') assets[0].story_id = 'another-story'
    expect((await run()).status).toBe(409)
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('fails closed when transcript lineage results are truncated', async () => {
    const defaultFrom = mockFrom.getMockImplementation()!
    mockFrom.mockImplementation(table => table === 'transcript_versions' ? query(versions, null, 2) : defaultFrom(table))
    expect((await run()).status).toBe(500)
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('removes a deleted image without suppressing independently sourced story text', async () => {
    const image = { ...asset, id: '66666666-6666-4666-8666-666666666666', kind: 'original_image', state: 'deleted', bucket: 'saga', object_key: 'alice/photo.jpg', mime_type: 'image/jpeg' }
    assets.push(image)
    stories[0].photo_url = image.object_key
    const response = await run()
    expect(response.status).toBe(200)
    const zip = await JSZip.loadAsync(await response.arrayBuffer())
    expect(await zip.file('index.html')!.async('string')).toContain(story.transcript)
    expect(JSON.parse(await zip.file('manifest.json')!.async('string')).assets).toHaveLength(1)
    expect(mockDownload).toHaveBeenCalledTimes(1)
  })
})
