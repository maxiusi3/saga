// Independent review probe; actual facade/store/SDK/dashboard + mocked display components and Auth fetch.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const ts = require('typescript'), assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const root = path.resolve(__dirname, '../../..')
const evidence = path.join(root, 'docs/research/evidence/2026-10-19-auth-session-integration/fix2/quality-event-refresh-probe.json')
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename)
const originalResolve = Module._resolveFilename
Module._resolveFilename = function(name, ...args) { return originalResolve.call(this, name.startsWith('@/') ? path.join(root, 'packages/web/src', name.slice(2)) : name, ...args) }
const dom = new JSDOM('<div id="root"></div>', { url: 'http://127.0.0.1/en/dashboard', pretendToBeVisual: true })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, BroadcastChannel: undefined, IS_REACT_ACT_ENVIRONMENT: true })
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-key'
const React = require('react'), { createRoot } = require('react-dom/client')
const router = { push() {} }, display = ({ children }) => React.createElement('div', null, children)
const originalLoad = Module._load
Module._load = function(name, ...args) {
  if (name === 'next/navigation') return { useRouter: () => router }
  if (name === 'next-intl') return { useLocale: () => 'en', useTranslations: () => key => key }
  if (name === 'next/link') return display
  if (name === '@/components/layout/navigation') return { Navigation: () => null }
  if (name === '@/components/ui') return { Button: display }
  if (name === 'lucide-react') return { BookOpen: () => null, Gem: () => null, User: () => null }
  return originalLoad.call(this, name, ...args)
}
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const session = { user, access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Date.now() / 1000 + 3600 }
const cookie = value => 'sb-127-auth-token=base64-' + Buffer.from(JSON.stringify(value)).toString('base64url')
document.cookie = cookie(session) + '; Path=/'
let blockUser = false, resolveUser, fetchCalls = [], mounts = 0, unmounts = 0
let sdk, view
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const state = store => ({ user: store.getState().user?.id || null, authenticated: store.getState().isAuthenticated, loading: store.getState().isLoading })
globalThis.fetch = async (resource, init) => {
  fetchCalls.push({ url: String(resource), method: init?.method })
  if (String(resource).endsWith('/user')) {
    if (blockUser) return new Promise(resolve => { resolveUser = () => resolve(Response.json(user)) })
    return Response.json(user)
  }
  if (String(resource).includes('/token?grant_type=refresh_token')) return Response.json({ ...session, access_token: 'synthetic-refreshed-access', refresh_token: 'synthetic-refreshed-refresh', expires_at: Date.now() / 1000 + 3600 })
  throw new Error('Probe rejected unexpected fetch')
}
async function main() {
  sdk = require(path.join(root, 'packages/web/src/lib/supabase.ts')).createClientSupabase()
  const store = require(path.join(root, 'packages/web/src/stores/auth-store.ts')).useAuthStore
  await store.getState().initialize(); await wait(20)
  assert.equal(store.getState().isAuthenticated, true)
  const Layout = require(path.join(root, 'packages/web/src/app/[locale]/dashboard/layout.tsx')).default
  function StatefulChild() { React.useEffect(() => { mounts++; return () => { unmounts++ } }, []); return React.createElement('div', { id: 'stateful-child' }, 'synthetic unsaved state') }
  view = createRoot(document.getElementById('root'))
  await React.act(async () => view.render(React.createElement(Layout, null, React.createElement(StatefulChild))))
  const before = { ...state(store), mounts, unmounts, childPresent: !!document.getElementById('stateful-child') }
  blockUser = true
  // Installed SDK's public browser event handler performs real recovery and emits SIGNED_IN.
  await React.act(async () => { window.dispatchEvent(new window.Event('visibilitychange')); await wait(30) })
  assert.ok(resolveUser, 'same-session visibility recovery should request provider confirmation')
  const during = { ...state(store), mounts, unmounts, childPresent: !!document.getElementById('stateful-child') }
  blockUser = false
  await React.act(async () => { resolveUser(); await wait(20) })
  const after = { ...state(store), mounts, unmounts, childPresent: !!document.getElementById('stateful-child') }
  // A normal SDK refresh inside the public token getter also causes its generation check to fail.
  document.cookie = cookie({ ...session, expires_at: 1 }) + '; Path=/'
  let refreshedToken
  await React.act(async () => { refreshedToken = await store.getState().getAccessToken(); await wait(20) })
  const tokenRefresh = { returnedToken: refreshedToken, sdkSessionToken: (await sdk.auth.getSession()).data.session?.access_token, ...state(store) }
  const result = { qualification: 'Actual installed SDK, production browser facade/store/dashboard render, synthetic child lifecycle; mocked display components and Auth fetch, no network or real recording', before, during, after, tokenRefresh, fetchCalls }
  fs.writeFileSync(evidence, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { if (view) await React.act(async () => view.unmount()); if (sdk) await sdk.auth.stopAutoRefresh(); dom.window.close() })
