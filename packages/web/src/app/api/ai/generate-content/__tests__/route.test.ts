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

  it.each([0, 0.2, undefined])('does not raise or fabricate the reported confidence %s', async confidence => {
    createChatCompletion.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      title: 'A memory', summary: 'The original account.', followUpQuestions: [], confidence,
    }) } }] })
    const { POST } = await import('../route')
    const response = await POST(new NextRequest('http://localhost/api/ai/generate-content', {
      method: 'POST', body: JSON.stringify({ transcript: 'The original account.' }),
    }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.summary).toBe('The original account.')
    expect(body.confidence).toBe(confidence)
  })

  it('keeps a valid draft without inventing follow-up questions when they are omitted', async () => {
    createChatCompletion.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      title: 'A memory', summary: 'The original account.',
    }) } }] })
    const { POST } = await import('../route')
    const response = await POST(new NextRequest('http://localhost/api/ai/generate-content', {
      method: 'POST', body: JSON.stringify({ transcript: 'The original account.' }),
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      title: 'A memory', summary: 'The original account.', followUpQuestions: [],
    })
  })

  it.each([{}, null, { title: 'A title', summary: {} }, { title: '', summary: 'Words' }, {
    title: 'A title', summary: 'Words', followUpQuestions: null,
  }])('rejects malformed model content %j without substituting a template', async content => {
    createChatCompletion.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(content) } }] })
    const { POST } = await import('../route')
    const response = await POST(new NextRequest('http://localhost/api/ai/generate-content', {
      method: 'POST', body: JSON.stringify({ transcript: 'Original words.' }),
    }))
    expect(response.status).toBe(502)
    const body = await response.json()
    expect(body.error).toBeTruthy()
    expect(body.summary).toBeUndefined()
  })
})
