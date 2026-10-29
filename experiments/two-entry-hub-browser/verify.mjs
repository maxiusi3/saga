import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..')
const require = createRequire(join(root, 'package.json'))
const webpack = require('webpack'), { chromium, expect } = require('@playwright/test'), JSZip = require('jszip')
const sha = data => createHash('sha256').update(data).digest('hex')
const evidence = join(root, 'docs/research/evidence/2026-10-29-two-entry-integration')
await mkdir(evidence, { recursive: true })
const scratch = await mkdtemp(join(tmpdir(), 'saga-hub-browser-'))
const runId = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`
const report = { status: 'running', scope: 'Real React hub/client adapter in Chromium with synthetic auth, Link, Storage and local HTTP fixtures; not real device, Supabase or Next server E2E', checks: [], sources: {}, externalRequests: [] }
let browser, server
try {
  const compiler = webpack({
    mode: 'development', devtool: false, context: root,
    entry: join(here, 'entry.tsx'), output: { path: scratch, filename: 'hub.js' },
    resolve: { extensions: ['.tsx', '.ts', '.js'], alias: {
      'next/link$': join(here, 'boundaries.tsx'), '@/stores/auth-store$': join(here, 'boundaries.tsx'),
      '@/lib/supabase$': join(here, 'boundaries.tsx'), '@': join(root, 'packages/web/src'),
    } },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: join(here, 'typescript-loader.cjs') }] },
  })
  await new Promise((done, fail) => compiler.run((error, stats) => {
    compiler.close(closeError => {
      if (error || closeError || stats.hasErrors()) fail(error || closeError || new Error(stats.toString({ all: false, errors: true })))
      else done()
    })
  }))
  const cssDir = join(root, 'packages/web/.next/static/css')
  const css = (await Promise.all((await readdir(cssDir)).filter(f => f.endsWith('.css')).map(f => readFile(join(cssDir, f), 'utf8')))).join('\n')
  report.buildStylesSha256 = sha(css)
  const bundle = await readFile(join(scratch, 'hub.js'))
  const wav = Buffer.alloc(44 + 8000 * 2 * 6)
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
  const zip = await new JSZip().file('synthetic.txt', 'Browser download fixture only').generateAsync({ type: 'nodebuffer' })
  let failSearch = false, uploadedBytes = 0
  const asset = { id: 'asset-browser', project_id: 'project-browser', state: 'pending_upload', bucket: 'audio-recordings', object_key: 'user/projects/project-browser/assets/asset-browser/original' }
  server = createServer(async (req, res) => {
    try {
      const path = req.url.split('?')[0]
      const reply = (status, type, body) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body) }
      const json = (status, value) => reply(status, 'application/json', JSON.stringify(value))
      if (path === '/hub.js') return reply(200, 'text/javascript', bundle)
      if (path === '/style.css') return reply(200, 'text/css', css)
      if (path === '/audio.wav') return reply(200, 'audio/wav', wav)
      if (path === '/fixture-upload') {
        let bytes = 0
        for await (const chunk of req) { bytes += chunk.length; if (bytes > 1024 * 1024) throw new Error('Fixture upload too large') }
        uploadedBytes = bytes
        return json(200, { ok: true })
      }
      if (path.startsWith('/api/')) {
        if (req.headers.authorization !== 'Bearer synthetic-browser-session') return json(401, { error: 'Fixture authentication required' })
        if (path.endsWith('/search')) return failSearch ? json(503, { error: 'Fixture unavailable' }) : json(200, {
          status: 'grounded_answer', answerText: 'One synthetic source', citations: [{ entryId: 'entry-browser', storyId: 'story-browser', storyTitle: 'The cedar boat',
            transcriptVersionId: 'transcript-browser', segmentId: 'segment-browser', mediaAssetId: asset.id, startMs: 2000, endMs: 4500,
            quotedText: 'A fictional narrator tested a cedar boat.', matchedPeople: [], matchedDates: [], matchedPlaces: [], score: 1 }],
        })
        if (path.endsWith('/access')) return json(200, { signedUrl: `http://127.0.0.1:${server.address().port}/audio.wav` })
        if (path.endsWith('/export')) return reply(200, 'application/zip', zip)
        if (path.endsWith('/complete')) return json(202, { asset: { ...asset, state: 'verifying' } })
        if (path === '/api/media/assets') return json(200, { asset, upload: { token: 'synthetic-upload-token' } })
        return json(404, { error: 'Unknown fixture route' })
      }
      reply(200, 'text/html', '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/hub.js"></script></body></html>')
    } catch { res.writeHead(500); res.end('Fixture failed') }
  })
  await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done) })
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true })
  report.browserVersion = browser.version()
  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true })
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin !== origin) { report.externalRequests.push(new URL(route.request().url()).origin); return route.abort() }
      return route.continue()
    })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    failSearch = false
    await page.goto(origin)
    await expect(page.getByTestId('two-entry-project-hub')).toBeVisible()
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow')
    assert(await page.getByTestId('provenance-search-submit-btn').evaluate(button => {
      const box = button.getBoundingClientRect(), form = button.closest('form').getBoundingClientRect()
      return box.right <= form.right + 1 && box.left >= form.left - 1
    }), 'Search action stays inside its form on narrow screens')
    report.checks.push({ width, check: 'render_without_horizontal_overflow', status: 'passed' })
    await page.getByTestId('entry-record-or-invite-btn').click()
    await expect(page.getByRole('link', { name: 'Record a new story' })).toHaveAttribute('href', '/en/dashboard/projects/project-browser/record')
    await expect(page.getByRole('link', { name: 'Manage family invitations' })).toHaveAttribute('href', '/en/dashboard/projects/project-browser/invitations')
    report.checks.push({ width, check: 'locale_navigation_targets', status: 'passed' })
    await page.getByLabel('Select existing audio').setInputFiles({ name: 'synthetic.wav', mimeType: 'audio/wav', buffer: wav })
    await page.getByRole('button', { name: 'Upload selected audio' }).click()
    await expect(page.getByRole('status')).toContainText('verification is still pending')
    assert.equal(uploadedBytes, wav.length)
    report.checks.push({ width, check: 'import_bytes_and_pending_verification', status: 'passed' })
    await page.getByTestId('provenance-search-query-input').fill('cedar boat')
    await page.getByTestId('provenance-search-submit-btn').click()
    await page.getByTestId('seek-citation-segment-browser').click()
    await expect.poll(() => page.getByLabel('Cited original audio').evaluate(audio => audio.currentTime)).toBeGreaterThanOrEqual(2)
    report.checks.push({ width, check: 'search_and_metadata_seek', status: 'passed' })
    const downloading = page.waitForEvent('download')
    await page.getByTestId('export-complete-archive-btn').click()
    const download = await downloading
    assert.equal(download.suggestedFilename(), 'saga-project-browser-archive.zip')
    assert.equal(sha(await readFile(await download.path())), sha(zip))
    report.checks.push({ width, check: 'zip_download_bytes', status: 'passed' })
    await page.screenshot({ path: join(evidence, `hub-${width}-${runId}.png`), fullPage: true })
    failSearch = true
    await page.getByTestId('provenance-search-submit-btn').click()
    await expect(page.getByRole('alert')).toHaveText('Search is unavailable. Please try again.')
    await expect(page.getByLabel('Cited original audio')).toHaveCount(0)
    assert.deepEqual(errors, [])
    report.checks.push({ width, check: 'failed_search_clears_source_and_audio_no_page_errors', status: 'passed' })
    await context.close()
  }
  assert.deepEqual(report.externalRequests, [])
  for (const path of ['packages/web/src/components/projects/ConnectedProjectHub.tsx', 'packages/web/src/components/projects/TwoEntryProjectHub.tsx', 'packages/web/src/lib/project-hub-client.ts', ...['entry.tsx', 'boundaries.tsx', 'typescript-loader.cjs', 'verify.mjs'].map(p => `experiments/two-entry-hub-browser/${p}`)]) report.sources[path] = sha(await readFile(join(root, path)))
  report.status = 'passed'
} catch (error) { report.status = 'failed'; report.error = error.message }
finally {
  await browser?.close()
  if (server) { server.closeAllConnections(); await new Promise(done => server.close(done)) }
  await rm(scratch, { recursive: true, force: true })
  report.cleanup = { browserClosed: true, serverClosed: true, scratchRemoved: true }
  await writeFile(join(evidence, `browser-${runId}.json`), JSON.stringify(report, null, 2) + '\n')
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, evidence: `browser-${runId}.json`, error: report.error }))
if (report.status !== 'passed') process.exitCode = 1
