/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '../route'
import { ACTOR, PROJECT, SESSION, STORY, statusFixture, statusTransport } from '@/lib/server/test-support/recording-status-fixture'
const mockAuth = jest.fn(), mockAdmin = jest.fn(), mockAccess = jest.fn()
jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/server/project-access', () => ({ requireProjectAccess: (...args: unknown[]) => mockAccess(...args) }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => mockAdmin() }))
const metadata = { title: 'Synthetic', content: '', transcript: '', happenedAt: '2026-11-06T00:00:00.000Z', recordingMode: 'chat', isPublic: false }
const params = { params: Promise.resolve({ sessionId: SESSION }) }
const request = (body?: unknown, query = `?projectId=${PROJECT}`) => new NextRequest(`http://localhost/api/recordings/sessions/${SESSION}/save${query}`,
  body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
beforeEach(() => {
  jest.clearAllMocks(); process.env.MEDIA_ASSETS_ENABLED = 'true'
  mockAuth.mockResolvedValue({ ok: true, user: { id: ACTOR }, headers: new Headers({ 'Set-Cookie': 'session=refreshed' }) })
  mockAccess.mockResolvedValue({ ok: true })
})
afterEach(() => delete process.env.MEDIA_ASSETS_ENABLED)
it('authenticates before accessing private save state', async () => {
  mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
  const response = await GET(request(), params)
  expect(response.status).toBe(401); expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(mockAdmin).not.toHaveBeenCalled()
})
it.each([`?projectId=${PROJECT}&extra=1`, `?projectId=${PROJECT}&projectId=${PROJECT}`, '?projectId=oops', ''])('rejects malformed query %s', async query => {
  expect((await GET(request(undefined, query), params)).status).toBe(400); expect(mockAdmin).not.toHaveBeenCalled()
})
it.each([{ action: 'other', projectId: PROJECT }, { action: 'reserve', projectId: PROJECT, metadata, extra: true },
  { action: 'confirm', projectId: PROJECT, manifestSha256: 'bad' }])('rejects malformed body %#', async body => {
  expect((await POST(request(body, ''), params)).status).toBe(400); expect(mockAdmin).not.toHaveBeenCalled()
})
it('returns normal empty lookup with refreshed cookie and no cleanup', async () => {
  const lookup = { schemaVersion: 1, actorId: ACTOR, projectId: PROJECT, sessionId: SESSION, intent: null, canClearLocalDrafts: false }
  mockAdmin.mockReturnValue(statusTransport({ lookup, snapshot: null }).admin)
  const response = await GET(request(), params)
  expect(response.status).toBe(200); expect(await response.json()).toEqual(lookup)
  expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(response.headers.get('Set-Cookie')).toBe('session=refreshed')
})
it('revalidates authorization after confirmation await before sending cleanup receipt', async () => {
  const f = statusFixture()
  const t = statusTransport({ lookup: { schemaVersion: 1, actorId: ACTOR, projectId: PROJECT, sessionId: SESSION,
    intent: { storyId: STORY, metadata, manifestSha256: f.input.manifestSha256, assetId: f.sealed.task.assetId, confirmed: true }, canClearLocalDrafts: false }, snapshot: f.snapshot })
  t.setHook(() => { mockAccess.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'denied' }, { status: 403 }) }) })
  mockAdmin.mockReturnValue(t.admin)
  const response = await POST(request({ action: 'confirm', projectId: PROJECT, manifestSha256: f.input.manifestSha256 }, ''), params)
  expect(response.status).toBe(403); expect(await response.text()).not.toContain('canClearLocalDrafts')
})
