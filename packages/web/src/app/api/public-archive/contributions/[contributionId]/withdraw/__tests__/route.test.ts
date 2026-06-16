/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requireContributionOwner = jest.fn()
const withdrawPublicContribution = jest.fn()
const markContributionEventsForReprocessing = jest.fn()
const createPublicArchiveAuditEvent = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requireContributionOwner: (...args: unknown[]) => requireContributionOwner(...args) }))
jest.mock('@/lib/server/public-archive-store', () => ({
  withdrawPublicContribution: (...args: unknown[]) => withdrawPublicContribution(...args),
  markContributionEventsForReprocessing: (...args: unknown[]) => markContributionEventsForReprocessing(...args),
  createPublicArchiveAuditEvent: (...args: unknown[]) => createPublicArchiveAuditEvent(...args),
}))

describe('/api/public-archive/contributions/[contributionId]/withdraw', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'user-1' }, headers: new Headers() })
    requireContributionOwner.mockResolvedValue({ ok: true, contribution: { id: 'contribution-1', status: 'active' } })
    withdrawPublicContribution.mockResolvedValue({ id: 'contribution-1', status: 'withdrawn' })
    markContributionEventsForReprocessing.mockResolvedValue([])
    createPublicArchiveAuditEvent.mockResolvedValue({ id: 'audit-1' })
  })

  it('withdraws an owned active contribution and marks linked events for reprocessing', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/public-archive/contributions/contribution-1/withdraw', { method: 'POST' }),
      { params: Promise.resolve({ contributionId: 'contribution-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ contribution: { id: 'contribution-1', status: 'withdrawn' } })
    expect(withdrawPublicContribution).toHaveBeenCalledWith('contribution-1')
    expect(markContributionEventsForReprocessing).toHaveBeenCalledWith('contribution-1')
    expect(createPublicArchiveAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'withdrawn' }))
  })
})
