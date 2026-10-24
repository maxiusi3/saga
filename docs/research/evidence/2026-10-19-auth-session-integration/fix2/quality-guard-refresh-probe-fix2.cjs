// Reviewer-only: actual guard and installed SSR SDK, mock Auth transport; no network.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript')
const root = path.resolve(__dirname, '../../..')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename)
const originalResolve = Module._resolveFilename
Module._resolveFilename = function(name, ...args) { return originalResolve.call(this, name.startsWith('@/') ? path.join(root, 'packages/web/src', name.slice(2)) : name, ...args) }
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-key'
const { NextRequest } = require('next/server')
const { getAuthenticatedUser } = require(path.join(root, 'packages/web/src/lib/server/auth.ts'))
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const session = { user, access_token: 'synthetic-access', refresh_token: 'synthetic-valid-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 1 }
const cookie = 'sb-127-auth-token=base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
const request = () => new NextRequest('http://localhost/api/synthetic', { headers: { cookie } })
async function main() {
  const results = []
  for (const mode of ['503', '429', 'fetch-rejection', 'recovered-provider']) {
    const captured = []
    globalThis.fetch = async (resource, init) => {
      captured.push({ url: String(resource), method: init?.method })
      if (mode === 'fetch-rejection') throw new Error('SYNTHETIC_TRANSPORT_FAILURE')
      if (mode !== 'recovered-provider') return Response.json({ msg: 'SYNTHETIC_TEMPORARY_FAILURE' }, { status: Number(mode) })
      if (String(resource).includes('/token?grant_type=refresh_token')) return Response.json({ ...session, access_token: 'synthetic-refreshed-access', refresh_token: 'synthetic-refreshed-refresh', expires_at: Date.now() / 1000 + 3600 })
      return Response.json(user)
    }
    const result = await getAuthenticatedUser(request())
    const headers = result.ok ? result.headers : result.response.headers
    results.push({ mode, status: result.ok ? 200 : result.response.status, cookies: headers.getSetCookie(), captured })
  }
  const report = { qualification: 'Actual server guard and installed SSR/Auth SDK; complete expired synthetic cookie; fully mocked fetch, no network or provider revocation', results }
  fs.writeFileSync(path.join(root, 'docs/research/evidence/2026-10-19-auth-session-integration/fix2/quality-guard-refresh-probe.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
