/** @jest-environment node */
import { NextRequest } from 'next/server'
import { GET as readPath } from '@/app/api/invitations/[token]/route'
import { GET as readQuery } from '@/app/api/invitations/verify/route'
import { GET as checkPending } from '@/app/api/invitations/check-pending/route'
import {
  startInvitationFixture, fixtureToken, fixtureBearer, providerUser, pendingHttp,
  pendingRow, acceptedStatusRow, otherUser,
} from '../test-support/invitation-fixture'

const cookieAuth = jest.fn(async () => ({ data: { user: null }, error: null }))
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => ({ auth: { getUser: cookieAuth } }),
}))
const savedEnv = { ...process.env }
const nativeFetch = globalThis.fetch
const authPath = '/auth/v1/user'
const statusPath = '/rest/v1/rpc/status'
let fixture: Awaited<ReturnType<typeof startInvitationFixture>>
let fetchSpy: jest.SpyInstance
let logSpies: jest.SpyInstance[]
const listeners: Array<[jest.SpyInstance, jest.SpyInstance]> = []
jest.setTimeout(20000)

beforeEach(async () => {
  fixture = await startInvitationFixture()
  process.env.INVITATION_TRANSACTIONS_ENABLED = 'true'
  process.env.NEXT_PUBLIC_SUPABASE_URL = fixture.url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-never-used'
  fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(nativeFetch)
  logSpies = ['log', 'error', 'warn'].map(method => jest.spyOn(console, method as 'log').mockImplementation(() => {}))
})
afterEach(async () => {
  const cleanup = await fixture.close()
  process.env = { ...savedEnv }
  for (const [add, remove] of listeners) {
    expect(remove.mock.calls.filter(call => call[0] === 'abort').map(call => call[1]))
      .toEqual(add.mock.calls.filter(call => call[0] === 'abort').map(call => call[1]))
  }
  listeners.length = 0
  const logged = logSpies.some(spy => spy.mock.calls.length > 0)
  jest.restoreAllMocks()
  cookieAuth.mockClear()
  expect(cleanup).toEqual({ listening: false, sockets: 0, held: 0 })
  expect(logged).toBe(false)
})
function request(query = '', bearer: string | null = fixtureBearer, signal?: AbortSignal) {
  const headers: Record<string, string> = { Cookie: 'unrelated-user-cookie=other-user' }
  if (bearer !== null) headers.Authorization = `Bearer ${bearer}`
  const value = new NextRequest(`http://localhost/api/invitations/verify${query}`, { headers, signal })
  listeners.push([jest.spyOn(value.signal, 'addEventListener'), jest.spyOn(value.signal, 'removeEventListener')])
  return value
}
const readers = {
  path: (req: NextRequest, token = fixtureToken) => readPath(req, { params: Promise.resolve({ token }) }),
  query: (req: NextRequest) => readQuery(req),
}
type Reader = keyof typeof readers
function read(kind: Reader, bearer: string | null = fixtureBearer, signal?: AbortSignal) {
  return readers[kind](request(`?token=${fixtureToken}&debug=1`, bearer, signal))
}
async function reply(response: Response, status: number, outcome: string) {
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('vary')).toBe('Authorization')
  const body = await response.json()
  expect(body.outcome).toBe(outcome)
  const containsPrivateData = [fixtureToken, fixtureBearer, providerUser.email, 'PRIVATE_UPSTREAM_ERROR', 'synthetic-service-never-used']
    .some(value => JSON.stringify(body).includes(value))
  expect(containsPrivateData).toBe(false)
  expect(body.debug).toBeUndefined()
  return body
}
const paths = () => fixture.captured.map(item => item.path)

