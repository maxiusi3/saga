/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET, POST } from '../route'

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: jest.fn(() => ({
    rpc: jest.fn(),
    from: jest.fn(),
  })),
}))

describe('/api/admin/cleanup-invitations', () => {
  const originalSecret = process.env.ADMIN_CRON_SECRET

  afterEach(() => {
    process.env.ADMIN_CRON_SECRET = originalSecret
  })

  it('rejects POST without x-cron-secret', async () => {
    process.env.ADMIN_CRON_SECRET = 'secret-1'
    const request = new NextRequest('http://localhost/api/admin/cleanup-invitations', { method: 'POST' })

    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it('rejects GET without x-cron-secret', async () => {
    process.env.ADMIN_CRON_SECRET = 'secret-1'
    const request = new NextRequest('http://localhost/api/admin/cleanup-invitations', { method: 'GET' })

    const response = await GET(request)

    expect(response.status).toBe(401)
  })
})
