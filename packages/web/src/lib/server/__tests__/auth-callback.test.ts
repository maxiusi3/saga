/** @jest-environment node */
import { NextRequest } from 'next/server'
import { GET } from '@/app/[locale]/auth/callback/route'

test('callback error is a private fixed 303 and preserves only a safe next', async () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {})
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const response = await GET(new NextRequest('http://localhost/en/auth/callback?error=PRIVATE_AUTH_SENTINEL&error_description=PRIVATE_DESCRIPTION_SENTINEL&next=%2Fdashboard'))
    expect({ status: response.status, location: response.headers.get('location'), cache: response.headers.get('cache-control'), referrer: response.headers.get('referrer-policy'), logs: log.mock.calls, errors: error.mock.calls }).toEqual({ status: 303, location: 'http://localhost/en/auth/signin?error=auth_failed&next=%2Fen%2Fdashboard', cache: 'no-store', referrer: 'no-referrer', logs: [], errors: [] })
  } finally { jest.restoreAllMocks() }
})

// No SDK mocks: every auth operation below uses installed @supabase/ssr + Supabase JS.
import { startAuthCallbackFixture, callbackUser, callbackSession, sessionName, verifierName, verifier, verifierCookie } from '../test-support/auth-callback-fixture'
const savedEnv = { ...process.env }
const nativeFetch = globalThis.fetch
const privateError = 'PRIVATE_UPSTREAM_SENTINEL'
const code = 'SYNTHETIC_CODE_SENTINEL'
const tokenHash = 'SYNTHETIC_HASH_SENTINEL'
let fixture: Awaited<ReturnType<typeof startAuthCallbackFixture>>
let consoleLog: jest.SpyInstance
let consoleError: jest.SpyInstance
let consoleWarn: jest.SpyInstance
let fetchSpy: jest.SpyInstance
let clientSpy: jest.SpyInstance
jest.setTimeout(20000)
beforeEach(async () => {
  fixture = await startAuthCallbackFixture()
  process.env.NEXT_PUBLIC_SUPABASE_URL = fixture.url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-never-used'
  consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(nativeFetch)
  clientSpy = jest.spyOn(jest.requireActual('@supabase/ssr/dist/main/createServerClient'), 'createServerClient')
})
afterEach(async () => {
  let closed: Awaited<ReturnType<typeof fixture.close>> | undefined
  try { closed = await fixture.close() }
  finally {
    process.env = { ...savedEnv }
    jest.restoreAllMocks()
    jest.useRealTimers()
  }
  expect(consoleLog).not.toHaveBeenCalled()
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  expect(closed).toEqual({ listening: false, sockets: 0, held: 0 })
})
function request(query = `code=${code}`, cookie = verifierCookie, signal?: AbortSignal, locale = 'en') {
  return new NextRequest(`http://localhost/${locale}/auth/callback?${query}`, { headers: { cookie }, signal })
}
async function safeReply(response: Response, success = false, next = '/en/dashboard', locale = 'en') {
  expect(response.status).toBe(303)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  const location = response.headers.get('location')!
  expect(location).toBe(success ? `http://localhost${next}` : `http://localhost/${locale}/auth/signin?error=auth_failed&next=${encodeURIComponent(next)}`)
  const body = await response.text()
  expect(body).toBe('')
  for (const secret of [privateError, code, tokenHash, callbackUser.email, '<script', 'synthetic-service-never-used']) expect(location + body).not.toContain(secret)
  if (!success) for (const cookie of (response as import('next/server').NextResponse).cookies.getAll()) expect(cookie.maxAge === 0 || (cookie.expires && +cookie.expires <= Date.now())).toBeTruthy()
}
test('real SSR PKCE exchange sends request verifier and retains cookie deletion and new session', async () => {
  const response = await GET(request())
  await safeReply(response, true)
  expect(fixture.captured).toHaveLength(1)
  expect(fixture.captured[0]).toMatchObject({ method: 'POST', path: '/auth/v1/token?grant_type=pkce', body: { auth_code: code, code_verifier: verifier }, headers: { apikey: 'synthetic-anon-key', authorization: 'Bearer synthetic-anon-key' } })
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  expect(clientSpy).toHaveBeenCalledTimes(1)
  const cookies = response.cookies.getAll()
  expect(cookies).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: verifierName, value: '', maxAge: 0, path: '/', sameSite: 'lax', httpOnly: false }),
    expect.objectContaining({ name: sessionName, path: '/', sameSite: 'lax', httpOnly: false, maxAge: 400 * 24 * 60 * 60 }),
  ]))
})
test.each(['email', 'magiclink', 'invite', 'signup', 'recovery', 'email_change'])('real SSR verifies token_hash type %s exactly once', async type => {
  const response = await GET(request(`token_hash=${tokenHash}&type=${type}&next=%2Fja%2Fdashboard`, '', undefined, 'pt'))
  await safeReply(response, true, '/ja/dashboard')
  expect(fixture.captured).toHaveLength(1)
  expect(fixture.captured[0]).toMatchObject({ path: '/auth/v1/verify', body: { token_hash: tokenHash, type } })
})
test.each([
  '', `code=${code}&code=${code}`, `code=${code}&token_hash=${tokenHash}&type=email`,
  `code=${code}&type=email`, `code=${code}&token_hash=`, 'code=', 'code=%20', 'code=%0A',
  `code=${'c'.repeat(4097)}`, `token_hash=${'h'.repeat(4097)}&type=email`,
  `token_hash=${tokenHash}`, 'type=email', `token_hash=${tokenHash}&type=unknown`,
  `token_hash=${tokenHash}&type=email&type=email`, `token_hash=${tokenHash}&token_hash=other&type=email`,
  `token_hash=${tokenHash}&type=`, `error=&code=${code}`, `code=${code}&access_token=bogus`,
])('invalid/ambiguous inputs never construct the SDK: %s', async query => {
  await safeReply(await GET(request(query)))
  expect(clientSpy).not.toHaveBeenCalled()
  expect(fetchSpy).not.toHaveBeenCalled()
  expect(fixture.captured).toHaveLength(0)
})
test('missing PKCE verifier is a safe SDK refusal with no request', async () => {
  await safeReply(await GET(request(`code=${code}`, '')))
  expect(fetchSpy).not.toHaveBeenCalled()
})
test('credential maximum is inclusive and values are decoded only once', async () => {
  await safeReply(await GET(request(`token_hash=${'h'.repeat(4096)}&type=email`)), true)
  expect((fixture.captured[0].body as { token_hash: string }).token_hash).toHaveLength(4096)
})
test.each([
  {}, { user: callbackUser }, { ...callbackSession, user: undefined },
  { ...callbackSession, user: { id: 'not-a-uuid' } }, { ...callbackSession, access_token: '' },
  { ...callbackSession, refresh_token: '' }, { ...callbackSession, expires_in: 0 },
  { ...callbackSession, token_type: '' }, { ...callbackSession, expires_at: 1 },
])('incomplete provider success does not publish a session cookie: %#', async body => {
  fixture.reply.body = body
  await safeReply(await GET(request(`token_hash=${tokenHash}&type=email`)))
  expect(fixture.captured).toHaveLength(1)
})
test.each([400, 401, 403, 429, 500, 503])('provider HTTP %s is safe without fallback or retry', async status => {
  fixture.reply.status = status
  fixture.reply.body = { msg: privateError, message: privateError, error_description: privateError }
  await safeReply(await GET(request()))
  expect(fixture.captured).toHaveLength(1)
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})
test.each(['drop', 'invalid-json'] as const)('transport %s is sanitized before SDK logging', async action => {
  fixture.reply.action = action
  await safeReply(await GET(request()))
  expect(fixture.captured).toHaveLength(1)
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})
test('a rejected transport carrying secrets is not logged by actual SDK', async () => {
  fetchSpy.mockRejectedValue(new Error(privateError))
  await safeReply(await GET(request()))
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})
test('large session is chunked and removes stale chunks with independent options', async () => {
  fixture.reply.body = { ...callbackSession, user: { ...callbackUser, user_metadata: { padding: 'x'.repeat(12000) } } }
  const response = await GET(request(`code=${code}`, `${verifierCookie}; ${sessionName}.9=stale-fragment`))
  await safeReply(response, true)
  const cookies = response.cookies.getAll()
  const writes = cookies.filter(cookie => cookie.name.startsWith(`${sessionName}.`) && cookie.maxAge !== 0)
  expect(writes.length).toBeGreaterThan(2)
  expect(writes.map(cookie => cookie.name)).toContain(`${sessionName}.0`)
  for (const cookie of writes) expect(cookie).toMatchObject({ path: '/', sameSite: 'lax', maxAge: 34560000 })
  expect(cookies).toContainEqual(expect.objectContaining({ name: `${sessionName}.9`, value: '', path: '/', sameSite: 'lax', maxAge: 0 }))
})
test.each(['hold', 'headers-only'] as const)('caller abort during %s includes body and prevents retries', async action => {
  fixture.reply.action = action
  const caller = new AbortController()
  const req = request(`code=${code}`, verifierCookie, caller.signal)
  const add = jest.spyOn(req.signal, 'addEventListener')
  const remove = jest.spyOn(req.signal, 'removeEventListener')
  const pending = GET(req)
  await fixture.waitForRequest()
  caller.abort(new Error(privateError))
  await safeReply(await pending)
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  const installed = add.mock.calls.filter(call => call[0] === 'abort').map(call => call[1])
  expect(remove.mock.calls.filter(call => call[0] === 'abort').map(call => call[1])).toEqual(installed)
})
test.each(['hold', 'headers-only'] as const)('ten-second total deadline bounds %s and clears timers', async action => {
  fixture.reply.action = action
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'performance', 'Date'] })
  const pending = GET(request())
  await fixture.waitForRequest()
  await jest.advanceTimersByTimeAsync(9999)
  let completed = false
  void pending.then(() => { completed = true })
  await Promise.resolve()
  expect(completed).toBe(false)
  await jest.advanceTimersByTimeAsync(1)
  await safeReply(await pending)
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})
test('already aborted caller never invokes SDK or fetch', async () => {
  const caller = new AbortController()
  caller.abort()
  await safeReply(await GET(request(`code=${code}`, verifierCookie, caller.signal)))
  expect(clientSpy).not.toHaveBeenCalled()
  expect(fetchSpy).not.toHaveBeenCalled()
})
test('success clears its total deadline and caller listener', async () => {
  const timeout = jest.spyOn(globalThis, 'setTimeout')
  const clear = jest.spyOn(globalThis, 'clearTimeout')
  const req = request()
  const add = jest.spyOn(req.signal, 'addEventListener')
  const remove = jest.spyOn(req.signal, 'removeEventListener')
  await safeReply(await GET(req), true)
  const operation = timeout.mock.calls.findIndex(call => call[1] === 10000)
  expect(operation).toBeGreaterThanOrEqual(0)
  expect(clear).toHaveBeenCalledWith(timeout.mock.results[operation].value)
  expect(remove.mock.calls.filter(call => call[0] === 'abort').map(call => call[1])).toEqual(add.mock.calls.filter(call => call[0] === 'abort').map(call => call[1]))
})
test.each(['missing-url', 'missing-key', 'invalid-url', 'cookie-read-throws'])('configuration/cookie failure %s is safe', async kind => {
  const req = request()
  if (kind === 'missing-url') delete process.env.NEXT_PUBLIC_SUPABASE_URL
  if (kind === 'missing-key') delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (kind === 'invalid-url') process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url'
  if (kind === 'cookie-read-throws') jest.spyOn(req.cookies, 'getAll').mockImplementation(() => { throw new Error(privateError) })
  await safeReply(await GET(req))
  expect(fetchSpy).not.toHaveBeenCalled()
})

