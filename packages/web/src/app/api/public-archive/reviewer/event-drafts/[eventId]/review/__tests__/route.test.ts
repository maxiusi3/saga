/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const requirePublicArchiveReviewer = jest.fn()
const approvePublicEventDraft = jest.fn()
const rejectPublicEventDraft = jest.fn()
const markPublicEventNeedsReprocessing = jest.fn()
const createPublicArchiveAuditEvent = jest.fn()
const reprocessPublicEventCluster = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requirePublicArchiveReviewer: (...args: unknown[]) => requirePublicArchiveReviewer(...args) }))
jest.mock('@/lib/server/public-archive-wiki-runner', () => ({
  reprocessPublicEventCluster: (...args: unknown[]) => reprocessPublicEventCluster(...args),
}))
jest.mock('@/lib/server/public-archive-store', () => ({
  approvePublicEventDraft: (...args: unknown[]) => approvePublicEventDraft(...args),
  rejectPublicEventDraft: (...args: unknown[]) => rejectPublicEventDraft(...args),
  markPublicEventNeedsReprocessing: (...args: unknown[]) => markPublicEventNeedsReprocessing(...args),
  createPublicArchiveAuditEvent: (...args: unknown[]) => createPublicArchiveAuditEvent(...args),
}))

describe('/api/public-archive/reviewer/event-drafts/[eventId]/review', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'reviewer-1' }, headers: new Headers() })
    requirePublicArchiveReviewer.mockResolvedValue({ ok: true })
    approvePublicEventDraft.mockResolvedValue({ id: 'event-1', status: 'approved' })
    rejectPublicEventDraft.mockResolvedValue({ id: 'event-1', status: 'rejected' })
    markPublicEventNeedsReprocessing.mockResolvedValue({ id: 'event-1', status: 'needs_reprocessing' })
    createPublicArchiveAuditEvent.mockResolvedValue({ id: 'audit-1' })
    reprocessPublicEventCluster.mockResolvedValue({ eventClusterId: 'event-1', status: 'candidate' })
  })

  it('approves a draft event', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/public-archive/reviewer/event-drafts/event-1/review', {
        method: 'POST',
        body: JSON.stringify({ action: 'approve' }),
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ event: { id: 'event-1', status: 'approved' } })
    expect(approvePublicEventDraft).toHaveBeenCalledWith('event-1', 'reviewer-1')
    expect(createPublicArchiveAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'review_approved' }))
  })

  it('marks a draft for reprocessing and schedules a recompute', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/public-archive/reviewer/event-drafts/event-1/review', {
        method: 'POST',
        body: JSON.stringify({ action: 'needs_reprocessing' }),
      }),
      { params: Promise.resolve({ eventId: 'event-1' }) },
    )
    await new Promise(resolve => setImmediate(resolve))

    expect(response.status).toBe(200)
    expect(markPublicEventNeedsReprocessing).toHaveBeenCalledWith('event-1', 'reviewer-1')
    expect(reprocessPublicEventCluster).toHaveBeenCalledWith('event-1', 'reviewer-1')
  })
})
