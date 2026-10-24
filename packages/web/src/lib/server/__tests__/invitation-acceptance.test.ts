/** @jest-environment node */
import { NextRequest } from 'next/server'
import { POST as acceptBody } from '@/app/api/invitations/accept/route'
import { POST as acceptPath } from '@/app/api/invitations/[token]/accept/route'

const externalRequests: string[] = []
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => ({ auth: { getUser: async () => {
    externalRequests.push('cookie-auth.getUser')
    return { data: { user: null }, error: null }
  } } }),
}))

const token = 'v1_0123456789abcdef0123456789abcdef'
const userId = '11111111-1111-4111-8111-111111111111'
const savedEnv = { ...process.env }

afterEach(() => {
  process.env = { ...savedEnv }
  externalRequests.length = 0
})

test.each(['body', 'path'])('disabled %s acceptance never authenticates', async kind => {
  delete process.env.INVITATION_TRANSACTIONS_ENABLED
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon'
  const request = new NextRequest('http://localhost/api/invitations/accept', {
    method: 'POST', body: JSON.stringify({ token, user_id: userId }),
  })
  const response = kind === 'body'
    ? await acceptBody(request)
    : await acceptPath(request, { params: Promise.resolve({ token }) })
  expect({ status: response.status, externalRequests }).toEqual({ status: 503, externalRequests: [] })
})

// SDK methods are real below; the synthetic external provider is a loopback HTTP server.
import { POST as readStatus } from '@/app/api/invitations/status/route'
import {
  startInvitationFixture, fixtureToken, fixtureBearer, fixtureUser, fixtureProject,
  otherUser, providerUser, pendingRow, acceptedRow, acceptedStatusRow, acceptedHttp, pendingHttp,
} from '../test-support/invitation-fixture'

jest.setTimeout(20000)
let fixture: Awaited<ReturnType<typeof startInvitationFixture>>
const nativeFetch = globalThis.fetch
let fetchSpy: jest.SpyInstance
let consoleSpy: jest.SpyInstance
let requestSignal: AbortSignal | undefined
let addListener: jest.SpyInstance | undefined
let removeListener: jest.SpyInstance | undefined

beforeEach(async () => {
  fixture = await startInvitationFixture()
  process.env.INVITATION_TRANSACTIONS_ENABLED = 'true'
  process.env.NEXT_PUBLIC_SUPABASE_URL = fixture.url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-never-used'
  fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(nativeFetch)
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(async () => {
  if (addListener && removeListener) {
    const added = addListener.mock.calls.filter(call => call[0] === 'abort').map(call => call[1])
    const removed = removeListener.mock.calls.filter(call => call[0] === 'abort').map(call => call[1])
    expect(removed).toEqual(added)
  }
  expect(consoleSpy).not.toHaveBeenCalled()
  jest.restoreAllMocks()
  requestSignal = undefined
  addListener = undefined
  removeListener = undefined
  expect(await fixture.close()).toEqual({ listening: false, sockets: 0, held: 0 })
})
function requestFor(body: unknown = { token: fixtureToken }, authorization: string | null = `Bearer ${fixtureBearer}`, signal?: AbortSignal) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Cookie: 'unrelated-user-cookie=other-user' }
  if (authorization !== null) headers.Authorization = authorization
  const request = new NextRequest('http://localhost/api/invitations/accept?debug=1', {
    method: 'POST', headers, body: JSON.stringify(body), signal,
  })
  requestSignal = request.signal
  addListener = jest.spyOn(requestSignal, 'addEventListener')
  removeListener = jest.spyOn(requestSignal, 'removeEventListener')
  return request
}
async function expectReply(response: Response, status: number, outcome: string) {
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('vary')).toBe('Authorization')
  const body = await response.json()
  expect(body.outcome).toBe(outcome)
  const json = JSON.stringify(body)
  for (const secret of [fixtureToken, fixtureBearer, providerUser.email, 'synthetic-service-never-used', 'PRIVATE_UPSTREAM_ERROR']) expect(json).not.toContain(secret)
  expect(body.debug).toBeUndefined()
  return body
}
function paths() { return fixture.captured.map(item => item.path) }
const authPath = '/auth/v1/user'
const statusPath = '/rest/v1/rpc/status'
const acceptRpcPath = '/rest/v1/rpc/accept'

