/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '../route'

const mockGetAuthenticatedUser = jest.fn()
const mockGetSupabaseAdmin = jest.fn()
const mockRpc = jest.fn()

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}))
jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}))

describe('GET /api/admin/pilot-analytics', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, MEDIA_ASSETS_ENABLED: 'true', ADMIN_CRON_SECRET: 'synthetic-ops-secret' }
    jest.clearAllMocks()
    mockGetAuthenticatedUser.mockResolvedValue({
      ok: true, user: { id: 'ordinary-family-member' }, headers: new Headers(),
    })
    mockGetSupabaseAdmin.mockReset().mockReturnValue({ rpc: mockRpc })
    mockRpc.mockReset().mockResolvedValue({ data: { entries: [], batch: { closedAt: null, erasedHouseholds: 0 }, legacyUnclassifiedCount: 0 }, error: null })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function request(headers: Record<string, string> = {}) {
    return new NextRequest('http://localhost:3000/api/admin/pilot-analytics?cohort=pilot-test', { headers })
  }

  it.each([undefined, 'false', 'TRUE'])('keeps the route closed for flag %s', async flag => {
    if (flag === undefined) delete process.env.MEDIA_ASSETS_ENABLED
    else process.env.MEDIA_ASSETS_ENABLED = flag
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(503)
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled()
  })

  it.each([
    {},
    { authorization: 'Bearer ordinary-user-token' },
    { 'x-cron-secret': 'wrong-secret' },
  ])('rejects cross-family analytics access without an operations credential: %j', async headers => {
    const res = await GET(request(headers))
    expect(res.status).toBe(401)
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled()
    expect(mockGetAuthenticatedUser).not.toHaveBeenCalled()
  })

  it('fails closed before database access if the operations credential is not configured', async () => {
    delete process.env.ADMIN_CRON_SECRET
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(503)
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('allows the server-only credential without requiring a family session', async () => {
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(mockGetAuthenticatedUser).not.toHaveBeenCalled()
    expect(mockRpc).toHaveBeenCalledWith('read_pilot_cohort', { p_cohort: 'pilot-test', p_kind: 'observed' })
    const body = await res.json()
    expect(body).toHaveProperty('recommendation.requiresOwnerDecision', true)
  })

  it('requires a single explicit cohort before querying', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/admin/pilot-analytics', { headers: { 'x-cron-secret': 'synthetic-ops-secret' } }))
    expect(res.status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('renders a static protected HTML report with no executable script', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/admin/pilot-analytics?cohort=pilot-test&kind=synthetic&format=html', { headers: { 'x-cron-secret': 'synthetic-ops-secret' } }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
    const html = await res.text()
    expect(html).toContain('合成演练数据')
    expect(html).toContain('暂无样本')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('synthetic-ops-secret')
  })

  it('rejects malformed persisted evidence instead of producing a partial report', async () => {
    mockRpc.mockResolvedValue({ data: { entries: [{ revision: 1, recordedAt: 'invalid' }], batch: {} }, error: null })
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(500)
  })

  it('reports unavailable database configuration without exposing its error', async () => {
    mockGetSupabaseAdmin.mockImplementation(() => { throw new Error('private connection details') })
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(503)
    expect(await res.text()).not.toContain('private connection details')
  })

  it('reports a ledger query error without exposing private data', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'private cohort details' } })
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('private cohort details')
  })
})
