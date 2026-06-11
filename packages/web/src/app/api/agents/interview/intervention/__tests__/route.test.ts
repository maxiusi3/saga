/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requireProjectAccess = jest.fn()
const getSupabaseAdmin = jest.fn()
const from = jest.fn()
const select = jest.fn()
const eq = jest.fn()
const maybeSingle = jest.fn()
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

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdmin(...args),
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
    maybeSingle.mockResolvedValue({
      data: {
        id: 'session-1',
        project_id: 'project-1',
        storyteller_id: 'host-1',
      },
      error: null,
    })
    eq.mockReturnValue({ maybeSingle })
    select.mockReturnValue({ eq })
    from.mockReturnValue({ select })
    getSupabaseAdmin.mockReturnValue({ from })
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
        storytellerId: 'host-1',
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
    expect(from).toHaveBeenCalledWith('interview_sessions')
    expect(eq).toHaveBeenCalledWith('id', 'session-1')
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

  it('returns auth denial before generation or storage', async () => {
    getAuthenticatedUser.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const request = new NextRequest('http://localhost/api/agents/interview/intervention', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        interviewSessionId: 'session-1',
        storytellerId: 'host-1',
        interventionLevel: 'low',
        phase: 'opening',
        recentTranscript: '',
        previousStorySummary: null,
        previousPrompts: [],
        silenceMs: 0,
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(requireProjectAccess).not.toHaveBeenCalled()
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
    expect(generateInterviewIntervention).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
    expect(createInterviewEvent).not.toHaveBeenCalled()
  })

  it('returns access denial before generation or storage', async () => {
    requireProjectAccess.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
    })
    const request = new NextRequest('http://localhost/api/agents/interview/intervention', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        interviewSessionId: 'session-1',
        storytellerId: 'host-1',
        interventionLevel: 'low',
        phase: 'opening',
        recentTranscript: '',
        previousStorySummary: null,
        previousPrompts: [],
        silenceMs: 0,
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Access denied' })
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
    expect(generateInterviewIntervention).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
    expect(createInterviewEvent).not.toHaveBeenCalled()
  })

  it('rejects invalid intervention levels before creating an agent run or event', async () => {
    const request = new NextRequest('http://localhost/api/agents/interview/intervention', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        interviewSessionId: 'session-1',
        storytellerId: 'host-1',
        interventionLevel: 'very_high',
        phase: 'opening',
        recentTranscript: '',
        previousStorySummary: null,
        previousPrompts: [],
        silenceMs: 0,
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid interview intervention request' })
    expect(requireProjectAccess).not.toHaveBeenCalled()
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
    expect(generateInterviewIntervention).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
    expect(createInterviewEvent).not.toHaveBeenCalled()
    expect(completeAgentRun).not.toHaveBeenCalled()
    expect(failAgentRun).not.toHaveBeenCalled()
  })

  it('returns 403 when storyteller does not match the authenticated user', async () => {
    const request = new NextRequest('http://localhost/api/agents/interview/intervention', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        interviewSessionId: 'session-1',
        storytellerId: 'storyteller-2',
        interventionLevel: 'low',
        phase: 'opening',
        recentTranscript: '',
        previousStorySummary: null,
        previousPrompts: [],
        silenceMs: 0,
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Storyteller must match authenticated user' })
    expect(requireProjectAccess).not.toHaveBeenCalled()
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
    expect(generateInterviewIntervention).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
    expect(createInterviewEvent).not.toHaveBeenCalled()
  })

  it('returns 403 when the interview session does not match the requested project and storyteller', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'session-1',
        project_id: 'other-project',
        storyteller_id: 'host-1',
      },
      error: null,
    })
    const request = new NextRequest('http://localhost/api/agents/interview/intervention', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        interviewSessionId: 'session-1',
        storytellerId: 'host-1',
        interventionLevel: 'low',
        phase: 'opening',
        recentTranscript: '',
        previousStorySummary: null,
        previousPrompts: [],
        silenceMs: 0,
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Interview session does not match request' })
    expect(generateInterviewIntervention).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
    expect(createInterviewEvent).not.toHaveBeenCalled()
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
      storyteller_id: 'host-1',
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
        storytellerId: 'host-1',
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
        storyteller_id: 'host-1',
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
      storytellerId: 'host-1',
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

  it('marks the agent run failed when event storage fails after run creation', async () => {
    generateInterviewIntervention.mockReturnValueOnce({
      shouldIntervene: true,
      eventKind: 'opening',
      triggerReason: 'session_started',
      promptText: 'Hi Ada. Start wherever the memory begins for you.',
    })
    createInterviewEvent.mockRejectedValueOnce(new Error('event insert failed'))
    const request = new NextRequest('http://localhost/api/agents/interview/intervention', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        interviewSessionId: 'session-1',
        storytellerId: 'host-1',
        interventionLevel: 'high',
        phase: 'opening',
        recentTranscript: '',
        previousStorySummary: null,
        previousPrompts: [],
        silenceMs: 0,
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Unable to store interview intervention' })
    expect(createAgentRun).toHaveBeenCalled()
    expect(failAgentRun).toHaveBeenCalledWith('run-1', 'event insert failed')
  })

  it('still returns 500 when failing the agent run also fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    generateInterviewIntervention.mockReturnValueOnce({
      shouldIntervene: true,
      eventKind: 'opening',
      triggerReason: 'session_started',
      promptText: 'Hi Ada. Start wherever the memory begins for you.',
    })
    createInterviewEvent.mockRejectedValueOnce(new Error('event insert failed'))
    failAgentRun.mockRejectedValueOnce(new Error('run update failed'))
    const request = new NextRequest('http://localhost/api/agents/interview/intervention', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        interviewSessionId: 'session-1',
        storytellerId: 'host-1',
        interventionLevel: 'high',
        phase: 'opening',
        recentTranscript: '',
        previousStorySummary: null,
        previousPrompts: [],
        silenceMs: 0,
      }),
    })

    try {
      const response = await POST(request)

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ error: 'Unable to store interview intervention' })
      expect(failAgentRun).toHaveBeenCalledWith('run-1', 'event insert failed')
      expect(errorSpy).toHaveBeenCalledWith('Failed to mark interview agent run as failed')
    } finally {
      errorSpy.mockRestore()
    }
  })
})
