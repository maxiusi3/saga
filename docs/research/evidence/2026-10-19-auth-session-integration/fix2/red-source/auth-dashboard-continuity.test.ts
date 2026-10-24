/** @jest-environment node */
// Actual facade/store/Auth SDK and DashboardLayout; only display dependencies and
// provider HTTP are controlled. No manual invocation of an auth listener.
const { JSDOM } = require('jsdom')
const savedEnv = { ...process.env }
const savedGlobals = { window: (globalThis as any).window, document: (globalThis as any).document, localStorage: (globalThis as any).localStorage, BroadcastChannel: globalThis.BroadcastChannel, fetch: globalThis.fetch, IS_REACT_ACT_ENVIRONMENT: (globalThis as any).IS_REACT_ACT_ENVIRONMENT }
const mockRouter = { push: jest.fn() }
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }))
jest.mock('next/link', () => ({ children }: any) => children)
jest.mock('@/components/layout/navigation', () => ({ Navigation: () => null }))
jest.mock('@/components/ui', () => ({ Button: ({ children }: any) => children }))
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const otherUser = { ...user, id: '22222222-2222-4222-8222-222222222222' }
const session = (currentUser = user, token = 'synthetic-access') => ({ user: currentUser, access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Date.now() / 1000 + 3600 })
function deferred() { let resolve!: (value?: any) => void; const promise = new Promise<any>(r => { resolve = r }); return { promise, resolve } }
let dom: any, React: any, view: any, sdk: any, store: any, mounts: number, unmounts: number, blocked: boolean, started: ReturnType<typeof deferred>, provider: ReturnType<typeof deferred>
const cookie = (value: any) => { document.cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(value)).toString('base64url')}; Path=/` }
const child = () => document.getElementById('stateful-child')
beforeEach(async () => {
  jest.resetModules(); jest.clearAllMocks(); mounts = 0; unmounts = 0; blocked = false; started = deferred(); provider = deferred()
  dom = new JSDOM('<div id="root"></div>', { url: 'http://127.0.0.1/en/dashboard', pretendToBeVisual: true })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, BroadcastChannel: undefined, IS_REACT_ACT_ENVIRONMENT: true })
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-key'
  cookie(session())
  globalThis.fetch = jest.fn(async resource => {
    const url = String(resource)
    if (url.endsWith('/user')) { if (blocked) { started.resolve(); return provider.promise } return Response.json(user) }
    if (url.endsWith('/token?grant_type=refresh_token')) return Response.json(session(user, 'synthetic-refreshed-access'))
    if (url.endsWith('/token?grant_type=password')) return Response.json(session(otherUser, 'synthetic-other-access'))
    throw new Error('Unexpected synthetic request')
  })
  React = require('react')
  sdk = require('@/lib/supabase').createClientSupabase()
  store = require('@/stores/auth-store').useAuthStore
  await store.getState().initialize()
  expect(store.getState().isAuthenticated).toBe(true)
  const Layout = require('@/app/[locale]/dashboard/layout').default
  function StatefulChild() { React.useEffect(() => { mounts++; return () => { unmounts++ } }, []); return React.createElement('div', { id: 'stateful-child' }, 'synthetic unsaved state') }
  view = require('react-dom/client').createRoot(document.getElementById('root'))
  await React.act(async () => view.render(React.createElement(Layout, null, React.createElement(StatefulChild))))
})
afterEach(async () => {
  // Release any held provider request even when a RED assertion fails.
  blocked = false; provider.resolve(Response.json(user))
  await React.act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); view.unmount() })
  await sdk.auth.stopAutoRefresh(); dom.window.close(); Object.assign(globalThis, savedGlobals); process.env = { ...savedEnv }
})
test('same-session SDK visibility SIGNED_IN preserves mounted dashboard work during and after verification', async () => {
  const original = child(); blocked = true
  await React.act(async () => { window.dispatchEvent(new window.Event('visibilitychange')); await started.promise })
  expect(child()).toBe(original); expect({ mounts, unmounts }).toEqual({ mounts: 1, unmounts: 0 })
  expect(store.getState()).toMatchObject({ user, isAuthenticated: true, isLoading: false })
  await React.act(async () => { blocked = false; provider.resolve(Response.json(user)); await new Promise(resolve => setTimeout(resolve, 0)) })
  expect(child()).toBe(original); expect({ mounts, unmounts }).toEqual({ mounts: 1, unmounts: 0 })
})
test('successful SDK refresh inside concurrent token reads returns verified fresh tokens without unmounting', async () => {
  const original = child(); cookie({ ...session(), expires_at: 1 }); blocked = true
  let pending!: Promise<any>, settled = false
  await React.act(async () => { pending = Promise.all([store.getState().getAccessToken(), store.getState().getAccessToken()]).then(result => { settled = true; return result }); await started.promise })
  expect(child()).toBe(original); expect({ mounts, unmounts }).toEqual({ mounts: 1, unmounts: 0 }); expect(settled).toBe(false)
  let values
  await React.act(async () => { blocked = false; provider.resolve(Response.json(user)); values = await pending })
  expect(values).toEqual(['synthetic-refreshed-access', 'synthetic-refreshed-access'])
  expect((await sdk.auth.getSession()).data.session.access_token).toBe('synthetic-refreshed-access')
  expect(child()).toBe(original); expect({ mounts, unmounts }).toEqual({ mounts: 1, unmounts: 0 })
})
test('same-user revalidation rejection removes the authenticated dashboard after confirmation fails', async () => {
  blocked = true
  await React.act(async () => { window.dispatchEvent(new window.Event('visibilitychange')); await started.promise })
  await React.act(async () => { provider.resolve(Response.json({ msg: 'synthetic rejection' }, { status: 401 })); await new Promise(resolve => setTimeout(resolve, 0)) })
  expect(child()).toBeNull(); expect(unmounts).toBe(1)
  expect(store.getState()).toMatchObject({ user: null, isAuthenticated: false })
})
test('new-user SDK signin does not retain old dashboard while provider verification is pending', async () => {
  blocked = true
  await React.act(async () => { await sdk.auth.signInWithPassword({ email: 'synthetic@example.invalid', password: 'synthetic' }); await started.promise })
  expect(child()).toBeNull(); expect(store.getState()).toMatchObject({ user: null, isAuthenticated: false })
  await React.act(async () => { provider.resolve(Response.json(otherUser)); await new Promise(resolve => setTimeout(resolve, 0)) })
  expect(store.getState()).toMatchObject({ user: otherUser, isAuthenticated: true })
  expect({ mounts, unmounts }).toEqual({ mounts: 2, unmounts: 1 })
})
