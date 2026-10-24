import { webcrypto } from 'node:crypto'

const saved = { ...process.env }
beforeEach(() => {
  jest.resetModules()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon-key'
  Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto })
  global.fetch = jest.fn().mockRejectedValue(new Error('Unexpected network in factory test'))
  localStorage.clear()
  for (const cookie of document.cookie.split(';')) document.cookie = `${cookie.split('=')[0]}=;max-age=0;path=/`
  window.history.replaceState(null, '', '/en/auth/signin')
})
afterEach(async () => {
  const client = require('../supabase').createClientSupabase()
  await client.auth.stopAutoRefresh?.()
  process.env = { ...saved }
})
test('installed SDK creates S256 OAuth and a cookie verifier on the shared browser client', async () => {
  const { createClientSupabase } = require('../supabase')
  const client = createClientSupabase()
  expect(client).toBe(createClientSupabase())
  const result = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'http://localhost/en/auth/callback', skipBrowserRedirect: true } })
  expect(result.error).toBeNull()
  const url = new URL(result.data.url)
  expect(url.searchParams.get('code_challenge_method')).toBe('s256')
  expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(document.cookie).toContain('sb-127-auth-token-code-verifier=')
  expect(localStorage.getItem('sb-127-auth-token-code-verifier')).toBeNull()
  expect(global.fetch).not.toHaveBeenCalled()
})
test('deletes only exact legacy authentication keys without restoring cached identity or handling URL credentials', async () => {
  localStorage.setItem('auth-store', JSON.stringify({ state: { isAuthenticated: true, user: { id: 'legacy' } } }))
  localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'legacy', refresh_token: 'legacy', user: { id: 'legacy' } }))
  localStorage.setItem('sb-127-auth-token-code-verifier', 'legacy')
  localStorage.setItem('recording-draft', 'keep')
  window.history.replaceState(null, '', '/en/auth/signin?error=synthetic#access_token=synthetic&refresh_token=synthetic')
  const client = require('../supabase').createClientSupabase()
  const session = await client.auth.getSession()
  expect(session.data.session).toBeNull()
  expect(localStorage.getItem('auth-store')).toBeNull()
  expect(localStorage.getItem('sb-127-auth-token')).toBeNull()
  expect(localStorage.getItem('sb-127-auth-token-code-verifier')).toBeNull()
  expect(localStorage.getItem('recording-draft')).toBe('keep')
  expect(global.fetch).not.toHaveBeenCalled()
})
test('unconfigured preview methods explicitly fail including OTP and setSession', async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  const client = require('../supabase').createClientSupabase()
  for (const method of ['getSession', 'getUser', 'signInWithPassword', 'signUp', 'signOut', 'signInWithOAuth', 'signInWithOtp', 'verifyOtp', 'setSession']) {
    expect(typeof client.auth[method]).toBe('function')
    expect((await client.auth[method]({})).error).toBeTruthy()
  }
})