test('an expired request session never triggers implicit refresh or user lookup', async () => {
  const expired = { ...callbackSession, expires_at: 1, refresh_token: 'OLD_REFRESH_MUST_NOT_BE_SENT' }
  const oldCookie = `${sessionName}=base64-${Buffer.from(JSON.stringify(expired)).toString('base64url')}`
  await safeReply(await GET(request(`code=${code}`, `${verifierCookie}; ${oldCookie}`)), true)
  expect(fixture.captured).toHaveLength(1)
  expect(fixture.captured[0].path).toBe('/auth/v1/token?grant_type=pkce')
  expect(JSON.stringify(fixture.captured)).not.toContain('OLD_REFRESH_MUST_NOT_BE_SENT')
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})
test('cookie serialization failure discards new session writes and safely redirects', async () => {
  const { NextResponse } = await import('next/server')
  const prototype = Object.getPrototypeOf(new NextResponse().cookies)
  const original = prototype.set
  jest.spyOn(prototype, 'set').mockImplementation(function (this: unknown, ...args: unknown[]) {
    if (args[0] === sessionName) throw new Error(privateError)
    return original.apply(this, args)
  })
  await safeReply(await GET(request()))
  expect(fixture.captured).toHaveLength(1)
})
test('failed verification retains only actual SSR deletion cookies', async () => {
  fixture.reply.body = { ...callbackSession, user: { id: 'bad-provider-user' } }
  const response = await GET(request(`code=${code}`, `${verifierCookie}; ${sessionName}.9=stale`))
  await safeReply(response)
  expect(response.cookies.getAll()).toContainEqual(expect.objectContaining({ name: verifierName, value: '', maxAge: 0, path: '/', sameSite: 'lax' }))
  expect(response.cookies.getAll()).toContainEqual(expect.objectContaining({ name: `${sessionName}.9`, value: '', maxAge: 0, path: '/', sameSite: 'lax' }))
})
test('synthetic code is decoded once without rejecting opaque non-whitespace content', async () => {
  await safeReply(await GET(request('code=synthetic%252Fopaque')), true)
  expect(fixture.captured[0].body).toMatchObject({ auth_code: 'synthetic%2Fopaque', code_verifier: verifier })
})
test.each(['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'pt'])('callback locale %s is canonical and unsafe next never leaks', async locale => {
  const response = await GET(request(`code=${code}&next=${encodeURIComponent("/dashboard/'</script>" + privateError)}`, verifierCookie, undefined, locale))
  await safeReply(response, true, `/${locale}/dashboard`)
})
test('callback duplicate next falls back and invalid locale falls back to en', async () => {
  await safeReply(await GET(request(`code=${code}&next=/ja/dashboard&next=/pt/dashboard`, verifierCookie, undefined, 'invalid')), true)
})
test('verified session token may be longer than URL credential limit and still uses SSR cookie chunks', async () => {
  fixture.reply.body = { ...callbackSession, access_token: 'x'.repeat(8000) }
  const response = await GET(request())
  await safeReply(response, true)
  expect(response.cookies.getAll().some(cookie => cookie.name === `${sessionName}.1`)).toBe(true)
})

