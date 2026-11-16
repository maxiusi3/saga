/**
 * @jest-environment node
 */

import { AiOutputError, type AiTaskDefinition } from '@saga/shared/ai'

const createChatCompletion = jest.fn()
const openAiConstructor = jest.fn()
const createAgentRun = jest.fn()
const completeAgentRun = jest.fn()
const failAgentRun = jest.fn()

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn((config: unknown) => {
    openAiConstructor(config)
    return { chat: { completions: { create: createChatCompletion } } }
  }),
}))

jest.mock('../agent-store', () => ({
  createAgentRun: (...args: unknown[]) => createAgentRun(...args),
  completeAgentRun: (...args: unknown[]) => completeAgentRun(...args),
  failAgentRun: (...args: unknown[]) => failAgentRun(...args),
}))

const task: AiTaskDefinition<{ text: string }, string> = {
  id: 'test_task',
  version: '2026-11-16.1',
  agentType: 'interview',
  tier: 'realtime',
  responseFormat: 'json',
  temperature: 0.1,
  maxOutputTokens: 10,
  buildMessages: input => [{ role: 'system', content: 'sys' }, { role: 'user', content: input.text }],
  parse: raw => {
    const value = JSON.parse(raw)
    if (typeof value.answer !== 'string') throw new AiOutputError()
    return value.answer
  },
}