test.each(['path', 'query'] as const)('disabled %s GET stops before external work', async kind => {
  for (const flag of [undefined, 'false', 'TRUE', '1', ' true']) {
    if (flag === undefined) delete process.env.INVITATION_TRANSACTIONS_ENABLED
    else process.env.INVITATION_TRANSACTIONS_ENABLED = flag
    await reply(await read(kind), 503, 'not_attempted')
  }
  expect(fetchSpy).not.toHaveBeenCalled()
  expect(cookieAuth).not.toHaveBeenCalled()
})
test('pending discovery is unavailable for every flag without configuration or auth', async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  for (const flag of [undefined, 'false', 'TRUE', '1', ' true', 'true']) {
    if (flag === undefined) delete process.env.INVITATION_TRANSACTIONS_ENABLED
    else process.env.INVITATION_TRANSACTIONS_ENABLED = flag
    const body = await reply(await checkPending(), 503, 'not_attempted')
    expect(body).toMatchObject({ success: false })
    expect(body).not.toHaveProperty('invitations')
    expect(body).not.toHaveProperty('hasPendingInvitations')
  }
  expect(fetchSpy).not.toHaveBeenCalled()
  expect(cookieAuth).not.toHaveBeenCalled()
})
test.each(['path', 'query'] as const)('%s GET uses Bearer verification then exactly one read-only RPC with anon key', async kind => {
  expect(await reply(await read(kind), 200, 'confirmed')).toEqual(pendingHttp)
  expect(fixture.captured.map(item => [item.path, item.body])).toEqual([
    [authPath, null], [statusPath, { p_token: fixtureToken }],
  ])
  for (const item of fixture.captured) {
    expect(item.headers.authorization === `Bearer ${fixtureBearer}`).toBe(true)
    expect(item.headers.apikey).toBe('synthetic-anon')
    expect(item.headers.cookie).toBeUndefined()
    if (item.path === statusPath) {
      expect(item.method).toBe('POST')
      expect(item.headers['content-profile']).toBe('invitation_candidate')
    }
  }
  expect(cookieAuth).not.toHaveBeenCalled()
})
test.each(['path', 'query'] as const)('%s GET never uses cookies or a malformed Bearer', async kind => {
  for (const bearer of [null, '', 'two words']) await reply(await read(kind, bearer), 401, 'not_attempted')
  expect(paths()).toEqual([])
  expect(cookieAuth).not.toHaveBeenCalled()
})
test('path is already decoded once; whitespace and residual encoding are rejected', async () => {
  for (const token of [' ' + fixtureToken, '%76' + fixtureToken.slice(1), '%2576' + fixtureToken.slice(1), fixtureToken.toUpperCase()]) {
    await reply(await readers.path(request(), token), 400, 'rejected')
  }
  expect(paths()).toEqual([])
})
test('query requires one canonical token after URLSearchParams decoding, ignoring debug', async () => {
  for (const query of ['', '?token=', `?token=${fixtureToken}&token=${fixtureToken}`, `?token=%2576${fixtureToken.slice(1)}`, `?token=+${fixtureToken}`]) {
    await reply(await readQuery(request(query)), 400, 'rejected')
  }
  expect(paths()).toEqual([])
  expect(await reply(await readQuery(request(`?token=%76${fixtureToken.slice(1)}&debug=1`)), 200, 'confirmed')).toEqual(pendingHttp)
  expect(paths()).toEqual([authPath, statusPath])
})
test.each(['path', 'query'] as const)('%s GET safely rejects provider identity failures without reading', async kind => {
  for (const [status, body, expected, outcome] of [
    [401, { message: 'PRIVATE_UPSTREAM_ERROR' }, 401, 'not_attempted'],
    [503, { message: 'PRIVATE_UPSTREAM_ERROR' }, 503, 'not_attempted'],
    [200, { ...providerUser, email_confirmed_at: null }, 403, 'rejected'],
  ] as const) {
    fixture.replies[authPath] = { status, body }
    await reply(await read(kind), expected, outcome)
  }
  expect(paths()).toEqual([authPath, authPath, authPath])
})
test.each(['path', 'query'] as const)('%s GET validates TABLE data and never writes expired status', async kind => {
  for (const body of [[], [pendingRow, pendingRow], [{ ...pendingRow, token: 'wrong' }], [{ ...acceptedStatusRow, user_id: otherUser }]]) {
    fixture.replies[statusPath] = { body }
    await reply(await read(kind), 503, 'unknown')
  }
  fixture.replies[statusPath] = { body: [{ ...pendingRow, status: 'expired', is_expired: true }] }
  expect(await reply(await read(kind), 200, 'confirmed')).toMatchObject({ status: 'expired', is_expired: true })
  expect(paths()).toEqual(Array(5).fill([authPath, statusPath]).flat())
})
test.each(['path', 'query'] as const)('%s GET handles status refusal without exposing provider details', async kind => {
  fixture.replies[statusPath] = { status: 403, body: { code: '42501', message: 'PRIVATE_UPSTREAM_ERROR' } }
  await reply(await read(kind), 403, 'rejected')
  expect(paths()).toEqual([authPath, statusPath])
})
test.each(['path', 'query'] as const)('%s GET respects abort before authentication and during a read', async kind => {
  const cancelled = new AbortController()
  cancelled.abort()
  await reply(await read(kind, fixtureBearer, cancelled.signal), 503, 'not_attempted')
  expect(paths()).toEqual([])
  fixture.replies[statusPath] = { action: 'headers-only' }
  const caller = new AbortController()
  const pending = read(kind, fixtureBearer, caller.signal)
  await fixture.waitFor(statusPath)
  caller.abort()
  await reply(await pending, 503, 'unknown')
  expect(paths()).toEqual([authPath, statusPath])
})
test('GET keeps one ten second deadline across auth and stalled status body and clears its timer', async () => {
  fixture.replies[authPath] = { action: 'hold' }
  fixture.replies[statusPath] = { action: 'headers-only' }
  const timers = jest.spyOn(globalThis, 'setTimeout')
  const clears = jest.spyOn(globalThis, 'clearTimeout')
  const started = performance.now()
  const pending = read('query')
  await fixture.waitFor(authPath)
  await new Promise<void>(resolve => setTimeout(resolve, 5000))
  fixture.release(authPath, providerUser)
  await reply(await pending, 503, 'unknown')
  expect(performance.now() - started).toBeGreaterThanOrEqual(9500)
  expect(performance.now() - started).toBeLessThan(14500)
  expect(paths()).toEqual([authPath, statusPath])
  const deadlineIndex = timers.mock.calls.findIndex(call => call[1] === 10000)
  expect(deadlineIndex).toBeGreaterThanOrEqual(0)
  expect(clears.mock.calls.map(call => call[0])).toContain(timers.mock.results[deadlineIndex].value)
})
