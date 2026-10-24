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
