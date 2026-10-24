#!/usr/bin/env node
// Local synthetic bridge: actual project browser facade/store + callback/guard.
// This is not a deployed Next app, live OAuth/SMTP, or JWT/RLS verification.
process.env.NEXT_TELEMETRY_DISABLED = '1'
process.env.DO_NOT_TRACK = '1'
const fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const assert = require('node:assert/strict'), Module = require('node:module')
const { createHash } = require('node:crypto')
const webpack = require('webpack'), ts = require('typescript')
const { chromium } = require('playwright')
const { startSessionFixture, user, sessionName, verifierName } = require('./test-support/auth-session-fixture.cjs')
const root = path.resolve(__dirname, '..')
const evidence = path.resolve(process.argv[2] || path.join(root, 'docs/research/evidence/2026-10-19-auth-session-integration'))
const sources = ['packages/web/src/lib/supabase.ts', 'packages/web/src/stores/auth-store.ts', 'packages/web/src/lib/server/auth.ts', 'packages/web/src/lib/server/auth-callback.ts', 'packages/web/src/lib/auth-return.ts', 'scripts/verify-auth-session-browser.cjs', 'scripts/test-support/auth-session-fixture.cjs']
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const nextEnv = path.join(root, 'packages/web/next-env.d.ts'), nextBefore = fs.readFileSync(nextEnv)
const savedEnv = { ...process.env }, checks = [], blocked = [], consoleMessages = [], callbackReplies = []
let fixture, browser, compiler, temp
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`) }
const bridge = async (request, response, origin) => {
  const { NextRequest } = require('next/server')
  const url = new URL(request.url, origin)
  if (url.pathname.endsWith('/auth/callback')) {
    const result = await require('../packages/web/src/lib/server/auth-callback.ts').handleAuthCallback(new NextRequest(url, { headers: request.headers }))
    response.statusCode = result.status
    for (const [name, value] of result.headers) if (name.toLowerCase() !== 'set-cookie') response.setHeader(name, value)
    response.setHeader('Set-Cookie', result.headers.getSetCookie())
    callbackReplies.push({ status: result.status, location: result.headers.get('location'), cookieNames: result.cookies.getAll().map(cookie => ({ name: cookie.name, deleted: cookie.maxAge === 0 })) })
    return response.end(await result.text())
  }
  if (url.pathname === '/__guard') {
    const result = await require('../packages/web/src/lib/server/auth.ts').getAuthenticatedUser(new NextRequest(url, { headers: request.headers }))
    response.statusCode = result.ok ? 200 : result.response.status
    const headers = result.ok ? result.headers : result.response.headers
    if (headers.getSetCookie().length) response.setHeader('Set-Cookie', headers.getSetCookie())
    response.setHeader('Content-Type', 'application/json')
    return response.end(JSON.stringify(result.ok ? { user: result.user.id } : { error: 'Unauthenticated' }))
  }
  if (url.pathname === '/bundle.js') { response.setHeader('Content-Type', 'application/javascript'); return response.end(fs.readFileSync(path.join(temp, 'bundle.js'))) }
  response.setHeader('Content-Type', 'text/html')
  response.end('<!doctype html><meta charset="utf-8"><title>Synthetic session bridge</title><h1>Synthetic session bridge</h1><p>Actual facade/store; local callback/guard. Not deployed Next or live OAuth.</p><pre id="state">initializing</pre><script src="/bundle.js"></script>')
}
async function main() {
  fs.mkdirSync(evidence, { recursive: true }); temp = fs.mkdtempSync(path.join(os.tmpdir(), 'saga-auth-session-'))
  // Require actual TS modules in this owned Node process, without changing source.
  const originalResolve = Module._resolveFilename
  Module._resolveFilename = function(name, ...args) { return originalResolve.call(this, name.startsWith('@/') ? path.join(root, 'packages/web/src', name.slice(2)) : name, ...args) }
  require.extensions['.ts'] = function(module, filename) { module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename) }
  // NextRequest standalone normalizes 127.0.0.1 to localhost. Preserve this
  // bridge's actual loopback origin so host-only browser cookies stay coherent.
  process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE = '1'
  fixture = await startSessionFixture(bridge)
  process.env.NEXT_PUBLIC_SUPABASE_URL = fixture.origin
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-key'
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  const entry = path.join(temp, 'entry.ts')
  fs.writeFileSync(entry, `import { createClientSupabase } from ${JSON.stringify(path.join(root, 'packages/web/src/lib/supabase.ts'))};\nimport { useAuthStore } from ${JSON.stringify(path.join(root, 'packages/web/src/stores/auth-store.ts'))};\nconst client = createClientSupabase(); window.harness = { client, store: useAuthStore };\nconst show = () => {const { user, isAuthenticated, isLoading, error } = useAuthStore.getState(); document.getElementById('state').textContent = JSON.stringify({ user: user?.id || null, isAuthenticated, isLoading, error }, null, 2)}; useAuthStore.subscribe(show); show(); window.ready = useAuthStore.getState().initialize();\n`)
  compiler = webpack({ mode: 'development', target: 'web', devtool: false, entry, output: { path: temp, filename: 'bundle.js' }, resolve: { extensions: ['.ts', '.tsx', '.js'], modules: [path.join(root, 'node_modules')], alias: { '@': path.join(root, 'packages/web/src') } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(root, 'scripts/test-support/auth-session-ts-loader.cjs') }] }, plugins: [new webpack.DefinePlugin({ 'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(fixture.origin), 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify('synthetic-public-key') })] })
  await new Promise((resolve, reject) => compiler.run((err, stats) => { if (err || stats.hasErrors()) reject(err || new Error(stats.toString({ all: false, errors: true }))); else resolve() }))
  await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve())); compiler = null
  browser = await chromium.launch({ headless: true, args: ['--disable-background-networking', '--disable-component-update', '--disable-sync'] })
  const context = await browser.newContext({ serviceWorkers: 'block' })
  await context.route('**/*', route => { if (new URL(route.request().url()).origin === fixture.origin) return route.continue(); blocked.push(route.request().url()); console.log('BLOCKED', route.request().url()); return route.abort('blockedbyclient') })
  const page = await context.newPage()
  page.on('console', msg => { if (msg.type() === 'warning' || msg.type() === 'error') { consoleMessages.push({ type: msg.type(), text: msg.text() }); console.log(`BROWSER ${msg.type()}: ${msg.text()}`) } })
  await page.goto(`${fixture.origin}/en/auth/signin?error=synthetic#access_token=synthetic&refresh_token=synthetic`)
  await page.waitForFunction(() => !!window.harness && !!window.ready)
  await page.evaluate(() => window.ready)
  check('mixed error/token URL caused no SDK exchange/session write', fixture.captured.length === 0 && !(await context.cookies()).some(cookie => cookie.name === sessionName))
  await page.evaluate(() => history.replaceState(null, '', '/en/auth/signin'))
  const oauth = await page.evaluate(async () => {
    const client = window.harness.client
    const result = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/en/auth/callback?next=%2Ffr%2Fdashboard`, skipBrowserRedirect: true } })
    return { url: result.data.url, singleton: client === window.harness.client, cookie: document.cookie }
  })
  const authorize = new URL(oauth.url)
  check('OAuth uses S256 and writes browser verifier cookie', authorize.searchParams.get('code_challenge_method') === 's256' && oauth.cookie.includes(`${verifierName}=`))
  await page.goto(oauth.url)
  await page.waitForFunction(() => !!window.harness && !!window.ready)
  await page.evaluate(() => window.ready)
  check('real navigation passes provider/callback 303 to safe locale target', new URL(page.url()).pathname === '/fr/dashboard' && callbackReplies.at(-1).status === 303)
  const restored = await page.evaluate(async () => { const { data } = await window.harness.client.auth.getSession(); return { session: data.session, store: { user: window.harness.store.getState().user?.id, authenticated: window.harness.store.getState().isAuthenticated }, cookies: document.cookie } })
  check('fresh browser bundle restores provider-verified store identity', restored.store.authenticated && restored.store.user === user.id && restored.session.user.id === user.id)
  check('callback consumed the S256 verifier and exchanged code only once', fixture.captured.filter(call => call.path.includes('grant_type=pkce')).length === 1 && !(await context.cookies()).some(cookie => cookie.name === verifierName))
  const guard = await page.evaluate(async token => ({ cookie: await (await fetch('/__guard')).json(), bearer: await (await fetch('/__guard', { headers: { Authorization: `Bearer ${token}` } })).json(), invalid: (await fetch('/__guard', { headers: { Authorization: 'Bearer forged' } })).status }), restored.session.access_token)
  check('SSR cookie and public Bearer agree; invalid Bearer cannot fall back', guard.cookie.user === user.id && guard.bearer.user === user.id && guard.invalid === 401)
  await page.screenshot({ path: path.join(evidence, 'browser-session.png'), fullPage: true })
  await page.evaluate(() => window.harness.store.getState().signout())
  check('browser signout removes shared session and next SSR request is rejected', await page.evaluate(async () => (await fetch('/__guard')).status === 401 && (await window.harness.client.auth.getSession()).data.session === null))
  await page.evaluate(async () => { const result = await window.harness.client.auth.signInWithOtp({ email: 'synthetic@example.invalid', options: { emailRedirectTo: `${location.origin}/en/auth/callback?next=%2Fja%2Fdashboard` } }); if (result.error) throw result.error })
  check('mail request carries PKCE S256 challenge and browser verifier', fixture.captured.at(-1).body.code_challenge_method === 's256' && (await context.cookies()).some(cookie => cookie.name === verifierName))
  await page.goto(`${fixture.origin}/en/auth/callback?code=${fixture.emailCode()}&next=%2Fja%2Fdashboard`)
  await page.waitForFunction(() => !!window.harness && !!window.ready)
  await page.evaluate(() => window.ready)
  check('email code return restores same verified browser/SSR session', new URL(page.url()).pathname === '/ja/dashboard' && await page.evaluate(async () => (await (await fetch('/__guard')).json()).user === window.harness.store.getState().user?.id))
  await page.evaluate(() => window.harness.store.getState().signout())
  await page.goto(`${fixture.origin}/en/auth/callback?token_hash=synthetic-token-hash&type=magiclink&next=%2Fpt%2Fdashboard`)
  await page.waitForFunction(() => !!window.harness && !!window.ready)
  await page.evaluate(() => window.ready)
  check('token_hash return writes cookies restored by browser store', new URL(page.url()).pathname === '/pt/dashboard' && await page.evaluate(() => window.harness.store.getState().isAuthenticated))
  await page.evaluate(() => window.harness.store.getState().signout())
  await page.evaluate(async () => { const result = await window.harness.client.auth.verifyOtp({ email: 'synthetic@example.invalid', token: '123456', type: 'email' }); if (result.error) throw result.error })
  await page.waitForFunction(() => window.harness.store.getState().isAuthenticated)
  check('numeric OTP writes cookies used by provider-verified browser store and SSR', await page.evaluate(async () => (await (await fetch('/__guard')).json()).user === window.harness.store.getState().user?.id))
  await page.evaluate(() => window.harness.store.getState().signout())
  const beforeInvalid = fixture.captured.length
  await page.goto(`${fixture.origin}/en/auth/callback?code=synthetic-missing-verifier`)
  await page.waitForFunction(() => !!window.harness && !!window.ready)
  await page.evaluate(() => window.ready)
  check('missing verifier fails privately without provider exchange', new URL(page.url()).searchParams.get('error') === 'auth_failed' && fixture.captured.length === beforeInvalid)
  await page.goto(`${fixture.origin}/en/auth/callback?code=synthetic&error=synthetic`)
  await page.waitForFunction(() => !!window.harness && !!window.ready)
  await page.evaluate(() => window.ready)
  check('mixed callback is rejected with no exchange', new URL(page.url()).searchParams.get('error') === 'auth_failed' && fixture.captured.length === beforeInvalid)
  check('page network remained loopback-only', blocked.length === 0)
  const output = { qualification: 'Synthetic bridge with actual browser SDK/store, callback and guard; not production Next, live Google/SMTP, JWT signature or RLS validation', checks: checks.length, names: checks, browser: await browser.version(), blockedRequests: blocked, consoleMessages, callbackReplies, capturedSyntheticAuthRequests: fixture.captured, sourceHashes: Object.fromEntries(sources.map(file => [file, hash(fs.readFileSync(path.join(root, file)))])), nextEnvBefore: hash(nextBefore) }
  fs.writeFileSync(path.join(evidence, 'browser-results.json'), JSON.stringify(output, null, 2) + '\n')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  if (compiler) await new Promise(resolve => compiler.close(resolve))
  if (browser) await browser.close()
  const cleanup = fixture ? await fixture.close() : null
  if (temp) fs.rmSync(temp, { recursive: true, force: true })
  const unchanged = fs.readFileSync(nextEnv).equals(nextBefore)
  if (!unchanged) fs.writeFileSync(nextEnv, nextBefore)
  process.env = savedEnv
  const result = { cleanup, ownedBrowserClosed: !!browser && !browser.isConnected(), ownedTempRemoved: !!temp && !fs.existsSync(temp), nextEnvUnchanged: unchanged, nextEnvRestoredHash: hash(fs.readFileSync(nextEnv)) }
  console.log(JSON.stringify(result))
  fs.writeFileSync(path.join(evidence, 'browser-cleanup.json'), JSON.stringify(result, null, 2) + '\n')
})
