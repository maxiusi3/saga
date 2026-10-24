const mockAuth = { getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn(), signInWithPassword: jest.fn(), signUp: jest.fn(), signOut: jest.fn(), signInWithOAuth: jest.fn() }
jest.mock('@/lib/supabase', () => ({ createClientSupabase: () => ({ auth: mockAuth }) }))
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'synthetic@example.invalid' }
const session = () => ({ user, access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Date.now() / 1000 + 3600 })
function deferred() { let resolve!: (v: any) => void; let reject!: (v: any) => void; const promise = new Promise<any>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
let store: any
let listener: (event: string, session: any) => void
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
beforeEach(() => {
  jest.resetModules(); jest.clearAllMocks(); localStorage.clear()
  mockAuth.getSession.mockResolvedValue({ data: { session: session() }, error: null })
  mockAuth.getUser.mockResolvedValue({ data: { user }, error: null })
  mockAuth.signOut.mockResolvedValue({ error: null })
  mockAuth.onAuthStateChange.mockImplementation(cb => { listener = cb; return { data: { subscription: { unsubscribe: jest.fn() } } } })
  store = require('../auth-store').useAuthStore
})
test('subscribes before reading session, coalesces concurrent initialization and repeated mounts', async () => {
  const pending = deferred(); mockAuth.getSession.mockReturnValue(pending.promise)
  const a = store.getState().initialize(); const b = store.getState().initialize()
  expect(mockAuth.onAuthStateChange).toHaveBeenCalledTimes(1)
  expect(mockAuth.onAuthStateChange.mock.invocationCallOrder[0]).toBeLessThan(mockAuth.getSession.mock.invocationCallOrder[0])
  pending.resolve({ data: { session: session() }, error: null }); await Promise.all([a, b])
  await store.getState().initialize()
  expect(mockAuth.onAuthStateChange).toHaveBeenCalledTimes(1)
  expect(mockAuth.getUser).toHaveBeenCalledWith('synthetic-access')
  expect(store.getState()).toMatchObject({ isAuthenticated: true, user })
})
test('provider rejection never authenticates a cached user', async () => {
  mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'RAW_PRIVATE_SENTINEL' } })
  await store.getState().initialize()
  expect(store.getState()).toMatchObject({ user: null, isAuthenticated: false, isLoading: false })
  expect(JSON.stringify(store.getState())).not.toContain('RAW_PRIVATE_SENTINEL')
  expect(await store.getState().getAccessToken()).toBeNull()
})
test('signout invalidates pending initialization and provider verification', async () => {
  const pending = deferred(); mockAuth.getUser.mockReturnValue(pending.promise)
  const init = store.getState().initialize(); await flush()
  await store.getState().signout()
  pending.resolve({ data: { user }, error: null }); await init
  expect(store.getState()).toMatchObject({ user: null, isAuthenticated: false })
})
test('listener verification runs outside the SDK callback and newer identities invalidate old results', async () => {
  await store.getState().initialize()
  const old = deferred(); mockAuth.getUser.mockReturnValueOnce(old.promise)
  listener('TOKEN_REFRESHED', session())
  expect(mockAuth.getUser).toHaveBeenCalledTimes(1)
  await flush()
  listener('SIGNED_OUT', null)
  old.resolve({ data: { user }, error: null }); await flush()
  expect(store.getState()).toMatchObject({ user: null, isAuthenticated: false })
})
test('persisted UI identity is never rehydrated', () => {
  localStorage.setItem('auth-store', JSON.stringify({ state: { user, isAuthenticated: true }, version: 0 }))
  jest.resetModules()
  const fresh = require('../auth-store').useAuthStore
  expect(fresh.getState()).toMatchObject({ user: null, isAuthenticated: false })
})
