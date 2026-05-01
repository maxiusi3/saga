/**
 * @jest-environment node
 */

import { NextResponse } from 'next/server'
import { requireAiRequest } from '@/lib/server/ai-guard'
import { OPTIONS, POST } from '../route'

jest.mock('@/lib/server/ai-guard', () => ({
  requireAiRequest: jest.fn(async () => ({
    ok: true,
    user: { id: 'user-1' },
    headers: new Headers({ 'X-RateLimit-Limit': '30' }),
  })),
  jsonWithRateLimit: (body: unknown, headers: HeadersInit, status = 200) =>
    NextResponse.json(body, { status, headers }),
}))

describe('/api/ai/transcribe', () => {
  const requireAiRequestMock = requireAiRequest as jest.Mock
  const originalWebUrl = process.env.NEXT_PUBLIC_WEB_URL

  beforeEach(() => {
    requireAiRequestMock.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      headers: new Headers({ 'X-RateLimit-Limit': '30' }),
    })
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_WEB_URL = originalWebUrl
  })

  it('rejects oversized uploads from Content-Length before parsing form data', async () => {
    const formData = jest.fn()
    const request = {
      headers: new Headers({ 'content-length': String(26 * 1024 * 1024) }),
      formData,
    }

    const response = await POST(request as any)

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({
      error: 'Audio file too large. Maximum size is 25MB.',
    })
    expect(formData).not.toHaveBeenCalled()
  })

  it('does not parse form data when authentication fails', async () => {
    requireAiRequestMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const formData = jest.fn()
    const request = {
      headers: new Headers(),
      formData,
    }

    const response = await POST(request as any)

    expect(response.status).toBe(401)
    expect(formData).not.toHaveBeenCalled()
  })

  it('restricts preflight CORS origin to the configured web URL', async () => {
    process.env.NEXT_PUBLIC_WEB_URL = 'https://app.example.com'

    const response = await OPTIONS()

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization')
  })
})
