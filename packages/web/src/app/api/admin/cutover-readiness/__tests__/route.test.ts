/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '../route'

const mockGetAuthenticatedUser = jest.fn()
const mockLoadSnapshot = jest.fn()

jest.mock('@/lib/server/operational-snapshot', () => ({
  ...jest.requireActual('@/lib/server/operational-snapshot'),
  loadOperationalSnapshot: (...args: unknown[]) => mockLoadSnapshot(...args),
}))

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}))

describe('GET /api/admin/cutover-readiness', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, MEDIA_ASSETS_ENABLED: 'true', ADMIN_CRON_SECRET: 'synthetic-ops-secret' }
    delete process.env.OPERATIONAL_PROJECT_COST_CAP_CENTS
    mockLoadSnapshot.mockReset().mockResolvedValue({ ok: false, reason: 'not_configured' })
    mockGetAuthenticatedUser.mockReset().mockResolvedValue({
      ok: true, user: { id: 'ordinary-family-member' }, headers: new Headers(),
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function request(headers: Record<string, string> = {}) {
    return new NextRequest('http://localhost:3000/api/admin/cutover-readiness', { headers })
  }

  it.each([undefined, 'false', 'TRUE'])('keeps the route closed for flag %s', async flag => {
    if (flag === undefined) delete process.env.MEDIA_ASSETS_ENABLED
    else process.env.MEDIA_ASSETS_ENABLED = flag
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(mockLoadSnapshot).not.toHaveBeenCalled()
    expect(mockGetAuthenticatedUser).not.toHaveBeenCalled()
  })

  it.each([
    {},
    { authorization: 'Bearer ordinary-user-token' },
    { 'x-cron-secret': 'wrong-secret' },
  ])('rejects callers without the server-only operations credential: %j', async headers => {
    const res = await GET(request(headers))
    expect(res.status).toBe(401)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(mockLoadSnapshot).not.toHaveBeenCalled()
    expect(mockGetAuthenticatedUser).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('fails closed if the operations credential is not configured', async () => {
    delete process.env.ADMIN_CRON_SECRET
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(mockLoadSnapshot).not.toHaveBeenCalled()
  })

  it('reports missing operational observations instead of fabricated healthy metrics', async () => {
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toContain('no-store')
    await expect(res.json()).resolves.toMatchObject({
      status: 'not_ready',
      operationalHealth: {
        status: 'unavailable',
        reason: 'not_configured',
        source: 'unavailable',
        coverage: 'partial',
        snapshot: null,
        containsPrivateFamilyText: false,
        alerts: [],
      },
    })
    expect(mockLoadSnapshot).toHaveBeenCalledTimes(1)
    expect(mockLoadSnapshot).toHaveBeenCalledWith(expect.any(AbortSignal))
  })

  it('exposes actual partial observations and alerts without approving cutover or alert delivery', async () => {
    process.env.OPERATIONAL_PROJECT_COST_CAP_CENTS = '500'
    const snapshot = {
      schemaVersion: 2, observedAt: '2026-10-29T05:00:00.000Z',
      processing: { stalledJobsCount: 2, maxRunnableBacklogAgeSeconds: 1800, invalidJobCount: 0 },
      costs: { maxProjectKnownExposureCents: 751, unknownAttemptCostsCount: 0 },
      deletions: { overdueRequestsCount: 1, invalidRequestCount: 0 },
      exports: {
        scope: 'synchronous_archive_assembly', windowMinutes: 60,
        coverageStartedAt: '2026-10-29T04:30:00.000Z', windowComplete: false,
        integrityFailuresCount: 1, unsettledAttemptsCount: 1, invalidAttemptsCount: 0,
      },
    }
    mockLoadSnapshot.mockResolvedValue({ ok: true, snapshot })
    const req = request({ 'x-cron-secret': 'synthetic-ops-secret' })
    const res = await GET(req)
    const body = await res.json()
    expect(mockLoadSnapshot).toHaveBeenCalledWith(req.signal)
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(body).toMatchObject({
      status: 'not_ready',
      operationalHealth: { status: 'critical', coverage: 'partial', source: 'database_ledger', snapshot },
      alertDelivery: { status: 'unavailable', reason: 'responder_and_delivery_not_verified' },
    })
    expect(body.operationalHealth.unavailableMetrics).toEqual(['uploads', 'export_observation_window', 'export_outcome_completeness'])
    expect(body.operationalHealth.alerts.map((alert: { code: string }) => alert.code)).toEqual([
      'job_backlog_stalled', 'project_cost_anomaly', 'deletion_sla_breach', 'export_integrity_failure',
    ])
    expect(body.providerProbes.every((probe: { status: string }) => probe.status === 'blocked_by_policy')).toBe(true)
  })

  it.each(['database_unavailable', 'invalid_snapshot', 'request_interrupted'])('fails closed on %s', async reason => {
    mockLoadSnapshot.mockResolvedValue({ ok: false, reason })
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    await expect(res.json()).resolves.toMatchObject({
      status: 'not_ready', operationalHealth: { status: 'unavailable', reason, snapshot: null },
    })
  })

  it('does not infer provider data-policy approval from configured API keys', async () => {
    process.env.ELEVENLABS_API_KEY = 'synthetic-elevenlabs-key'
    process.env.ANTHROPIC_API_KEY = 'synthetic-anthropic-key'
    process.env.VOYAGE_API_KEY = 'synthetic-voyage-key'
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    const body = await res.json()
    expect(body.providerProbes).toHaveLength(3)
    for (const probe of body.providerProbes) {
      expect(probe).toMatchObject({
        mode: 'dry_run_contract_check', policyCompliant: false,
        readyForLiveProbe: false, status: 'blocked_by_policy',
      })
    }
    expect(JSON.stringify(body)).not.toContain('synthetic-ops-secret')
    expect(JSON.stringify(body)).not.toContain('synthetic-elevenlabs-key')
  })

  it('does not let the operations secret bypass the media feature switch', async () => {
    delete process.env.MEDIA_ASSETS_ENABLED
    const req = request({ 'x-cron-secret': 'synthetic-ops-secret' })
    const res = await GET(req)
    expect(res.status).toBe(503)
  })
})
