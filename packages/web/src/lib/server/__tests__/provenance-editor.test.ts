/** @jest-environment node */

import { buildVersionedTranscript } from '@/lib/server/ai-capability-gateway'
import {
  applyFamilyReviewDecision,
  approveStoryRevision,
  propagateTranscriptCorrection,
  verifyAndBuildProvenanceDraft,
} from '@/lib/server/provenance-editor'

describe('T07 & T08 provenance-constrained editor, invalidation propagation, and family review', () => {
  const transcript = buildVersionedTranscript({
    transcriptVersionId: 'tv-alpha-1',
    projectId: 'proj-alpha',
    storyId: 'story-alpha-1',
    version: 1,
    language: 'en',
    provider: 'elevenlabs',
    model: 'scribe_v2',
    createdBy: 'user-owner',
    rawSegments: [
      {
        speakerLabel: 'Grandma Evelyn',
        startMs: 0,
        endMs: 15000,
        text: 'In 1964, no wait, in 1968, my maternal uncle Uncle Arthur rebuilt the cedar boat in Portland.',
      },
      {
        speakerLabel: 'Grandma Evelyn',
        startMs: 15000,
        endMs: 30000,
        text: 'We sailed out every Sunday morning.',
      },
    ],
  })

  it('verifies grounded quotes and rejects mismatched quotes/timestamps without falling back to whole-transcript verification', () => {
    const { revision, assertions } = verifyAndBuildProvenanceDraft({
      revisionId: 'rev-1',
      revisionNumber: 1,
      transcript,
      candidateTitle: 'The Cedar Boat in Portland',
      candidateBody: 'In 1968, Uncle Arthur rebuilt the cedar boat in Portland.',
      candidateSummary: 'Uncle Arthur rebuilt the boat in 1968.',
      createdBy: 'user-owner',
      candidateAssertions: [
        {
          id: 'assert-valid',
          segmentId: transcript.segments[0].id,
          assertionType: 'person',
          subject: 'Uncle Arthur',
          claimText: 'Uncle Arthur rebuilt the cedar boat',
          sourceQuote: 'my maternal uncle Uncle Arthur rebuilt the cedar boat',
          startMs: 0,
          endMs: 15000,
        },
        {
          id: 'assert-retracted-year',
          segmentId: transcript.segments[0].id,
          assertionType: 'year_date',
          subject: '1964',
          claimText: 'Rebuilt in 1964',
          sourceQuote: 'In 1964, no wait, in 1968',
          startMs: 0,
          endMs: 15000,
        },
        {
          id: 'assert-bad-quote',
          segmentId: transcript.segments[1].id,
          assertionType: 'event',
          subject: 'won a gold medal',
          claimText: 'Won a gold medal on Sunday',
          sourceQuote: 'Quote that does not exist in segment 2',
          startMs: 15000,
          endMs: 30000,
        },
      ],
    })

    expect(assertions[0].verificationStatus).toBe('verified')
    expect(assertions[0].isSevereFabrication).toBe(false)

    // Retracted year 1964 is rejected as a severe fabrication
    expect(assertions[1].verificationStatus).toBe('unverified_rejected')
    expect(assertions[1].rejectionReason).toBe('uses_self_retracted_statement')
    expect(assertions[1].isSevereFabrication).toBe(true)

    // Mismatched quote is rejected without falling back to whole transcript
    expect(assertions[2].verificationStatus).toBe('unverified_rejected')
    expect(assertions[2].rejectionReason).toBe('quote_not_substring_of_segment')
    expect(assertions[2].isSevereFabrication).toBe(true)

    // Approving while severe fabrications remain unresolved is blocked
    expect(() => approveStoryRevision(revision, assertions, 'user-owner')).toThrow(/g2_approval_blocked/)
  })

  it('supports family review decisions (modify, dispute with attribution, reject) and allows approval once severe errors are resolved', () => {
    const { revision, assertions } = verifyAndBuildProvenanceDraft({
      revisionId: 'rev-2',
      revisionNumber: 2,
      transcript,
      candidateTitle: 'The Cedar Boat',
      candidateBody: 'In 1968, Uncle Arthur rebuilt the cedar boat.',
      candidateSummary: 'Summary',
      createdBy: 'user-owner',
      candidateAssertions: [
        {
          id: 'a-1',
          segmentId: transcript.segments[0].id,
          assertionType: 'year_date',
          subject: '1968',
          claimText: 'The boat was rebuilt in 1968',
          sourceQuote: 'in 1968, my maternal uncle Uncle Arthur',
          startMs: 0,
          endMs: 15000,
        },
        {
          id: 'a-2',
          segmentId: transcript.segments[0].id,
          assertionType: 'person',
          subject: 'Uncle Arnold',
          claimText: 'Uncle Arnold helped',
          sourceQuote: 'Uncle Arthur rebuilt',
          startMs: 0,
          endMs: 15000,
        },
      ],
    })

    // Family member disputes the year (preserving both Grandma's 1968 memory and Aunt Clara's 1969 note)
    const disputedYear = applyFamilyReviewDecision(assertions[0], {
      action: 'dispute',
      reviewerId: 'member-clara',
      disputedAlternativeText: 'Aunt Clara recalls the harbor storm was in autumn 1969',
      reviewerNote: 'Checked harbour logbook',
    })
    expect(disputedYear.verificationStatus).toBe('disputed')
    expect(disputedYear.memoryAttribution).toBe('disputed_memory')
    expect(disputedYear.claimText).toBe('The boat was rebuilt in 1968')
    expect(disputedYear.disputedAlternativeText).toContain('autumn 1969')
    expect(disputedYear.disputedBy).toBe('member-clara')

    // Reviewer modifies the hallucinated name to the verified name or family supplement
    const correctedPerson = applyFamilyReviewDecision(assertions[1], {
      action: 'modify',
      reviewerId: 'user-owner',
      modifiedClaimText: 'Uncle Arthur rebuilt the boat',
    })
    expect(correctedPerson.isSevereFabrication).toBe(false)
    expect(correctedPerson.verificationStatus).toBe('family_supplement')

    const approved = approveStoryRevision(revision, [disputedYear, correctedPerson], 'user-owner')
    expect(approved.status).toBe('approved')
    expect(approved.approvedBy).toBe('user-owner')
  })

  it('invalidates unapproved drafts when transcript is corrected while preserving approved revision snapshots', () => {
    const approvedRev = {
      id: 'rev-approved',
      projectId: 'proj-alpha',
      storyId: 'story-alpha-1',
      transcriptVersionId: 'tv-alpha-1',
      revisionNumber: 1,
      status: 'approved' as const,
      title: 'Approved Snapshot',
      body: 'Original approved body',
      summary: 'Summary',
      provenanceLinks: [],
      contentSha256: 'a'.repeat(64),
      createdBy: 'user-owner',
      approvedBy: 'user-owner',
      approvedAt: '2026-10-24T10:00:00.000Z',
    }
    const draftRev = {
      ...approvedRev,
      id: 'rev-draft',
      revisionNumber: 2,
      status: 'draft' as const,
      approvedBy: null,
      approvedAt: null,
    }

    const { updatedRevisions } = propagateTranscriptCorrection({
      previousRevisions: [approvedRev, draftRev],
      previousAssertions: [],
      correctedSegmentIds: [transcript.segments[0].id],
    })

    expect(updatedRevisions[0].status).toBe('approved')
    expect(updatedRevisions[0].body).toBe('Original approved body')
    expect(updatedRevisions[1].status).toBe('invalidated')
  })
})
