/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { GET } from '../route'

const mockAuth = jest.fn()
const mockAccess = jest.fn()
const mockFrom = jest.fn()
jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/server/project-access', () => ({ requireProjectAccess: (...args: unknown[]) => mockAccess(...args) }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({ from: (...args: unknown[]) => mockFrom(...args) }) }))

function query(data: unknown, error: unknown = null, count = Array.isArray(data) ? data.length : null) {
  const result = { data, error, count }
  const chain: any = { then: (resolve: any) => Promise.resolve(result).then(resolve) }
  for (const method of ['select', 'eq', 'not', 'in']) chain[method] = jest.fn(() => chain)
  chain.maybeSingle = jest.fn(async () => result)
  return chain
}

// These are the real P2/P3 schema fields. The index has neither a media asset
// column nor a story title; transcript_versions.asset_id supplies the source.
const row = {
  id: 'entry-1', project_id: 'proj-1', story_id: 'story-1',
  transcript_version_id: 'transcript-1', story_revision_id: null, segment_id: 'segment-1',
  index_version: 1, is_active_index: true, searchable_text: 'Chicago in 1968', start_ms: 0, end_ms: 1200,
  entity_people: [], entity_dates: ['1968'], entity_places: ['Chicago'], created_at: '2026-10-29',
}
const source = { id: 'transcript-1', project_id: 'proj-1', story_id: 'story-1', asset_id: 'asset-1' }
const story = { id: 'story-1', project_id: 'proj-1', title: 'Family source story' }
const asset = { id: 'asset-1', project_id: 'proj-1', story_id: 'story-1', kind: 'original_audio', state: 'ready' }
let tableRows: Record<string, Array<Record<string, unknown>>>
let tableErrors: Record<string, unknown>
let tableCounts: Record<string, number>
let queries: Record<string, any>

const run = () => GET(new NextRequest('http://localhost/api/projects/proj-1/search?q=Chicago'), {
  params: Promise.resolve({ id: 'proj-1' }),
})

beforeEach(() => {
  jest.clearAllMocks()
  process.env.MEDIA_ASSETS_ENABLED = 'true'
  mockAuth.mockResolvedValue({ ok: true, user: { id: 'alice' }, headers: new Headers({ 'Set-Cookie': 'session=refreshed' }) })
  mockAccess.mockResolvedValue({ ok: true })
  tableRows = { search_index_entries: [{ ...row }], transcript_versions: [{ ...source }], stories: [{ ...story }], media_assets: [{ ...asset }], deletion_requests: [] }
  tableErrors = {}; tableCounts = {}; queries = {}
  mockFrom.mockImplementation(table => {
    const data = tableRows[table] ?? []
    const chain = query(data, tableErrors[table] ?? null, tableCounts[table] ?? data.length)
    queries[table] = chain
    return chain
  })
})
afterEach(() => { delete process.env.MEDIA_ASSETS_ENABLED })

describe('project provenance search boundary', () => {
  it('gates disabled search without querying private data', async () => {
    delete process.env.MEDIA_ASSETS_ENABLED
    expect((await run()).status).toBe(503)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('uses central access and resolves real-schema provenance before producing a citation', async () => {
    const response = await run()
    expect(response.status).toBe(200)
    expect(mockAccess).toHaveBeenCalledWith('proj-1', { id: 'alice' })
    expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect((await response.json()).citations[0]).toMatchObject({ mediaAssetId: 'asset-1', storyTitle: story.title, startMs: 0, endMs: 1200 })
    expect(mockFrom).not.toHaveBeenCalledWith('projects')
    for (const table of ['transcript_versions', 'stories', 'media_assets', 'deletion_requests']) {
      expect(queries[table].eq).toHaveBeenCalledWith('project_id', 'proj-1')
    }
    expect(queries.transcript_versions.select).toHaveBeenCalledWith('id, project_id, story_id, asset_id', { count: 'exact' })
    expect(queries.transcript_versions.in).toHaveBeenCalledWith('id', ['transcript-1'])
    expect(queries.stories.select).toHaveBeenCalledWith('id, project_id, title', { count: 'exact' })
    expect(queries.stories.in).toHaveBeenCalledWith('id', ['story-1'])
    expect(queries.media_assets.in).toHaveBeenCalledWith('id', ['asset-1'])
    expect(queries.deletion_requests.in).toHaveBeenCalledWith('subject_id', expect.arrayContaining(['story-1', 'asset-1']))
  })

  it('denies revoked membership before reading any index', async () => {
    mockAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
    const response = await run()
    expect(response.status).toBe(403)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it.each(['deletion_requests', 'media_assets', 'search_index_entries', 'transcript_versions', 'stories'])('fails closed on %s errors', async table => {
    tableErrors[table] = { message: 'private database detail' }
    const response = await run()
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('private database detail')
  })

  it.each(['story-1', 'asset-1'])('removes source %s with deletion evidence', async subjectId => {
    tableRows.deletion_requests = [{ subject_id: subjectId, tombstone_at: '2026-10-29' }]
    const response = await run()
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.status).toBe('no_matching_sources')
    expect(result.citations).toEqual([])
    expect(result.answerText).not.toContain(row.searchable_text)
  })

  it('screens optional asset-row tombstones even when the real-schema index remains active', async () => {
    tableRows.media_assets[0].tombstone_at = '2026-10-29'
    expect((await (await run()).json()).citations).toEqual([])
  })

  it.each(['pending_upload', 'uploaded', 'verifying', 'quarantined', 'deleting', 'deleted'])('does not claim a %s asset is a verified source', async state => {
    tableRows.media_assets[0].state = state
    const response = await run()
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.status).toBe('no_matching_sources')
    expect(result.citations).toEqual([])
  })

  it.each(['transcript_versions', 'stories', 'media_assets'])('suppresses citations when the %s source row is missing', async table => {
    tableRows[table] = []
    const response = await run()
    expect(response.status).toBe(200)
    expect((await response.json()).citations).toEqual([])
  })

  it('never labels an unbound legacy transcript as a verified citation', async () => {
    tableRows.transcript_versions[0].asset_id = null
    const response = await run()
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.status).toBe('no_matching_sources')
    expect(result.citations).toEqual([])
  })

  it.each([
    ['transcript_versions', 'project_id', 'other-project'],
    ['transcript_versions', 'story_id', 'other-story'],
    ['stories', 'project_id', 'other-project'],
    ['media_assets', 'project_id', 'other-project'],
    ['media_assets', 'story_id', 'other-story'],
    ['media_assets', 'story_id', null],
  ])('rejects misaligned source evidence %s.%s=%s', async (table, field, value) => {
    tableRows[table!][0][field!] = value
    const response = await run()
    expect(response.status).toBe(200)
    expect((await response.json()).citations).toEqual([])
  })

  it.each(['deletion_requests', 'transcript_versions', 'stories', 'media_assets'])('fails closed if the database truncates required %s evidence', async table => {
    tableCounts[table] = tableRows[table].length + 1
    expect((await run()).status).toBe(500)
  })

  it('returns no sources for an empty index without issuing empty source lookups', async () => {
    tableRows.search_index_entries = []
    const response = await run()
    expect(response.status).toBe(200)
    expect((await response.json()).citations).toEqual([])
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })
})