test('a streamed-body failure is sanitized and does not publish session cookies', async () => {
  fetchSpy.mockResolvedValue(new Response(new ReadableStream({ start(controller) { controller.error(new Error(privateError)) } }), { status: 200 }))
  await safeReply(await GET(request()))
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})
test('HTTP redirect never replays the code at another endpoint', async () => {
  fixture.reply.status = 302
  fixture.reply.headers = { Location: `${fixture.url}/unexpected?code=${code}` }
  fixture.reply.body = { message: privateError }
  await safeReply(await GET(request()))
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  expect(fetchSpy.mock.calls[0][1].redirect).toBe('error')
  expect(fixture.captured).toHaveLength(1)
})
test('PKCE verifier cookie chunks are recombined by the actual SSR SDK', async () => {
  const value = `base64-${Buffer.from(JSON.stringify(verifier)).toString('base64url')}`
  const split = Math.floor(value.length / 2)
  const response = await GET(request(`code=${code}`, `${verifierName}.0=${value.slice(0, split)}; ${verifierName}.1=${value.slice(split)}`))
  await safeReply(response, true)
  expect(fixture.captured[0].body).toMatchObject({ code_verifier: verifier })
  for (const suffix of ['.0', '.1']) expect(response.cookies.getAll()).toContainEqual(expect.objectContaining({ name: verifierName + suffix, maxAge: 0, value: '', sameSite: 'lax', path: '/' }))
})

test.each([' ', 'with space', 'has\nnewline', 'bad%token'])('malformed output session token %j never publishes a cookie', async value => {
  fixture.reply.body = { ...callbackSession, access_token: value }
  await safeReply(await GET(request()))
  expect(fixture.captured).toHaveLength(1)
})
