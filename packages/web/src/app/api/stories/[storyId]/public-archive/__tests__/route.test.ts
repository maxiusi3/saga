/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET, POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requireStoryContributionOwner = jest.fn()
const createStoryContentHash = jest.fn()
const getAgentArtifactByIdForStory = jest.fn()
const createPublicContribution = jest.fn()
const createPublicContributionElements = jest.fn()
const createPublicArchiveAuditEvent = jest.fn()
const getOwnContributionForStory = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requireStoryContributionOwner: (...args: unknown[]) => requireStoryContributionOwner(...args) }))
jest.mock('@/lib/server/story-content-hash', () => ({ createStoryContentHash: (...args: unknown[]) => createStoryContentHash(...args) }))
jest.mock('@/lib/server/agent-store', () => ({ getAgentArtifactByIdForStory: (...args: unknown[]) => getAgentArtifactByIdForStory(...args) }))
jest.mock('@/lib/server/public-archive-store', () => ({
  createPublicContribution: (...args: unknown[]) => createPublicContribution(...args),
  createPublicContributionElements: (...args: unknown[]) => createPublicContributionElements(...args),
  createPublicArchiveAuditEvent: (...args: unknown[]) => createPublicArchiveAuditEvent(...args),
  getOwnContributionForStory: (...args: unknown[]) => getOwnContributionForStory(...args),
}))

describe('/api/stories/[storyId]/public-archive', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'user-1' }, headers: new Headers([['x-auth-refreshed', '1']]) })
    requireStoryContributionOwner.mockResolvedValue({
      ok: true,
      story: { id: 'story-1', project_id: 'project-1', storyteller_id: 'user-1', title: 'Story', transcript: 'Text', created_at: '2026-01-02T03:04:05.000Z' },
    })
    createStoryContentHash.mockReturnValue('content-hash')
    getAgentArtifactByIdForStory.mockResolvedValue({
      id: 'preview-1',
      payload: {
        previewId: 'preview-1',
        storyId: 'story-1',
        sourceContentHash: 'content-hash',
        consentCopyVersion: 'public-archive-consent-v1',
        anonymizedTitle: 'Story',
        anonymizedText: 'Anonymized text',
        anonymizedSummary: 'Summary',
        elements: [{ elementType: 'time', value: '1976', normalizedValue: '1976', sourceQuote: '1976', confidence: 0.9 }],
      },
    })
    createPublicContribution.mockResolvedValue({ id: 'contribution-1', public_ref: 'pc_1' })
    createPublicContributionElements.mockResolvedValue([{ id: 'element-1' }])
    createPublicArchiveAuditEvent.mockResolvedValue({ id: 'audit-1' })
    getOwnContributionForStory.mockResolvedValue({ id: 'contribution-1', status: 'active' })
  })

  it('returns the storyteller contribution status for a story', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/stories/story-1/public-archive'),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ contribution: { id: 'contribution-1', status: 'active' } })
  })

  it('commits a public contribution from a current preview artifact', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive', {
        method: 'POST',
        body: JSON.stringify({ previewId: 'preview-1' }),
      }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      contribution: { id: 'contribution-1', public_ref: 'pc_1' },
      elementsCount: 1,
    })
    expect(createPublicContribution).toHaveBeenCalledWith(expect.objectContaining({
      sourceProjectId: 'project-1',
      sourceStoryId: 'story-1',
      sourceUserId: 'user-1',
      sourceContentHash: 'content-hash',
      anonymizedText: 'Anonymized text',
    }))
    expect(createPublicContributionElements).toHaveBeenCalledWith('contribution-1', expect.any(Array))
    expect(createPublicArchiveAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'opted_in' }))
  })

  it('rejects stale preview commits', async () => {
    createStoryContentHash.mockReturnValueOnce('new-content-hash')

    const response = await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive', {
        method: 'POST',
        body: JSON.stringify({ previewId: 'preview-1' }),
      }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(409)
    expect(createPublicContribution).not.toHaveBeenCalled()
  })
})
