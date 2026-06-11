/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requireProjectAccess = jest.fn()
const generateInterviewIntervention = jest.fn()
const createAgentRun = jest.fn()
const completeAgentRun = jest.fn()
const failAgentRun = jest.fn()
const createInterviewEvent = jest.fn()

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args),
}))

jest.mock('@/lib/server/project-access', () => ({
  requireProjectAccess: (...args: unknown[]) => requireProjectAccess(...args),
}))

jest.mock('@/lib/agents/interview-agent', () => ({
  generateInterviewIntervention: (...args: unknown[]) => generateInterviewIntervention(...args),
}))

jest.mock('@/lib/server/agent-store', () => ({
  createAgentRun: (...args: unknown[]) => createAgentRun(...args),
  completeAgentRun: (...args: unknown[]) => completeAgentRun(...args),
  failAgentRun: (...args: unknown[]) => failAgentRun(...args),
  createInterviewEvent: (...args: unknown[]) => createInterviewEvent(...args),
}))

describe('/api/agents/interview/intervention', () => {
  beforeEach(() => {
    getAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { id: 'host-1' },
      headers: new Headers([['x-auth-refreshed', '1']]),
    })
    requireProjectAccess.mockResolvedValue({ ok: true })
    generateInterviewIntervention.mockReturnValue({
      shouldIntervene: false,
      eventKind: null,
      triggerReason: 'intervention_level_off',
      promptText: '',
    })
    createAgentRun.mockResolvedValue({ id: 'run-1' })
    completeAgentRun.mockResolvedValue({ id: 'run-1', status: 'completed' })
    createInterviewEvent.mockResolvedValue({ id: 'event-1' })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('does not create an agent run or event when intervention level is off', async () => {
    const request = new NextRequest('http://localhost/api/agents/interview/intervention', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        interviewSessionId: 'session-1',
        storytellerId: 'storyteller-1',
        interventionLevel: 'off',
        phase: 'story_listening',
        recentTranscript: 'I remember walking through the market.',
        previousStorySummary: null,
        previousPrompts: [],
        silenceMs: 60000,
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('x-auth-refreshed')).toBe('1')
    await expect(response.json()).resolves.toEqual({
      intervention: {
        shouldIntervene: false,
        eventKind: null,
        triggerReason: 'intervention_level_off',
        promptText: '',
      },
      event: null,
    })
    expect(requireProjectAccess).toHaveBeenCalledWith('project-1', { id: 'host-1' })
    expect(generateInterviewIntervention).toHaveBeenCalledWith({
      interventionLevel: 'off',
      phase: 'story_listening',
      storytellerName: undefined,
      currentPrompt: undefined,
      recentTranscript: 'I remember walking through the market.',
      previousStorySummary: null,
      previousPrompts: [],
      silenceMs: 60000,
    })
    expect(createAgentRun).not.toHaveBeenCalled()
    expect(createInterviewEvent).not.toHaveBeenCalled()
    expect(completeAgentRun).not.toHaveBeenCalled()
  })

  it('creates an agent run and opening event when intervention should happen', async () => {
    generateInterviewIntervention.mockReturnValueOnce({
      shouldIntervene: true,
      eventKind: 'opening',
      triggerReason: 'session_started',
      promptText: 'Hi Ada. Start wherever the memory begins for you.',
    })
    createInterviewEvent.mockResolvedValueOnce({
      id: 'event-1',
      interview_session_id: 'session-1',
      project_id: 'project-1',
      storyteller_id: 'storyteller-1',
      event_kind: 'opening',
      intervention_level: 'high',
      trigger_reason: 'session_started',
      prompt_text: 'Hi Ada. Start wherever the memory begins for you.',
    })
    const request = new NextRequest('http://localhost/api/agents/interview/intervention', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        interviewSessionId: 'session-1',
        storytellerId: 'storyteller-1',
        interventionLevel: 'high',
        phase: 'opening',
        storytellerName: 'Ada',
        currentPrompt: 'Tell us about the first day.',
        recentTranscript: '',
        previousStorySummary: null,
        previousPrompts: [],
        silenceMs: 0,
        transcriptStartOffset: 0,
        transcriptEndOffset: 0,
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      intervention: {
        shouldIntervene: true,
        eventKind: 'opening',
        triggerReason: 'session_started',
        promptText: 'Hi Ada. Start wherever the memory begins for you.',
      },
      event: {
        id: 'event-1',
        interview_session_id: 'session-1',
        project_id: 'project-1',
        storyteller_id: 'storyteller-1',
        event_kind: 'opening',
        intervention_level: 'high',
        trigger_reason: 'session_started',
        prompt_text: 'Hi Ada. Start wherever the memory begins for you.',
      },
    })
    expect(createAgentRun).toHaveBeenCalledWith({
      agentType: 'interview',
      projectId: 'project-1',
      storyId: null,
      interviewSessionId: 'session-1',
      createdBy: 'host-1',
      input: expect.objectContaining({
        phase: 'opening',
        interventionLevel: 'high',
      }),
      model: 'deterministic-interview-agent',
    })
    expect(createInterviewEvent).toHaveBeenCalledWith({
      interviewSessionId: 'session-1',
      projectId: 'project-1',
      storytellerId: 'storyteller-1',
      eventKind: 'opening',
      interventionLevel: 'high',
      triggerReason: 'session_started',
      promptText: 'Hi Ada. Start wherever the memory begins for you.',
      transcriptWindow: '',
      transcriptStartOffset: 0,
      transcriptEndOffset: 0,
      accepted: null,
    })
    expect(completeAgentRun).toHaveBeenCalledWith('run-1', {
      intervention: {
        shouldIntervene: true,
        eventKind: 'opening',
        triggerReason: 'session_started',
        promptText: 'Hi Ada. Start wherever the memory begins for you.',
      },
      eventId: 'event-1',
    })
    expect(failAgentRun).not.toHaveBeenCalled()
  })
})
