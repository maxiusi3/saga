/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET, POST } from '../route'

const mockGetSupabaseAdmin = jest.fn(() => ({
  rpc: jest.fn(),
  from: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}))

describe('/api/admin/cleanup-invitations', () => {
  const originalSecret = process.env.ADMIN_CRON_SECRET

  beforeEach(() => {
    mockGetSupabaseAdmin.mockClear()
  })

  afterEach(() => {
    process.env.ADMIN_CRON_SECRET = originalSecret
  })

  it('rejects POST without x-cron-secret', async () => {
    process.env.ADMIN_CRON_SECRET = 'secret-1'
    const request = new NextRequest('http://localhost/api/admin/cleanup-invitations', { method: 'POST' })

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('rejects GET without x-cron-secret', async () => {
    process.env.ADMIN_CRON_SECRET = 'secret-1'
    const request = new NextRequest('http://localhost/api/admin/cleanup-invitations', { method: 'GET' })

    const response = await GET(request)

    expect(response.status).toBe(401)
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('rejects mismatched x-cron-secret before Supabase admin access', async () => {
    process.env.ADMIN_CRON_SECRET = 'secret-1'
    const request = new NextRequest('http://localhost/api/admin/cleanup-invitations', {
      method: 'POST',
      headers: { 'x-cron-secret': 'wrong-secret' },
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('returns 503 before Supabase admin access when cron secret is not configured', async () => {
    delete process.env.ADMIN_CRON_SECRET
    const request = new NextRequest('http://localhost/api/admin/cleanup-invitations', {
      method: 'GET',
      headers: { 'x-cron-secret': 'secret-1' },
    })

    const response = await GET(request)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Admin cron secret is not configured' })
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled()
  })
})
