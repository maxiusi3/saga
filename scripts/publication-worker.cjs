#!/usr/bin/env node
// Explicit operator configuration only; no dotenv or remote provisioning.
const path = require('node:path')
const { createRequire } = require('node:module')
const { loadWorker } = require('./recording-worker.cjs')
function config(env = process.env) {
  const fail = () => { throw new Error('publication_worker_configuration') }
  const raw = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
  let url
  try { url = new URL(raw) } catch { fail() }
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (typeof raw !== 'string' || /[\s\x00-\x1f\x7f]/.test(raw) || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    typeof key !== 'string' || !key || /[\s\x00-\x1f\x7f]/.test(key)) fail()
  const poll = env.PUBLICATION_WORKER_POLL_MS ?? '2000'
  if (!/^[0-9]+$/.test(poll) || Number(poll) < 250 || Number(poll) > 60000) fail()
  const font = env.ARCHIVE_FONT_PATH ?? path.resolve(__dirname, '../packages/web/assets/fonts/NotoSansCJKsc-Regular.otf')
  if (!path.isAbsolute(font) || /[\x00-\x1f\x7f]/.test(font)) fail()
  return { storageUrl: url.origin, serviceRoleKey: key, pollMs: Number(poll), font }
}
function pause(ms, signal) {
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve() }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
    if (signal.aborted) done()
  })
}
async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || args.some(arg => !['--check', '--once', '--help'].includes(arg))) throw new Error('publication_worker_arguments')
  if (args[0] === '--help') { console.log('Usage: npm run worker:publications -- [--check | --once]\nRequires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ARCHIVE_SPOOL_DIR. See docs/publication-worker.md.'); return }
  const options = config(), controller = new AbortController(), stop = () => controller.abort()
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
  const priorFont = process.env.ARCHIVE_FONT_PATH
  let runtime
  try {
    process.env.ARCHIVE_FONT_PATH = options.font
    runtime = await loadWorker('publications')
    runtime.worker.requireArchiveSpool()
    const webRequire = createRequire(path.resolve(__dirname, '../packages/web/package.json'))
    const font = createRequire(webRequire.resolve('pdfkit'))('fontkit').openSync(options.font)
    if (!font.hasGlyphForCodePoint(20013) || !font.hasGlyphForCodePoint(65)) throw new Error('publication_worker_configuration')
    if (controller.signal.aborted) return
    if (args[0] === '--check') { console.log('publication_worker_ready'); return }
    const { createClient } = webRequire('@supabase/supabase-js')
    const admin = createClient(options.storageUrl, options.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      // Bound every request, including claims/reconciliation before a job starts.
      global: { fetch: (input, init) => {
        const timeout = AbortSignal.timeout(new URL(String(input)).pathname.startsWith('/storage/v1/object/') ? 540000 : 15000)
        return fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout })
      } },
    })
    do {
      try {
        const result = await runtime.worker.runPublicationDeliveryWorker({ admin, signal: controller.signal })
        if (!['idle', 'contended', 'ready', 'failed', 'unavailable'].includes(result.outcome)) throw new Error('publication_worker_unavailable')
        if (result.outcome !== 'idle') console.log('publication_worker_' + result.outcome)
        if (args[0] === '--once' && ['failed', 'unavailable'].includes(result.outcome)) process.exitCode = 1
      } catch {
        if (!controller.signal.aborted) { console.error('publication_worker_unavailable'); if (args[0] === '--once') process.exitCode = 1 }
      }
      if (args[0] === '--once' || controller.signal.aborted) break
      await pause(options.pollMs, controller.signal)
    } while (!controller.signal.aborted)
  } finally {
    await runtime?.close()
    if (priorFont === undefined) delete process.env.ARCHIVE_FONT_PATH; else process.env.ARCHIVE_FONT_PATH = priorFont
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop)
  }
}
module.exports = { config, main }
if (require.main === module) void main().catch(error => {
  console.error(['publication_worker_configuration', 'publication_worker_arguments'].includes(error?.message) ? error.message : 'publication_worker_unavailable')
  process.exitCode = 1
})
