/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '../route'

describe('POST /api/payments/webhook', () => {
  const originalFlag = process.env.MEDIA_ASSETS_ENABLED
  const originalSecret = process.env.PAYMENT_WEBHOOK_SECRET

  afterEach(() => {
    process.env.MEDIA_ASSETS_ENABLED = originalFlag
    process.env.PAYMENT_WEBHOOK_SECRET = originalSecret
  })

  it('returns 503 when MEDIA_ASSETS_ENABLED is not enabled', async () => {
    delete process.env.MEDIA_ASSETS_ENABLED
    const req = new NextRequest('http://localhost:3000/api/payments/webhook', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(503)
  })

  it('returns 401 when x-saga-webhook-secret does not match PAYMENT_WEBHOOK_SECRET', async () => {
    process.env.MEDIA_ASSETS_ENABLED = 'true'
    process.env.PAYMENT_WEBHOOK_SECRET = 'expected-secret-123'
    const req = new NextRequest('http://localhost:3000/api/payments/webhook', {
      method: 'POST',
      headers: { 'x-saga-webhook-secret': 'wrong-secret' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
