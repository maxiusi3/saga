import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requirePublicArchiveReviewer } from '@/lib/server/public-archive-access'
import { runAfterResponse, withAuthHeaders } from '@/lib/server/http'
import { reprocessPublicEventCluster } from '@/lib/server/public-archive-wiki-runner'
import {
  approvePublicEventDraft,
  createPublicArchiveAuditEvent,
  markPublicEventNeedsReprocessing,
  rejectPublicEventDraft,
} from '@/lib/server/public-archive-store'

interface RouteContext {
  params: Promise<{ eventId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const access = await requirePublicArchiveReviewer(auth.user)
  if (!access.ok) return withAuthHeaders(access.response, auth.headers)

  const { eventId } = await context.params
  const body = await request.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : null

  if (action === 'approve') {
    const event = await approvePublicEventDraft(eventId, auth.user.id)
    await createPublicArchiveAuditEvent({
      eventType: 'review_approved',
      actorUserId: auth.user.id,
      publicContributionId: null,
      publicEventClusterId: eventId,
      consentCopyVersion: null,
      metadata: {},
    })
    return NextResponse.json({ event }, { headers: auth.headers })
  }

  if (action === 'reject') {
    const event = await rejectPublicEventDraft(eventId, auth.user.id)
    await createPublicArchiveAuditEvent({
      eventType: 'review_rejected',
      actorUserId: auth.user.id,
      publicContributionId: null,
      publicEventClusterId: eventId,
      consentCopyVersion: null,
      metadata: {},
    })
    return NextResponse.json({ event }, { headers: auth.headers })
  }

  if (action === 'needs_reprocessing') {
    const event = await markPublicEventNeedsReprocessing(eventId, auth.user.id)
    // Recompute the cluster from its current active contributions after responding.
    runAfterResponse(() => reprocessPublicEventCluster(eventId, auth.user.id))
    return NextResponse.json({ event }, { headers: auth.headers })
  }

  return NextResponse.json({ error: 'Unsupported review action' }, { status: 400, headers: auth.headers })
}