// An accidentally re-enabled old route must still fail these at the external boundary.
test.each([undefined, 'false', 'TRUE', '1', ' true'])('disabled gate value case %# has zero external calls', async flag => {
  if (flag === undefined) delete process.env.INVITATION_TRANSACTIONS_ENABLED
  else process.env.INVITATION_TRANSACTIONS_ENABLED = flag
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  for (const route of [acceptBody, readStatus, (request: Request) => acceptPath(request, { params: Promise.resolve({ token: fixtureToken }) })]) {
    await expectReply(await route(requestFor()), 503, 'not_attempted')
  }
  expect(fetchSpy).not.toHaveBeenCalled()
  expect(fixture.captured).toHaveLength(0)
})

test.each(['body', 'path'])('enabled %s accepts with one verified Bearer and exact schema/parameters', async kind => {
  const request = requestFor(kind === 'body' ? { token: fixtureToken, user_id: fixtureUser } : { token: 'ignored-body', user_id: otherUser })
  const response = kind === 'body' ? await acceptBody(request) : await acceptPath(request, { params: Promise.resolve({ token: fixtureToken }) })
  expect(await expectReply(response, 200, 'accepted')).toEqual(acceptedHttp)
  expect(fixture.captured.map(item => [item.path, item.body])).toEqual([
    [authPath, null], [statusPath, { p_token: fixtureToken }], [acceptRpcPath, { token: fixtureToken }],
  ])
  for (const captured of fixture.captured) {
    expect(captured.headers.authorization).toBe(`Bearer ${fixtureBearer}`)
    expect(captured.headers.apikey).toBe('synthetic-anon')
    expect(captured.headers.cookie).toBeUndefined()
    if (captured.path !== authPath) {
      expect(captured.method).toBe('POST')
      expect(captured.headers['content-profile']).toBe('invitation_candidate')
    }
  }
})

