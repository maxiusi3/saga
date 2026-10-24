const mockAuth = { getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn() }
jest.mock('@/lib/supabase', () => ({ createClientSupabase: () => ({ auth: mockAuth }) }))
const userA = { id: '11111111-1111-4111-8111-111111111111' }, userB = { id: '22222222-2222-4222-8222-222222222222' }
const session = (user = userA, access_token = 'synthetic-A') => ({ user, access_token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Date.now() / 1000 + 3600 })
function deferred() { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r }); return { promise, resolve } }
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
let store: any, listener: (event: string, session: any) => void
beforeEach(async () => {
  jest.resetModules(); jest.clearAllMocks()
  mockAuth.getSession.mockResolvedValue({ data: { session: session() }, error: null })
  mockAuth.getUser.mockResolvedValue({ data: { user: userA }, error: null })
  mockAuth.signInWithPassword.mockResolvedValue({ data: { user: userA, session: session() }, error: null })
  mockAuth.signOut.mockResolvedValue({ error: null })
  mockAuth.onAuthStateChange.mockImplementation(cb => { listener = cb; return { data: { subscription: { unsubscribe() {} } } } })
  store = require('../auth-store').useAuthStore
  await store.getState().initialize()
})
test('A to B to A identity replacement never revives an earlier token read for A', async () => {
  const old = deferred(); mockAuth.getUser.mockReturnValueOnce(old.promise)
  const pending = store.getState().getAccessToken(); await flush()
  mockAuth.getUser.mockResolvedValue({ data: { user: userB }, error: null })
  listener('SIGNED_IN', session(userB, 'synthetic-B')); await flush()
  mockAuth.getUser.mockResolvedValue({ data: { user: userA }, error: null })
  listener('SIGNED_IN', session()); await flush()
  old.resolve({ data: { user: userA }, error: null })
  expect(await pending).toBeNull()
  expect(store.getState()).toMatchObject({ user: userA, isAuthenticated: true })
})
test('signout then same-user signin invalidates a token read started before signout', async () => {
  const old = deferred(); mockAuth.getSession.mockReturnValueOnce(old.promise)
  const pending = store.getState().getAccessToken()
  await store.getState().signout()
  await store.getState().signin('synthetic@example.invalid', 'synthetic')
  old.resolve({ data: { session: session() }, error: null })
  expect(await pending).toBeNull()
  expect(store.getState()).toMatchObject({ user: userA, isAuthenticated: true })
})
