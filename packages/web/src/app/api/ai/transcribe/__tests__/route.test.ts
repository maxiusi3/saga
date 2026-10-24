/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
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
      error: 'Audio file too large. Maximum size is 4MB for direct upload.',
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

  it.each([undefined, 0, 0.2, -1, 2])('returns only a valid provider confidence (%s), never a synthetic default', async confidence => {
    const previousKey = process.env.SILICONFLOW_API_KEY
    const previousFetch = global.fetch
    process.env.SILICONFLOW_API_KEY = 'test-only-key'
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ text: 'Original words', confidence }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    try {
      const form = new FormData()
      form.append('audio', new Blob(['test audio'], { type: 'audio/webm' }), 'test.webm')
      const response = await POST(new NextRequest('http://localhost/api/ai/transcribe', { method: 'POST', body: form }))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.text).toBe('Original words')
      expect(body.confidence).toBe(confidence === 0 || confidence === 0.2 ? confidence : undefined)
    } finally {
      if (previousKey === undefined) delete process.env.SILICONFLOW_API_KEY
      else process.env.SILICONFLOW_API_KEY = previousKey
      global.fetch = previousFetch
    }
  })
})
