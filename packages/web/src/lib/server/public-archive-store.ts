import type { StoryElementType } from '@saga/shared/types/agents'
import type {
  PublicArchiveApprovedEventSummary,
  PublicArchiveConsentScope,
} from '@saga/shared/types/public-archive'
import { getSupabaseAdmin } from '@/lib/supabase'

function raise(error: { message?: string; code?: string } | null) {
  if (!error) return
  const storeError = new Error(error.message || 'Supabase public archive store operation failed') as Error & {
    code?: string
  }
  storeError.code = error.code
  throw storeError
}

export async function createPublicContribution(input: {
  sourceProjectId: string
  sourceStoryId: string
  sourceUserId: string
  sourceStoryHash: string
  sourceContentHash: string
  consentCopyVersion: string
  consentScope?: PublicArchiveConsentScope[]
  anonymizedTitle: string
  anonymizedText: string
  anonymizedSummary: string
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('public_contributions')
    .insert({
      source_project_id: input.sourceProjectId,
      source_story_id: input.sourceStoryId,
      source_user_id: input.sourceUserId,
      source_story_hash: input.sourceStoryHash,
      source_content_hash: input.sourceContentHash,
      consent_scope: input.consentScope ?? ['text', 'structured_elements'],
      consent_copy_version: input.consentCopyVersion,
      anonymized_title: input.anonymizedTitle,
      anonymized_text: input.anonymizedText,
      anonymized_summary: input.anonymizedSummary,
    })
    .select()
    .single()

  raise(error)
  return data
}

export async function createPublicContributionElements(
  publicContributionId: string,
  elements: Array<{
    elementType: StoryElementType
    value: string
    normalizedValue: string | null
    sourceQuote: string | null
    confidence: number
  }>,
) {
  if (elements.length === 0) return []

  const { data, error } = await getSupabaseAdmin()
    .from('public_contribution_elements')
    .insert(
      elements.map(element => ({
        public_contribution_id: publicContributionId,
        element_type: element.elementType,
        value: element.value,
        normalized_value: element.normalizedValue ?? null,
        source_quote: element.sourceQuote ?? null,
        confidence: element.confidence,
      })),
    )
    .select()

  raise(error)
  return data || []
}

export async function createPublicContributionInvitation(input: {
  storyId: string
  projectId: string
  invitedStorytellerId: string
  invitedBy: string
  message: string | null
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('public_contribution_invitations')
    .insert({
      story_id: input.storyId,
      project_id: input.projectId,
      invited_storyteller_id: input.invitedStorytellerId,
      invited_by: input.invitedBy,
      message: input.message,
    })
    .select()
    .single()

  raise(error)
  return data
}

export async function getOwnContributionForStory(storyId: string, userId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('public_contributions')
    .select('*')
    .eq('source_story_id', storyId)
    .eq('source_user_id', userId)
    .maybeSingle()

  raise(error)
  return data || null
}

export async function withdrawPublicContribution(contributionId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('public_contributions')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', contributionId)
    .select()
    .single()

  raise(error)
  return data
}

export async function markContributionEventsForReprocessing(publicContributionId: string) {
  const db = getSupabaseAdmin()
  const { data: links, error: linkError } = await db
    .from('public_event_contributions')
    .select('public_event_cluster_id')
    .eq('public_contribution_id', publicContributionId)
    .is('removed_at', null)

  raise(linkError)
  const ids = [...new Set((links || []).map((link: { public_event_cluster_id: string }) => link.public_event_cluster_id))]
  if (ids.length === 0) return []

  const { data, error } = await db
    .from('public_event_clusters')
    .update({ status: 'needs_reprocessing', updated_at: new Date().toISOString() })
    .in('id', ids)
    .select()

  raise(error)
  return data || []
}

export async function createPublicArchiveAuditEvent(input: {
  eventType: 'preview_generated' | 'opted_in' | 'wiki_processed' | 'review_approved' | 'review_rejected' | 'withdrawn'
  actorUserId: string | null
  publicContributionId: string | null
  publicEventClusterId: string | null
  consentCopyVersion: string | null
  metadata: Record<string, unknown>
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('public_archive_audit_events')
    .insert({
      event_type: input.eventType,
      actor_user_id: input.actorUserId,
      public_contribution_id: input.publicContributionId,
      public_event_cluster_id: input.publicEventClusterId,
      consent_copy_version: input.consentCopyVersion,
      metadata: input.metadata,
    })
    .select()
    .single()

  raise(error)
  return data
}

interface WikiEventClusterOutput {
  status: 'candidate' | 'draft' | 'approved' | 'rejected' | 'needs_reprocessing'
  eventLabel: string
  timeframe: string
  placeScope: string
  historicalContextSummary: string
  perspectiveSummary: string
  representativeExcerpts: string[]
  uncertaintyNotes: string
  confidence: number
  // When set, an existing open cluster to update instead of inserting a new one.
  existingClusterId?: string | null
}

export async function getActiveContributionWithElementsForWiki(contributionId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('public_contributions')
    .select('*, elements:public_contribution_elements(*)')
    .eq('id', contributionId)
    .eq('status', 'active')
    .maybeSingle()

  raise(error)
  return data || null
}

const CLUSTER_MEMBER_LIMIT = 500

// Active contributions (with their public elements) currently linked to a cluster.
// Bounded by cluster membership - not the whole archive - so clustering/reprocessing
// scales with a single event's size; the cap is logged so truncation is never silent.
export async function getActiveContributionsWithElementsForCluster(
  clusterId: string,
  limit: number = CLUSTER_MEMBER_LIMIT,
) {
  const db = getSupabaseAdmin()
  const { data: links, error: linksError } = await db
    .from('public_event_contributions')
    .select('public_contribution_id')
    .eq('public_event_cluster_id', clusterId)
    .is('removed_at', null)

  raise(linksError)
  const ids = [...new Set((links || []).map((link: { public_contribution_id: string }) => link.public_contribution_id))]
  if (ids.length === 0) return []

  const { data, error } = await db
    .from('public_contributions')
    .select('*, elements:public_contribution_elements(*)')
    .in('id', ids)
    .eq('status', 'active')
    .limit(limit)

  raise(error)
  const rows = data || []
  if (rows.length === limit) {
    console.warn(`[public-archive] cluster ${clusterId} reprocessing considered only the first ${limit} contributions`)
  }
  return rows
}

// Open clusters eligible to be reused/updated by the Wiki Editor. Approved and
// rejected clusters are intentionally excluded so reviewed state stays immutable.
export async function listClusterableEventClusters() {
  const { data, error } = await getSupabaseAdmin()
    .from('public_event_clusters')
    .select('*')
    .in('status', ['candidate', 'draft', 'needs_reprocessing'])

  raise(error)
  return data || []
}

export async function createOrUpdatePublicEventCluster(output: WikiEventClusterOutput) {
  const db = getSupabaseAdmin()
  const row = {
    status: output.status,
    event_label: output.eventLabel,
    timeframe: output.timeframe,
    place_scope: output.placeScope,
    historical_context_summary: output.historicalContextSummary,
    perspective_summary: output.perspectiveSummary,
    representative_excerpts: output.representativeExcerpts,
    uncertainty_notes: output.uncertaintyNotes,
    confidence: output.confidence,
  }

  if (output.existingClusterId) {
    const { data, error } = await db
      .from('public_event_clusters')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', output.existingClusterId)
      .select()
      .single()

    raise(error)
    return data
  }

  const { data, error } = await db
    .from('public_event_clusters')
    .insert(row)
    .select()
    .single()

  raise(error)
  return data
}

// When a cluster has no remaining active contributions (e.g. all were withdrawn), clear
// its derived text and mark it rejected so no withdrawn content lingers and it leaves the
// reviewer queue.
export async function emptyPublicEventCluster(clusterId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('public_event_clusters')
    .update({
      status: 'rejected',
      perspective_summary: '',
      historical_context_summary: '',
      representative_excerpts: [],
      uncertainty_notes: 'All contributions were withdrawn; no active perspectives remain.',
      updated_at: new Date().toISOString(),
    })
    .eq('id', clusterId)
    .select()
    .single()

  raise(error)
  return data
}

export async function linkPublicEventContributions(
  publicEventClusterId: string,
  contributionIds: string[],
) {
  if (contributionIds.length === 0) return []

  const db = getSupabaseAdmin()
  // Idempotent: only insert links that do not already exist for this cluster, so
  // reprocessing the same group does not violate the active-link unique index.
  const { data: existing, error: existingError } = await db
    .from('public_event_contributions')
    .select('public_contribution_id')
    .eq('public_event_cluster_id', publicEventClusterId)
    .is('removed_at', null)

  raise(existingError)
  const linked = new Set((existing || []).map((row: { public_contribution_id: string }) => row.public_contribution_id))
  const missing = contributionIds.filter(id => !linked.has(id))
  if (missing.length === 0) return []

  const { data, error } = await db
    .from('public_event_contributions')
    .insert(
      missing.map(contributionId => ({
        public_event_cluster_id: publicEventClusterId,
        public_contribution_id: contributionId,
        perspective_summary: '',
      })),
    )
    .select()

  raise(error)
  return data || []
}

// Soft-delete a contribution's active event links so a withdrawn contribution stops
// counting toward clusters and stops influencing future Wiki processing.
export async function removeContributionEventLinks(publicContributionId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('public_event_contributions')
    .update({ removed_at: new Date().toISOString() })
    .eq('public_contribution_id', publicContributionId)
    .is('removed_at', null)
    .select()

  raise(error)
  return data || []
}

export async function updateContributionWikiStatus(
  contributionId: string,
  wikiStatus: 'pending' | 'processed' | 'failed',
) {
  const { data, error } = await getSupabaseAdmin()
    .from('public_contributions')
    .update({ wiki_status: wikiStatus })
    .eq('id', contributionId)
    .select()
    .single()

  raise(error)
  return data
}

export async function listReviewerEventDrafts() {
  const { data, error } = await getSupabaseAdmin()
    .from('public_event_clusters')
    .select('*')
    .eq('status', 'draft')

  raise(error)
  return data || []
}

export async function approvePublicEventDraft(eventId: string, reviewerId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('public_event_clusters')
    .update({
      status: 'approved',
      review_status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select()
    .single()

  raise(error)
  return data
}

export async function rejectPublicEventDraft(eventId: string, reviewerId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('public_event_clusters')
    .update({
      status: 'rejected',
      review_status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select()
    .single()

  raise(error)
  return data
}

export async function markPublicEventNeedsReprocessing(eventId: string, reviewerId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('public_event_clusters')
    .update({
      status: 'needs_reprocessing',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select()
    .single()

  raise(error)
  return data
}

export async function getApprovedEventSummariesForContributor(
  userId: string,
): Promise<PublicArchiveApprovedEventSummary[]> {
  const db = getSupabaseAdmin()

  const { data: contributions, error: contributionsError } = await db
    .from('public_contributions')
    .select('id')
    .eq('source_user_id', userId)
    .eq('status', 'active')

  raise(contributionsError)
  const contributionIds = (contributions || []).map((row: { id: string }) => row.id)
  if (contributionIds.length === 0) return []

  const { data: links, error: linksError } = await db
    .from('public_event_contributions')
    .select('public_event_cluster_id, public_contribution_id')
    .in('public_contribution_id', contributionIds)
    .is('removed_at', null)

  raise(linksError)
  const clusterIds = [
    ...new Set((links || []).map((row: { public_event_cluster_id: string }) => row.public_event_cluster_id)),
  ]
  if (clusterIds.length === 0) return []

  const { data: clusters, error: clustersError } = await db
    .from('public_event_clusters')
    .select('*')
    .in('id', clusterIds)
    .eq('status', 'approved')

  raise(clustersError)

  return (clusters || []).map((cluster: Record<string, any>) => ({
    id: String(cluster.id),
    eventLabel: cluster.event_label,
    activeContributionCount: countClusterContributions(links || [], String(cluster.id)),
    timeframe: cluster.timeframe,
    placeScope: cluster.place_scope,
    historicalContextSummary: cluster.historical_context_summary,
    perspectiveSummary: cluster.perspective_summary,
    representativeExcerpts: Array.isArray(cluster.representative_excerpts) ? cluster.representative_excerpts : [],
    uncertaintyNotes: cluster.uncertainty_notes,
  }))
}

function countClusterContributions(
  links: Array<{ public_event_cluster_id: string }>,
  clusterId: string,
) {
  return links.filter(link => link.public_event_cluster_id === clusterId).length
}
