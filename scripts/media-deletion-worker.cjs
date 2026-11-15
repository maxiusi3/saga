#!/usr/bin/env node
// Explicit operator configuration only. No dotenv or remote provisioning.
const { loadWorker } = require('./recording-worker.cjs')
function config(env = process.env) {
  const fail = () => { throw new Error('media_deletion_worker_configuration') }
  const raw = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
  let url
  try { url = new URL(raw) } catch { fail() }
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (typeof raw !== 'string' || /[\s\x00-\x1f\x7f]/.test(raw) || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    typeof key !== 'string' || !key || /[\s\x00-\x1f\x7f]/.test(key)) fail()
  const poll = env.MEDIA_DELETION_POLL_MS ?? '2000'
  if (!/^[0-9]+$/.test(poll) || Number(poll) < 250 || Number(poll) > 60000) fail()
  return { storageUrl: url.origin, serviceRoleKey: key, pollMs: Number(poll) }
}
async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || args.some(a => !['--check', '--once', '--help'].includes(a))) throw new Error('media_deletion_worker_arguments')
  if (args[0] === '--help') { console.log('Usage: npm run worker:deletions -- [--check | --once]\nRequires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. See docs/media-deletion-worker.md.'); return }
  const options = config(), controller = new AbortController(), stop = () => controller.abort()
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
  let runtime
  try {
    runtime = await loadWorker('deletions')
    if (args[0] === '--check') { console.log('media_deletion_worker_ready'); return }
    const { createClient } = require('@supabase/supabase-js')
    const admin = createClient(options.storageUrl, options.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    let cursor = null
    do {
      try {
        const result = await runtime.worker.runMediaDeletionWorkerOnce({ ...options, admin, cursor, signal: controller.signal })
        cursor = result.nextCursor
        if (result.status === 'unavailable') { console.error('media_deletion_worker_unavailable'); if (args[0] === '--once') process.exitCode = 1 }
        if (result.receipt) console.log('media_deletion_' + result.receipt.state)
      } catch {
        if (!controller.signal.aborted) { console.error('media_deletion_worker_unavailable'); if (args[0] === '--once') process.exitCode = 1 }
      }
      if (args[0] === '--once' || controller.signal.aborted) break
      await new Promise(resolve => {
        const done = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', done); resolve() }
        const timer = setTimeout(done, options.pollMs)
        controller.signal.addEventListener('abort', done, { once: true })
        if (controller.signal.aborted) done()
      })
    } while (!controller.signal.aborted)
  } finally { await runtime?.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop) }
}
module.exports = { config, main }
if (require.main === module) void main().catch(error => {
  console.error(['media_deletion_worker_configuration', 'media_deletion_worker_arguments'].includes(error?.message) ? error.message : 'media_deletion_worker_unavailable')
  process.exitCode = 1
})
