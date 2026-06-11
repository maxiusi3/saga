/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { GET } from '../route'

const getAuthenticatedUser = jest.fn()
const requireProjectAccess = jest.fn()
const getSupabaseAdmin = jest.fn()
const from = jest.fn()
const select = jest.fn()
const eq = jest.fn()
const maybeSingle = jest.fn()
const getCompletedEditorArtifactsForStory = jest.fn()
const getCompletedEditorStoryElementsForStory = jest.fn()

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args),
}))

jest.mock('@/lib/server/project-access', () => ({
  requireProjectAccess: (...args: unknown[]) => requireProjectAccess(...args),
}))

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdmin(...args),
}))

jest.mock('@/lib/server/agent-store', () => ({
  getCompletedEditorArtifactsForStory: (...args: unknown[]) => getCompletedEditorArtifactsForStory(...args),
  getCompletedEditorStoryElementsForStory: (...args: unknown[]) => getCompletedEditorStoryElementsForStory(...args),
}))

describe('/api/stories/[storyId]/agent-artifacts', () => {
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
      },
      error: null,
    })
    eq.mockReturnValue({ maybeSingle })
    select.mockReturnValue({ eq })
    from.mockReturnValue({ select })
    getSupabaseAdmin.mockReturnValue({ from })
    getCompletedEditorArtifactsForStory.mockResolvedValue([
      {
        id: 'artifact-standalone',
        artifact_type: 'standalone_story',
        payload: {
          title: 'A Market Morning',
          body: 'A polished standalone story.',
          summary: 'A memory about courage.',
        },
        confidence: 0.8,
        source_refs: [],
      },
      {
        id: 'artifact-elements',
        artifact_type: 'story_elements',
        payload: { elements: [] },
        confidence: 0.75,
        source_refs: [],
      },
    ])
    getCompletedEditorStoryElementsForStory.mockResolvedValue([
      {
        id: 'element-1',
        element_type: 'time',
        value: '1976',
        normalized_value: '1976',
        source_quote: '1976',
        source_start_offset: 3,
        source_end_offset: 7,
        confidence: 0.9,
        review_status: 'unreviewed',
      },
    ])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns standalone story, elements, and raw artifacts for an authorized project member', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/stories/story-1/agent-artifacts'),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-auth-refreshed')).toBe('1')
    await expect(response.json()).resolves.toEqual({
      standaloneStory: {
        title: 'A Market Morning',
        body: 'A polished standalone story.',
        summary: 'A memory about courage.',
      },
      elements: [
        {
          id: 'element-1',
          element_type: 'time',
          value: '1976',
          normalized_value: '1976',
          source_quote: '1976',
          source_start_offset: 3,
          source_end_offset: 7,
          confidence: 0.9,
          review_status: 'unreviewed',
        },
      ],
      artifacts: [
        {
          id: 'artifact-standalone',
          artifact_type: 'standalone_story',
          payload: {
            title: 'A Market Morning',
            body: 'A polished standalone story.',
            summary: 'A memory about courage.',
          },
          confidence: 0.8,
          source_refs: [],
        },
        {
          id: 'artifact-elements',
          artifact_type: 'story_elements',
          payload: { elements: [] },
          confidence: 0.75,
          source_refs: [],
        },
      ],
    })
    expect(from).toHaveBeenCalledWith('stories')
    expect(select).toHaveBeenCalledWith('id, project_id')
    expect(eq).toHaveBeenCalledWith('id', 'story-1')
    expect(requireProjectAccess).toHaveBeenCalledWith('project-1', { id: 'host-1' })
    expect(getCompletedEditorArtifactsForStory).toHaveBeenCalledWith('story-1')
    expect(getCompletedEditorStoryElementsForStory).toHaveBeenCalledWith('story-1')
  })

  it('returns auth denial before loading the story', async () => {
    getAuthenticatedUser.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await GET(
      new NextRequest('http://localhost/api/stories/story-1/agent-artifacts'),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
    expect(requireProjectAccess).not.toHaveBeenCalled()
  })

  it('returns not found when the story is missing', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const response = await GET(
      new NextRequest('http://localhost/api/stories/story-1/agent-artifacts'),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Story not found' })
    expect(requireProjectAccess).not.toHaveBeenCalled()
    expect(getCompletedEditorArtifactsForStory).not.toHaveBeenCalled()
  })

  it('returns access denial before reading artifacts', async () => {
    requireProjectAccess.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
    })

    const response = await GET(
      new NextRequest('http://localhost/api/stories/story-1/agent-artifacts'),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Access denied' })
    expect(getCompletedEditorArtifactsForStory).not.toHaveBeenCalled()
    expect(getCompletedEditorStoryElementsForStory).not.toHaveBeenCalled()
  })
})
