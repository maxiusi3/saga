/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '../route'
const mockAuth = jest.fn(), mockAdmin = jest.fn(), mockStatus = jest.fn(), mockTranscribe = jest.fn()
jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => mockAdmin() }))
jest.mock('@/lib/server/story-review-service', () => ({ ...jest.requireActual('@/lib/server/story-review-service'), readStoryTranscriptionStatus: (...args: unknown[]) => mockStatus(...args) }))
jest.mock('@/lib/server/story-transcription', () => ({ ...jest.requireActual('@/lib/server/story-transcription'), transcribeStory: (...args: unknown[]) => mockTranscribe(...args) }))
const storyId = '11111111-1111-4111-8111-111111111111', actorId = '22222222-2222-4222-8222-222222222222', requestId = '44444444-4444-4444-8444-444444444444'
const review = { revision: null, assertions: [], transcript: null, approvedRevisions: [], sourceChanged: false, canApprove: true }
const context = { params: Promise.resolve({ storyId }) }
const body = { requestId, consent: true, policyVersion: 'policy-from-readiness' }
function request(input?: unknown) { return new NextRequest(`http://localhost/api/stories/${storyId}/transcribe`, input === undefined ? undefined : { method: 'POST', body: JSON.stringify(input), headers: { 'content-type': 'application/json' } }) }
describe('story transcription route', () => {
  beforeEach(() => { jest.clearAllMocks(); process.env.MEDIA_ASSETS_ENABLED = 'true'; delete process.env.G2_TRANSCRIPTION_ENABLED; mockAuth.mockResolvedValue({ ok: true, user: { id: actorId }, headers: new Headers({ 'Set-Cookie': 'session=refreshed' }) }); mockAdmin.mockReturnValue({}); mockStatus.mockResolvedValue({ pendingRequestId: null, status: null, review }); mockTranscribe.mockResolvedValue(review) })
  afterEach(() => { delete process.env.MEDIA_ASSETS_ENABLED; delete process.env.G2_TRANSCRIPTION_ENABLED })
  it.each(['false', 'TRUE', '1', ''])('disables transcription when media flag is %s before auth', async flag => { process.env.MEDIA_ASSETS_ENABLED = flag; expect((await POST(request(body), context)).status).toBe(404); expect(mockAuth).not.toHaveBeenCalled(); expect(mockTranscribe).not.toHaveBeenCalled() })
  it('shows safe unconfigured readiness only after story authorization', async () => { const response = await GET(request(), context); expect(response.status).toBe(200); expect(await response.json()).toEqual({ transcription: { ready: false, provider: 'elevenlabs', model: 'scribe_v2', region: 'us', policyVersion: null, requiresConsent: true, pendingRequestId: null, retryableRequestId: null } }); expect(mockStatus).toHaveBeenCalledWith(actorId, storyId, expect.any(Object)); expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('set-cookie')).toBe('session=refreshed') })
  it('returns durable pending identity after browser reload', async () => { mockStatus.mockResolvedValue({ pendingRequestId: requestId, status: 'pending', review }); expect((await (await GET(request(), context)).json()).transcription.pendingRequestId).toBe(requestId) })
  it('uses authenticated actor, path story and parsed request only', async () => { const response = await POST(request(body), context); expect(response.status).toBe(200); expect(await response.json()).toEqual({ review }); expect(mockTranscribe).toHaveBeenCalledWith(actorId, storyId, { ...body, expectedVersion: 0 }, expect.objectContaining({ admin: {}, signal: expect.any(AbortSignal) })) })
  it.each([{ ...body, provider: 'client' }, { ...body, model: 'client' }, { ...body, audioUrl: 'https://attacker.test' }, { ...body, consent: 'yes' }, { ...body, policyVersion: undefined }, { ...body, requestId: 'bad' }])('rejects client overrides and malformed input %#', async input => { expect((await POST(request(input), context)).status).toBe(400); expect(mockTranscribe).not.toHaveBeenCalled() })
  it('rejects oversized request without invoking transcription', async () => { expect((await POST(request({ ...body, extra: 'x'.repeat(5000) }), context)).status).toBe(400); expect(mockTranscribe).not.toHaveBeenCalled() })
  it('keeps authentication rejection without loading privileged state', async () => { mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }); expect((await GET(request(), context)).status).toBe(401); expect(mockAdmin).not.toHaveBeenCalled() })
  it('does not disclose unexpected database or provider errors', async () => { mockTranscribe.mockRejectedValue(new Error('secret URL and API key')); const response = await POST(request(body), context); expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'Transcription is unavailable.', code: 'unavailable' }) })
})
