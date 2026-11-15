import type { SupabaseClient } from '@supabase/supabase-js'

const unavailable = () => new Error('hosting_reminder_unavailable')
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const address = /^[^\s<>@\x00-\x1f\x7f]+@[^\s<>@\x00-\x1f\x7f]+\.[^\s<>@\x00-\x1f\x7f]+$/
export interface HostingReminderConfig {
  email: { from: string; key: string; webOrigin: string } | null
  batchSize: number
}
export function readHostingReminderConfig(env: NodeJS.ProcessEnv = process.env): HostingReminderConfig {
  const fail = (): never => { throw new Error('hosting_reminder_configuration') }
  const enabled = env.HOSTING_REMINDER_EMAIL_ENABLED ?? 'false'
  if (!['true', 'false'].includes(enabled)) fail()
  const batch = env.HOSTING_REMINDER_BATCH_SIZE ?? '50'
  if (!/^\d+$/.test(batch) || Number(batch) < 1 || Number(batch) > 100) fail()
  if (enabled === 'false') return { email: null, batchSize: Number(batch) }
  const from = env.HOSTING_REMINDER_EMAIL_FROM, key = env.RESEND_API_KEY, raw = env.HOSTING_REMINDER_WEB_ORIGIN
  if (!from || from.length > 254 || !address.test(from) || !key || /[\s\x00-\x1f\x7f]/.test(key) || !raw) return fail()
  let url: URL
  try { url = new URL(raw) } catch { return fail() }
  if (/[\s\x00-\x1f\x7f]/.test(raw) || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail()
  return { email: { from, key, webOrigin: url.origin }, batchSize: Number(batch) }
}

/** Race as well as abort: a broken transport must not hang the worker indefinitely. */
async function bounded<T>(signal: AbortSignal | undefined, ms: number, work: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController(), abort = () => controller.abort()
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, ms)
  let rejectAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(unavailable())
    controller.signal.addEventListener('abort', rejectAbort, { once: true })
  })
  try {
    if (controller.signal.aborted) throw unavailable()
    return await Promise.race([work(controller.signal), interrupted])
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', rejectAbort); controller.abort()
  }
}
async function rpc(admin: SupabaseClient, name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<any> {
  try {
    const response = await bounded(signal, 15000, current => admin.rpc(name, args).abortSignal(current).retry(false))
    if (response.error) throw unavailable()
    return response.data
  } catch { throw unavailable() }
}
interface EmailClaim { id: string; token: string; orderId: string; projectId: string; expiresAt: string; daysBefore: 30 | 90; email: string }
function payload(value: any): EmailClaim {
  if (!value || !['id','token','orderId','projectId'].every(key => typeof value[key] === 'string' && ID.test(value[key])) ||
    ![30,90].includes(value.daysBefore) || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt)) ||
    typeof value.email !== 'string' || value.email.length > 254 || !address.test(value.email)) throw unavailable()
  return value
}
async function readReceipt(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.body) throw unavailable()
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    while (true) {
      if (signal.aborted) throw unavailable()
      const next = await reader.read()
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > 8192) throw unavailable()
      chunks.push(next.value)
    }
    if (signal.aborted) throw unavailable()
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(value.id)) throw unavailable()
    return value.id
  } finally { signal.removeEventListener('abort', cancel); void reader.cancel().catch(() => {}); reader.releaseLock() }
}

/** One bounded scan and at most batchSize email sends; only begin may authorize HTTP. */
export async function runHostingReminderWorkerOnce({ admin, config, signal, fetch: fetcher = fetch }: {
  admin: SupabaseClient; config: HostingReminderConfig; signal?: AbortSignal; fetch?: typeof fetch
}): Promise<{ inAppSent: number; emailAccepted: number; emailUnknown: number; emailFailed: number }> {
  const tick = await rpc(admin, 'tick_hosting_reminders', { p_limit: config.batchSize, p_email_enabled: config.email !== null }, signal)
  if (!Number.isInteger(tick?.inAppSent) || tick.inAppSent < 0 || tick.inAppSent > config.batchSize) throw unavailable()
  const result = { inAppSent: tick.inAppSent, emailAccepted: 0, emailUnknown: 0, emailFailed: 0 }
  if (!config.email) return result
  for (let i = 0; i < config.batchSize && !signal?.aborted; i++) {
    const claimed = await rpc(admin, 'claim_hosting_reminder_email', {}, signal)
    if (claimed === null) break
    const item = payload(claimed)
    const begun = await rpc(admin, 'begin_hosting_reminder_email', { p_id: item.id, p_token: item.token }, signal)
    if (['canceled','unknown','sent'].includes(begun?.status)) continue
    if (begun?.status !== 'outbound') throw unavailable()
    const current = payload(begun)
    if (current.id !== item.id || current.token !== item.token || current.orderId !== item.orderId || current.projectId !== item.projectId || current.expiresAt !== item.expiresAt || current.daysBefore !== item.daysBefore) throw unavailable()
    let status: 'sent' | 'unknown' | 'failed' = 'unknown', receipt: string | null = null
    try {
      await bounded(signal, 15000, async outboundSignal => {
        const response = await fetcher('https://api.resend.com/emails', {
          method: 'POST', redirect: 'error', signal: outboundSignal,
          headers: { Authorization: `Bearer ${config.email!.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `hosting-reminder/${current.id}` },
          body: JSON.stringify({ from: config.email!.from, to: [current.email], subject: 'Your project hosting period ends soon',
            text: `Your project hosting period ends on ${new Date(current.expiresAt).toISOString().slice(0,10)} (UTC). Review your project and download your archive before that date.\n${config.email!.webOrigin}/en/dashboard/projects/${current.projectId}` }),
        })
        if (!response.ok) {
          // Timeouts, rate limits, conflicts and server failures may follow acceptance.
          if (response.status >= 400 && response.status < 500 && ![408,409,425,429].includes(response.status)) status = 'failed'
          void response.body?.cancel().catch(() => {})
          return
        }
        receipt = await readReceipt(response, outboundSignal); status = 'sent'
      })
    } catch { status = 'unknown'; receipt = null }
    // Shutdown still gets an independent bounded receipt attempt; never resend on acknowledgement loss.
    const completed = await rpc(admin, 'complete_hosting_reminder_email', { p_id: current.id, p_token: current.token, p_status: status, p_receipt: receipt })
    if (!['sent','unknown','failed','canceled'].includes(completed?.status)) throw unavailable()
    if (completed.status === 'sent') result.emailAccepted++
    else if (completed.status === 'unknown') result.emailUnknown++
    else if (completed.status === 'failed') result.emailFailed++
  }
  return result
}
