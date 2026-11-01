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
    process.env = { ...originalEnv, MEDIA_ASSETS_ENABLED: 'true', ADMIN_CRON_SECRET: 'synthetic-ops-secret', OPERATIONAL_COLLECTOR_BUILD_HASH: 'a'.repeat(64) }
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
      schemaVersion: 4, observedAt: '2026-10-29T05:00:00.000Z',
      processing: { stalledJobsCount: 2, maxRunnableBacklogAgeSeconds: 1800, invalidJobCount: 0 },
      costs: { maxProjectKnownExposureCents: 751, unknownAttemptCostsCount: 0 },
      deletions: { overdueRequestsCount: 1, invalidRequestCount: 0 },
      exports: {
        scope: 'synchronous_archive_assembly', windowMinutes: 60,
        coverageStartedAt: '2026-10-29T04:30:00.000Z', windowComplete: false,
        integrityFailuresCount: 1, unsettledAttemptsCount: 1, invalidAttemptsCount: 0,
      },
      uploads: {
        scope: 'project_hub_audio_put_reports', windowMinutes: 60,
        coverageStartedAt: '2026-10-29T03:00:00.000Z', windowComplete: true,
        evaluatedAttemptsCount: 10, reportedFailuresCount: 2, reportedCancellationsCount: 100,
        unsettledAttemptsCount: 0, invalidAttemptsCount: 0,
      },
      collectionCoverage: {
        exports: {
          scope: 'synchronous_archive_assembly', windowMinutes: 60,
          releaseHash: 'a'.repeat(64), cutoverAt: '2026-10-29T04:30:00.000Z', cutoverWindowComplete: false,
          matchingBuildAttemptsCount: 2, unattributedAttemptsCount: 0,
          staleBuildAttemptsCount: 0, invalidBuildAttemptsCount: 0, buildCoverageComplete: false,
        },
        uploads: {
          scope: 'project_hub_audio_put_reports', windowMinutes: 60,
          releaseHash: 'a'.repeat(64), cutoverAt: '2026-10-29T03:00:00.000Z', cutoverWindowComplete: true,
          matchingBuildAttemptsCount: 110, unattributedAttemptsCount: 0,
          staleBuildAttemptsCount: 0, invalidBuildAttemptsCount: 0, buildCoverageComplete: true,
        },
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
    expect(body.operationalHealth.unavailableMetrics).toEqual([
      'export_observation_window', 'export_outcome_completeness', 'export_collection_coverage', 'upload_collection_coverage',
    ])
    expect(body.operationalHealth.alerts.map((alert: { code: string }) => alert.code)).toEqual([
      'upload_failure_spike', 'job_backlog_stalled', 'project_cost_anomaly', 'deletion_sla_breach', 'export_integrity_failure',
    ])
    expect(body.operationalHealth.alerts[0].summary).toMatch(/^Client-reported/)
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

  it('does not let verified alert delivery approve overall cutover while collection or provider gaps remain', async () => {
    process.env.OPERATIONAL_ALERT_WEBHOOK_URL = 'https://alerts.internal.example/webhook'
    process.env.OPERATIONAL_ALERT_RESPONDER_CONFIRMED = 'true'
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.status).toBe('not_ready')
    expect(body.alertDelivery).toEqual({
      status: 'verified',
      channel: 'https://alerts.internal.example/webhook',
      responderRole: 'primary_developer_oncall',
    })
  })

  it('keeps alert delivery unavailable when webhook is configured but responder confirmation is missing', async () => {
    process.env.OPERATIONAL_ALERT_WEBHOOK_URL = 'https://alerts.internal.example/webhook'
    delete process.env.OPERATIONAL_ALERT_RESPONDER_CONFIRMED
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.status).toBe('not_ready')
    expect(body.alertDelivery).toEqual({
      status: 'unavailable',
      reason: 'responder_and_delivery_not_verified',
    })
  })

  it('evaluates verified provider evidence from environment while keeping endpoint not_ready', async () => {
    process.env.PROVIDER_POLICY_EVIDENCE_JSON = JSON.stringify([
      {
        provider: 'elevenlabs',
        accountOrOrgId: 'org-saga-verified-enterprise',
        modelId: 'scribe_v2',
        allowedRegions: ['us'],
        trainingOptOutConfirmed: true,
        zeroDataRetentionConfirmed: true,
        maxRetentionDaysAllowed: 0,
        evidenceDate: new Date().toISOString(),
        evidenceReference: 'DPA-2026-ELEVENLABS-VERIFIED',
      },
    ])
    // ElevenLabs has verified policy but missing API key
    delete process.env.ELEVENLABS_API_KEY

    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.status).toBe('not_ready')

    const elProbe = body.providerProbes.find((p: { provider: string }) => p.provider === 'elevenlabs')
    expect(elProbe).toMatchObject({
      provider: 'elevenlabs',
      policyCompliant: true,
      readyForLiveProbe: false,
      status: 'missing_api_key',
    })

    // Now configure the API key
    process.env.ELEVENLABS_API_KEY = 'sk-verified-live-key'
    const resWithKey = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    const bodyWithKey = await resWithKey.json()
    const elProbeReady = bodyWithKey.providerProbes.find((p: { provider: string }) => p.provider === 'elevenlabs')
    expect(elProbeReady).toMatchObject({
      provider: 'elevenlabs',
      policyCompliant: true,
      readyForLiveProbe: true,
      status: 'ready_for_live_probe',
    })
    // Overall endpoint still fails closed as not_ready
    expect(resWithKey.status).toBe(503)
    expect(bodyWithKey.status).toBe('not_ready')
  })

  it('fails closed when provider evidence is malformed or expired in environment', async () => {
    process.env.PROVIDER_POLICY_EVIDENCE_JSON = JSON.stringify([
      {
        provider: 'elevenlabs',
        accountOrOrgId: 'org-saga-expired',
        modelId: 'scribe_v2',
        allowedRegions: ['us'],
        trainingOptOutConfirmed: true,
        zeroDataRetentionConfirmed: true,
        maxRetentionDaysAllowed: 0,
        evidenceDate: '2025-01-01T00:00:00.000Z', // Expired > 90 days
        evidenceReference: 'DPA-2025-EXPIRED',
      },
    ])
    process.env.ELEVENLABS_API_KEY = 'sk-key'
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    const body = await res.json()
    const elProbe = body.providerProbes.find((p: { provider: string }) => p.provider === 'elevenlabs')
    expect(elProbe.status).toBe('blocked_by_policy')
    expect(elProbe.policyCompliant).toBe(false)
  })

  it('exposes schemeBBackup status as unverified by default and verified when valid ledger provided', async () => {
    // Default without ledger
    delete process.env.SCHEME_B_BACKUP_LEDGER_JSON
    const resDefault = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    const bodyDefault = await resDefault.json()
    expect(bodyDefault.schemeBBackup).toEqual({
      status: 'unverified',
      verified: false,
      reason: 'scheme_b_backup_not_rehearsed_or_verified',
    })

    // Configured valid ledger
    process.env.SCHEME_B_BACKUP_LEDGER_JSON = JSON.stringify({
      dumpSha256: 'a'.repeat(64),
      verifiedAt: '2026-10-24T08:50:00.000Z',
      survivingObjectsCount: 42,
      tombstonesReplayed: 1,
      driftDetected: false,
    })
    const resVerified = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    const bodyVerified = await resVerified.json()
    expect(bodyVerified.schemeBBackup).toEqual({
      status: 'verified',
      verified: true,
      dumpSha256: 'a'.repeat(64),
      verifiedAt: '2026-10-24T08:50:00.000Z',
      survivingObjectsCount: 42,
      tombstonesReplayed: 1,
    })
    // Overall endpoint still fails closed as not_ready
    expect(resVerified.status).toBe(503)
    expect(bodyVerified.status).toBe('not_ready')
  })

  it('fails closed when SCHEME_B_BACKUP_LEDGER_JSON is malformed JSON without crashing', async () => {
    process.env.SCHEME_B_BACKUP_LEDGER_JSON = '{"invalid_json'
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.status).toBe('not_ready')
    expect(body.schemeBBackup).toEqual({
      status: 'unverified',
      verified: false,
      reason: 'invalid_backup_ledger',
    })
  })

  it('reports storage_or_database_drift_detected when backup ledger detects drift', async () => {
    process.env.SCHEME_B_BACKUP_LEDGER_JSON = JSON.stringify({
      dumpSha256: 'a'.repeat(64),
      verifiedAt: '2026-10-24T08:50:00.000Z',
      survivingObjectsCount: 42,
      tombstonesReplayed: 1,
      driftDetected: true,
    })
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.schemeBBackup.status).toBe('unverified')
    expect(body.schemeBBackup.reason).toBe('storage_or_database_drift_detected')
  })

  it('does not let the operations secret bypass the media feature switch', async () => {
    delete process.env.MEDIA_ASSETS_ENABLED
    const req = request({ 'x-cron-secret': 'synthetic-ops-secret' })
    const res = await GET(req)
    expect(res.status).toBe(503)
  })
})