test.each([null, '', 'Bearer', 'Bearer ', 'Basic value', 'Bearer two words', 'Bearer one,two', 'Bearer  value'])('malformed or missing Bearer case %# cannot use a cookie', async authorization => {
  await expectReply(await acceptBody(requestFor({ token: fixtureToken }, authorization)), 401, 'not_attempted')
  expect(fixture.captured).toHaveLength(0)
})
test.each([
  null, [], { token: fixtureToken, extra: true }, { token: fixtureToken, user_id: 12 },
  { token: 12 }, { token: 'legacy-token' }, { token: fixtureToken.toUpperCase() }, { token: fixtureToken + '\n' },
])('invalid JSON shape case %# never authenticates', async body => {
  await expectReply(await acceptBody(requestFor(body)), 400, 'rejected')
  expect(fixture.captured).toHaveLength(0)
})
test('invalid JSON is safely rejected before authentication', async () => {
  const request = new NextRequest('http://localhost/api/invitations/accept', { method: 'POST', headers: { Authorization: `Bearer ${fixtureBearer}` }, body: '{' })
  await expectReply(await acceptBody(request), 400, 'rejected')
  expect(fixture.captured).toHaveLength(0)
})
test.each([' ' + fixtureToken, '%76' + fixtureToken.slice(1), '%2576' + fixtureToken.slice(1)])('path token case %# is never trimmed or decoded again', async token => {
  await expectReply(await acceptPath(requestFor(), { params: Promise.resolve({ token }) }), 400, 'rejected')
  expect(fixture.captured).toHaveLength(0)
})
test.each(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'])('missing %s fails without fallback', async key => {
  delete process.env[key]
  await expectReply(await acceptBody(requestFor()), 503, 'not_attempted')
  expect(fixture.captured).toHaveLength(0)
})
test('malformed server URL fails without exposing the configuration', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid URL PRIVATE_UPSTREAM_ERROR'
  await expectReply(await acceptBody(requestFor()), 503, 'not_attempted')
  expect(fixture.captured).toHaveLength(0)
})
test.each([401, 403, 500, 503])('provider HTTP %s never falls back or writes', async status => {
  fixture.replies[authPath] = { status, body: { code: 'unexpected_failure', message: 'PRIVATE_UPSTREAM_ERROR' } }
  await expectReply(await acceptBody(requestFor()), status < 500 ? 401 : 503, 'not_attempted')
  expect(paths()).toEqual([authPath])
})
test('explicit provider bad_jwt rejection is unauthorized even with HTTP 400', async () => {
  fixture.replies[authPath] = { status: 400, body: { code: 'bad_jwt', message: 'PRIVATE_UPSTREAM_ERROR' } }
  await expectReply(await acceptBody(requestFor()), 401, 'not_attempted')
  expect(paths()).toEqual([authPath])
})
test.each([
  { ...providerUser, email: null }, { ...providerUser, email_confirmed_at: null },
  { ...providerUser, email_confirmed_at: 'invalid' }, { ...providerUser, email: 'a@@b' },
  { id: fixtureUser, user_metadata: { email: providerUser.email, email_confirmed_at: providerUser.email_confirmed_at } },
])('unconfirmed or self asserted email case %# cannot read or accept', async body => {
  fixture.replies[authPath] = { body }
  await expectReply(await acceptBody(requestFor()), 403, 'rejected')
  expect(paths()).toEqual([authPath])
})
test('malformed provider ID is an unavailable identity result', async () => {
  fixture.replies[authPath] = { body: { ...providerUser, id: 'invalid' } }
  await expectReply(await acceptBody(requestFor()), 503, 'not_attempted')
  expect(paths()).toEqual([authPath])
})
test('body identity is only a consistency assertion after Bearer verification', async () => {
  await expectReply(await acceptBody(requestFor({ token: fixtureToken, user_id: otherUser })), 403, 'rejected')
  expect(paths()).toEqual([authPath])
})
test.each([
  null, [], [pendingRow, pendingRow], [{ ...pendingRow, token: 'wrong' }],
  [{ ...pendingRow, project_id: null }], [{ ...acceptedStatusRow, user_id: otherUser }],
  [{ ...pendingRow, is_expired: 'false' }],
])('unconfirmable pre-read case %# never sends accept', async body => {
  fixture.replies[statusPath] = { body }
  await expectReply(await acceptBody(requestFor()), 503, 'not_attempted')
  expect(paths()).toEqual([authPath, statusPath])
})
test.each([
  null, [], [acceptedRow, acceptedRow], [{ ...acceptedRow, project_id: null }],
  [{ ...acceptedRow, invitation_id: otherUser }], [{ ...acceptedRow, project_id: otherUser }],
  [{ ...acceptedRow, user_id: otherUser }], [{ ...acceptedRow, member_id: null }],
  [{ ...acceptedRow, role: 'facilitator' }], [{ ...acceptedRow, outcome: 'unknown' }],
])('unconfirmable accept case %# stays unknown after one write', async body => {
  fixture.replies[acceptRpcPath] = { body }
  expect(await expectReply(await acceptBody(requestFor()), 503, 'unknown')).toMatchObject({ can_query_status: true })
  expect(paths()).toEqual([authPath, statusPath, acceptRpcPath])
})
test('accepted pre-read still requires a successful already_accepted RPC', async () => {
  fixture.replies[statusPath] = { body: [acceptedStatusRow] }
  fixture.replies[acceptRpcPath] = { body: [{ ...acceptedRow, outcome: 'already_accepted' }] }
  await expectReply(await acceptBody(requestFor()), 200, 'already_accepted')
  expect(paths()).toEqual([authPath, statusPath, acceptRpcPath])
})
test('database expiry information never replaces the accept RPC decision', async () => {
  fixture.replies[statusPath] = { body: [{ ...pendingRow, expires_at: '2020-01-01T00:00:00Z', is_expired: true }] }
  fixture.replies[acceptRpcPath] = { status: 403, body: { code: '42501', message: 'PRIVATE_UPSTREAM_ERROR' } }
  await expectReply(await acceptBody(requestFor()), 403, 'rejected')
  expect(paths()).toEqual([authPath, statusPath, acceptRpcPath])
})
test('already accepted status can confirm idempotency even after expiry', async () => {
  fixture.replies[statusPath] = { body: [{ ...acceptedStatusRow, expires_at: '2020-01-01T00:00:00Z', is_expired: true }] }
  fixture.replies[acceptRpcPath] = { body: [{ ...acceptedRow, outcome: 'already_accepted' }] }
  await expectReply(await acceptBody(requestFor()), 200, 'already_accepted')
  expect(paths()).toEqual([authPath, statusPath, acceptRpcPath])
})
test.each([
  null, [{ ...acceptedRow, outcome: 'accepted' }],
  [{ ...acceptedRow, outcome: 'already_accepted', member_id: otherUser }],
  [{ ...acceptedRow, outcome: 'already_accepted', joined_at: '2026-10-18T00:00:00Z' }],
])('accepted pre-read cannot hide final result failure case %#', async body => {
  fixture.replies[statusPath] = { body: [acceptedStatusRow] }
  fixture.replies[acceptRpcPath] = { body }
  await expectReply(await acceptBody(requestFor()), 503, 'unknown')
  expect(paths()).toEqual([authPath, statusPath, acceptRpcPath])
})
test.each([['42501', 403], ['22023', 400], ['23502', 409], ['23503', 409], ['23505', 409], ['23514', 409]] as const)('SQLSTATE %s maps safely without retry', async (code, status) => {
  fixture.replies[acceptRpcPath] = { status: 400, body: { code, message: 'PRIVATE_UPSTREAM_ERROR', details: fixtureToken, hint: fixtureBearer } }
  await expectReply(await acceptBody(requestFor()), status, 'rejected')
  expect(paths()).toEqual([authPath, statusPath, acceptRpcPath])
})
test.each([statusPath, acceptRpcPath])('unknown SQLSTATE at %s does not retry or recover automatically', async path => {
  fixture.replies[path] = { status: 503, body: { code: 'XX000', message: 'PRIVATE_UPSTREAM_ERROR' } }
  await expectReply(await acceptBody(requestFor()), 503, path === statusPath ? 'not_attempted' : 'unknown')
  expect(paths()).toEqual(path === statusPath ? [authPath, statusPath] : [authPath, statusPath, acceptRpcPath])
})
test.each([authPath, statusPath])('connection drop at %s never attempts acceptance', async path => {
  fixture.replies[path] = { action: 'drop' }
  await expectReply(await acceptBody(requestFor()), 503, 'not_attempted')
  expect(paths()).toEqual(path === authPath ? [authPath] : [authPath, statusPath])
})
test('lost accept response followed by explicit status never adds a write', async () => {
  fixture.replies[acceptRpcPath] = { action: 'drop' }
  await expectReply(await acceptBody(requestFor()), 503, 'unknown')
  expect(paths()).toEqual([authPath, statusPath, acceptRpcPath])
  fixture.replies[statusPath] = { body: [acceptedStatusRow] }
  expect(await expectReply(await readStatus(requestFor()), 200, 'confirmed')).toMatchObject({ status: 'accepted', project_id: fixtureProject })
  expect(paths()).toEqual([authPath, statusPath, acceptRpcPath, authPath, statusPath])
})
test.each(['pending', 'declined', 'expired'])('explicit status %s only reads', async status => {
  fixture.replies[statusPath] = { body: [{ ...pendingRow, status, is_expired: status === 'expired' }] }
  expect(await expectReply(await readStatus(requestFor()), 200, 'confirmed')).toEqual({ ...pendingHttp, status, is_expired: status === 'expired' })
  expect(paths()).toEqual([authPath, statusPath])
})
test('status refusal and unconfirmable status never write', async () => {
  fixture.replies[statusPath] = { status: 403, body: { code: '42501', message: 'PRIVATE_UPSTREAM_ERROR' } }
  await expectReply(await readStatus(requestFor()), 403, 'rejected')
  fixture.replies[statusPath] = { body: [] }
  await expectReply(await readStatus(requestFor()), 503, 'unknown')
  expect(paths()).toEqual([authPath, statusPath, authPath, statusPath])
})
test('already aborted request sends no external request', async () => {
  const caller = new AbortController()
  caller.abort()
  await expectReply(await acceptBody(requestFor(undefined, undefined, caller.signal)), 503, 'not_attempted')
  expect(fixture.captured).toHaveLength(0)
})
test.each([authPath, statusPath, acceptRpcPath])('caller abort during %s closes the outstanding request and does not retry', async path => {
  fixture.replies[path] = { action: 'hold' }
  const caller = new AbortController()
  const operation = acceptBody(requestFor(undefined, undefined, caller.signal))
  await fixture.waitFor(path)
  caller.abort()
  await expectReply(await operation, 503, path === acceptRpcPath ? 'unknown' : 'not_attempted')
  expect(paths()).toEqual(path === authPath ? [authPath] : path === statusPath ? [authPath, statusPath] : [authPath, statusPath, acceptRpcPath])
})
test('one ten second budget spans delayed auth and stalled accept body, then clears its timer', async () => {
  fixture.replies[authPath] = { action: 'hold' }
  fixture.replies[acceptRpcPath] = { action: 'headers-only' }
  const timers = jest.spyOn(globalThis, 'setTimeout')
  const clears = jest.spyOn(globalThis, 'clearTimeout')
  const started = performance.now()
  const operation = acceptBody(requestFor())
  await fixture.waitFor(authPath)
  await new Promise<void>(resolve => setTimeout(resolve, 5000))
  fixture.release(authPath, providerUser)
  await expectReply(await operation, 503, 'unknown')
  const elapsed = performance.now() - started
  expect(elapsed).toBeGreaterThanOrEqual(9500)
  expect(elapsed).toBeLessThan(14500)
  expect(paths()).toEqual([authPath, statusPath, acceptRpcPath])
  const deadlineIndex = timers.mock.calls.findIndex(call => call[1] === 10000)
  expect(deadlineIndex).toBeGreaterThanOrEqual(0)
  expect(clears.mock.calls.map(call => call[0])).toContain(timers.mock.results[deadlineIndex].value)
})
