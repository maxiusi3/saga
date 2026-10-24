/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '../route'

describe('GET /api/admin/pilot-analytics', () => {
  const originalFlag = process.env.MEDIA_ASSETS_ENABLED

  afterEach(() => {
    process.env.MEDIA_ASSETS_ENABLED = originalFlag
  })

  it('returns 503 when MEDIA_ASSETS_ENABLED is not enabled', async () => {
    delete process.env.MEDIA_ASSETS_ENABLED
    const req = new NextRequest('http://localhost:3000/api/admin/pilot-analytics')
    const res = await GET(req)
    expect(res.status).toBe(503)
  })
})
