import { createHash } from 'crypto'
import { isIP } from 'net'
import type { OperationalAlertItem } from './cutover-readiness'

export interface OperationalAlertPayload {
  schemaVersion: 1
  code: OperationalAlertItem['code']
  severity: OperationalAlertItem['severity']
  responderRole: OperationalAlertItem['responderRole']
  summary: string
  fingerprint: string
  timestamp: string
}

export interface AlertDeliveryStatusUnavailable {
  status: 'unavailable'
  reason: 'responder_and_delivery_not_verified'
}

export interface AlertDeliveryStatusVerified {
  status: 'verified'
  channel: string
  responderRole: 'primary_developer_oncall'
}

export type AlertDeliveryStatus =
  | AlertDeliveryStatusUnavailable
  | AlertDeliveryStatusVerified

export interface AlertDeliveryConfig {
  webhookUrl?: string
  responderConfirmed?: boolean
  suppressionLedger?: AlertSuppressionLedger
  fetchImpl?: typeof fetch
}

export type AlertDispatchResult =
  | { ok: true; delivered: true; status: number }
  | { ok: true; delivered: false; suppressed: true }
  | { ok: false; reason: 'responder_and_delivery_not_verified' }
  | { ok: false; reason: 'dispatch_timeout' }
  | { ok: false; reason: 'delivery_failed'; statusCode?: number }

export class AlertSuppressionLedger {
  private readonly windowMs: number
  private readonly maxEntries: number
  private readonly entries = new Map<string, number>()

  constructor(options?: { windowMs?: number; maxEntries?: number }) {
    this.windowMs = Math.max(1, options?.windowMs ?? 600_000) // default 10 minutes
    this.maxEntries = Math.max(1, options?.maxEntries ?? 1000)
  }

  get size(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
  }

  shouldSuppress(fingerprint: string, nowMs = Date.now()): boolean {
    const recordedAt = this.entries.get(fingerprint)
    if (recordedAt === undefined) return false
    if (nowMs - recordedAt >= this.windowMs) {
      this.entries.delete(fingerprint)
      return false
    }
    return true
  }

  record(fingerprint: string, nowMs = Date.now()): void {
    // Delete first so re-inserted key moves to tail (latest in LRU order)
    this.entries.delete(fingerprint)

    if (this.entries.size >= this.maxEntries) {
      this.purgeExpired(nowMs)
      if (this.entries.size >= this.maxEntries) {
        const oldestKey = this.entries.keys().next().value
        if (oldestKey !== undefined) this.entries.delete(oldestKey)
      }
    }
    this.entries.set(fingerprint, nowMs)
  }

  private purgeExpired(nowMs: number): void {
    for (const [key, timestamp] of this.entries.entries()) {
      if (nowMs - timestamp >= this.windowMs) {
        this.entries.delete(key)
      }
    }
  }
}

export const defaultSuppressionLedger = new AlertSuppressionLedger()

// In-flight dispatches map to eliminate TOCTOU alert storm during concurrent failures
const inFlightDispatches = new Map<string, Promise<AlertDispatchResult>>()

export function clearInFlightDispatches(): void {
  inFlightDispatches.clear()
}

export function buildOperationalAlertPayload(
  alert: OperationalAlertItem,
  timestamp = new Date().toISOString(),
): OperationalAlertPayload {
  const hash = createHash('sha256')
    .update(JSON.stringify([alert.code, alert.severity, alert.responderRole, alert.summary]))
    .digest('hex')

  return {
    schemaVersion: 1,
    code: alert.code,
    severity: alert.severity,
    responderRole: alert.responderRole,
    summary: alert.summary,
    fingerprint: hash,
    timestamp,
  }
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.lan')
  ) {
    return true
  }

  const cleanHost = lower.replace(/^\[|\]$/g, '')
  const ipType = isIP(cleanHost)

  if (ipType === 4) {
    const parts = cleanHost.split('.').map(Number)
    if (parts[0] === 0 || parts[0] === 10 || parts[0] === 127) return true
    if (parts[0] === 169 && parts[1] === 254) return true // Link-local / Cloud metadata
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    if (parts[0] === 192 && parts[1] === 168) return true
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true // Carrier-grade NAT
    return false
  }

  if (ipType === 6) {
    if (cleanHost === '::1' || cleanHost === '::') return true
    if (/^f[cd][0-9a-f]{2}:/i.test(cleanHost)) return true // Unique Local Address (fc00::/7)
    if (/^fe[89ab][0-9a-f]:/i.test(cleanHost)) return true // Link-local (fe80::/10)
    // Reject IPv4-mapped IPv6 (::ffff:...) to prevent SSRF bypass
    if (/^::ffff:/i.test(cleanHost)) return true
    return false
  }

  return false
}

