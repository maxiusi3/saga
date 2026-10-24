/** @jest-environment node */
test('SSR facade cannot share or persist browser sessions', async () => {
  const saved = { ...process.env }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-key'
  jest.resetModules()
  try {
    const { createClientSupabase, createServerSupabase } = require('../supabase')
    const a = createClientSupabase(), b = createClientSupabase(), c = createServerSupabase()
    expect(a).not.toBe(b); expect(a).not.toBe(c)
    for (const client of [a, b, c]) {
      expect((await client.auth.getSession()).data.session).toBeNull()
      expect(client.auth.persistSession).toBe(false)
      expect(client.auth.autoRefreshToken).toBe(false)
      expect(client.auth.detectSessionInUrl).toBe(false)
    }
  } finally { process.env = saved }
})
