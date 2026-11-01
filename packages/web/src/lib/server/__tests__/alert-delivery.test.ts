/** @jest-environment node */
import {
  buildOperationalAlertPayload,
  AlertSuppressionLedger,
  defaultSuppressionLedger,
  clearInFlightDispatches,
  evaluateAlertDeliveryStatus,
  dispatchOperationalAlert,
  type AlertDeliveryConfig,
} from '../alert-delivery'
import type { OperationalAlertItem } from '../cutover-readiness'

describe('Operational Alert Delivery & Responder Verification (§11)', () => {
  const originalEnv = process.env
  const alert: OperationalAlertItem = {
    code: 'upload_failure_spike',
    severity: 'critical',
    responderRole: 'primary_developer_oncall',
    summary: 'Client-reported upload failure rate 30.0% (3/10) in 60m window',
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-01T08:00:00.000Z'))
    jest.resetAllMocks()
    defaultSuppressionLedger.clear()
    clearInFlightDispatches()
    process.env = { ...originalEnv }
    delete process.env.OPERATIONAL_ALERT_WEBHOOK_URL
    delete process.env.OPERATIONAL_ALERT_RESPONDER_CONFIRMED
  })

  afterEach(() => {
    defaultSuppressionLedger.clear()
    clearInFlightDispatches()
    process.env = originalEnv
    jest.useRealTimers()
  })

  describe('buildOperationalAlertPayload', () => {
    it('constructs sanitized payload without leaking private family details', () => {
      const payload = buildOperationalAlertPayload(alert)
      expect(payload).toEqual({
        schemaVersion: 1,
        code: 'upload_failure_spike',
        severity: 'critical',
        responderRole: 'primary_developer_oncall',
        summary: 'Client-reported upload failure rate 30.0% (3/10) in 60m window',
        fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
        timestamp: '2026-11-01T08:00:00.000Z',
      })
      expect(Object.keys(payload).sort()).toEqual([
        'code',
        'fingerprint',
        'responderRole',
        'schemaVersion',
        'severity',
        'summary',
        'timestamp',
      ])
    })

    it('generates deterministic fingerprint for identical alert code and summary', () => {
      const p1 = buildOperationalAlertPayload(alert)
      const p2 = buildOperationalAlertPayload({ ...alert })
      expect(p1.fingerprint).toBe(p2.fingerprint)

      const p3 = buildOperationalAlertPayload({ ...alert, summary: 'different summary' })
      expect(p3.fingerprint).not.toBe(p1.fingerprint)
    })
  })

  describe('AlertSuppressionLedger', () => {
    it('suppresses duplicate alerts within the suppression window', () => {
      const ledger = new AlertSuppressionLedger({ windowMs: 600_000, maxEntries: 100 })
      expect(ledger.shouldSuppress('fingerprint-1')).toBe(false)
      ledger.record('fingerprint-1')
      expect(ledger.shouldSuppress('fingerprint-1')).toBe(true)

      // Different fingerprint is not suppressed
      expect(ledger.shouldSuppress('fingerprint-2')).toBe(false)

      // After window passes, suppression expires
      jest.advanceTimersByTime(600_001)
      expect(ledger.shouldSuppress('fingerprint-1')).toBe(false)
    })

    it('bounds memory consumption and purges expired entries when capacity is reached', () => {
      const ledger = new AlertSuppressionLedger({ windowMs: 1_000, maxEntries: 2 })
      ledger.record('fp-1')
      ledger.record('fp-2')
      expect(ledger.shouldSuppress('fp-1')).toBe(true)
      expect(ledger.shouldSuppress('fp-2')).toBe(true)
      expect(ledger.size).toBe(2)

      // Adding 3rd entry triggers cleanup of expired
      jest.advanceTimersByTime(1_001)
      ledger.record('fp-3')
      expect(ledger.shouldSuppress('fp-3')).toBe(true)
      expect(ledger.shouldSuppress('fp-1')).toBe(false)
    })

    it('re-recording an existing fingerprint updates LRU order without prematurely evicting unrelated keys', () => {
      const ledger = new AlertSuppressionLedger({ windowMs: 10_000, maxEntries: 2 })
      ledger.record('fp-1')
      ledger.record('fp-2')
      expect(ledger.size).toBe(2)

      // Re-recording fp-1 should refresh it to tail, not evict fp-2
      ledger.record('fp-1')
      expect(ledger.size).toBe(2)
      expect(ledger.shouldSuppress('fp-1')).toBe(true)
      expect(ledger.shouldSuppress('fp-2')).toBe(true)

      // Now adding fp-3 at capacity should evict fp-2 (the oldest), leaving fp-1 and fp-3
      ledger.record('fp-3')
      expect(ledger.size).toBe(2)
      expect(ledger.shouldSuppress('fp-1')).toBe(true)
      expect(ledger.shouldSuppress('fp-3')).toBe(true)
      expect(ledger.shouldSuppress('fp-2')).toBe(false)
    })

    it('supports clear() and size reporting', () => {
      const ledger = new AlertSuppressionLedger({ windowMs: 10_000, maxEntries: 10 })
      ledger.record('fp-1')
      ledger.record('fp-2')
      expect(ledger.size).toBe(2)
      ledger.clear()
      expect(ledger.size).toBe(0)
      expect(ledger.shouldSuppress('fp-1')).toBe(false)
    })
  })

  describe('evaluateAlertDeliveryStatus', () => {
    it('returns unavailable when webhook url or responder confirmation is missing', () => {
      expect(evaluateAlertDeliveryStatus()).toEqual({
        status: 'unavailable',
        reason: 'responder_and_delivery_not_verified',
      })

      // Even if webhook is set, without responder confirmation it stays unavailable
      process.env.OPERATIONAL_ALERT_WEBHOOK_URL = 'https://alerts.internal.example/webhook'
      expect(evaluateAlertDeliveryStatus()).toEqual({
        status: 'unavailable',
        reason: 'responder_and_delivery_not_verified',
      })
    })

    it.each([
      '',
      'not-a-url',
      'ftp://invalid.scheme/webhook',
      'http://insecure.example.com/webhook', // plaintext HTTP rejected
      'https://user:pass@alerts.example.com/webhook', // credentials rejected
      'https://127.0.0.1/webhook', // loopback rejected
      'https://localhost/webhook', // localhost rejected
      'https://service.internal/webhook', // internal domain rejected
      'https://169.254.169.254/latest/meta-data', // cloud metadata rejected
      'https://10.0.0.1/webhook', // private IPv4 rejected
      'https://192.168.1.1/webhook', // private IPv4 rejected
      'https://172.16.0.1/webhook', // private IPv4 rejected
      'https://[::1]/webhook', // IPv6 loopback rejected
      'https://[fe80::1]/webhook', // IPv6 link-local rejected
      'https://[fc00::1]/webhook', // IPv6 unique local rejected
      'https://[::ffff:127.0.0.1]/webhook', // IPv4-mapped IPv6 loopback rejected
      'https://alerts.example.com/web\nhook', // embedded newline control char rejected
      'https://alerts.example.com/web hook', // inner space rejected
    ])('rejects malformed, insecure or SSRF target url %j', url => {
      process.env.OPERATIONAL_ALERT_WEBHOOK_URL = url
      process.env.OPERATIONAL_ALERT_RESPONDER_CONFIRMED = 'true'
      expect(evaluateAlertDeliveryStatus()).toEqual({
        status: 'unavailable',
        reason: 'responder_and_delivery_not_verified',
      })
    })

    it('returns verified status only when both valid https url and responder confirmation are present', () => {
      process.env.OPERATIONAL_ALERT_WEBHOOK_URL = 'https://alerts.ops.example.com/webhook'
      process.env.OPERATIONAL_ALERT_RESPONDER_CONFIRMED = 'true'
      expect(evaluateAlertDeliveryStatus()).toEqual({
        status: 'verified',
        channel: 'https://alerts.ops.example.com/webhook',
        responderRole: 'primary_developer_oncall',
      })
    })
  })

  describe('dispatchOperationalAlert', () => {
    const fetchMock = jest.fn()
    const config: AlertDeliveryConfig = {
      webhookUrl: 'https://alerts.ops.example.com/webhook',
      responderConfirmed: true,
      fetchImpl: fetchMock as any,
    }

    it('fails closed when delivery is unverified without attempting network call', async () => {
      const res = await dispatchOperationalAlert(alert, {
        webhookUrl: undefined,
        responderConfirmed: false,
        fetchImpl: fetchMock as any,
      })
      expect(res).toEqual({
        ok: false,
        reason: 'responder_and_delivery_not_verified',
      })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('validates config.webhookUrl and rejects insecure or SSRF URLs passed via config', async () => {
      const res = await dispatchOperationalAlert(alert, {
        webhookUrl: 'http://169.254.169.254/latest/meta-data',
        responderConfirmed: true,
        fetchImpl: fetchMock as any,
      })
      expect(res).toEqual({
        ok: false,
        reason: 'responder_and_delivery_not_verified',
      })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('dispatches sanitized payload to verified channel and cancels response body', async () => {
      const cancelMock = jest.fn().mockResolvedValue(undefined)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: { cancel: cancelMock },
      })
      const ledger = new AlertSuppressionLedger({ windowMs: 600_000, maxEntries: 100 })
      const res = await dispatchOperationalAlert(alert, { ...config, suppressionLedger: ledger })

      expect(res).toEqual({
        ok: true,
        delivered: true,
        status: 200,
      })
      expect(cancelMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith('https://alerts.ops.example.com/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"code":"upload_failure_spike"'),
        signal: expect.any(AbortSignal),
      })

      // Next dispatch of same alert is suppressed
      const res2 = await dispatchOperationalAlert(alert, { ...config, suppressionLedger: ledger })
      expect(res2).toEqual({
        ok: true,
        delivered: false,
        suppressed: true,
      })
      expect(fetchMock).toHaveBeenCalledTimes(1) // not called again
    })

    it('formats body with msg_type and content for Feishu webhook endpoints', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: { cancel: jest.fn().mockResolvedValue(undefined) },
      })
      const ledger = new AlertSuppressionLedger({ windowMs: 600_000, maxEntries: 100 })
      const res = await dispatchOperationalAlert(alert, {
        webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/4b47faed-9c07-4d1e-b8d1-d24d8a03b73c',
        responderConfirmed: true,
        suppressionLedger: ledger,
        fetchImpl: fetchMock as any,
      })
      expect(res.ok).toBe(true)
      const call = fetchMock.mock.calls[0]
      const sentBody = JSON.parse(call[1].body)
      expect(sentBody.msg_type).toBe('text')
      expect(sentBody.content.text).toContain('saga')
      expect(sentBody.code).toBe('upload_failure_spike')
    })

    it('deduplicates concurrent in-flight dispatches for the same alert to prevent alert storm', async () => {
      let finishRequest!: (value: any) => void
      fetchMock.mockImplementationOnce(() => new Promise((resolve) => {
        finishRequest = resolve
      }))

      const ledger = new AlertSuppressionLedger({ windowMs: 600_000, maxEntries: 100 })
      const p1 = dispatchOperationalAlert(alert, { ...config, suppressionLedger: ledger })
      const p2 = dispatchOperationalAlert(alert, { ...config, suppressionLedger: ledger })

      // Second call while p1 is in-flight should be suppressed or deduplicated
      expect(fetchMock).toHaveBeenCalledTimes(1)

      finishRequest({ ok: true, status: 200, body: { cancel: jest.fn().mockResolvedValue(undefined) } })
      const [r1, r2] = await Promise.all([p1, p2])

      expect(r1).toEqual({ ok: true, delivered: true, status: 200 })
      expect(r2).toEqual({ ok: true, delivered: false, suppressed: true })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('bounds dispatch timeout to 5000ms with AbortSignal', async () => {
      let aborted = false
      fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
        return new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => {
            aborted = true
            reject(new Error('dispatch aborted by deadline'))
          })
        })
      })

      const pending = dispatchOperationalAlert(alert, config)
      await jest.advanceTimersByTimeAsync(5000)
      const res = await pending

      expect(aborted).toBe(true)
      expect(res).toEqual({
        ok: false,
        reason: 'dispatch_timeout',
      })
    })

    it('handles callerSignal pre-aborted and in-flight cancellation', async () => {
      // 1. Pre-aborted caller signal
      const preAborted = new AbortController()
      preAborted.abort()
      const resPre = await dispatchOperationalAlert(alert, config, preAborted.signal)
      expect(resPre).toEqual({
        ok: false,
        reason: 'dispatch_timeout',
      })
      expect(fetchMock).not.toHaveBeenCalled()

      // 2. Mid-flight caller abort
      let abortedSignal: AbortSignal | undefined
      fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
        abortedSignal = init.signal
        return new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new Error('caller aborted'))
          })
        })
      })

      const inFlightController = new AbortController()
      const pendingInFlight = dispatchOperationalAlert(alert, config, inFlightController.signal)
      inFlightController.abort()

      const resInFlight = await pendingInFlight
      expect(resInFlight).toEqual({
        ok: false,
        reason: 'dispatch_timeout',
      })
      expect(abortedSignal?.aborted).toBe(true)
    })

    it('handles remote HTTP failure without leaking secrets', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        body: { cancel: jest.fn().mockResolvedValue(undefined) },
      })
      const res = await dispatchOperationalAlert(alert, config)
      expect(res).toEqual({
        ok: false,
        reason: 'delivery_failed',
        statusCode: 502,
      })
    })

    it('clears in-flight dispatches map via clearInFlightDispatches helper', async () => {
      let pendingResolve!: (val: any) => void
      fetchMock.mockImplementationOnce(() => new Promise((resolve) => { pendingResolve = resolve }))

      const p1 = dispatchOperationalAlert(alert, config)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      // Clearing in-flight map resets tracking
      clearInFlightDispatches()

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, body: { cancel: jest.fn().mockResolvedValue(undefined) } })
      const p2 = dispatchOperationalAlert(alert, config)
      expect(fetchMock).toHaveBeenCalledTimes(2)

      pendingResolve({ ok: true, status: 200, body: { cancel: jest.fn().mockResolvedValue(undefined) } })
      await Promise.all([p1, p2])
    })
  })
})
