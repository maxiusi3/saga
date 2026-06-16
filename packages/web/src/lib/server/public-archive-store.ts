import type { StoryElementType } from '@saga/shared/types/agents'
import type { PublicArchiveConsentScope } from '@saga/shared/types/public-archive'
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
    .update({ status: 'withdrawn', wiki_status: 'processed', withdrawn_at: new Date().toISOString() })
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
