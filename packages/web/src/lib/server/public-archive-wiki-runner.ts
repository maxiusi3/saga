import { processWikiEventDraft } from '@/lib/public-archive/wiki-editor-agent'
import {
  completeAgentRun,
  createAgentArtifact,
  createAgentRun,
  failAgentRun,
} from '@/lib/server/agent-store'
import {
  createOrUpdatePublicEventCluster,
  createPublicArchiveAuditEvent,
  emptyPublicEventCluster,
  getActiveContributionWithElementsForWiki,
  getActiveContributionsWithElementsForCluster,
  linkPublicEventContributions,
  listClusterableEventClusters,
  updateContributionWikiStatus,
} from '@/lib/server/public-archive-store'

export async function processPublicContributionWithWikiAgent(input: {
  contributionId: string
  actorUserId: string
}) {
  let runId: string | null = null
  try {
    const run = await createAgentRun({
      agentType: 'wiki_editor',
      projectId: null,
      storyId: null,
      interviewSessionId: null,
      createdBy: input.actorUserId,
      input: { contributionId: input.contributionId },
      contentHash: input.contributionId,
      model: 'deterministic-wiki-editor-agent',
    })
    runId = String(run.id)
    const contribution = await getActiveContributionWithElementsForWiki(input.contributionId)
    if (!contribution) {
      throw new Error(`Active public contribution ${input.contributionId} not found for wiki processing`)
    }

    const existingClusters = await listClusterableEventClusters()
    // Pass 1: derive this contribution's signature and whether it joins an open cluster.
    const probe = processWikiEventDraft({
      existingClusters,
      contributions: [contribution],
      primaryContributionId: String(contribution.id),
    })
    // Pass 2: if it joins an existing cluster, recompute over that cluster's active members
    // plus this contribution so shared events reach 'draft'. Aggregation happens at the
    // cluster (the shared signature is the rendezvous point), so we never scan the whole
    // archive - the load is bounded by a single event's membership.
    let wikiOutput = probe
    if (probe.existingClusterId) {
      const members = await getActiveContributionsWithElementsForCluster(probe.existingClusterId)
      wikiOutput = processWikiEventDraft({
        existingClusters,
        contributions: mergePrimaryContribution(contribution, members),
        primaryContributionId: String(contribution.id),
      })
    }

    const eventCluster = await createOrUpdatePublicEventCluster(wikiOutput)
    await linkPublicEventContributions(String(eventCluster.id), wikiOutput.activeContributionIds)
    await createAgentArtifact({
      agentRunId: runId,
      // agent_artifacts.project_id is NOT NULL; scope the cluster artifact to the
      // source contribution's project rather than an invalid empty string.
      projectId: String(contribution.source_project_id),
      storyId: null,
      artifactType: wikiOutput.status === 'draft' ? 'wiki_event_draft' : 'wiki_event_candidate',
      payload: wikiOutput as unknown as Record<string, unknown>,
      sourceRefs: wikiOutput.activeContributionIds.map(id => ({ source_type: 'story', source_id: id })),
      confidence: wikiOutput.confidence,
    })
    await updateContributionWikiStatus(input.contributionId, 'processed')
    await createPublicArchiveAuditEvent({
      eventType: 'wiki_processed',
      actorUserId: input.actorUserId,
      publicContributionId: input.contributionId,
      publicEventClusterId: String(eventCluster.id),
      consentCopyVersion: null,
      metadata: { status: wikiOutput.status },
    })
    await completeAgentRun(runId, { eventClusterId: String(eventCluster.id), status: wikiOutput.status })
    return { eventClusterId: String(eventCluster.id), status: wikiOutput.status }
  } catch (error) {
    await updateContributionWikiStatus(input.contributionId, 'failed')
    if (runId) await failAgentRun(runId, error instanceof Error ? error.message : 'Wiki processing failed')
    throw error
  }
}

// Recompute a cluster from its remaining active contributions. Used after a withdrawal or
// a reviewer 'needs_reprocessing' action so withdrawn perspectives are scrubbed and the
// cluster's status/summary reflect only active contributors. Empties the cluster (and
// marks it rejected) when no active contributions remain.
export async function reprocessPublicEventCluster(clusterId: string, actorUserId: string) {
  const members = await getActiveContributionsWithElementsForCluster(clusterId)
  if (members.length === 0) {
    await emptyPublicEventCluster(clusterId)
    return { eventClusterId: clusterId, status: 'rejected' as const, activeContributions: 0 }
  }

  const wikiOutput = processWikiEventDraft({
    existingClusters: [],
    contributions: members,
    primaryContributionId: String(members[0].id),
  })
  // Force the update onto this cluster regardless of the agent's match heuristic.
  await createOrUpdatePublicEventCluster({ ...wikiOutput, existingClusterId: clusterId })
  await linkPublicEventContributions(clusterId, wikiOutput.activeContributionIds)
  await createPublicArchiveAuditEvent({
    eventType: 'wiki_processed',
    actorUserId,
    publicContributionId: null,
    publicEventClusterId: clusterId,
    consentCopyVersion: null,
    metadata: { status: wikiOutput.status, reprocessed: true },
  })
  return { eventClusterId: clusterId, status: wikiOutput.status, activeContributions: members.length }
}

// Ensure the contribution being processed is present exactly once, even if the cluster
// member query raced or excluded it.
function mergePrimaryContribution<T extends { id: string }>(primary: T, others: T[]): T[] {
  const seen = new Set([String(primary.id)])
  const merged: T[] = [primary]
  for (const contribution of others) {
    const id = String(contribution.id)
    if (seen.has(id)) continue
    seen.add(id)
    merged.push(contribution)
  }
  return merged
}
