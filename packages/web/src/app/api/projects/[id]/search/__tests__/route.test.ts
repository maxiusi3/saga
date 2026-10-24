/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '../route'

describe('GET /api/projects/[id]/search', () => {
  const originalFlag = process.env.MEDIA_ASSETS_ENABLED

  afterEach(() => {
    process.env.MEDIA_ASSETS_ENABLED = originalFlag
  })

  it('returns 503 when MEDIA_ASSETS_ENABLED is not enabled', async () => {
    delete process.env.MEDIA_ASSETS_ENABLED
    const req = new NextRequest('http://localhost:3000/api/projects/proj-1/search?q=Chicago')
    const res = await GET(req, { params: Promise.resolve({ id: 'proj-1' }) })
    expect(res.status).toBe(503)
  })
})
