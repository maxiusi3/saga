/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'

const createChatCompletion = jest.fn()
const requireProjectAccess = jest.fn()
const createAgentRun = jest.fn()
const completeAgentRun = jest.fn()
const failAgentRun = jest.fn()
const sessionMaybeSingle = jest.fn()

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => ({ chat: { completions: { create: createChatCompletion } } })),
}))

jest.mock('@/lib/server/ai-guard', () => ({
  requireAiRequest: jest.fn(async () => ({
    ok: true,
    user: { id: 'user-1' },
    headers: new Headers({ 'X-RateLimit-Limit': '120' }),
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

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: sessionMaybeSingle,
        }),
      }),
    }),
  }),
}))

function post(body: unknown) {
  return new NextRequest('http://localhost/api/ai/realtime-prompt', { method: 'POST', body: JSON.stringify(body) })
}

describe('/api/ai/realtime-prompt', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv, TEXT_API_KEY: 'key', TEXT_MODEL: 'model' }
    createChatCompletion.mockReset()
    requireProjectAccess.mockReset().mockResolvedValue({ ok: true })
    createAgentRun.mockReset().mockResolvedValue({ id: 'run-rt-1' })
    completeAgentRun.mockReset().mockResolvedValue({ id: 'run-rt-1', status: 'completed' })
    failAgentRun.mockReset().mockResolvedValue({ id: 'run-rt-1', status: 'failed' })
    sessionMaybeSingle.mockReset().mockResolvedValue({ data: { id: 'sess-1', project_id: 'project-1' }, error: null })
    jest.spyOn(console, 'info').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('returns the model question and keeps previous prompts out of the system prompt', async () => {
    createChatCompletion.mockResolvedValue({ choices: [{ message: { content: '"What did the river sound like?"' } }] })
    const { POST } = await import('../route')
    const response = await POST(post({ transcript: 'I grew up by the river.', previousPrompts: ['Who else was there?'] }))
    expect(await response.json()).toEqual({ prompt: 'What did the river sound like?', source: 'ai' })
    const { messages } = createChatCompletion.mock.calls[0][0]
    expect(messages[0].content).not.toContain('Who else was there?')
    expect(messages[1].content).toContain('Who else was there?')
    expect(createAgentRun).not.toHaveBeenCalled()
  })

  it('audits interview runs when projectId and interviewSessionId are provided', async () => {
    createChatCompletion.mockResolvedValue({ choices: [{ message: { content: 'What happened next?' } }] })
    const { POST } = await import('../route')
    const response = await POST(post({
      transcript: 'I grew up by the river.',
      projectId: 'project-1',
      interviewSessionId: 'sess-1',
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ prompt: 'What happened next?', source: 'ai', agentRunId: 'run-rt-1' })
    expect(requireProjectAccess).toHaveBeenCalledWith('project-1', { id: 'user-1' })
    expect(createAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentType: 'interview',
      projectId: 'project-1',
      interviewSessionId: 'sess-1',
      contentHash: null,
    }))
    expect(completeAgentRun).toHaveBeenCalledWith('run-rt-1', expect.objectContaining({
      taskId: 'followup_realtime',
    }))
  })

  it('marks audit run failed and falls back when the model fails', async () => {
    createChatCompletion.mockRejectedValue({ status: 429 })
    const { POST } = await import('../route')
    const response = await POST(post({
      transcript: '我小时候住在乡下',
      language: 'zh-CN',
      projectId: 'project-1',
      interviewSessionId: 'sess-1',
    }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.source).toBe('fallback')
    expect(['那时候你最喜欢做什么？', '你还记得当时的朋友吗？', '那段时光给你留下了什么印象？']).toContain(body.prompt)
    expect(failAgentRun).toHaveBeenCalledWith('run-rt-1', 'rate_limited')
  })

  it('falls back to a deterministic nudge when the model fails without audit scope', async () => {
    createChatCompletion.mockRejectedValue({ status: 429 })
    const { POST } = await import('../route')
    const response = await POST(post({ transcript: '我小时候住在乡下', language: 'zh-CN' }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.source).toBe('fallback')
    expect(['那时候你最喜欢做什么？', '你还记得当时的朋友吗？', '那段时光给你留下了什么印象？']).toContain(body.prompt)
    expect(createAgentRun).not.toHaveBeenCalled()
  })

  it('does not call the model for very short transcripts', async () => {
    const { POST } = await import('../route')
    const response = await POST(post({ transcript: 'hi' }))
    expect((await response.json()).source).toBe('fallback')
    expect(createChatCompletion).not.toHaveBeenCalled()
  })
})
