/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requireProjectAccess = jest.fn()
const createInterviewSession = jest.fn()

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args),
}))

jest.mock('@/lib/server/project-access', () => ({
  requireProjectAccess: (...args: unknown[]) => requireProjectAccess(...args),
}))

jest.mock('@/lib/server/agent-store', () => ({
  createInterviewSession: (...args: unknown[]) => createInterviewSession(...args),
}))

describe('/api/agents/interview/session', () => {
  beforeEach(() => {
    getAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { id: 'host-1' },
      headers: new Headers([['x-auth-refreshed', '1']]),
    })
    requireProjectAccess.mockResolvedValue({ ok: true })
    createInterviewSession.mockResolvedValue({
      id: 'session-1',
      project_id: 'project-1',
      storyteller_id: 'storyteller-1',
      prompt_text: 'Tell me about the old shop.',
      recording_mode: 'deep_dive',
      intervention_level: 'low',
      status: 'active',
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('creates an interview session for an authorized project member', async () => {
    const request = new NextRequest('http://localhost/api/agents/interview/session', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        storytellerId: 'storyteller-1',
        promptText: 'Tell me about the old shop.',
        recordingMode: 'deep_dive',
        interventionLevel: 'low',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('x-auth-refreshed')).toBe('1')
    await expect(response.json()).resolves.toEqual({
      session: {
        id: 'session-1',
        project_id: 'project-1',
        storyteller_id: 'storyteller-1',
        prompt_text: 'Tell me about the old shop.',
        recording_mode: 'deep_dive',
        intervention_level: 'low',
        status: 'active',
      },
    })
    expect(requireProjectAccess).toHaveBeenCalledWith('project-1', { id: 'host-1' })
    expect(createInterviewSession).toHaveBeenCalledWith({
      projectId: 'project-1',
      storytellerId: 'storyteller-1',
      promptText: 'Tell me about the old shop.',
      recordingMode: 'deep_dive',
      interventionLevel: 'low',
    })
  })

  it('rejects invalid intervention levels before checking project access', async () => {
    const request = new NextRequest('http://localhost/api/agents/interview/session', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        storytellerId: 'storyteller-1',
        recordingMode: 'chat',
        interventionLevel: 'medium',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid interview session request' })
    expect(requireProjectAccess).not.toHaveBeenCalled()
    expect(createInterviewSession).not.toHaveBeenCalled()
  })

  it('returns the auth failure response when the requester is not authenticated', async () => {
    getAuthenticatedUser.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const request = new NextRequest('http://localhost/api/agents/interview/session', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        storytellerId: 'storyteller-1',
        recordingMode: 'chat',
        interventionLevel: 'off',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(requireProjectAccess).not.toHaveBeenCalled()
    expect(createInterviewSession).not.toHaveBeenCalled()
  })
})
