/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAiRequest } from '@/lib/server/ai-guard'

const createChatCompletion = jest.fn()
const openAiConstructor = jest.fn()
const requireProjectAccess = jest.fn()
const createAgentRun = jest.fn()
const completeAgentRun = jest.fn()
const failAgentRun = jest.fn()
const storyMaybeSingle = jest.fn()

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

jest.mock('@/lib/server/project-access', () => ({
  requireProjectAccess: (...args: unknown[]) => requireProjectAccess(...args),
}))

jest.mock('@/lib/server/agent-store', () => ({
  createAgentRun: (...args: unknown[]) => createAgentRun(...args),
  completeAgentRun: (...args: unknown[]) => completeAgentRun(...args),
  failAgentRun: (...args: unknown[]) => failAgentRun(...args),
}))

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: storyMaybeSingle,
        }),
      }),
    }),
  }),
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
    requireProjectAccess.mockReset().mockResolvedValue({ ok: true })
    createAgentRun.mockReset().mockResolvedValue({ id: 'run-meta-1' })
    completeAgentRun.mockReset().mockResolvedValue({ id: 'run-meta-1', status: 'completed' })
    failAgentRun.mockReset().mockResolvedValue({ id: 'run-meta-1', status: 'failed' })
    storyMaybeSingle.mockReset().mockResolvedValue({ data: { id: 'story-1', project_id: 'project-1' }, error: null })
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
    expect(requireProjectAccess).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
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

  it('verifies project access and persists agent_runs audit when projectId and storyId are provided', async () => {
    const { POST } = await import('../route')
    const response = await POST(new NextRequest('http://localhost/api/ai/generate-content', {
      method: 'POST',
      body: JSON.stringify({
        transcript: 'Private family recollection.',
        projectId: 'project-1',
        storyId: 'story-1',
        language: 'en',
      }),
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.agentRunId).toBe('run-meta-1')
    expect(requireProjectAccess).toHaveBeenCalledWith('project-1', { id: 'user-1' })
    expect(createAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentType: 'editor_librarian',
      projectId: 'project-1',
      storyId: 'story-1',
      createdBy: 'user-1',
      contentHash: null,
    }))
    expect(completeAgentRun).toHaveBeenCalledWith('run-meta-1', expect.objectContaining({
      taskId: 'story_metadata',
      model: 'glm-5.1',
    }))
  })

  it('denies access with rate-limit headers and makes no provider or audit calls when project access fails', async () => {
    requireProjectAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
    })
    const { POST } = await import('../route')
    const response = await POST(new NextRequest('http://localhost/api/ai/generate-content', {
      method: 'POST',
      body: JSON.stringify({
        transcript: 'Private family recollection.',
        projectId: 'project-forbidden',
      }),
    }))

    expect(response.status).toBe(403)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('30')
    expect(createChatCompletion).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
  })

  it('rejects mismatched storyId and projectId before calling the provider', async () => {
    storyMaybeSingle.mockResolvedValue({ data: { id: 'story-1', project_id: 'other-project' }, error: null })
    const { POST } = await import('../route')
    const response = await POST(new NextRequest('http://localhost/api/ai/generate-content', {
      method: 'POST',
      body: JSON.stringify({
        transcript: 'Private family recollection.',
        projectId: 'project-1',
        storyId: 'story-1',
      }),
    }))

    expect(response.status).toBe(403)
    expect(createChatCompletion).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
  })
})
