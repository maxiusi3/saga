/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '../route'

const mockGetAuthenticatedUser = jest.fn()
const mockGetSupabaseAdmin = jest.fn()
const mockOrder = jest.fn()
const mockSelect = jest.fn(() => ({ order: mockOrder }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))

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
    mockGetSupabaseAdmin.mockReset().mockReturnValue({ from: mockFrom })
    mockOrder.mockReset().mockResolvedValue({ data: [], error: null })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function request(headers: Record<string, string> = {}) {
    return new NextRequest('http://localhost:3000/api/admin/pilot-analytics', { headers })
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
    expect(mockFrom).toHaveBeenCalledWith('pilot_households')
    expect(mockOrder).toHaveBeenCalledWith('enrolled_at', { ascending: true })
    const body = await res.json()
    expect(body).toHaveProperty('recommendation.requiresOwnerDecision', true)
  })

  it('reports unavailable database configuration without exposing its error', async () => {
    mockGetSupabaseAdmin.mockImplementation(() => { throw new Error('private connection details') })
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(503)
    expect(await res.text()).not.toContain('private connection details')
  })

  it('reports a ledger query error without exposing private data', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'private cohort details' } })
    const res = await GET(request({ 'x-cron-secret': 'synthetic-ops-secret' }))
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('private cohort details')
  })
})
