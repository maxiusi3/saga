// Real browser regression for the production recorderDB adapter. No remote services.
// Run: node scripts/verify-recorder-db.cjs [--mutation=user-filter|numeric-sort]
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require('@playwright/test')
const ts = require('typescript')
const webpack = require('webpack')
const postcss = require('postcss')

const root = path.resolve(__dirname, '..')
const output = path.join(root, 'docs/research/evidence/2026-10-14-t04-browser')
const mutation = process.argv.find(arg => arg.startsWith('--mutation='))?.split('=')[1]
const report = { timestamp: new Date().toISOString(), mutation: mutation ?? null, checks: [] }
let browser
let server
let scratch

async function buildRecoveryUI() {
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'saga-recovery-browser-'))
  const entry = path.join(scratch, 'entry.js')
  const loader = path.join(scratch, 'typescript-loader.cjs')
  await fs.writeFile(entry, `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { NextIntlClientProvider } from 'next-intl';
    import { RecordingRecoveryPanel } from '@/components/recording/RecordingRecoveryPanel';
    import en from ${JSON.stringify(path.join(root, 'packages/web/public/locales/en/recording.json'))};
    import zh from ${JSON.stringify(path.join(root, 'packages/web/public/locales/zh-TW/recording.json'))};
    const app = createRoot(document.getElementById('root'));
    window.showRecovery = (userId, projectId = 'tone-project', locale = 'en') => app.render(
      React.createElement(NextIntlClientProvider, {locale, timeZone: 'Asia/Taipei', messages: {recording: locale === 'zh-TW' ? zh : en}},
        React.createElement(RecordingRecoveryPanel, {projectId, userId})));
  `)
  await fs.writeFile(loader, `const ts = require(${JSON.stringify(require.resolve('typescript'))}); module.exports = function(source) {
    return ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  };`)
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: 'development', devtool: false, entry,
      output: { path: scratch, filename: 'ui.js' },
      resolve: { extensions: ['.tsx', '.ts', '.js'], alias: { '@': path.join(root, 'packages/web/src') }, modules: [path.join(root, 'node_modules')] },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: loader }] },
    })
    compiler.run((error, stats) => compiler.close(() => {
      if (error || stats.hasErrors()) reject(error ?? new Error(stats.toString({ all: false, errors: true })))
      else resolve()
    }))
  })
  const cssPath = path.join(root, 'packages/web/src/app/globals.css')
  const config = require(path.join(root, 'packages/web/tailwind.config.js'))
  const css = await postcss([require('postcss-import'), require('tailwindcss')({ ...config,
    content: [path.join(root, 'packages/web/src/components/recording/RecordingRecoveryPanel.tsx'), path.join(root, 'packages/web/src/components/ui/{card,button}.tsx')],
  })]).process(await fs.readFile(cssPath, 'utf8'), { from: cssPath })
  return { js: await fs.readFile(path.join(scratch, 'ui.js')), css: css.css }
}

function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name)
  report.checks.push(name)
}

