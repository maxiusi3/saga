/** @jest-environment node */
const { JSDOM } = require('jsdom')
const savedEnv = { ...process.env }
const savedGlobals = { window: (globalThis as any).window, document: (globalThis as any).document, localStorage: (globalThis as any).localStorage, BroadcastChannel: globalThis.BroadcastChannel, fetch: globalThis.fetch }
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'synthetic@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const session = () => ({ user, access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Date.now() / 1000 + 3600 })
const sentinel = 'SYNTHETIC_PRIVATE_PROVIDER_SENTINEL'
let dom: any, client: any, errors: jest.SpyInstance
const messages = () => errors.mock.calls.flat().map(value => value instanceof Error ? `${value.name}: ${value.message}` : String(value)).join('\n')
beforeEach(() => {
  jest.resetModules()
  dom = new JSDOM('', { url: 'http://127.0.0.1:54321/en' })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, BroadcastChannel: undefined })
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-key'
  // Spy without replacing the logger: real SDK diagnostics stay visible.
  errors = jest.spyOn(console, 'error')
  client = undefined
})
afterEach(async () => {
  if (client) await client.auth.stopAutoRefresh()
  dom.window.close(); jest.restoreAllMocks(); Object.assign(globalThis, savedGlobals); process.env = { ...savedEnv }
})
function create(expired = false) {
  if (expired) document.cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify({ ...session(), expires_at: 1 })).toString('base64url')}; Path=/`
  client = require('../supabase').createClientSupabase()
  return client
}
test('expired-cookie initialization keeps rejected-refresh diagnostics safe and removes invalid session', async () => {
  globalThis.fetch = jest.fn(async () => Response.json({ msg: sentinel, code: 'refresh_token_not_found' }, { status: 401, headers: { 'X-Supabase-Api-Version': '2024-01-01' } }))
  await create(true).auth.initialize()
  expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  expect(messages()).not.toContain(sentinel)
  expect(errors).toHaveBeenCalled()
  expect(document.cookie).not.toContain('sb-127-auth-token=')
})
test('expired-cookie transport rejection is sanitized while SDK retry can recover normally', async () => {
  globalThis.fetch = jest.fn().mockRejectedValueOnce(new Error(sentinel)).mockResolvedValue(Response.json(session()))
  await create(true).auth.initialize()
  expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  expect(messages()).not.toContain(sentinel)
  expect(errors).toHaveBeenCalled()
  expect((await client.auth.getSession()).data.session.access_token).toBe('synthetic-access')
  expect(document.cookie).toContain('sb-127-auth-token=')
})
test('HTTP error code and body cannot leak private text through SDK auth errors', async () => {
  globalThis.fetch = jest.fn(async () => Response.json({ msg: sentinel, code: sentinel, error_description: sentinel }, { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } }))
  const result = await create().auth.signInWithPassword({ email: user.email, password: 'synthetic' })
  expect(result.error).toBeTruthy()
  expect(JSON.stringify(result.error)).not.toContain(sentinel)
  expect(result.error.message).not.toContain(sentinel)
})
test('successful auth responses and cookie persistence retain provider/session data', async () => {
  globalThis.fetch = jest.fn(async () => Response.json(session()))
  const result = await create().auth.signInWithPassword({ email: user.email, password: 'synthetic' })
  expect(result.error).toBeNull()
  expect(result.data).toMatchObject({ user, session: { user, access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' } })
  expect(document.cookie).toContain('sb-127-auth-token=')
  expect(errors).not.toHaveBeenCalled()
})
test('non-Auth responses and failures retain their normal semantics', async () => {
  const resultBody = { message: 'synthetic-business-error', code: 'SYNTHETIC_BUSINESS_CODE', details: 'keep-details' }
  globalThis.fetch = jest.fn(async () => Response.json(resultBody, { status: 400 }))
  const result = await create().from('synthetic').select('*')
  expect(result.error).toMatchObject(resultBody)
  globalThis.fetch = jest.fn().mockRejectedValue(new Error('synthetic-business-transport'))
  const transport = await client.from('synthetic').select('*')
  expect(transport.error.message).toContain('synthetic-business-transport')
})
