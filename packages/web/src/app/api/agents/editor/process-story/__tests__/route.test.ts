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
const processStoryForBiography = jest.fn()
const createAgentRun = jest.fn()
const createAgentArtifact = jest.fn()
const createStoryElements = jest.fn()
const completeAgentRun = jest.fn()
const failAgentRun = jest.fn()

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args),
}))

jest.mock('@/lib/server/project-access', () => ({
  requireProjectAccess: (...args: unknown[]) => requireProjectAccess(...args),
}))

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdmin(...args),
}))

jest.mock('@/lib/agents/editor-agent', () => ({
  processStoryForBiography: (...args: unknown[]) => processStoryForBiography(...args),
}))

jest.mock('@/lib/server/agent-store', () => ({
  createAgentRun: (...args: unknown[]) => createAgentRun(...args),
  createAgentArtifact: (...args: unknown[]) => createAgentArtifact(...args),
  createStoryElements: (...args: unknown[]) => createStoryElements(...args),
  completeAgentRun: (...args: unknown[]) => completeAgentRun(...args),
  failAgentRun: (...args: unknown[]) => failAgentRun(...args),
}))

describe('/api/agents/editor/process-story', () => {
  beforeEach(() => {
    getAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { id: 'host-1' },
      headers: new Headers([['x-auth-refreshed', '1']]),
    })
    requireProjectAccess.mockResolvedValue({ ok: true })
    maybeSingle.mockResolvedValue({
      data: {
        id: 'story-1',
        project_id: 'project-1',
        title: 'A Market Morning',
        transcript: 'In 1976 my mother took me to Guangzhou. I learned courage.',
        created_at: '2026-01-02T03:04:05.000Z',
      },
      error: null,
    })
    eq.mockReturnValue({ maybeSingle })
    select.mockReturnValue({ eq })
    from.mockReturnValue({ select })
    getSupabaseAdmin.mockReturnValue({ from })
    processStoryForBiography.mockReturnValue({
      standaloneStory: {
        title: 'A Market Morning',
        body: 'In 1976 my mother took me to Guangzhou. I learned courage.',
        summary: 'A memory about courage.',
      },
      elements: [
        {
          elementType: 'time',
          value: '1976',
          normalizedValue: '1976',
          sourceQuote: '1976',
          sourceStartOffset: 3,
          sourceEndOffset: 7,
          confidence: 0.9,
        },
        {
          elementType: 'place',
          value: 'Guangzhou',
          normalizedValue: 'Guangzhou',
          sourceQuote: 'Guangzhou',
          sourceStartOffset: 29,
          sourceEndOffset: 38,
          confidence: 0.75,
        },
      ],
    })
    createAgentRun.mockResolvedValue({ id: 'run-1' })
    createAgentArtifact.mockResolvedValue({ id: 'artifact-1' })
    createStoryElements.mockResolvedValue([{ id: 'element-1' }, { id: 'element-2' }])
    completeAgentRun.mockResolvedValue({ id: 'run-1', status: 'completed' })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('processes a story, stores artifacts and elements, and completes the agent run', async () => {
    const request = new NextRequest('http://localhost/api/agents/editor/process-story', {
      method: 'POST',
      body: JSON.stringify({ storyId: 'story-1' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('x-auth-refreshed')).toBe('1')
    await expect(response.json()).resolves.toEqual({
      processed: true,
      agentRunId: 'run-1',
      elementsCount: 2,
    })
    expect(from).toHaveBeenCalledWith('stories')
    expect(select).toHaveBeenCalledWith('id, project_id, title, transcript, created_at')
    expect(eq).toHaveBeenCalledWith('id', 'story-1')
    expect(requireProjectAccess).toHaveBeenCalledWith('project-1', { id: 'host-1' })
    expect(processStoryForBiography).toHaveBeenCalledWith({
      storyId: 'story-1',
      projectId: 'project-1',
      title: 'A Market Morning',
      transcript: 'In 1976 my mother took me to Guangzhou. I learned courage.',
      createdAt: '2026-01-02T03:04:05.000Z',
    })
    expect(createAgentRun).toHaveBeenCalledWith({
      agentType: 'editor_librarian',
      projectId: 'project-1',
      storyId: 'story-1',
      interviewSessionId: null,
      createdBy: 'host-1',
      input: {
        storyId: 'story-1',
        title: 'A Market Morning',
        transcriptLength: 58,
      },
      model: 'deterministic-editor-agent',
    })
    expect(createAgentArtifact).toHaveBeenNthCalledWith(1, {
      agentRunId: 'run-1',
      projectId: 'project-1',
      storyId: 'story-1',
      artifactType: 'standalone_story',
      payload: {
        title: 'A Market Morning',
        body: 'In 1976 my mother took me to Guangzhou. I learned courage.',
        summary: 'A memory about courage.',
      },
      sourceRefs: [
        {
          source_type: 'transcript',
          source_id: 'story-1',
          start_offset: 0,
          end_offset: 58,
        },
      ],
      confidence: 0.8,
    })
    expect(createAgentArtifact).toHaveBeenNthCalledWith(2, {
      agentRunId: 'run-1',
      projectId: 'project-1',
      storyId: 'story-1',
      artifactType: 'story_elements',
      payload: {
        elements: [
          {
            elementType: 'time',
            value: '1976',
            normalizedValue: '1976',
            sourceQuote: '1976',
            sourceStartOffset: 3,
            sourceEndOffset: 7,
            confidence: 0.9,
          },
          {
            elementType: 'place',
            value: 'Guangzhou',
            normalizedValue: 'Guangzhou',
            sourceQuote: 'Guangzhou',
            sourceStartOffset: 29,
            sourceEndOffset: 38,
            confidence: 0.75,
          },
        ],
      },
      sourceRefs: [
        {
          source_type: 'transcript',
          source_id: 'story-1',
          start_offset: 3,
          end_offset: 7,
          quote: '1976',
        },
        {
          source_type: 'transcript',
          source_id: 'story-1',
          start_offset: 29,
          end_offset: 38,
          quote: 'Guangzhou',
        },
      ],
      confidence: 0.825,
    })
    expect(createStoryElements).toHaveBeenCalledWith([
      {
        projectId: 'project-1',
        storyId: 'story-1',
        agentRunId: 'run-1',
        elementType: 'time',
        value: '1976',
        normalizedValue: '1976',
        sourceQuote: '1976',
        sourceStartOffset: 3,
        sourceEndOffset: 7,
        confidence: 0.9,
      },
      {
        projectId: 'project-1',
        storyId: 'story-1',
        agentRunId: 'run-1',
        elementType: 'place',
        value: 'Guangzhou',
        normalizedValue: 'Guangzhou',
        sourceQuote: 'Guangzhou',
        sourceStartOffset: 29,
        sourceEndOffset: 38,
        confidence: 0.75,
      },
    ])
    expect(completeAgentRun).toHaveBeenCalledWith('run-1', {
      processed: true,
      standaloneStoryTitle: 'A Market Morning',
      elementsCount: 2,
    })
    expect(failAgentRun).not.toHaveBeenCalled()
  })

  it('returns auth denial before loading the story', async () => {
    getAuthenticatedUser.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await POST(new NextRequest('http://localhost/api/agents/editor/process-story', {
      method: 'POST',
      body: JSON.stringify({ storyId: 'story-1' }),
    }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
    expect(requireProjectAccess).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
  })

  it('rejects invalid requests before loading the story', async () => {
    const response = await POST(new NextRequest('http://localhost/api/agents/editor/process-story', {
      method: 'POST',
      body: JSON.stringify({ storyId: '' }),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid editor process story request' })
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
    expect(requireProjectAccess).not.toHaveBeenCalled()
  })

  it('returns not found when the story is missing', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const response = await POST(new NextRequest('http://localhost/api/agents/editor/process-story', {
      method: 'POST',
      body: JSON.stringify({ storyId: 'story-1' }),
    }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Story not found' })
    expect(requireProjectAccess).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
  })

  it('returns access denial before processing or storing artifacts', async () => {
    requireProjectAccess.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
    })

    const response = await POST(new NextRequest('http://localhost/api/agents/editor/process-story', {
      method: 'POST',
      body: JSON.stringify({ storyId: 'story-1' }),
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Access denied' })
    expect(processStoryForBiography).not.toHaveBeenCalled()
    expect(createAgentRun).not.toHaveBeenCalled()
  })

  it('marks the agent run failed when artifact storage fails after run creation', async () => {
    createAgentArtifact.mockRejectedValueOnce(new Error('artifact insert failed'))

    const response = await POST(new NextRequest('http://localhost/api/agents/editor/process-story', {
      method: 'POST',
      body: JSON.stringify({ storyId: 'story-1' }),
    }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Unable to process story with editor agent' })
    expect(createAgentRun).toHaveBeenCalled()
    expect(failAgentRun).toHaveBeenCalledWith('run-1', 'artifact insert failed')
  })

  it('marks the agent run failed when story processing fails after run creation', async () => {
    processStoryForBiography.mockImplementationOnce(() => {
      throw new Error('processor failed')
    })

    const response = await POST(new NextRequest('http://localhost/api/agents/editor/process-story', {
      method: 'POST',
      body: JSON.stringify({ storyId: 'story-1' }),
    }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Unable to process story with editor agent' })
    expect(createAgentRun).toHaveBeenCalledWith({
      agentType: 'editor_librarian',
      projectId: 'project-1',
      storyId: 'story-1',
      interviewSessionId: null,
      createdBy: 'host-1',
      input: {
        storyId: 'story-1',
        title: 'A Market Morning',
        transcriptLength: 58,
      },
      model: 'deterministic-editor-agent',
    })
    expect(failAgentRun).toHaveBeenCalledWith('run-1', 'processor failed')
    expect(createAgentArtifact).not.toHaveBeenCalled()
    expect(createStoryElements).not.toHaveBeenCalled()
    expect(completeAgentRun).not.toHaveBeenCalled()
  })

  it('still returns 500 when failing the agent run also fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    createStoryElements.mockRejectedValueOnce(new Error('element insert failed'))
    failAgentRun.mockRejectedValueOnce(new Error('run update failed'))

    try {
      const response = await POST(new NextRequest('http://localhost/api/agents/editor/process-story', {
        method: 'POST',
        body: JSON.stringify({ storyId: 'story-1' }),
      }))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ error: 'Unable to process story with editor agent' })
      expect(failAgentRun).toHaveBeenCalledWith('run-1', 'element insert failed')
      expect(errorSpy).toHaveBeenCalledWith('Failed to mark editor agent run as failed')
    } finally {
      errorSpy.mockRestore()
    }
  })
})