async function main() {
  const source = await fs.readFile(path.join(root, 'packages/web/src/lib/recorder-db.ts'), 'utf8')
  report.sourceSha256 = crypto.createHash('sha256').update(source).digest('hex')
  report.os = `${os.platform()} ${os.release()} ${os.arch()}`
  report.limits = 'Synthetic fixture bytes plus a short Web Audio tone captured with native MediaRecorder, persisted and reopened through native IndexedDB, verified by the production recovery helper, decoded and played by desktop Chromium. No microphone, crash, mobile, long recording, quota, remote authorization, or cloud confirmation evidence.'
  let testedSource = source
  if (mutation === 'user-filter') {
    testedSource = source.replace('session.userId === userId && ', '')
  } else if (mutation === 'numeric-sort') {
    testedSource = source.replace('a.index - b.index', 'String(a.index).localeCompare(String(b.index))')
  } else if (mutation) {
    throw new Error(`Unknown mutation: ${mutation}`)
  }
  if (mutation && testedSource === source) throw new Error('Mutation did not apply')
  const compiled = ts.transpileModule(testedSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText.replace("from 'idb'", "from '/idb.js'")
  const recoverySource = await fs.readFile(path.join(root, 'packages/web/src/lib/recording-recovery.ts'), 'utf8')
  report.recoverySourceSha256 = crypto.createHash('sha256').update(recoverySource).digest('hex')
  const recoveryCompiled = ts.transpileModule(recoverySource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText.replace("from './recorder-db'", "from '/recorder-db.js'")
  const idb = await fs.readFile(path.join(path.dirname(require.resolve('idb')), 'index.js'), 'utf8')
  const ui = await buildRecoveryUI()
  report.uiSourceSha256 = crypto.createHash('sha256').update(await fs.readFile(path.join(root, 'packages/web/src/components/recording/RecordingRecoveryPanel.tsx'))).digest('hex')
  const routes = new Map([
    ['/', ['text/html', '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>T04 local recovery verification</title><link rel="stylesheet" href="/ui.css"><body style="padding:24px;font-family:system-ui;background:#f8fafc"><main id="root"></main><script src="/ui.js"></script></body></html>']],
    ['/ui.js', ['text/javascript', ui.js]],
    ['/ui.css', ['text/css', ui.css]],
    ['/recorder-db.js', ['text/javascript', compiled]],
    ['/recording-recovery.js', ['text/javascript', recoveryCompiled]],
    ['/idb.js', ['text/javascript', idb]],
  ])
  server = http.createServer((req, res) => {
    const route = routes.get(req.url)
    const contentType = route?.[0] ?? 'text/plain'
    res.writeHead(route ? 200 : 404, { 'Content-Type': /^(text|application\/javascript)/.test(contentType) ? `${contentType}; charset=utf-8` : contentType, 'Cache-Control': 'no-store' })
    res.end(route?.[1] ?? 'Not found')
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true })
  report.browser = `Chromium ${browser.version()}`
  const context = await browser.newContext()
  context.setDefaultTimeout(10000)
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  let page = await context.newPage()
  await page.goto(origin)

  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('saga-recorder-db', 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('chunks', { keyPath: 'id' }).createIndex('by-session', 'sessionId')
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('chunks', 'readwrite')
        tx.objectStore('chunks').put({
          id: 'legacy-0', sessionId: 'legacy', index: 0,
          blob: new Blob(['legacy-bytes'], { type: 'audio/webm' }), timestamp: 1700000000000,
        })
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onabort = () => { db.close(); reject(tx.error) }
      }
    })
  })
  const legacy = await page.evaluate(async () => {
    const { recorderDB } = await import('/recorder-db.js')
    const [chunk] = await recorderDB.getChunksBySession('legacy')
    const databases = await indexedDB.databases()
    return {
      version: databases.find(db => db.name === 'saga-recorder-db').version,
      text: await chunk.blob.text(), byteSize: chunk.byteSize, sha256: chunk.sha256,
      uploadStatus: chunk.uploadStatus, persistedAt: chunk.persistedAt,
    }
  })
  check('v1 upgrade keeps legacy bytes and supplies compatible defaults', legacy, {
    version: 2, text: 'legacy-bytes', byteSize: 12, sha256: null,
    uploadStatus: 'pending', persistedAt: '2023-11-14T22:13:20.000Z',
  })
  await page.evaluate(async () => {
    const { recorderDB } = await import('/recorder-db.js')
    for (const [id, projectId, userId, state] of [
      ['draft', 'project-a', 'user-a', 'interrupted'],
      ['active', 'project-a', 'user-a', 'recording'],
      ['confirmed', 'project-a', 'user-a', 'confirmed'],
      ['other-user', 'project-a', 'user-b', 'interrupted'],
      ['other-project', 'project-b', 'user-a', 'interrupted'],
    ]) {
      await recorderDB.saveSession({
        id, projectId, userId, state, mimeType: 'audio/webm',
        startedAt: '2026-10-14T00:00:00.000Z', lastPersistedIndex: -1,
        cloudConfirmedAssetId: state === 'confirmed' ? 'synthetic-asset' : null,
      })
    }
    for (const [index, text] of [[10, 'ten'], [2, 'two'], [0, 'zero']]) {
      const blob = new Blob([text], { type: 'audio/webm' })
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
      const sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
      await recorderDB.saveChunk('draft', index, blob, { sha256 })
    }
    await recorderDB.markChunkUploaded('draft', 0)
    // Use explicit times so newest-first assertions cannot depend on clock resolution.
    for (const [id, updatedAt] of [['draft', 10], ['active', 20]]) {
      await recorderDB.saveSession({ ...await recorderDB.getSession(id), updatedAt })
    }
  })
  const captured = await page.evaluate(async () => {
    const { recorderDB } = await import('/recorder-db.js')
    const audioContext = new AudioContext()
    const destination = audioContext.createMediaStreamDestination()
    const oscillator = audioContext.createOscillator()
    oscillator.frequency.value = 440
    oscillator.connect(destination)
    const preferred = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type))
    if (!preferred) throw new Error('No supported synthetic capture format')
    const recorder = new MediaRecorder(destination.stream, { mimeType: preferred })
    const blobs = []
    recorder.ondataavailable = event => { if (event.data.size) blobs.push(event.data) }
    await audioContext.resume()
    oscillator.start()
    recorder.start(80)
    // Headless audio advances on its own clock; wall time can include renderer startup.
    const audioDeadline = audioContext.currentTime + 0.7
    const wallDeadline = Date.now() + 5000
    while (audioContext.currentTime < audioDeadline) {
      if (Date.now() > wallDeadline) throw new Error('Synthetic audio clock did not advance')
      await new Promise(resolve => setTimeout(resolve, 30))
    }
    await new Promise((resolve, reject) => {
      recorder.onstop = resolve
      recorder.onerror = reject
      recorder.stop()
    })
    oscillator.stop()
    destination.stream.getTracks().forEach(track => track.stop())
    await audioContext.close()
    const hash = async blob => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('')
    await recorderDB.saveSession({ id: 'tone', projectId: 'tone-project', userId: 'tone-user', state: 'interrupted',
      mimeType: recorder.mimeType, startedAt: '2026-10-14T00:00:00.000Z', lastPersistedIndex: -1, cloudConfirmedAssetId: null })
    const hashes = []
    for (const [index, blob] of blobs.entries()) {
      const sha256 = await hash(blob)
      hashes.push(sha256)
      await recorderDB.saveChunk('tone', index, blob, { sha256 })
    }
    return { mimeType: recorder.mimeType, chunkCount: blobs.length, hashes,
      byteSize: new Blob(blobs).size, sha256: await hash(new Blob(blobs)) }
  })
  check('native MediaRecorder emits multiple nonempty tone chunks', captured.chunkCount >= 2, true)
  await page.close()
  page = await context.newPage()
  await page.goto(origin)
  const reopened = await page.evaluate(async () => {
    const { recorderDB } = await import('/recorder-db.js')
    const chunks = await recorderDB.getChunksBySession('draft')
    return {
      ids: (await recorderDB.getRecoverableSessions('project-a', 'user-a')).map(s => s.id),
      unknownUser: await recorderDB.getRecoverableSessions('project-a', 'absent-user'),
      indices: chunks.map(c => c.index),
      contents: await Promise.all(chunks.map(c => c.blob.text())),
      hashes: chunks.map(c => c.sha256),
      statuses: chunks.map(c => c.uploadStatus),
      lastPersistedIndex: (await recorderDB.getSession('draft')).lastPersistedIndex,
    }
  })
  check('reopened drafts are scoped to project/user and newest first', reopened.ids, ['active', 'draft'])
  check('unknown users have no recoverable drafts', reopened.unknownUser, [])
  check('indices are numeric after page close/reopen', reopened.indices, [0, 2, 10])
  check('all Blob bytes survive page close/reopen', reopened.contents, ['zero', 'two', 'ten'])
  check('stored SHA-256 survives page close/reopen', reopened.hashes,
    ['zero', 'two', 'ten'].map(text => crypto.createHash('sha256').update(text).digest('hex')))
  check('upload marker retains the uploaded Blob and pending copies', reopened.statuses, ['uploaded', 'pending', 'pending'])
  check('out-of-order chunk saves retain the highest persisted index', reopened.lastPersistedIndex, 10)
  const playable = await page.evaluate(async () => {
    const { loadLocalRecording } = await import('/recording-recovery.js')
    const { recorderDB } = await import('/recorder-db.js')
    const result = await loadLocalRecording('tone', 'tone-project', 'tone-user')
    const bytes = await result.blob.arrayBuffer()
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
    const audioContext = new AudioContext()
    const decoded = await audioContext.decodeAudioData(bytes.slice(0))
    const decodedDuration = decoded.duration
    const signalPresent = decoded.getChannelData(0).some(sample => Math.abs(sample) > 0.01)
    await audioContext.close()
    const url = URL.createObjectURL(result.blob)
    const audio = new Audio(url)
    audio.muted = true
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Tone playback timed out')), 5000)
        audio.onended = () => { clearTimeout(timeout); resolve() }
        audio.onerror = () => { clearTimeout(timeout); reject(new Error('Tone playback failed')) }
        audio.play().catch(error => { clearTimeout(timeout); reject(error) })
      })
      return { mimeType: result.blob.type, sha256, byteSize: result.blob.size,
        hashes: (await recorderDB.getChunksBySession('tone')).map(chunk => chunk.sha256),
        decodedDuration, signalPresent, ended: audio.ended, playedSeconds: audio.currentTime,
        retainedState: (await recorderDB.getSession('tone')).state }
    } finally { audio.pause(); audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url) }
  })
  report.tone = { ...captured, ...playable }
  check('reopened playable tone preserves actual MIME, all bytes and per-chunk hashes',
    [playable.mimeType, playable.byteSize, playable.sha256, playable.hashes],
    [captured.mimeType, captured.byteSize, captured.sha256, captured.hashes])
  check('recovered tone decodes to non-silent audio of plausible duration',
    playable.signalPresent && playable.decodedDuration > 0.2 && playable.decodedDuration < 2, true)
  check('native audio playback reaches the end after reopen', playable.ended && playable.playedSeconds > 0.2, true)
  check('preview leaves the recovery copy unconfirmed', playable.retainedState, 'interrupted')
  const uiErrors = []
  page.on('pageerror', error => uiErrors.push(error.message))
  await page.waitForFunction(() => typeof window.showRecovery === 'function')
  await page.evaluate(() => window.showRecovery('tone-user'))
  await page.getByRole('button', { name: 'Listen / recover Recording 1', exact: true }).click()
  await page.getByRole('link', { name: 'Download this copy' }).waitFor()
  check('production recovery panel mounts one native audio preview', await page.locator('audio[controls]').count(), 1)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download this copy' }).click()])
  const downloaded = await fs.readFile(await download.path())
  check('UI download contains exactly the recovered tone bytes', crypto.createHash('sha256').update(downloaded).digest('hex'), captured.sha256)
  check('UI download uses an audio filename', download.suggestedFilename(), 'saga-local-recording.webm')
  await page.setViewportSize({ width: 375, height: 812 })
  check('recovery panel fits a 375px viewport', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await fs.mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, 'recovery-preview-mobile-width.png'), fullPage: true })
  await page.evaluate(() => window.showRecovery(undefined))
  await page.locator('audio').waitFor({ state: 'detached' })
  check('sign-out removes recovery audio and download', await page.getByRole('link', { name: 'Download this copy' }).count(), 0)
  await page.evaluate(() => window.showRecovery('tone-user', 'other-project'))
  await page.getByText('Looking for recordings…').waitFor({ state: 'hidden' })
  check('another project cannot see the recovery selection', await page.getByRole('button', { name: /Listen \/ recover/ }).count(), 0)
  await page.evaluate(() => window.showRecovery('tone-user', 'tone-project', 'zh-TW'))
  await page.waitForTimeout(500)
  try {
    await page.getByRole('heading', { name: '儲存在此裝置的錄音' }).waitFor()
  } catch (error) {
    throw new Error(`${error.message}\nUI text after zh-TW switch:\n${await page.locator('body').innerText()}`)
  }
  await page.getByRole('button', { name: /回聽 \/ 恢復/ }).click()
  await page.getByRole('link', { name: '下載此副本' }).waitFor()
  check('traditional Chinese recovery translations render', await page.getByRole('heading', { name: '儲存在此裝置的錄音' }).count(), 1)
  await page.setViewportSize({ width: 1100, height: 800 })
  await page.screenshot({ path: path.join(output, 'recovery-preview-zh-TW.png'), fullPage: true })
  await page.evaluate(() => window.showRecovery(undefined))
  await page.locator('audio').waitFor({ state: 'detached' })
  check('recovery UI has no uncaught browser errors', uiErrors, [])
  const cleanup = await page.evaluate(async () => {
    const { recorderDB } = await import('/recorder-db.js')
    let missingRejected = false
    try { await recorderDB.markChunkUploaded('draft', 99) } catch { missingRejected = true }
    await recorderDB.clearSession('draft')
    return {
      missingRejected,
      sessionMissing: (await recorderDB.getSession('draft')) === undefined,
      chunks: await recorderDB.getChunksBySession('draft'),
      legacyText: await (await recorderDB.getChunksBySession('legacy'))[0].blob.text(),
      otherSession: (await recorderDB.getSession('other-user')).id,
    }
  })
  check('upload cannot mark a nonexistent chunk', cleanup.missingRejected, true)
  check('explicit cleanup deletes only its target session and chunks', cleanup, {
    missingRejected: true, sessionMissing: true, chunks: [], legacyText: 'legacy-bytes', otherSession: 'other-user',
  })
  const isolated = await browser.newContext()
  const isolatedPage = await isolated.newPage()
  await isolatedPage.goto(origin)
  check('new isolated browser context starts without previous data', await isolatedPage.evaluate(async () => {
    const { recorderDB } = await import('/recorder-db.js')
    return recorderDB.getRecoverableSessions('project-a', 'user-a')
  }), [])
  await isolated.close()
  await context.close()
  report.status = 'passed'
}

// A hung transaction must fail the run rather than leave browser/server processes behind.
const deadline = setTimeout(() => {
  void finish(new Error('Browser verification exceeded 60 seconds'))
}, 60000)
let finishing = false
async function finish(error) {
  if (finishing) return
  finishing = true
  clearTimeout(deadline)
  if (error) { report.status = 'failed'; report.error = error.stack ?? String(error); process.exitCode = 1 }
  try {
    await browser?.close()
    if (server) await new Promise(resolve => server.close(resolve))
    if (scratch) await fs.rm(scratch, { recursive: true, force: true })
    await fs.mkdir(output, { recursive: true })
    await fs.writeFile(path.join(output, mutation ? `mutation-${mutation}.json` : 'results.json'), `${JSON.stringify(report, null, 2)}\n`)
    console.log(JSON.stringify(report, null, 2))
  } catch (cleanupError) { console.error(cleanupError); process.exitCode = 1 }
}
main().then(() => finish(), finish)