export function parseValidWebhookUrl(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Reject any control characters, whitespace, or newlines inside the URL string
  if (/[\s\x00-\x1F\x7F]/.test(trimmed)) return null

  try {
    const parsed = new URL(trimmed)
    // Require secure HTTPS protocol strictly
    if (parsed.protocol !== 'https:') return null
    // Reject embedded basic-auth user/password credentials
    if (parsed.username || parsed.password) return null
    // Reject missing, localhost, internal or private IP hosts
    if (!parsed.hostname || isPrivateOrLocalHost(parsed.hostname)) return null

    return parsed.href
  } catch {
    return null
  }
}

export function evaluateAlertDeliveryStatus(env: NodeJS.ProcessEnv = process.env): AlertDeliveryStatus {
  const webhookUrl = parseValidWebhookUrl(env.OPERATIONAL_ALERT_WEBHOOK_URL)
  const isConfirmed = env.OPERATIONAL_ALERT_RESPONDER_CONFIRMED === 'true'

  if (!webhookUrl || !isConfirmed) {
    return {
      status: 'unavailable',
      reason: 'responder_and_delivery_not_verified',
    }
  }

  return {
    status: 'verified',
    channel: webhookUrl,
    responderRole: 'primary_developer_oncall',
  }
}

export async function dispatchOperationalAlert(
  alert: OperationalAlertItem,
  config?: AlertDeliveryConfig,
  callerSignal?: AbortSignal,
): Promise<AlertDispatchResult> {
  const rawUrl = config?.webhookUrl ?? process.env.OPERATIONAL_ALERT_WEBHOOK_URL
  const webhookUrl = parseValidWebhookUrl(rawUrl)
  const isConfirmed = config?.responderConfirmed ?? (process.env.OPERATIONAL_ALERT_RESPONDER_CONFIRMED === 'true')

  if (!webhookUrl || !isConfirmed) {
    return { ok: false, reason: 'responder_and_delivery_not_verified' }
  }

  if (callerSignal?.aborted) {
    return { ok: false, reason: 'dispatch_timeout' }
  }

  const payload = buildOperationalAlertPayload(alert)
  const ledger = config?.suppressionLedger ?? defaultSuppressionLedger

  if (ledger.shouldSuppress(payload.fingerprint)) {
    return { ok: true, delivered: false, suppressed: true }
  }

  // De-duplicate concurrent in-flight dispatches for the same alert payload
  const existingInFlight = inFlightDispatches.get(payload.fingerprint)
  if (existingInFlight) {
    return { ok: true, delivered: false, suppressed: true }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)

  const abortListener = () => controller.abort()
  if (callerSignal) {
    callerSignal.addEventListener('abort', abortListener, { once: true })
  }

  const fetchFn = config?.fetchImpl ?? fetch

  const dispatchPromise = (async (): Promise<AlertDispatchResult> => {
    try {
      const res = await fetchFn(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      // Safely drain/cancel response stream if present
      if (res.body && typeof (res.body as any).cancel === 'function') {
        await (res.body as any).cancel().catch(() => {})
      }

      if (!res.ok) {
        return { ok: false, reason: 'delivery_failed', statusCode: res.status }
      }

      ledger.record(payload.fingerprint)
      return { ok: true, delivered: true, status: res.status }
    } catch {
      return {
        ok: false,
        reason: controller.signal.aborted ? 'dispatch_timeout' : 'delivery_failed',
      }
    } finally {
      clearTimeout(timer)
      if (callerSignal) {
        callerSignal.removeEventListener('abort', abortListener)
      }
      inFlightDispatches.delete(payload.fingerprint)
    }
  })()

  inFlightDispatches.set(payload.fingerprint, dispatchPromise)
  return dispatchPromise
}
