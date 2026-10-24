/** @jest-environment node */
import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '../auth'
const { startSessionFixture, sessionName } = require('../../../../../../scripts/test-support/auth-session-fixture.cjs')
const savedEnv = { ...process.env }
let fixture: any
const cookie = (session: any) => `${sessionName}=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`
const request = (value: string, signal?: AbortSignal) => new NextRequest('http://localhost/api/synthetic', { headers: { cookie: value }, signal })
beforeEach(async () => { fixture = await startSessionFixture(); process.env.NEXT_PUBLIC_SUPABASE_URL = fixture.origin; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-key' })
afterEach(async () => { expect(await fixture.close()).toEqual({ listening: false, sockets: 0 }); process.env = { ...savedEnv } })
test.each(['503', '429', 'drop', 'abort'])('temporary expired-session refresh %s rejects safely without deleting the recoverable cookie', async mode => {
  const original = cookie({ ...fixture.issue(), expires_at: 1 })
  if (mode === '503' || mode === '429') fixture.control.refreshStatus = Number(mode)
  else if (mode === 'drop') fixture.control.drop = true
  else fixture.control.headersOnly = true
  const controller = new AbortController()
  const pending = getAuthenticatedUser(request(original, controller.signal))
  let timer: ReturnType<typeof setTimeout> | undefined
  if (mode === 'abort') timer = setTimeout(() => controller.abort(), 40)
  const result = await pending
  if (timer) clearTimeout(timer)
  expect(result.ok).toBe(false)
  if (!result.ok) { expect(result.response.status).toBe(503); expect(result.response.headers.getSetCookie()).toEqual([]) }
  expect(fixture.captured).toHaveLength(1)
  fixture.control.refreshStatus = 200; fixture.control.drop = false; fixture.control.headersOnly = false
  const recovered = await getAuthenticatedUser(request(original))
  expect(recovered.ok).toBe(true)
  if (recovered.ok) expect(recovered.headers.getSetCookie().some(value => value.includes('Max-Age=0'))).toBe(false)
})
test('successful refresh cookie remains publishable when subsequent user verification is temporarily unavailable', async () => {
  const original = cookie({ ...fixture.issue(), expires_at: 1 }); fixture.control.userStatus = 503
  const result = await getAuthenticatedUser(request(original))
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.response.status).toBe(503)
  const writes = result.response.headers.getSetCookie()
  expect(writes).toHaveLength(1)
  expect(writes[0]).not.toContain('Max-Age=0')
  fixture.control.userStatus = 200
  expect((await getAuthenticatedUser(request(writes.map(value => value.split(';')[0]).join('; ')))).ok).toBe(true)
})
