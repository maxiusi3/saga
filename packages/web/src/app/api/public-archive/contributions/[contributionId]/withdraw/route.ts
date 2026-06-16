import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireContributionOwner } from '@/lib/server/public-archive-access'
import {
  createPublicArchiveAuditEvent,
  markContributionEventsForReprocessing,
  withdrawPublicContribution,
} from '@/lib/server/public-archive-store'

interface RouteContext {
  params: Promise<{ contributionId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { contributionId } = await context.params
  const access = await requireContributionOwner(contributionId, auth.user)
  if (!access.ok) return withAuthHeaders(access.response, auth.headers)

  const contribution = await withdrawPublicContribution(contributionId)
  await markContributionEventsForReprocessing(contributionId)
  await createPublicArchiveAuditEvent({
    eventType: 'withdrawn',
    actorUserId: auth.user.id,
    publicContributionId: contributionId,
    publicEventClusterId: null,
    consentCopyVersion: null,
    metadata: {},
  })

  return NextResponse.json({ contribution }, { headers: auth.headers })
}

function withAuthHeaders(response: NextResponse, headers: Headers) {
  headers.forEach((value, key) => response.headers.set(key, value))
  return response
}