describe('runAiTask', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv, TEXT_API_KEY: 'key', TEXT_MODEL: 'base-model' }
    delete process.env.TEXT_MODEL_REALTIME
    createChatCompletion.mockReset()
    openAiConstructor.mockClear()
    createAgentRun.mockReset().mockResolvedValue({ id: 'run-1' })
    completeAgentRun.mockReset().mockResolvedValue({ id: 'run-1', status: 'completed' })
    failAgentRun.mockReset().mockResolvedValue({ id: 'run-1', status: 'failed' })
    jest.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('routes by tier, applies tier timeouts and returns versioned metadata without audit when omitted', async () => {
    process.env.TEXT_MODEL_REALTIME = 'fast-model'
    createChatCompletion.mockResolvedValue({
      choices: [{ message: { content: '{"answer":"ok"}' } }],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    })
    const { runAiTask } = await import('../ai-runner')
    const result = await runAiTask(task, { text: 'hi' })

    expect(result.output).toBe('ok')
    expect(result.metadata).toEqual(expect.objectContaining({
      taskId: 'test_task',
      taskVersion: '2026-11-16.1',
      model: 'fast-model',
      inputTokens: 12,
      outputTokens: 3,
      agentRunId: null,
    }))
    expect(createAgentRun).not.toHaveBeenCalled()
    expect(completeAgentRun).not.toHaveBeenCalled()
    expect(openAiConstructor).toHaveBeenCalledWith(expect.objectContaining({ timeout: 8000, maxRetries: 0 }))
    expect(createChatCompletion).toHaveBeenCalledWith(expect.objectContaining({
      model: 'fast-model', max_tokens: 10, response_format: { type: 'json_object' },
    }))
  })

  it('persists content-free audit metadata to agent_runs when audit scope is supplied', async () => {
    createChatCompletion.mockResolvedValue({
      choices: [{ message: { content: '{"answer":"secret answer"}' } }],
      usage: { prompt_tokens: 20, completion_tokens: 5 },
    })
    const { runAiTask } = await import('../ai-runner')
    const result = await runAiTask(
      task,
      { text: 'private memory' },
      {
        audit: {
          actorId: 'user-1',
          projectId: 'project-1',
          storyId: 'story-1',
          recordingSessionId: 'rec-1',
          inputSummary: { transcriptLength: 14 },
        },
      },
    )

    expect(result.metadata.agentRunId).toBe('run-1')
    expect(createAgentRun).toHaveBeenCalledWith({
      agentType: 'interview',
      projectId: 'project-1',
      storyId: 'story-1',
      interviewSessionId: null,
      createdBy: 'user-1',
      contentHash: null,
      model: 'base-model',
      input: {
        taskId: 'test_task',
        taskVersion: '2026-11-16.1',
        tier: 'realtime',
        recordingSessionId: 'rec-1',
        transcriptLength: 14,
      },
    })
    expect(completeAgentRun).toHaveBeenCalledWith('run-1', expect.objectContaining({
      taskId: 'test_task',
      taskVersion: '2026-11-16.1',
      tier: 'realtime',
      model: 'base-model',
      inputTokens: 20,
      outputTokens: 5,
    }))
    const persisted = JSON.stringify([createAgentRun.mock.calls, completeAgentRun.mock.calls])
    expect(persisted).not.toContain('private memory')
    expect(persisted).not.toContain('secret answer')
  })

  it('marks the audit run as failed when provider or parser fails', async () => {
    createChatCompletion.mockResolvedValue({ choices: [{ message: { content: '{"wrong":1}' } }] })
    const { runAiTask } = await import('../ai-runner')
    await expect(
      runAiTask(task, { text: 'hi' }, { audit: { actorId: 'user-1', projectId: 'project-1' } }),
    ).rejects.toEqual(expect.objectContaining({ code: 'invalid_response' }))
    expect(failAgentRun).toHaveBeenCalledWith('run-1', 'invalid_response')
    expect(completeAgentRun).not.toHaveBeenCalled()

    failAgentRun.mockClear()
    createChatCompletion.mockRejectedValue({ status: 429 })
    await expect(
      runAiTask(task, { text: 'hi' }, { audit: { actorId: 'user-1', projectId: 'project-1' } }),
    ).rejects.toEqual(expect.objectContaining({ code: 'rate_limited' }))
    expect(failAgentRun).toHaveBeenCalledWith('run-1', 'rate_limited')
  })

  it('does not call the provider if createAgentRun rejects (e.g. deleted-story fence)', async () => {
    createAgentRun.mockRejectedValue(new Error('Recording interview source unavailable'))
    const { runAiTask } = await import('../ai-runner')
    await expect(
      runAiTask(task, { text: 'hi' }, { audit: { actorId: 'user-1', projectId: 'project-1', recordingSessionId: 'rec-1' } }),
    ).rejects.toThrow('Recording interview source unavailable')
    expect(createChatCompletion).not.toHaveBeenCalled()
  })

  it('does not log family content', async () => {
    createChatCompletion.mockResolvedValue({ choices: [{ message: { content: '{"answer":"secret answer"}' } }] })
    const { runAiTask } = await import('../ai-runner')
    await runAiTask(task, { text: 'private memory' })
    const logged = (console.info as jest.Mock).mock.calls.flat().join(' ')
    expect(logged).toContain('ai_task_run')
    expect(logged).not.toContain('private memory')
    expect(logged).not.toContain('secret answer')
  })

  it('reports unavailable without a key', async () => {
    delete process.env.TEXT_API_KEY
    delete process.env.OPENROUTER_API_KEY
    const { runAiTask, AiTaskError } = await import('../ai-runner')
    await expect(runAiTask(task, { text: 'hi' })).rejects.toEqual(expect.objectContaining({ code: 'unavailable' }))
    await expect(runAiTask(task, { text: 'hi' })).rejects.toBeInstanceOf(AiTaskError)
    expect(createChatCompletion).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
  })

  it.each([
    ['empty', { choices: [{ message: { content: '' } }] }],
    ['malformed', { choices: [{ message: { content: '{"wrong":1}' } }] }],
  ])('rejects %s output as invalid_response', async (_label, completion) => {
    createChatCompletion.mockResolvedValue(completion)
    const { runAiTask } = await import('../ai-runner')
    await expect(runAiTask(task, { text: 'hi' })).rejects.toEqual(expect.objectContaining({ code: 'invalid_response' }))
  })

  it.each([
    [{ status: 429 }, 'rate_limited', 429],
    [{ status: 402 }, 'quota_exceeded', 402],
    [{ name: 'APIConnectionTimeoutError', message: 'Request timed out.' }, 'timeout', 504],
    [{ status: 400, error: { type: 'invalid_request_error' } }, 'invalid_request', 400],
    [new Error('socket hang up'), 'provider_failed', 502],
  ])('maps provider error %j to %s', async (error, code, status) => {
    createChatCompletion.mockRejectedValue(error)
    const { runAiTask, aiTaskErrorResponse, AiTaskError } = await import('../ai-runner')
    const failure = await runAiTask(task, { text: 'hi' }).catch(value => value)
    expect(failure).toBeInstanceOf(AiTaskError)
    expect(failure.code).toBe(code)
    expect(aiTaskErrorResponse(failure).status).toBe(status)
  })
})
