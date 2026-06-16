/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requireStoryContributionOwner = jest.fn()
const createStoryContentHash = jest.fn()
const getCompletedEditorRunForStory = jest.fn()
const getStoryElementsForRun = jest.fn()
const createAgentRun = jest.fn()
const createAgentArtifact = jest.fn()
const completeAgentRun = jest.fn()
const failAgentRun = jest.fn()
const buildContributionPreview = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requireStoryContributionOwner: (...args: unknown[]) => requireStoryContributionOwner(...args) }))
jest.mock('@/lib/server/story-content-hash', () => ({ createStoryContentHash: (...args: unknown[]) => createStoryContentHash(...args) }))
jest.mock('@/lib/server/agent-store', () => ({
  getCompletedEditorRunForStory: (...args: unknown[]) => getCompletedEditorRunForStory(...args),
  getStoryElementsForRun: (...args: unknown[]) => getStoryElementsForRun(...args),
  createAgentRun: (...args: unknown[]) => createAgentRun(...args),
  createAgentArtifact: (...args: unknown[]) => createAgentArtifact(...args),
  completeAgentRun: (...args: unknown[]) => completeAgentRun(...args),
  failAgentRun: (...args: unknown[]) => failAgentRun(...args),
}))
jest.mock('@/lib/public-archive/anonymizer', () => ({ buildContributionPreview: (...args: unknown[]) => buildContributionPreview(...args) }))

describe('/api/stories/[storyId]/public-archive/preview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'user-1' }, headers: new Headers([['x-auth-refreshed', '1']]) })
    requireStoryContributionOwner.mockResolvedValue({
      ok: true,
      story: {
        id: 'story-1',
        project_id: 'project-1',
        storyteller_id: 'user-1',
        title: 'Alice in Guangzhou',
        transcript: 'Alice visited Guangzhou in 1976.',
        created_at: '2026-01-02T03:04:05.000Z',
      },
    })
    createStoryContentHash.mockReturnValue('content-hash')
    getCompletedEditorRunForStory.mockResolvedValue({ id: 'editor-run-1' })
    getStoryElementsForRun.mockResolvedValue([
      { id: 'element-1', element_type: 'person', value: 'Alice', normalized_value: 'Alice', source_quote: 'Alice', confidence: 0.9 },
    ])
    createAgentRun.mockResolvedValue({ id: 'wiki-run-1' })
    createAgentArtifact.mockResolvedValue({ id: 'preview-artifact-1' })
    completeAgentRun.mockResolvedValue({ id: 'wiki-run-1', status: 'completed' })
    buildContributionPreview.mockReturnValue({
      previewId: 'preview-artifact-1',
      storyId: 'story-1',
      sourceContentHash: 'content-hash',
      consentScope: ['text', 'structured_elements'],
      consentCopyVersion: 'public-archive-consent-v1',
      anonymizedTitle: '[person] in Guangzhou',
      anonymizedText: '[person] visited Guangzhou in 1976.',
      anonymizedSummary: '[person] visited Guangzhou in 1976.',
      elements: [],
      excludedDataTypes: ['voice', 'audio', 'photos', 'media_derivatives', 'exact_identity'],
    })
  })

  it('creates a private anonymized preview artifact for the storyteller', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive/preview', { method: 'POST' }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-auth-refreshed')).toBe('1')
    await expect(response.json()).resolves.toEqual({
      preview: expect.objectContaining({
        previewId: 'preview-artifact-1',
        anonymizedText: '[person] visited Guangzhou in 1976.',
      }),
    })
    expect(requireStoryContributionOwner).toHaveBeenCalledWith('story-1', { id: 'user-1' })
    expect(createAgentRun).toHaveBeenCalledWith(expect.objectContaining({ agentType: 'wiki_editor', contentHash: 'content-hash' }))
    expect(createAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({ artifactType: 'anonymized_contribution_preview' }))
    expect(completeAgentRun).toHaveBeenCalledWith('wiki-run-1', expect.objectContaining({ previewCreated: true }))
  })

  it('uses an empty element list when no completed editor run exists', async () => {
    getCompletedEditorRunForStory.mockResolvedValueOnce(null)

    await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive/preview', { method: 'POST' }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(getStoryElementsForRun).not.toHaveBeenCalled()
    expect(buildContributionPreview).toHaveBeenCalledWith(expect.objectContaining({ elements: [] }))
  })

  it('rejects non-storyteller users before creating an agent run', async () => {
    requireStoryContributionOwner.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Only the storyteller can contribute this story' }, { status: 403 }),
    })

    const response = await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive/preview', { method: 'POST' }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(403)
    expect(createAgentRun).not.toHaveBeenCalled()
  })
})
