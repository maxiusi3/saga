/**
 * @jest-environment node
 */

import { NextResponse } from 'next/server'
import {
  requireContributionOwner,
  requirePublicArchiveReviewer,
  requireStoryContributionOwner,
  requireStoryFacilitatorForInvitation,
} from '../public-archive-access'

const from = jest.fn()
const select = jest.fn()
const eq = jest.fn()
const is = jest.fn()
const maybeSingle = jest.fn()

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from }),
}))

describe('public-archive-access', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    is.mockReturnValue({ maybeSingle })
    eq.mockReturnValue({ eq, is, maybeSingle })
    select.mockReturnValue({ eq })
    from.mockReturnValue({ select })
  })

  it('allows the story storyteller to contribute', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: { id: 'story-1', project_id: 'project-1', storyteller_id: 'user-1' },
      error: null,
    })

    const result = await requireStoryContributionOwner('story-1', { id: 'user-1' } as any)

    expect(result).toEqual({
      ok: true,
      story: { id: 'story-1', project_id: 'project-1', storyteller_id: 'user-1' },
    })
  })

  it('rejects facilitator contribution ownership for storyteller story', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: { id: 'story-1', project_id: 'project-1', storyteller_id: 'storyteller-1' },
      error: null,
    })

    const result = await requireStoryContributionOwner('story-1', { id: 'facilitator-1' } as any)

    expect(result.ok).toBe(false)
    if (!result.ok) expect((result.response as NextResponse).status).toBe(403)
  })

  it('allows active public archive reviewers', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: 'role-1' }, error: null })

    const result = await requirePublicArchiveReviewer({ id: 'reviewer-1' } as any)

    expect(result).toEqual({ ok: true })
    expect(from).toHaveBeenCalledWith('platform_roles')
  })

  it('allows project facilitator to invite a storyteller', async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { id: 'story-1', project_id: 'project-1', storyteller_id: 'storyteller-1' }, error: null })
      .mockResolvedValueOnce({ data: { facilitator_id: 'facilitator-1' }, error: null })

    const result = await requireStoryFacilitatorForInvitation('story-1', { id: 'facilitator-1' } as any)

    expect(result.ok).toBe(true)
  })

  it('allows users to withdraw only their own contributions', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: { id: 'contribution-1', source_user_id: 'user-1', status: 'active' },
      error: null,
    })

    const result = await requireContributionOwner('contribution-1', { id: 'user-1' } as any)

    expect(result.ok).toBe(true)
  })
})
