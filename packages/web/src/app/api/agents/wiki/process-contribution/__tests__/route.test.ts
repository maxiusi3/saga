/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requireContributionOwner = jest.fn()
const processPublicContributionWithWikiAgent = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requireContributionOwner: (...args: unknown[]) => requireContributionOwner(...args) }))
jest.mock('@/lib/server/public-archive-wiki-runner', () => ({
  processPublicContributionWithWikiAgent: (...args: unknown[]) => processPublicContributionWithWikiAgent(...args),
}))

describe('/api/agents/wiki/process-contribution', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'user-1' }, headers: new Headers() })
    requireContributionOwner.mockResolvedValue({ ok: true, contribution: { id: 'contribution-1', source_user_id: 'user-1' } })
    processPublicContributionWithWikiAgent.mockResolvedValue({ eventClusterId: 'event-1', status: 'candidate' })
  })

  it('processes a contribution for the authenticated owner', async () => {
    const response = await POST(new NextRequest('http://localhost/api/agents/wiki/process-contribution', {
      method: 'POST',
      body: JSON.stringify({ contributionId: 'contribution-1' }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      processed: true,
      result: { eventClusterId: 'event-1', status: 'candidate' },
    })
    expect(requireContributionOwner).toHaveBeenCalledWith('contribution-1', { id: 'user-1' })
    expect(processPublicContributionWithWikiAgent).toHaveBeenCalledWith({
      contributionId: 'contribution-1',
      actorUserId: 'user-1',
    })
  })

  it('rejects callers who do not own the contribution', async () => {
    requireContributionOwner.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
    })

    const response = await POST(new NextRequest('http://localhost/api/agents/wiki/process-contribution', {
      method: 'POST',
      body: JSON.stringify({ contributionId: 'contribution-1' }),
    }))

    expect(response.status).toBe(403)
    expect(processPublicContributionWithWikiAgent).not.toHaveBeenCalled()
  })
})
