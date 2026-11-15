/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { GET } from '../route'
import { ACTOR, PROJECT, SESSION, ERROR, statusFixture, statusTransport } from '@/lib/server/test-support/recording-status-fixture'

const mockAuth = jest.fn(), mockAdmin = jest.fn()
jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args) }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => mockAdmin() }))
let flag: string | undefined
const headers = new Headers()
headers.append('Set-Cookie', 'first=refresh; Path=/; HttpOnly')
headers.append('Set-Cookie', 'second=refresh; Path=/; HttpOnly')
const request = (query: string, signal?: AbortSignal) => new NextRequest(`http://localhost/api/recordings/sessions/${SESSION}/status?${query}`, { signal })
const queryFor = (f: ReturnType<typeof statusFixture>) => `projectId=${PROJECT}&manifestSha256=${f.input.manifestSha256}`
const get = (req: NextRequest, sessionId = SESSION) => GET(req, { params: Promise.resolve({ sessionId }) })
function privateHeaders(response: Response) {
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.getSetCookie()).toEqual(headers.getSetCookie())
}
beforeEach(() => {
  jest.resetAllMocks(); flag = process.env.MEDIA_ASSETS_ENABLED; process.env.MEDIA_ASSETS_ENABLED = 'true'
  mockAuth.mockResolvedValue({ ok: true, user: { id: ACTOR }, headers })
})
afterEach(() => { if (flag === undefined) delete process.env.MEDIA_ASSETS_ENABLED; else process.env.MEDIA_ASSETS_ENABLED = flag })

it.each(['succeeded', 'failed', 'queued'] as const)('serves only compact %s status with refreshed cookies', async state => {
  const f = statusFixture(state), t = statusTransport(f.snapshot); mockAdmin.mockReturnValue(t.admin)
  const response = await get(request(queryFor(f)))
  expect(response.status).toBe(state === 'queued' ? 202 : 200); privateHeaders(response)
  const body = await response.json()
  expect(body).toMatchObject({ state: state === 'queued' ? 'unresolved' : state, canClearLocalDrafts: false })
  expect(Object.keys(body).sort()).toEqual(['schemaVersion', 'projectId', 'sessionId', 'assetId', 'jobId', 'manifestSha256',
    'observedAt', 'state', 'content', 'errorCode', 'finishedAt', 'canClearLocalDrafts'].sort())
  expect(JSON.stringify(body)).not.toMatch(/object_key|objectKey|worker|candidateId|recording-candidates|test-service-key/)
  expect(t.requests).toHaveLength(1)
  expect(t.requests[0].url.pathname).toBe('/rest/v1/rpc/read_recording_session_snapshot')
  expect(JSON.parse(String(t.requests[0].init.body)).p_actor_id).toBe(ACTOR)
})
it.each([401, 403, 503])('preserves auth %s response and cookies without calling the reader', async status => {
  mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'auth_failed' }, { status, headers }) })
  const response = await get(request(''))
  expect(response.status).toBe(status); privateHeaders(response)
  expect(await response.json()).toEqual({ error: 'auth_failed' }); expect(mockAdmin).not.toHaveBeenCalled()
})
it.each([undefined, 'false', 'TRUE', '1', ' true '])('requires the literal enabled flag (%s)', async value => {
  if (value === undefined) delete process.env.MEDIA_ASSETS_ENABLED; else process.env.MEDIA_ASSETS_ENABLED = value
  const response = await get(request(''))
  expect(response.status).toBe(404); privateHeaders(response); expect(mockAdmin).not.toHaveBeenCalled()
})
it.each(['', 'projectId=x', `projectId=${PROJECT}`, 'manifestSha256=' + 'a'.repeat(64),
  `projectId=${PROJECT}&manifestSha256=${'A'.repeat(64)}`, `projectId=${PROJECT}&manifestSha256=${'a'.repeat(63)}`,
  `projectId=x&manifestSha256=${'a'.repeat(64)}`, `projectId=${PROJECT}&manifestSha256=${'a'.repeat(64)}&actorId=${ACTOR}`,
  `projectId=${PROJECT}&manifestSha256=${'a'.repeat(64)}&extra=`,
  `projectId=${PROJECT}&projectId=${PROJECT}&manifestSha256=${'a'.repeat(64)}`,
  `projectId=${PROJECT}&manifestSha256=${'a'.repeat(64)}&manifestSha256=${'a'.repeat(64)}`])
('rejects missing, duplicate or polluted query %s before database access', async query => {
  const response = await get(request(query))
  expect(response.status).toBe(400); privateHeaders(response); expect(mockAdmin).not.toHaveBeenCalled()
})
it.each(['bad', '22222222-2222-4222-8222-22222222222Z', ` ${SESSION}`, SESSION.toUpperCase().replace('2', 'A')])
('rejects invalid session %s', async sessionId => {
  const response = await get(request(queryFor(statusFixture())), sessionId)
  expect(response.status).toBe(400); privateHeaders(response); expect(mockAdmin).not.toHaveBeenCalled()
})
it('authenticates even when disabled and before interpreting arguments', async () => {
  process.env.MEDIA_ASSETS_ENABLED = 'false'
  mockAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'auth' }, { status: 401, headers }) })
  const response = await get(request('garbage'))
  expect(response.status).toBe(401); privateHeaders(response); expect(mockAdmin).not.toHaveBeenCalled()
})
it.each(['config', 'malformed', 'lost', 'rpc', 'terminal-fragment'])('returns fixed unavailable for %s failure', async mode => {
  const f = statusFixture(), t = statusTransport(f.snapshot)
  if (mode === 'config') mockAdmin.mockImplementation(() => { throw new Error('SECRET service key') })
  else mockAdmin.mockReturnValue(t.admin)
  if (mode === 'malformed') t.setResponse(() => new Response('malformed SECRET'))
  if (mode === 'lost') t.setHook(() => { throw new Error('SECRET token') })
  if (mode === 'rpc') t.setResponse(() => new Response(JSON.stringify({ message: 'SECRET', code: '42501' }), { status: 403 }))
  if (mode === 'terminal-fragment') f.job.state = 'running'
  const response = await get(request(queryFor(f)))
  expect(response.status).toBe(503); privateHeaders(response); expect(await response.json()).toEqual({ error: ERROR })
  expect(t.requests.length).toBe(mode === 'config' ? 0 : 1)
})
it('passes caller cancellation to the actual reader without a mutation fallback', async () => {
  const f = statusFixture(), t = statusTransport(f.snapshot), controller = new AbortController()
  mockAdmin.mockReturnValue(t.admin); t.setHook(() => { controller.abort('SECRET') })
  const response = await get(request(queryFor(f), controller.signal))
  expect(response.status).toBe(503); privateHeaders(response); expect(await response.json()).toEqual({ error: ERROR })
  expect(t.requests).toHaveLength(1); expect(t.requests[0].init.signal?.aborted).toBe(true)
})
