/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '../route'

const getAuthenticatedUser = jest.fn()
const requirePublicArchiveReviewer = jest.fn()
const listReviewerEventDrafts = jest.fn()

jest.mock('@/lib/server/auth', () => ({ getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args) }))
jest.mock('@/lib/server/public-archive-access', () => ({ requirePublicArchiveReviewer: (...args: unknown[]) => requirePublicArchiveReviewer(...args) }))
jest.mock('@/lib/server/public-archive-store', () => ({ listReviewerEventDrafts: (...args: unknown[]) => listReviewerEventDrafts(...args) }))

describe('/api/public-archive/reviewer/event-drafts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'reviewer-1' }, headers: new Headers() })
    requirePublicArchiveReviewer.mockResolvedValue({ ok: true })
    listReviewerEventDrafts.mockResolvedValue([{ id: 'event-1', status: 'draft' }])
  })

  it('lists pending event drafts for platform reviewers', async () => {
    const response = await GET(new NextRequest('http://localhost/api/public-archive/reviewer/event-drafts'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ drafts: [{ id: 'event-1', status: 'draft' }] })
    expect(requirePublicArchiveReviewer).toHaveBeenCalledWith({ id: 'reviewer-1' })
  })
})
