/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '../route'

const mockGetAuthenticatedUser = jest.fn()

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}))

describe('GET /api/admin/cutover-readiness', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, MEDIA_ASSETS_ENABLED: 'true', ADMIN_CRON_SECRET: 'synthetic-ops-secret' }
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
    expect(mockGetAuthenticatedUser).not.toHaveBeenCalled()
  })

  it.each([
    {},
    { authorization: 'Bearer ordinary-user-token' },
    { 'x-cron-secret': 'wrong-secret' },
  ])('rejects callers without the server-only operations credential: %j', async headers => {
    const res = await GET(request(headers))
    expect(res.status).toBe(401)
    expect(mockGetAuthenticatedUser).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('fails closed if the operations credential is not configured', async () => {
    delete process.env.ADMIN_CRON_SECRET
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(503)
  })

  it('reports missing operational observations instead of fabricated healthy metrics', async () => {
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toContain('no-store')
    await expect(res.json()).resolves.toMatchObject({
      status: 'not_ready',
      operationalHealth: {
        status: 'unavailable',
        reason: 'operational_metrics_not_connected',
        containsPrivateFamilyText: false,
        alerts: [],
      },
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
