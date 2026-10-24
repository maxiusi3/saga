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
test('initial state remains loading until provider validation finishes', async () => {
  expect(store.getState()).toMatchObject({ isAuthenticated: false, isLoading: true })
  const pending = deferred(); mockAuth.getUser.mockReturnValue(pending.promise)
  const init = store.getState().initialize(); await flush()
  expect(store.getState()).toMatchObject({ isAuthenticated: false, isLoading: true })
  pending.resolve({ data: { user }, error: null }); await init
  expect(store.getState()).toMatchObject({ isAuthenticated: true, isLoading: false })
})
test('new identity wins over earlier provider failure', async () => {
  await store.getState().initialize()
  const earlier = deferred(); mockAuth.getUser.mockReturnValueOnce(earlier.promise)
  listener('TOKEN_REFRESHED', session()); await flush()
  const newer = { ...user, id: '22222222-2222-4222-8222-222222222222' }
  mockAuth.getUser.mockResolvedValue({ data: { user: newer }, error: null })
  listener('SIGNED_IN', { ...session(), user: newer, access_token: 'new-token' }); await flush()
  earlier.reject(new Error('RAW_PRIVATE_SENTINEL')); await flush()
  expect(store.getState()).toMatchObject({ user: newer, isAuthenticated: true, error: null })
})
test('signout waits for prior SDK write but immediately invalidates old signin/event results', async () => {
  await store.getState().initialize()
  const pending = deferred(); mockAuth.signInWithPassword.mockReturnValue(pending.promise)
  const signin = store.getState().signin('synthetic@example.invalid', 'synthetic'); await flush()
  const signout = store.getState().signout()
  expect(store.getState().isAuthenticated).toBe(false)
  listener('SIGNED_IN', session())
  pending.resolve({ data: { session: session(), user }, error: null })
  await Promise.all([signin, signout]); await flush()
  expect(mockAuth.signOut.mock.invocationCallOrder[0]).toBeGreaterThan(mockAuth.signInWithPassword.mock.invocationCallOrder[0])
  expect(store.getState()).toMatchObject({ isAuthenticated: false, user: null, error: null })
})
test('empty signup session preserves confirmation-email outcome without authenticating', async () => {
  mockAuth.signUp.mockResolvedValue({ data: { user, session: null }, error: null })
  await store.getState().signup({ name: 'Synthetic', email: 'synthetic@example.invalid', password: 'synthetic' })
  expect(store.getState()).toMatchObject({ user: null, isAuthenticated: false, isLoading: false, error: null })
})
test('provider user mismatch and incomplete signin cannot authenticate', async () => {
  mockAuth.signInWithPassword.mockResolvedValue({ data: { user, session: session() }, error: null })
  mockAuth.getUser.mockResolvedValue({ data: { user: { ...user, id: '22222222-2222-4222-8222-222222222222' } }, error: null })
  await expect(store.getState().signin('synthetic@example.invalid', 'synthetic')).rejects.toThrow()
  expect(store.getState().isAuthenticated).toBe(false)
  mockAuth.signInWithPassword.mockResolvedValue({ data: { user, session: null }, error: null })
  await expect(store.getState().signin('synthetic@example.invalid', 'synthetic')).rejects.toThrow()
  expect(store.getState().isAuthenticated).toBe(false)
})
test('a missing current session invalidates UI identity when requesting an access token', async () => {
  await store.getState().initialize()
  mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  expect(await store.getState().getAccessToken()).toBeNull()
  expect(store.getState()).toMatchObject({ user: null, isAuthenticated: false })
})
test('SDK signin event cannot hide a rejected provider verification from the signin action', async () => {
  await store.getState().initialize()
  mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'RAW_PRIVATE_SENTINEL' } })
  mockAuth.signInWithPassword.mockImplementation(async () => { listener('SIGNED_IN', session()); return { data: { user, session: session() }, error: null } })
  await expect(store.getState().signin('synthetic@example.invalid', 'synthetic')).rejects.toThrow()
  expect(store.getState()).toMatchObject({ user: null, isAuthenticated: false })
})
test('a newer missing-session observation invalidates earlier access-token validation', async () => {
  await store.getState().initialize()
  const earlier = deferred(); mockAuth.getUser.mockReturnValueOnce(earlier.promise)
  const oldToken = store.getState().getAccessToken(); await flush()
  mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  expect(await store.getState().getAccessToken()).toBeNull()
  earlier.resolve({ data: { user }, error: null })
  expect(await oldToken).toBeNull()
  expect(store.getState()).toMatchObject({ isAuthenticated: false, user: null })
})
