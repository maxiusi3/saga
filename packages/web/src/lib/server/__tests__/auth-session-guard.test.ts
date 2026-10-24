/** @jest-environment node */
import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '../auth'
import { startAuthCallbackFixture, callbackUser, callbackSession, sessionName } from '../test-support/auth-callback-fixture'
jest.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
const saved = { ...process.env }
let fixture: Awaited<ReturnType<typeof startAuthCallbackFixture>>
const cookie = (changes = {}) => `${sessionName}=base64-${Buffer.from(JSON.stringify({ ...callbackSession, expires_at: Date.now() / 1000 + 3600, ...changes })).toString('base64url')}`
const req = (authorization?: string, value = cookie(), signal?: AbortSignal) => new NextRequest('http://localhost/api/synthetic-guard', { headers: { cookie: value, ...(authorization !== undefined ? { authorization } : {}) }, signal })
beforeEach(async () => { fixture = await startAuthCallbackFixture(); process.env.NEXT_PUBLIC_SUPABASE_URL = fixture.url; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-key'; delete process.env.SUPABASE_SERVICE_ROLE_KEY; fixture.reply.body = callbackUser })
afterEach(async () => { expect(await fixture.close()).toEqual({ listening: false, sockets: 0, held: 0 }); process.env = { ...saved }; jest.restoreAllMocks() })
test('public Bearer verification needs no service role and agrees with request cookie identity', async () => {
  const bearer = await getAuthenticatedUser(req('Bearer synthetic-access-token'))
  const cookies = await getAuthenticatedUser(req())
  expect(bearer).toMatchObject({ ok: true, user: callbackUser }); expect(cookies).toMatchObject({ ok: true, user: callbackUser })
  expect(fixture.captured).toHaveLength(2)
  for (const call of fixture.captured) expect(call).toMatchObject({ path: '/auth/v1/user', method: 'GET', headers: { apikey: 'synthetic-public-key', authorization: 'Bearer synthetic-access-token' } })
})
test.each(['Basic synthetic', '', 'Bearer', 'Bearer a b'])('malformed explicit authorization never falls back to cookies: %s', async authorization => {
  const result = await getAuthenticatedUser(req(authorization))
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.response.status).toBe(401)
  expect(fixture.captured).toHaveLength(0)
})
test('forged cookie identity is rejected by the provider', async () => {
  fixture.reply.status = 401; fixture.reply.body = { msg: 'RAW_PRIVATE_SENTINEL', code: 'bad_jwt' }
  const result = await getAuthenticatedUser(req())
  expect(result.ok).toBe(false)
  if (!result.ok) expect(await result.response.text()).toBe('{"error":"Unauthorized"}')
  expect(fixture.captured).toHaveLength(1)
})

describe('real SDK with validating synthetic provider', () => {
  const { startSessionFixture } = require('../../../../../../scripts/test-support/auth-session-fixture.cjs')
  let validating: any
  beforeEach(async () => { validating = await startSessionFixture(); process.env.NEXT_PUBLIC_SUPABASE_URL = validating.origin })
  afterEach(async () => { expect(await validating.close()).toEqual({ listening: false, sockets: 0 }) })
  test('invalid explicit Bearer cannot borrow a valid cookie session', async () => {
    const session = validating.issue()
    const result = await getAuthenticatedUser(req('Bearer forged-token', cookie(session)))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
    expect(validating.captured).toHaveLength(1)
    expect(validating.captured[0].authorization).toBe('Bearer forged-token')
  })
  test('provider identity replaces forged cookie user claims', async () => {
    const session = validating.issue()
    const result = await getAuthenticatedUser(req(undefined, cookie({ ...session, user: { ...callbackUser, id: '22222222-2222-4222-8222-222222222222' } })))
    expect(result).toMatchObject({ ok: true, user: callbackUser })
  })
  test('refresh propagates full cookie chunks/options and stale chunk deletion beyond five', async () => {
    const session = validating.issue()
    validating.control.userMetadataSize = 22000
    const result = await getAuthenticatedUser(req(undefined, `${cookie({ ...session, expires_at: 1 })}; ${sessionName}.12=stale`))
    expect(result).toMatchObject({ ok: true, user: callbackUser })
    if (!result.ok) return
    const writes = result.headers.getSetCookie()
    expect(writes.some(value => value.startsWith(`${sessionName}.12=;`) && value.includes('Max-Age=0'))).toBe(true)
    expect(writes.filter(value => !value.includes('Max-Age=0')).length).toBeGreaterThan(5)
    for (const value of writes) { expect(value).toContain('Path=/'); expect(value).toContain('SameSite=Lax') }
    expect(validating.captured.map((value: any) => value.path)).toEqual(['/auth/v1/token?grant_type=refresh_token', '/auth/v1/user'])
  })
  test('reads a current cookie session split into more than five chunks', async () => {
    const encoded = cookie(validating.issue()).split('=')[1]
    const split = Array.from({ length: Math.ceil(encoded.length / 80) }, (_, i) => `${sessionName}.${i}=${encoded.slice(i * 80, (i + 1) * 80)}`).join('; ')
    expect(await getAuthenticatedUser(req(undefined, split))).toMatchObject({ ok: true, user: callbackUser })
  })
  test('provider refresh rejection propagates cookie deletion', async () => {
    const session = validating.issue(); validating.control.refreshStatus = 400
    const result = await getAuthenticatedUser(req(undefined, cookie({ ...session, expires_at: 1 })))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      expect(result.response.headers.get('set-cookie')).toContain(`${sessionName}=;`)
      expect(result.response.headers.get('set-cookie')).toContain('Max-Age=0')
    }
  })
  test.each(['drop', 'headersOnly', 'server-error'])('transport %s and caller abort are finite, safe and never log raw exceptions', async mode => {
    const log = jest.spyOn(console, 'error')
    const session = validating.issue()
    if (mode === 'server-error') validating.control.userStatus = 503
    else validating.control[mode] = true
    const controller = new AbortController()
    const pending = getAuthenticatedUser(req(undefined, cookie(session), controller.signal))
    if (mode === 'headersOnly') setTimeout(() => controller.abort(new Error('PRIVATE_ABORT_SENTINEL')), 50)
    const result = await pending
    expect(result.ok).toBe(false)
    if (!result.ok) { expect(result.response.status).toBe(503); expect(await result.response.text()).not.toMatch(/PRIVATE|SENTINEL/) }
    expect(log).not.toHaveBeenCalled()
    expect(validating.captured).toHaveLength(1)
  })
  test('ten-second total deadline terminates stalled body without retry', async () => {
    const session = validating.issue(); validating.control.headersOnly = true
    const start = Date.now()
    const result = await getAuthenticatedUser(req(undefined, cookie(session)))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(503)
    expect(Date.now() - start).toBeGreaterThanOrEqual(9900)
    expect(Date.now() - start).toBeLessThan(12000)
    expect(validating.captured).toHaveLength(1)
  }, 15000)
})
