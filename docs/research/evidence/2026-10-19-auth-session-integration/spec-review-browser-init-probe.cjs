// Reviewer-only synthetic probe: no network, application source is unchanged.
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const root = path.resolve(__dirname, '../../..')
const dom = new JSDOM('', { url: 'http://127.0.0.1:54321/en' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage })
globalThis.BroadcastChannel = undefined
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-key'
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename)
const user = { id: '11111111-1111-4111-8111-111111111111' }
const session = { user, access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 1 }
document.cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}; Path=/`
const requests = [], messages = []
globalThis.fetch = async (resource, init) => {
  requests.push({ url: String(resource), method: init?.method })
  return Response.json({ msg: 'SYNTHETIC_PRIVATE_PROVIDER_SENTINEL', code: 'refresh_token_not_found' }, { status: 401, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
}
const oldError = console.error
console.error = (...args) => messages.push(args.map(value => value instanceof Error ? `${value.name}: ${value.message}` : String(value)).join(' '))
async function main() {
  const client = require(path.join(root, 'packages/web/src/lib/supabase.ts')).createClientSupabase()
  await client.auth.initialize()
  await client.auth.stopAutoRefresh()
  dom.window.close()
  console.error = oldError
  process.stdout.write(JSON.stringify({ qualification: 'Actual browser facade and installed SDK with synthetic expired cookie and mocked fetch; no network', requests, messages, rawSentinelLogged: messages.some(value => value.includes('SYNTHETIC_PRIVATE_PROVIDER_SENTINEL')) }, null, 2) + '\n')
}
main().catch(error => { console.error = oldError; oldError(error); process.exitCode = 1; dom.window.close() })
