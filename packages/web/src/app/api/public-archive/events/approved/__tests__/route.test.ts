/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '../route'

const getAuthenticatedUser = jest.fn()
const getApprovedEventSummariesForContributor = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-store', () => ({
  getApprovedEventSummariesForContributor: (...args: unknown[]) => getApprovedEventSummariesForContributor(...args),
}))

describe('/api/public-archive/events/approved', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'user-1' }, headers: new Headers() })
    getApprovedEventSummariesForContributor.mockResolvedValue([
      { id: 'event-1', eventLabel: '1976 Guangzhou memories', activeContributionCount: 2 },
    ])
  })

  it('returns approved summaries for the authenticated contributor', async () => {
    const response = await GET(new NextRequest('http://localhost/api/public-archive/events/approved'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      events: [{ id: 'event-1', eventLabel: '1976 Guangzhou memories', activeContributionCount: 2 }],
    })
    expect(getApprovedEventSummariesForContributor).toHaveBeenCalledWith('user-1')
  })
})
