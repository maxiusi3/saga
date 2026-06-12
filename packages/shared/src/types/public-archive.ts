import type { StoryElementType } from './agents'

export const PUBLIC_ARCHIVE_CONSENT_SCOPE = ['text', 'structured_elements'] as const
export type PublicArchiveConsentScope = (typeof PUBLIC_ARCHIVE_CONSENT_SCOPE)[number]

export const PUBLIC_CONTRIBUTION_STATUSES = ['active', 'withdrawn'] as const
export type PublicContributionStatus = (typeof PUBLIC_CONTRIBUTION_STATUSES)[number]

export const PUBLIC_WIKI_STATUSES = ['pending', 'processed', 'failed'] as const
export type PublicWikiStatus = (typeof PUBLIC_WIKI_STATUSES)[number]

export const PUBLIC_EVENT_STATUSES = ['candidate', 'draft', 'approved', 'rejected', 'needs_reprocessing'] as const
export type PublicEventStatus = (typeof PUBLIC_EVENT_STATUSES)[number]

export const PUBLIC_CONTRIBUTION_INVITATION_STATUSES = ['pending', 'accepted', 'dismissed', 'expired'] as const
export type PublicContributionInvitationStatus = (typeof PUBLIC_CONTRIBUTION_INVITATION_STATUSES)[number]

export const PLATFORM_ROLES = ['public_archive_reviewer'] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export const PUBLIC_ARCHIVE_CONSENT_COPY_VERSION = 'public-archive-consent-v1'

export interface PublicArchiveElementPreview {
  elementType: StoryElementType
  value: string
  normalizedValue: string | null
  sourceQuote: string | null
  confidence: number
}

export interface PublicArchiveContributionPreview {
  previewId: string
  storyId: string
  sourceContentHash: string
  consentScope: PublicArchiveConsentScope[]
  consentCopyVersion: typeof PUBLIC_ARCHIVE_CONSENT_COPY_VERSION
  anonymizedTitle: string
  anonymizedText: string
  anonymizedSummary: string
  elements: PublicArchiveElementPreview[]
  excludedDataTypes: Array<'voice' | 'audio' | 'photos' | 'media_derivatives' | 'exact_identity'>
}

export interface PublicArchiveContribution {
  id: string
  public_ref: string
  source_project_id: string
  source_story_id: string
  source_user_id: string
  source_story_hash: string
  source_content_hash: string
  consent_scope: PublicArchiveConsentScope[]
  consent_copy_version: string
  anonymized_title: string
  anonymized_text: string
  anonymized_summary: string
  status: PublicContributionStatus
  wiki_status: PublicWikiStatus
  submitted_at: string
  withdrawn_at: string | null
}

export interface PublicArchiveContributionElement {
  id: string
  public_contribution_id: string
  element_type: StoryElementType
  value: string
  normalized_value: string | null
  source_quote: string | null
  confidence: number
  review_status: 'unreviewed' | 'approved' | 'rejected' | 'edited'
  created_at: string
  updated_at: string
}

export interface PublicContributionInvitation {
  id: string
  story_id: string
  project_id: string
  invited_storyteller_id: string
  invited_by: string
  status: PublicContributionInvitationStatus
  message: string | null
  created_at: string
  responded_at: string | null
}

export interface PublicArchiveApprovedEventSummary {
  id: string
  eventLabel: string
  activeContributionCount: number
  timeframe: string
  placeScope: string
  historicalContextSummary: string
  perspectiveSummary: string
  representativeExcerpts: string[]
  uncertaintyNotes: string
}
