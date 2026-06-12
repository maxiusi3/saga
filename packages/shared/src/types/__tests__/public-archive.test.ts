import {
  PUBLIC_ARCHIVE_CONSENT_SCOPE,
  PUBLIC_CONTRIBUTION_STATUSES,
  PUBLIC_WIKI_STATUSES,
  PUBLIC_EVENT_STATUSES,
  PUBLIC_CONTRIBUTION_INVITATION_STATUSES,
  PLATFORM_ROLES,
  PUBLIC_ARCHIVE_CONSENT_COPY_VERSION,
  type PublicArchiveContribution,
  type PublicArchiveContributionPreview,
  type PublicArchiveApprovedEventSummary,
  type PlatformRole,
} from '../public-archive'
import * as PackageRoot from '../../index'
import * as TypesBarrel from '../index'
import type { PublicArchiveApprovedEventSummary as PackageRootApprovedEventSummary } from '../../index'
import type { PlatformRole as TypesBarrelPlatformRole } from '../index'

describe('public archive shared types', () => {
  it('defines Phase 2 consent scope and statuses', () => {
    expect(PUBLIC_ARCHIVE_CONSENT_SCOPE).toEqual(['text', 'structured_elements'])
    expect(PUBLIC_CONTRIBUTION_STATUSES).toEqual(['active', 'withdrawn'])
    expect(PUBLIC_WIKI_STATUSES).toEqual(['pending', 'processed', 'failed'])
    expect(PUBLIC_EVENT_STATUSES).toEqual(['candidate', 'draft', 'approved', 'rejected', 'needs_reprocessing'])
    expect(PUBLIC_CONTRIBUTION_INVITATION_STATUSES).toEqual(['pending', 'accepted', 'dismissed', 'expired'])
    expect(PLATFORM_ROLES).toEqual(['public_archive_reviewer'])
    expect(PUBLIC_ARCHIVE_CONSENT_COPY_VERSION).toBe('public-archive-consent-v1')
  })

  it('accepts public archive contribution and preview shapes', () => {
    const contribution: PublicArchiveContribution = {
      id: 'contribution-1',
      public_ref: 'pc_001',
      source_story_id: 'story-1',
      source_project_id: 'project-1',
      source_user_id: 'user-1',
      source_story_hash: 'story-hash',
      source_content_hash: 'content-hash',
      consent_scope: ['text', 'structured_elements'],
      consent_copy_version: 'public-archive-consent-v1',
      anonymized_title: 'A market memory',
      anonymized_text: 'In 1976, a child visited a market in Guangzhou.',
      anonymized_summary: 'A childhood memory about courage.',
      status: 'active',
      wiki_status: 'pending',
      submitted_at: '2026-06-12T00:00:00.000Z',
      withdrawn_at: null,
    }

    const preview: PublicArchiveContributionPreview = {
      previewId: 'artifact-1',
      storyId: 'story-1',
      sourceContentHash: 'content-hash',
      consentScope: ['text', 'structured_elements'],
      consentCopyVersion: 'public-archive-consent-v1',
      anonymizedTitle: 'A market memory',
      anonymizedText: 'In 1976, a child visited a market in Guangzhou.',
      anonymizedSummary: 'A childhood memory about courage.',
      elements: [
        {
          elementType: 'time',
          value: '1976',
          normalizedValue: '1976',
          sourceQuote: '1976',
          confidence: 0.9,
        },
      ],
      excludedDataTypes: ['voice', 'audio', 'photos', 'media_derivatives', 'exact_identity'],
    }

    expect(contribution.public_ref).toBe('pc_001')
    expect(preview.elements).toHaveLength(1)
  })

  it('accepts approved event summaries and exports through barrels', () => {
    const role: PlatformRole = 'public_archive_reviewer'
    const summary: PublicArchiveApprovedEventSummary = {
      id: 'event-1',
      eventLabel: '1976 Guangzhou market memories',
      activeContributionCount: 2,
      timeframe: '1976',
      placeScope: 'Guangzhou',
      historicalContextSummary: 'Two contributors remembered market visits in Guangzhou.',
      perspectiveSummary: 'One remembered courage; another remembered family support.',
      representativeExcerpts: ['A child remembered visiting a market.'],
      uncertaintyNotes: 'The exact market is intentionally omitted.',
    }

    expect(role).toBe('public_archive_reviewer')
    expect(summary.activeContributionCount).toBe(2)

    const packageRootSummary: PackageRootApprovedEventSummary = summary
    const typesBarrelRole: TypesBarrelPlatformRole = role

    expect(packageRootSummary.id).toBe('event-1')
    expect(typesBarrelRole).toBe('public_archive_reviewer')
    expect(TypesBarrel.PUBLIC_ARCHIVE_CONSENT_SCOPE).toBe(PUBLIC_ARCHIVE_CONSENT_SCOPE)
    expect(PackageRoot.PUBLIC_ARCHIVE_CONSENT_SCOPE).toBe(PUBLIC_ARCHIVE_CONSENT_SCOPE)
  })
})
