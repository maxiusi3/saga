// Reviewer-only synthetic probe: production store, fake auth, no network.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '../../..')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename)
const originalResolve = Module._resolveFilename
Module._resolveFilename = function(name, ...args) { return originalResolve.call(this, name.startsWith('@/') ? path.join(root, 'packages/web/src', name.slice(2)) : name, ...args) }
const user = { id: '11111111-1111-4111-8111-111111111111' }
const session = { user, access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Date.now() / 1000 + 3600 }
const auth = {
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  getSession: async () => ({ data: { session }, error: null }),
  getUser: async () => ({ data: { user }, error: null }),
}
const originalLoad = Module._load
Module._load = function(name, ...args) { return name === '@/lib/supabase' ? { createClientSupabase: () => ({ auth }) } : originalLoad.call(this, name, ...args) }
async function main() {
  const store = require(path.join(root, 'packages/web/src/stores/auth-store.ts')).useAuthStore
  await store.getState().initialize()
  const tokens = await Promise.all([store.getState().getAccessToken(), store.getState().getAccessToken()])
  process.stdout.write(JSON.stringify({ qualification: 'Actual store with complete provider-confirmed synthetic session and mocked auth; no network, signout or identity change', concurrentResults: tokens, authenticated: store.getState().isAuthenticated, user: store.getState().user.id }, null, 2) + '\n')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
