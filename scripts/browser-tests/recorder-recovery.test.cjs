// Native IndexedDB contracts, not microphone/device qualification or playable audio.
// Run separately from infra: node --test scripts/browser-tests/recorder-recovery.test.cjs
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const http = require('node:http')
const { createHash } = require('node:crypto')
const { chromium } = require('@playwright/test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')

test('G1 local recorder persistence contracts (synthetic bytes only)', { timeout: 120000 }, async t => {
  const routes = new Map([['/', ['text/html', '<!doctype html><title>Isolated recorder contracts</title>']]])
  for (const name of ['recorder-db', 'recording-recovery']) {
    const source = await fs.readFile(path.join(root, `packages/web/src/lib/${name}.ts`), 'utf8')
    t.diagnostic(`${name}.ts sha256=${createHash('sha256').update(source).digest('hex')}`)
    const compiled = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    }).outputText.replace("from 'idb'", "from '/idb.js'")
      .replace("from './recorder-db'", "from '/recorder-db.js'")
    routes.set(`/${name}.js`, ['text/javascript', compiled])
  }
  routes.set('/idb.js', ['text/javascript', await fs.readFile(
    path.join(path.dirname(require.resolve('idb')), 'index.js'), 'utf8')])

  const server = http.createServer((request, response) => {
    const route = routes.get(request.url)
    response.writeHead(route ? 200 : 404, { 'Content-Type': route?.[0] ?? 'text/plain', 'Cache-Control': 'no-store' })
    response.end(route?.[1] ?? 'Not found')
  })
  let browser
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const origin = `http://127.0.0.1:${server.address().port}`
    browser = await chromium.launch({ headless: true })
    t.diagnostic(`Chromium ${browser.version()}; no microphone, remote service, or real device matrix`)

    async function openPage(context) {
      const page = await context.newPage()
      await page.goto(origin)
      await page.evaluate(async () => {
        window.recorderDB = (await import('/recorder-db.js')).recorderDB
        window.loadLocalRecording = (await import('/recording-recovery.js')).loadLocalRecording
        window.hash = async blob => Array.from(new Uint8Array(
          await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')
        window.seed = async (id = 'capture') => recorderDB.saveSession({
          id, projectId: 'project-a', userId: 'user-a', state: 'recording',
          mimeType: 'audio/webm', startedAt: '2026-11-01T00:00:00.000Z',
          lastPersistedIndex: -1, cloudConfirmedAssetId: null,
        })
        window.append = async (index, id = 'capture') => {
          const blob = new Blob([`synthetic-chunk-${index};`], { type: 'audio/webm' })
          return recorderDB.saveChunk(id, index, blob, { sha256: await hash(blob) })
        }
        // Queue a competing native transaction before idb resumes the production get.
        // In the fixed adapter it must wait for the whole update, not just its read.
        window.interleave = async kind => {
          const originalGet = IDBObjectStore.prototype.get
          let queued
          let injected = false
          IDBObjectStore.prototype.get = function (key) {
            const request = originalGet.call(this, key)
            if (!injected && this.name === 'sessions' && key === 'capture') {
              injected = true
              request.addEventListener('success', () => {
                const other = this.transaction.db.transaction(['sessions', 'chunks'], 'readwrite')
                queued = new Promise((resolve, reject) => {
                  other.oncomplete = resolve
                  other.onabort = () => reject(other.error)
                })
                const read = originalGet.call(other.objectStore('sessions'), 'capture')
                read.onsuccess = () => {
                  if (kind === 'clear') {
                    other.objectStore('sessions').delete('capture')
                    other.objectStore('chunks').delete('capture-0')
                    return
                  }
                  const patch = kind === 'chunk'
                    ? { lastPersistedIndex: 1 } : { cloudConfirmedAssetId: 'synthetic-confirmed-asset' }
                  other.objectStore('sessions').put({ ...read.result, ...patch })
                  if (kind === 'chunk') other.objectStore('chunks').put(window.nextChunk)
                }
              }, { once: true })
            }
            return request
          }
          try {
            await recorderDB.updateSession('capture', { state: 'interrupted' })
            if (!injected) throw new Error('Interleaving hook did not execute')
            await queued
          } finally {
            IDBObjectStore.prototype.get = originalGet
          }
        }
      })
      return page
    }

    async function isolated(run) {
      const context = await browser.newContext()
      const pageErrors = []
      context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)))
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
      try {
        await run(await openPage(context), context)
        // Cross a renderer task boundary so unhandled promise rejections are observable.
        for (const page of context.pages()) await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)))
        assert.deepEqual(pageErrors, [], 'no unhandled browser errors')
      } finally {
        await context.close()
      }
    }

    await t.test('interruption cannot regress a concurrently persisted chunk watermark', () => isolated(async page => {
      const result = await page.evaluate(async () => {
        await seed()
        await append(0)
        const blob = new Blob(['synthetic-chunk-1;'], { type: 'audio/webm' })
        window.nextChunk = {
          id: 'capture-1', sessionId: 'capture', index: 1, blob, byteSize: blob.size,
          sha256: await hash(blob), persistedAt: new Date().toISOString(), uploadStatus: 'pending', timestamp: Date.now(),
        }
        await interleave('chunk')
        const session = await recorderDB.getSession('capture')
        const chunks = await recorderDB.getChunksBySession('capture')
        let recovered
        try { recovered = (await loadLocalRecording('capture', 'project-a', 'user-a')).chunkCount }
        catch (error) { recovered = error.code }
        return { watermark: session.lastPersistedIndex, count: chunks.length, recovered, state: session.state }
      })
      assert.deepEqual(result, { watermark: 1, count: 2, recovered: 2, state: 'interrupted' })
    }))

    await t.test('concurrent session patches do not overwrite each other', () => isolated(async page => {
      const result = await page.evaluate(async () => {
        await seed()
        await interleave('patch')
        const session = await recorderDB.getSession('capture')
        return { state: session.state, asset: session.cloudConfirmedAssetId }
      })
      assert.deepEqual(result, { state: 'interrupted', asset: 'synthetic-confirmed-asset' })
    }))

    await t.test('a concurrent clear is not undone by a stale session update', () => isolated(async page => {
      const result = await page.evaluate(async () => {
        await seed()
        await append(0)
        await interleave('clear')
        return { session: await recorderDB.getSession('capture'), chunks: (await recorderDB.getChunksBySession('capture')).length }
      })
      assert.deepEqual(result, { session: undefined, chunks: 0 })
    }))

    await t.test('aborted chunk transaction rejects and keeps the preceding committed draft', () => isolated(async page => {
      const result = await page.evaluate(async () => {
        await seed()
        await append(0)
        const originalPut = IDBObjectStore.prototype.put
        let injected = false
        IDBObjectStore.prototype.put = function (...args) {
          const request = originalPut.apply(this, args)
          if (!injected && this.name === 'chunks') {
            injected = true
            request.addEventListener('success', () => this.transaction.abort(), { once: true })
          }
          return request
        }
        let failure
        try { await append(1) } catch (error) { failure = error.name }
        finally { IDBObjectStore.prototype.put = originalPut }
        const recovered = await loadLocalRecording('capture', 'project-a', 'user-a')
        return { injected, failure: Boolean(failure), watermark: recovered.session.lastPersistedIndex,
          count: recovered.chunkCount, bytes: await recovered.blob.text(), cloud: recovered.session.cloudConfirmedAssetId }
      })
      assert.deepEqual(result, { injected: true, failure: true, watermark: 0, count: 1,
        bytes: 'synthetic-chunk-0;', cloud: null })
    }))

    await t.test('a synchronous quota error rolls back both chunk bytes and session metadata', () => isolated(async page => {
      const result = await page.evaluate(async () => {
        await seed()
        await append(0)
        const originalPut = IDBObjectStore.prototype.put
        let injected = false
        IDBObjectStore.prototype.put = function (...args) {
          if (!injected && this.name === 'sessions') {
            injected = true
            throw new DOMException('Injected write failure, not real disk exhaustion', 'QuotaExceededError')
          }
          return originalPut.apply(this, args)
        }
        let failure
        try { await append(1) } catch (error) { failure = error.name }
        finally { IDBObjectStore.prototype.put = originalPut }
        const session = await recorderDB.getSession('capture')
        return { injected, failure, watermark: session.lastPersistedIndex,
          count: (await recorderDB.getChunksBySession('capture')).length }
      })
      assert.deepEqual(result, { injected: true, failure: 'QuotaExceededError', watermark: 0, count: 1 })
    }))

    await t.test('session update waits for commit, rejects late abort, then permits explicit retry', () => isolated(async page => {
      const result = await page.evaluate(async () => {
        await seed()
        const originalPut = IDBObjectStore.prototype.put
        let injected = false
        IDBObjectStore.prototype.put = function (...args) {
          const request = originalPut.apply(this, args)
          if (!injected && this.name === 'sessions') {
            injected = true
            request.addEventListener('success', () => this.transaction.abort(), { once: true })
          }
          return request
        }
        let failure
        try { await recorderDB.updateSession('capture', { state: 'interrupted' }) }
        catch (error) { failure = error.name }
        finally { IDBObjectStore.prototype.put = originalPut }
        const afterAbort = (await recorderDB.getSession('capture')).state
        const retried = await recorderDB.updateSession('capture', { state: 'interrupted' })
        const missing = await recorderDB.updateSession('missing', { state: 'interrupted' })
        return { injected, failure: Boolean(failure), afterAbort, retried: retried.state, missing,
          sessions: (await recorderDB.getSessionsByProject('project-a')).length }
      })
      assert.deepEqual(result, { injected: true, failure: true, afterAbort: 'recording',
        retried: 'interrupted', missing: undefined, sessions: 1 })
    }))

    for (const minutes of [5, 20, 30]) {
      const chunkCount = minutes * 6
      await t.test(`${minutes}-minute chunk-count model (${chunkCount} synthetic blocks): offline, refresh, reopen`, () => isolated(async (page, context) => {
        await page.evaluate(async () => { await seed(); await append(0) })
        await context.setOffline(true)
        await page.evaluate(async count => {
          if (navigator.onLine) throw new Error('Offline injection did not apply')
          for (let index = 1; index < count; index += 1) await append(index)
          await recorderDB.updateSession('capture', { state: 'interrupted' })
          await recorderDB.updateSession('capture', { state: 'interrupted' })
        }, chunkCount)
        await context.setOffline(false)
        await page.reload()

        const expectedBytes = Array.from({ length: chunkCount }, (_, index) => `synthetic-chunk-${index};`).join('')
        const expected = { count: chunkCount, watermark: chunkCount - 1, byteSize: Buffer.byteLength(expectedBytes),
          sha256: createHash('sha256').update(expectedBytes).digest('hex'), cloud: null,
          allPending: true, state: 'interrupted', sessions: 1, wrongUser: 'unavailable', wrongProject: 'unavailable' }
        async function inspect(currentPage) {
          return currentPage.evaluate(async () => {
            const { recorderDB: db } = await import('/recorder-db.js')
            const { loadLocalRecording: load } = await import('/recording-recovery.js')
            const recording = await load('capture', 'project-a', 'user-a')
            const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
              await recording.blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')
            const denied = async (project, user) => {
              try { await load('capture', project, user); return 'unexpected-success' }
              catch (error) { return error.code }
            }
            return { count: recording.chunkCount, watermark: recording.session.lastPersistedIndex,
              byteSize: recording.blob.size, sha256, cloud: recording.session.cloudConfirmedAssetId,
              allPending: (await db.getChunksBySession('capture')).every(chunk => chunk.uploadStatus === 'pending'),
              state: recording.session.state, sessions: (await db.getSessionsByProject('project-a')).length,
              wrongUser: await denied('project-a', 'user-b'), wrongProject: await denied('project-b', 'user-a') }
          })
        }
        assert.deepEqual(await inspect(page), expected, 'after actual page reload')
        await page.close()
        assert.deepEqual(await inspect(await openPage(context)), expected, 'after close and reopen in the same isolated profile')
      }))
    }

    for (const damage of ['missing-chunk', 'wrong-hash']) {
      await t.test(`${damage} is rejected after reopen without deleting the recovery copy`, () => isolated(async (page, context) => {
        await page.evaluate(async mode => {
          await seed()
          await append(0)
          await append(1)
          if (mode === 'missing-chunk') await recorderDB.deleteChunk('capture-0')
          else {
            const chunks = await recorderDB.getChunksBySession('capture')
            await recorderDB.saveChunk('capture', 0, chunks[0].blob, { sha256: '0'.repeat(64) })
          }
        }, damage)
        await page.close()
        const reopened = await openPage(context)
        const result = await reopened.evaluate(async () => {
          let failure
          try { await loadLocalRecording('capture', 'project-a', 'user-a') }
          catch (error) { failure = error.code }
          return { failure, exists: Boolean(await recorderDB.getSession('capture')),
            chunks: (await recorderDB.getChunksBySession('capture')).length }
        })
        assert.deepEqual(result, { failure: 'damaged', exists: true, chunks: damage === 'missing-chunk' ? 1 : 2 })
      }))
    }
  } finally {
    if (browser) await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
})
