/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const processPublicContributionWithWikiAgent = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-wiki-runner', () => ({
  processPublicContributionWithWikiAgent: (...args: unknown[]) => processPublicContributionWithWikiAgent(...args),
}))

describe('/api/agents/wiki/process-contribution', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'user-1' }, headers: new Headers() })
    processPublicContributionWithWikiAgent.mockResolvedValue({ eventClusterId: 'event-1', status: 'candidate' })
  })

  it('processes a contribution for the authenticated actor', async () => {
    const response = await POST(new NextRequest('http://localhost/api/agents/wiki/process-contribution', {
      method: 'POST',
      body: JSON.stringify({ contributionId: 'contribution-1' }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      processed: true,
      result: { eventClusterId: 'event-1', status: 'candidate' },
    })
    expect(processPublicContributionWithWikiAgent).toHaveBeenCalledWith({
      contributionId: 'contribution-1',
      actorUserId: 'user-1',
    })
  })
})
