/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requireStoryFacilitatorForInvitation = jest.fn()
const createPublicContributionInvitation = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requireStoryFacilitatorForInvitation: (...args: unknown[]) => requireStoryFacilitatorForInvitation(...args) }))
jest.mock('@/lib/server/public-archive-store', () => ({ createPublicContributionInvitation: (...args: unknown[]) => createPublicContributionInvitation(...args) }))

describe('/api/stories/[storyId]/public-archive/invitations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'facilitator-1' }, headers: new Headers() })
    requireStoryFacilitatorForInvitation.mockResolvedValue({
      ok: true,
      story: { id: 'story-1', project_id: 'project-1', storyteller_id: 'storyteller-1' },
    })
    createPublicContributionInvitation.mockResolvedValue({ id: 'invitation-1', status: 'pending' })
  })

  it('lets a facilitator invite the storyteller without creating public contribution consent', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive/invitations', {
        method: 'POST',
        body: JSON.stringify({ message: 'This story may help others.' }),
      }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ invitation: { id: 'invitation-1', status: 'pending' } })
    expect(createPublicContributionInvitation).toHaveBeenCalledWith({
      storyId: 'story-1',
      projectId: 'project-1',
      invitedStorytellerId: 'storyteller-1',
      invitedBy: 'facilitator-1',
      message: 'This story may help others.',
    })
  })

  it('rejects users who cannot manage the story project', async () => {
    requireStoryFacilitatorForInvitation.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Only the project facilitator can invite contribution' }, { status: 403 }),
    })

    const response = await POST(
      new NextRequest('http://localhost/api/stories/story-1/public-archive/invitations', { method: 'POST', body: JSON.stringify({}) }),
      { params: Promise.resolve({ storyId: 'story-1' }) },
    )

    expect(response.status).toBe(403)
    expect(createPublicContributionInvitation).not.toHaveBeenCalled()
  })
})
