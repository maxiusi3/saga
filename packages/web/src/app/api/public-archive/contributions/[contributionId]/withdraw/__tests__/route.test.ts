/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requireContributionOwner = jest.fn()
const withdrawPublicContribution = jest.fn()
const markContributionEventsForReprocessing = jest.fn()
const removeContributionEventLinks = jest.fn()
const createPublicArchiveAuditEvent = jest.fn()
const reprocessPublicEventCluster = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requireContributionOwner: (...args: unknown[]) => requireContributionOwner(...args) }))
jest.mock('@/lib/server/public-archive-wiki-runner', () => ({
  reprocessPublicEventCluster: (...args: unknown[]) => reprocessPublicEventCluster(...args),
}))
jest.mock('@/lib/server/public-archive-store', () => ({
  withdrawPublicContribution: (...args: unknown[]) => withdrawPublicContribution(...args),
  markContributionEventsForReprocessing: (...args: unknown[]) => markContributionEventsForReprocessing(...args),
  removeContributionEventLinks: (...args: unknown[]) => removeContributionEventLinks(...args),
  createPublicArchiveAuditEvent: (...args: unknown[]) => createPublicArchiveAuditEvent(...args),
}))

const flushAsync = () => new Promise(resolve => setImmediate(resolve))

describe('/api/public-archive/contributions/[contributionId]/withdraw', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'user-1' }, headers: new Headers() })
    requireContributionOwner.mockResolvedValue({ ok: true, contribution: { id: 'contribution-1', status: 'active' } })
    withdrawPublicContribution.mockResolvedValue({ id: 'contribution-1', status: 'withdrawn' })
    markContributionEventsForReprocessing.mockResolvedValue([])
    removeContributionEventLinks.mockResolvedValue([])
    createPublicArchiveAuditEvent.mockResolvedValue({ id: 'audit-1' })
    reprocessPublicEventCluster.mockResolvedValue({ eventClusterId: 'event-1', status: 'rejected' })
  })

  it('withdraws an owned active contribution, reprocesses linked events, and detaches links', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/public-archive/contributions/contribution-1/withdraw', { method: 'POST' }),
      { params: Promise.resolve({ contributionId: 'contribution-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ contribution: { id: 'contribution-1', status: 'withdrawn' } })
    expect(withdrawPublicContribution).toHaveBeenCalledWith('contribution-1')
    expect(markContributionEventsForReprocessing).toHaveBeenCalledWith('contribution-1')
    expect(removeContributionEventLinks).toHaveBeenCalledWith('contribution-1')
    expect(createPublicArchiveAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'withdrawn' }))
  })

  it('schedules reprocessing for clusters the withdrawn contribution belonged to', async () => {
    markContributionEventsForReprocessing.mockResolvedValueOnce([{ id: 'event-1' }, { id: 'event-2' }])

    await POST(
      new NextRequest('http://localhost/api/public-archive/contributions/contribution-1/withdraw', { method: 'POST' }),
      { params: Promise.resolve({ contributionId: 'contribution-1' }) },
    )
    await flushAsync()

    expect(reprocessPublicEventCluster).toHaveBeenCalledWith('event-1', 'user-1')
    expect(reprocessPublicEventCluster).toHaveBeenCalledWith('event-2', 'user-1')
  })
})
