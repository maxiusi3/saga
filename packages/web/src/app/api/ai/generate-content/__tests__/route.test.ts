/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAiRequest } from '@/lib/server/ai-guard'

const createChatCompletion = jest.fn()
const openAiConstructor = jest.fn()

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn((config: unknown) => {
    openAiConstructor(config)
    return {
      chat: {
        completions: {
          create: createChatCompletion,
        },
      },
    }
  }),
}))

jest.mock('@/lib/server/ai-guard', () => ({
  requireAiRequest: jest.fn(async () => ({
    ok: true,
    user: { id: 'user-1' },
    headers: new Headers({ 'X-RateLimit-Limit': '30' }),
  })),
  jsonWithRateLimit: (body: unknown, headers: HeadersInit, status = 200) =>
    NextResponse.json(body, { status, headers }),
}))

describe('/api/ai/generate-content', () => {
  const requireAiRequestMock = requireAiRequest as jest.Mock
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    process.env.TEXT_API_KEY = 'text-key'
    process.env.TEXT_API_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
    process.env.TEXT_MODEL = 'glm-5.1'
    requireAiRequestMock.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      headers: new Headers({ 'X-RateLimit-Limit': '30' }),
    })
    createChatCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: 'Story',
              summary: 'Summary',
              followUpQuestions: ['What happened next?'],
              confidence: 0.9,
            }),
          },
        },
      ],
    })
    openAiConstructor.mockClear()
    createChatCompletion.mockClear()
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('uses the configured GLM text model through an OpenAI-compatible client', async () => {
    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/ai/generate-content', {
      method: 'POST',
      body: JSON.stringify({
        transcript: 'A family story transcript.',
        prompt: 'Tell a memory.',
        language: 'en',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(openAiConstructor).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'text-key',
      baseURL: 'https://integrate.api.nvidia.com/v1',
    }))
    expect(createChatCompletion).toHaveBeenCalledWith(expect.objectContaining({
      model: 'glm-5.1',
    }))
  })
})
