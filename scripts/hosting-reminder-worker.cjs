#!/usr/bin/env node
// Explicit environment only; --check compiles/configures offline, never contacts recipients.
const path = require('node:path')
const { createRequire } = require('node:module')
const { loadWorker } = require('./recording-worker.cjs')
function config(env = process.env) {
  const fail = () => { throw new Error('hosting_reminder_configuration') }
  const raw = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
  let url
  try { url = new URL(raw) } catch { fail() }
  const key = env.SUPABASE_SERVICE_ROLE_KEY, poll = env.HOSTING_REMINDER_POLL_MS ?? '60000'
  if (typeof raw !== 'string' || /[\s\x00-\x1f\x7f]/.test(raw) || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    typeof key !== 'string' || !key || /[\s\x00-\x1f\x7f]/.test(key) || !/^\d+$/.test(poll) || Number(poll) < 1000 || Number(poll) > 3600000) fail()
  return { url: url.origin, key, pollMs: Number(poll) }
}
function pause(ms, signal) {
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve() }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true }); if (signal.aborted) done()
  })
}
async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || args.some(arg => !['--check','--once','--help'].includes(arg))) throw new Error('hosting_reminder_arguments')
  if (args[0] === '--help') { console.log('Usage: npm run worker:hosting-reminders -- [--check | --once]\nRequires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Email is disabled by default. See docs/hosting-reminders.md.'); return }
  const options = config(), controller = new AbortController(), stop = () => controller.abort()
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
  let runtime
  try {
    runtime = await loadWorker('hosting-reminders')
    const reminderConfig = runtime.worker.readHostingReminderConfig()
    const webRequire = createRequire(path.resolve(__dirname, '../packages/web/package.json'))
    const { createClient } = webRequire('@supabase/supabase-js')
    if (controller.signal.aborted) return
    if (args[0] === '--check') { console.log('hosting_reminder_ready'); return }
    const admin = createClient(options.url, options.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    do {
      try {
        const result = await runtime.worker.runHostingReminderWorkerOnce({ admin, config: reminderConfig, signal: controller.signal })
        console.log(JSON.stringify({ status: 'hosting_reminder_pass', ...result }))
        if (args[0] === '--once' && (result.emailUnknown || result.emailFailed)) process.exitCode = 1
      } catch {
        if (!controller.signal.aborted) { console.error('hosting_reminder_unavailable'); if (args[0] === '--once') process.exitCode = 1 }
      }
      if (args[0] === '--once' || controller.signal.aborted) break
      await pause(options.pollMs, controller.signal)
    } while (!controller.signal.aborted)
  } finally { await runtime?.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop) }
}
module.exports = { config, main }
if (require.main === module) void main().catch(error => {
  console.error(['hosting_reminder_configuration','hosting_reminder_arguments'].includes(error?.message) ? error.message : 'hosting_reminder_unavailable')
  process.exitCode = 1
})
