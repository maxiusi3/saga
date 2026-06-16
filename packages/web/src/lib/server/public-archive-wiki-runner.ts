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
  getActiveContributionWithElementsForWiki,
  linkPublicEventContributions,
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
    const wikiOutput = processWikiEventDraft({
      existingClusters: [],
      contributions: [contribution],
    })
    const eventCluster = await createOrUpdatePublicEventCluster(wikiOutput)
    await linkPublicEventContributions(String(eventCluster.id), wikiOutput.activeContributionIds)
    await createAgentArtifact({
      agentRunId: runId,
      projectId: '',
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
