import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { requireContributionOwner } from '@/lib/server/public-archive-access'
import { runAfterResponse, withAuthHeaders } from '@/lib/server/http'
import { reprocessPublicEventCluster } from '@/lib/server/public-archive-wiki-runner'
import {
  createPublicArchiveAuditEvent,
  markContributionEventsForReprocessing,
  removeContributionEventLinks,
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
  // Flip linked clusters to needs_reprocessing first (while links still resolve them),
  // then detach this contribution so it no longer counts toward or feeds any cluster.
  const affectedClusters = await markContributionEventsForReprocessing(contributionId)
  await removeContributionEventLinks(contributionId)
  await createPublicArchiveAuditEvent({
    eventType: 'withdrawn',
    actorUserId: auth.user.id,
    publicContributionId: contributionId,
    publicEventClusterId: null,
    consentCopyVersion: null,
    metadata: {},
  })

  // Recompute affected clusters after responding so the withdrawn perspective is scrubbed
  // from their summaries/excerpts (or the cluster is emptied if no contributors remain).
  const clusterIds = (affectedClusters as Array<{ id: string }>).map(cluster => String(cluster.id))
  if (clusterIds.length > 0) {
    runAfterResponse(async () => {
      for (const clusterId of clusterIds) {
        await reprocessPublicEventCluster(clusterId, auth.user.id)
      }
    })
  }

  return NextResponse.json({ contribution }, { headers: auth.headers })
}
