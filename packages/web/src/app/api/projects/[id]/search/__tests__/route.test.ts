/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { GET } from '../route'
const mockAuth = jest.fn(), mockAccess = jest.fn(), mockRpc = jest.fn(), mockFrom = jest.fn()
jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/server/project-access', () => ({ requireProjectAccess: (...args: unknown[]) => mockAccess(...args) }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({ rpc: (...args: unknown[]) => mockRpc(...args), from: (...args: unknown[]) => mockFrom(...args) }) }))
const project = '11111111-1111-4111-8111-111111111111'
const entry = {
  entryId: 'segment:33333333-3333-4333-8333-333333333333', projectId: project,
  storyId: '22222222-2222-4222-8222-222222222222', storyTitle: 'Actual source',
  transcriptVersionId: '44444444-4444-4444-8444-444444444444',
  storyRevisionId: null, segmentId: '33333333-3333-4333-8333-333333333333',
  mediaAssetId: '55555555-5555-4555-8555-555555555555', startMs: 0, endMs: 1200,
  quotedText: 'Chicago in 1968', sourceKind: 'original_transcript', reviewStatus: 'source_only',
  sourceHash: 'a'.repeat(64), sourceFingerprint: 'b'.repeat(64), attributedTo: null,
  excerptStart: 0, excerptEnd: 15,
}
const run = (q = 'q=Chicago') => GET(new NextRequest(`http://localhost/api/projects/${project}/search?${q}`), { params: Promise.resolve({ id: project }) })
beforeEach(() => {
  jest.clearAllMocks(); process.env.MEDIA_ASSETS_ENABLED = 'true'
  mockAuth.mockResolvedValue({ ok: true, user: { id: 'alice' }, headers: new Headers({ 'Set-Cookie': 'session=refreshed' }) })
  mockAccess.mockResolvedValue({ ok: true }); mockRpc.mockResolvedValue({ data: { entries: [entry], hasMore: false }, error: null })
})
afterEach(() => { delete process.env.MEDIA_ASSETS_ENABLED })
it('finds authoritative sources without requiring manually seeded index rows', async () => {
  const response = await run()
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ status: 'source_matches', searchMode: 'literal', semanticSearch: 'unavailable_unmeasured', citations: [{ quotedText: 'Chicago in 1968', startMs: 0, endMs: 1200 }] })
  expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(mockFrom).not.toHaveBeenCalled()
})
it('gates disabled search', async () => {
  delete process.env.MEDIA_ASSETS_ENABLED; expect((await run()).status).toBe(503); expect(mockRpc).not.toHaveBeenCalled()
})
it('denies revoked access before sources and again at atomic database read', async () => {
  mockAccess.mockResolvedValueOnce({ ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) })
  expect((await run()).status).toBe(403); expect(mockRpc).not.toHaveBeenCalled()
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'private detail' } })
  const response = await run(); expect(response.status).toBe(403); expect(await response.text()).not.toContain('private detail')
})
it.each(['q=', `q=${'a'.repeat(241)}`, `q=Chicago&person=${'a'.repeat(81)}`, 'date=not-a-year', 'q=%00', 'q=a&q=b'])('rejects unbounded or ambiguous input %s', async q => {
  expect((await run(q)).status).toBe(400); expect(mockRpc).not.toHaveBeenCalled()
})
it('accepts filter-only and literal Unicode terms', async () => {
  expect((await run('person=王奶奶&place=臺北&date=1968')).status).toBe(200)
})
it('keeps family supplements unaligned and labelled', async () => {
  mockRpc.mockResolvedValueOnce({ data: { entries: [{ ...entry, sourceKind: 'family_supplement', reviewStatus: 'approved',
    storyRevisionId: '66666666-6666-4666-8666-666666666666', segmentId: null, mediaAssetId: null, startMs: null, endMs: null }], hasMore: false }, error: null })
  const response = await run(); expect(response.status).toBe(200)
  expect((await response.json()).citations[0]).toMatchObject({ sourceKind: 'family_supplement', startMs: null, endMs: null })
})
it.each([
  { projectId: 'other-project' }, { sourceHash: 'invalid' }, { sourceFingerprint: null }, { startMs: null },
  { sourceKind: 'family_supplement' }, { reviewStatus: 'approved' }, { excerptEnd: 99999 },
])('fails closed on malformed authority response %j', async change => {
  mockRpc.mockResolvedValueOnce({ data: { entries: [{ ...entry, ...change }], hasMore: false }, error: null })
  const response = await run(); expect(response.status).toBe(500); expect(await response.text()).not.toContain('Chicago')
})
it('bounds response work and database failures', async () => {
  mockRpc.mockResolvedValueOnce({ data: { entries: Array(51).fill(entry), hasMore: true }, error: null })
  expect((await run()).status).toBe(500)
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: '54000', message: 'private detail' } })
  expect((await run()).status).toBe(422)
})
it('counts title limits by Unicode code points like PostgreSQL, including astral characters', async () => {
  mockRpc.mockResolvedValueOnce({ data: { entries: [{ ...entry, storyTitle: '👵'.repeat(300) }], hasMore: false }, error: null })
  const response = await run()
  expect(response.status).toBe(200)
  expect((await response.json()).citations[0].storyTitle).toBe('👵'.repeat(300))
})
it('exposes semantic unavailable readiness without fetching corpus or transmitting content', async () => {
  const response = await run('mode=semantic&readiness=1')
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({semantic:{ready:false,provider:'voyage',policyVersion:null}})
  expect(mockRpc).not.toHaveBeenCalled()
})
it('never interprets a GET semantic request as literal search', async () => {
  expect((await run('mode=semantic&q=relocation')).status).toBe(400)
  expect(mockRpc).not.toHaveBeenCalled()
})
