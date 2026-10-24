// Run from the repository root after npm run verify.
// Synthetic images and unauthenticated localhost requests only.
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const fs = require('node:fs')
const { createRequire } = require('node:module')
const net = require('node:net')
const path = require('node:path')

const root = path.resolve(__dirname, '../../../..')
const webRequire = createRequire(path.join(root, 'packages/web/package.json'))
const sharp = webRequire('sharp')
const { chromium } = webRequire('playwright')
const checks = []
const record = (name) => checks.push(name)
let server
let browser
let browserVersion
let serverClosed

async function main() {
  const source = await sharp({ create: {
    width: 640, height: 480, channels: 4,
    background: { r: 100, g: 150, b: 200, alpha: 1 },
  } }).png().toBuffer()
  assert.equal((await sharp(source).metadata()).format, 'png')
  record('synthetic PNG metadata')

  for (const format of ['jpeg', 'png', 'gif', 'webp']) {
    const input = await sharp(source).toFormat(format).toBuffer()
    const outputFormat = format === 'gif' ? 'png' : format
    const thumbnail = await sharp(input)
      .resize({ width: 320, height: 320, fit: 'cover' })
      .toFormat(outputFormat, outputFormat === 'png' ? { compressionLevel: 9 } : { quality: 75 })
      .toBuffer()
    const metadata = await sharp(thumbnail).metadata()
    assert.equal(metadata.format, outputFormat)
    assert.equal(metadata.width, 320)
    assert.equal(metadata.height, 320)
    const decoded = await sharp(thumbnail).raw().toBuffer({ resolveWithObject: true })
    assert.equal(decoded.data.length, 320 * 320 * decoded.info.channels)
    record(`${format} input → ${outputFormat} thumbnail and pixel decode`)
  }
  await assert.rejects(sharp(Buffer.from('not an image')).toBuffer())
  record('corrupt image rejected')

  const reservation = net.createServer()
  reservation.listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise((resolve) => reservation.close(resolve))
  const base = `http://127.0.0.1:${port}`
  server = spawn(process.execPath, [webRequire.resolve('next/dist/bin/next'),
    'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: path.join(root, 'packages/web'),
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', MEDIA_ASSETS_ENABLED: 'false' },
    stdio: 'ignore',
  })
  serverClosed = new Promise((resolve, reject) => {
    server.once('close', resolve)
    server.once('error', reject)
  })
  // Handle an early spawn error even before the final cleanup awaits it.
  serverClosed.catch(() => {})
  const deadline = Date.now() + 30_000
  while (true) {
    try {
      const ready = await fetch(`${base}/api/ai/health`, { signal: AbortSignal.timeout(1000) })
      if (ready.ok) break
    } catch {}
    assert.ok(server.exitCode === null, 'Next server exited before readiness')
    assert.ok(Date.now() < deadline, 'Next server startup timed out')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  for (const route of ['/en', '/zh-CN', '/zh-TW', '/en/auth/signin']) {
    const res = await fetch(base + route, { signal: AbortSignal.timeout(15_000) })
    assert.equal(res.status, 200, route)
    assert.match(res.headers.get('content-type'), /text\/html/)
    assert.match(await res.text(), /<html/)
    record(`HTTP ${route}`)
  }
  const redirect = await fetch(base, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
  assert.ok([307, 308].includes(redirect.status))
  assert.equal(new URL(redirect.headers.get('location'), base).pathname, '/en')
  record('default locale redirect')
  const health = await fetch(`${base}/api/ai/health`, { signal: AbortSignal.timeout(5000) })
  assert.equal(health.headers.get('cache-control'), 'no-store')
  const body = await health.json()
  assert.ok(['configured', 'unavailable'].includes(body.mode))
  assert.equal(typeof body.services.transcription, 'boolean')
  assert.equal(typeof body.services.content_generation, 'boolean')
  record('health reports configuration without caching or provider probes')
  const assets = await fetch(`${base}/api/media/assets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(5000),
  })
  assert.equal(assets.status, 401)
  record('unauthenticated asset creation denied before feature/storage access')

  browser = await chromium.launch({ headless: true })
  browserVersion = browser.version()
  const page = await browser.newPage()
  // Keep the browser smoke local, including analytics and auth calls.
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    return url.origin === base ? route.continue() : route.abort()
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const route of ['/en', '/zh-CN', '/zh-TW', '/en/auth/signin']) {
    await page.goto(base + route, { waitUntil: 'networkidle' })
    assert.ok((await page.locator('body').innerText()).trim().length > 100, route)
    const styles = await page.evaluate(() => {
      // Next splits styles into multiple chunks; the first is not the whole app.
      const sheets = [...document.styleSheets].filter((item) => item.href?.includes('/_next/'))
      return { rules: sheets.reduce((total, sheet) => total + sheet.cssRules.length, 0), assets: sheets.length }
    })
    assert.ok(styles.rules > 100, `${route}: compiled styles loaded ${JSON.stringify(styles)}`)
    record(`Chromium ${route}: render, hydration and CSS`)
  }
  assert.deepEqual(errors, [], 'browser runtime errors')
  record('no browser page errors')
}

async function run() {
  const resultPath = path.join(__dirname, 'runtime-smoke.json')
  fs.writeFileSync(resultPath, JSON.stringify({ status: 'running' }) + '\n')
  let failure
  try {
    await main()
  } catch (error) {
    failure = error
  } finally {
    try {
      if (browser) await browser.close()
    } catch (error) {
      failure ??= error
    } finally {
      if (server && server.exitCode === null) server.kill('SIGTERM')
      if (serverClosed) {
        const timer = setTimeout(() => server.kill('SIGKILL'), 5000)
        try { await serverClosed } catch (error) { failure ??= error } finally { clearTimeout(timer) }
      }
    }
  }
  fs.writeFileSync(resultPath, JSON.stringify({
    status: failure ? 'failed' : 'passed', checkedAt: new Date().toISOString(),
    node: process.version, next: webRequire('next/package.json').version,
    sharp: sharp.versions, checks,
    browserVersion,
    error: failure?.message,
    boundary: 'Local production build, synthetic image buffers, unauthenticated HTTP, external browser requests blocked. No remote Storage, provider, or G1 device validation.',
  }, null, 2) + '\n')
  if (failure) throw failure
  console.log(`Runtime smoke: ${checks.length} checks passed`)
}

run().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
