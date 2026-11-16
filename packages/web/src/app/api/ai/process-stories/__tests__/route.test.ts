/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'

const createChatCompletion = jest.fn()
const requireProjectAccess = jest.fn()
const createAgentRun = jest.fn()
const completeAgentRun = jest.fn()
const failAgentRun = jest.fn()

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => ({ chat: { completions: { create: createChatCompletion } } })),
}))

jest.mock('@/lib/server/ai-guard', () => ({
  requireAiRequest: jest.fn(async () => ({
    ok: true,
    user: { id: 'user-1' },
    headers: new Headers({ 'X-RateLimit-Limit': '30' }),
  })),
  jsonWithRateLimit: (body: unknown, headers: HeadersInit, status = 200) => NextResponse.json(body, { status, headers }),
}))

jest.mock('@/lib/server/project-access', () => ({
  requireProjectAccess: (...args: unknown[]) => requireProjectAccess(...args),
}))

jest.mock('@/lib/server/agent-store', () => ({
  createAgentRun: (...args: unknown[]) => createAgentRun(...args),
  completeAgentRun: (...args: unknown[]) => completeAgentRun(...args),
  failAgentRun: (...args: unknown[]) => failAgentRun(...args),
}))

const stories = [{ title: 'The farm', content: 'We lived on a farm in 1952.' }]

function post(body: unknown) {
  return new NextRequest('http://localhost/api/ai/process-stories', { method: 'POST', body: JSON.stringify(body) })
}

describe('/api/ai/process-stories', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv, TEXT_API_KEY: 'key', TEXT_MODEL: 'model', TEXT_MODEL_LONG_FORM: 'long-model' }
    createChatCompletion.mockReset()
    requireProjectAccess.mockReset().mockResolvedValue({ ok: true })
    createAgentRun.mockReset().mockResolvedValue({ id: 'run-proc-1' })
    completeAgentRun.mockReset().mockResolvedValue({ id: 'run-proc-1', status: 'completed' })
    failAgentRun.mockReset().mockResolvedValue({ id: 'run-proc-1', status: 'failed' })
    jest.spyOn(console, 'info').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('generates a validated chapter with the long-form model and the request locale fallback', async () => {
    createChatCompletion.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      title: 'Farm years', introduction: 'Intro', summary: 'Summary', themes: ['farm'], timeline: ['1952 — farm'], followUpQuestions: ['q?'],
    }) } }] })
    const { POST } = await import('../route')
    const response = await POST(post({ action: 'generate_chapter', stories, language: 'en' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(expect.objectContaining({
      title: 'Farm years', action: 'generate_chapter', storiesCount: 1, model: 'long-model', taskVersion: expect.any(String),
    }))
    expect(body.agentRunId).toBeUndefined()
    expect(requireProjectAccess).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
    const { messages, model } = createChatCompletion.mock.calls[0][0]
    expect(model).toBe('long-model')
    expect(messages[0].content).toContain('English')
    // No hard-coded Chinese user prompt regardless of locale.
    expect(messages[1].content).not.toContain('以下是')
    expect(messages[1].content).toContain('We lived on a farm in 1952.')
  })

  it('checks project access and records agent_runs audit when projectId is supplied', async () => {
    createChatCompletion.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      categories: ['work'], questions: [{ category: 'work', question: 'Who taught you the trade?' }], themes: ['craft'],
    }) } }] })
    const { POST } = await import('../route')
    const response = await POST(post({ action: 'suggest_questions', stories, projectId: 'project-1', language: 'en' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.agentRunId).toBe('run-proc-1')
    expect(requireProjectAccess).toHaveBeenCalledWith('project-1', { id: 'user-1' })
    expect(createAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentType: 'interview',
      projectId: 'project-1',
      contentHash: null,
    }))
    expect(completeAgentRun).toHaveBeenCalledWith('run-proc-1', expect.objectContaining({
      taskId: 'followup_project',
      model: 'long-model',
    }))
  })

  it('denies access when projectId is unauthorized without invoking the model', async () => {
    requireProjectAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
    })
    const { POST } = await import('../route')
    const response = await POST(post({ action: 'generate_summary', stories, projectId: 'project-denied' }))

    expect(response.status).toBe(403)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('30')
    expect(createChatCompletion).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
  })

  it('rejects malformed model output instead of returning it', async () => {
    createChatCompletion.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ title: 'Only a title' }) } }] })
    const { POST } = await import('../route')
    const response = await POST(post({ action: 'generate_summary', stories }))
    expect(response.status).toBe(502)
    expect((await response.json()).title).toBeUndefined()
  })

  it.each([
    [{ action: 'generate_chapter', stories: [] }, 'No stories provided'],
    [{ stories }, 'No action specified'],
    [{ action: 'hack', stories }, 'Invalid action specified'],
  ])('validates request %j', async (body, error) => {
    const { POST } = await import('../route')
    const response = await POST(post(body))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe(error)
    expect(createChatCompletion).not.toHaveBeenCalled()
  })
})
