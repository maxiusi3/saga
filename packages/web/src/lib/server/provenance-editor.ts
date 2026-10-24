import { createHash, randomUUID } from 'crypto'
import type {
  MemoryAttributionKind,
  ProvenanceVerificationStatus,
  ReviewDecisionKind,
} from '@saga/shared/types/agents'
import type { TranscriptVersionRecord } from './ai-capability-gateway'

export type AssertionCategory = 'person' | 'relation' | 'year_date' | 'place' | 'event' | 'quote'
export type DatePrecisionKind = 'exact' | 'approximate_year' | 'decade' | 'unknown' | 'not_applicable'

export interface CandidateStoryAssertion {
  id?: string
  segmentId: string | null
  assertionType: AssertionCategory
  subject: string
  claimText: string
  sourceQuote: string | null
  startMs: number | null
  endMs: number | null
  datePrecision?: DatePrecisionKind
  memoryAttribution?: MemoryAttributionKind
}

export interface VerifiedStoryAssertion {
  id: string
  projectId: string
  storyId: string
  transcriptVersionId: string
  segmentId: string | null
  assertionType: AssertionCategory
  subject: string
  claimText: string
  sourceQuote: string | null
  startMs: number | null
  endMs: number | null
  datePrecision: DatePrecisionKind
  memoryAttribution: MemoryAttributionKind
  verificationStatus: ProvenanceVerificationStatus
  reviewDecision: ReviewDecisionKind
  isSevereFabrication: boolean
  rejectionReason: string | null
  disputedAlternativeText: string | null
  disputedBy: string | null
  reviewedBy: string | null
  reviewerNote: string | null
}

export interface ProvenanceLinkItem {
  paragraphIndex: number
  segmentId: string | null
  startMs: number | null
  endMs: number | null
  verificationStatus: ProvenanceVerificationStatus
}

export interface StoryRevisionSnapshot {
  id: string
  projectId: string
  storyId: string
  transcriptVersionId: string
  revisionNumber: number
  status: 'draft' | 'approved' | 'superseded' | 'invalidated'
  title: string
  body: string
  summary: string
  provenanceLinks: ProvenanceLinkItem[]
  contentSha256: string
  createdBy: string
  approvedBy: string | null
  approvedAt: string | null
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function extractRetractedTerms(segmentText: string): string[] {
  const retracted: string[] = []
  // Match patterns like "in 1968, no wait, 1972" or "not John, I mean Peter"
  const yearCorrection = /\b(19\d{2}|20\d{2})\b[^.!?]*?\b(?:no wait|wait no|sorry|i mean|actually|不对|应该是)\b[^.!?]*?\b(19\d{2}|20\d{2})\b/gi
  for (const match of segmentText.matchAll(yearCorrection)) {
    if (match[1] && match[2] && match[1] !== match[2]) {
      retracted.push(match[1].toLowerCase())
    }
  }
  const nameCorrection = /\bnot\s+([a-z\u4e00-\u9fa5]{2,20})\s*,\s*(?:i mean|actually|it was)\s+([a-z\u4e00-\u9fa5]{2,20})/gi
  for (const match of segmentText.matchAll(nameCorrection)) {
    if (match[1] && match[2] && match[1].toLowerCase() !== match[2].toLowerCase()) {
      retracted.push(match[1].toLowerCase())
    }
  }
  return retracted
}

function isSubjectGroundedInSegment(
  assertion: CandidateStoryAssertion,
  segmentText: string,
): { ok: boolean; reason: string | null } {
  const normSegment = normalizeWhitespace(segmentText)
  const normSubject = normalizeWhitespace(assertion.subject)
  const normClaim = normalizeWhitespace(assertion.claimText)

  if (!normSubject) {
    return { ok: false, reason: 'missing_subject' }
  }

  // Check if the assertion uses a self-retracted value from the speaker
  const retractedTerms = extractRetractedTerms(segmentText)
  for (const retracted of retractedTerms) {
    if (normSubject.includes(retracted) || normClaim.includes(retracted)) {
      return { ok: false, reason: 'uses_self_retracted_statement' }
    }
  }

  // Subject must appear in the segment text
  if (!normSegment.includes(normSubject)) {
    return { ok: false, reason: 'subject_not_in_segment' }
  }

  // If year_date assertion specifies a 4-digit year, verify that exact year is in the segment
  if (assertion.assertionType === 'year_date') {
    const yearsInClaim = [...normClaim.matchAll(/\b(18\d{2}|19\d{2}|20\d{2})\b/g)].map(m => m[1])
    for (const yr of yearsInClaim) {
      if (!normSegment.includes(yr) || retractedTerms.includes(yr)) {
        return { ok: false, reason: 'year_not_grounded_in_segment' }
      }
    }
  }

  return { ok: true, reason: null }
}

const SEVERE_CATEGORIES = new Set<AssertionCategory>(['person', 'relation', 'year_date', 'event'])

export function verifyAndBuildProvenanceDraft(input: {
  revisionId?: string
  revisionNumber: number
  transcript: TranscriptVersionRecord
  candidateTitle: string
  candidateBody: string
  candidateSummary: string
  candidateAssertions: CandidateStoryAssertion[]
  createdBy: string
}): {
  revision: StoryRevisionSnapshot
  assertions: VerifiedStoryAssertion[]
} {
  const segmentMap = new Map(input.transcript.segments.map(s => [s.id, s]))

  // Enforce §4.1: Do not inflate brief greetings or laughter into a long essay
  const body = input.transcript.preserveAsShortClip
    ? input.transcript.fullText
    : input.candidateBody.trim() || input.transcript.fullText
  const summary = input.transcript.preserveAsShortClip
    ? input.transcript.fullText
    : input.candidateSummary.trim() || body.slice(0, 180)
  const title = input.candidateTitle.trim() || 'Family Memory'

  const verifiedAssertions: VerifiedStoryAssertion[] = input.candidateAssertions.map((cand, idx) => {
    const id = cand.id?.trim() || `${input.transcript.id}-assertion-${idx}`
    const datePrecision: DatePrecisionKind = cand.datePrecision ?? 'exact'
    const attribution: MemoryAttributionKind = cand.memoryAttribution ?? 'storyteller_memory'

    // Explicit family supplements are preserved as family_supplement without pretending to be audio-verified
    if (attribution === 'family_supplement') {
      return {
        id,
        projectId: input.transcript.projectId,
        storyId: input.transcript.storyId,
        transcriptVersionId: input.transcript.id,
        segmentId: null,
        assertionType: cand.assertionType,
        subject: cand.subject.trim(),
        claimText: cand.claimText.trim(),
        sourceQuote: cand.sourceQuote?.trim() ?? null,
        startMs: null,
        endMs: null,
        datePrecision,
        memoryAttribution: 'family_supplement',
        verificationStatus: 'family_supplement',
        reviewDecision: 'unreviewed',
        isSevereFabrication: false,
        rejectionReason: null,
        disputedAlternativeText: null,
        disputedBy: null,
        reviewedBy: null,
        reviewerNote: null,
      }
    }

    const segment = cand.segmentId ? segmentMap.get(cand.segmentId) : undefined
    let rejectionReason: string | null = null

    if (!segment) {
      rejectionReason = 'missing_or_unknown_segment_id'
    } else if (!cand.sourceQuote || !cand.sourceQuote.trim()) {
      rejectionReason = 'missing_source_quote'
    } else if (!normalizeWhitespace(segment.text).includes(normalizeWhitespace(cand.sourceQuote))) {
      rejectionReason = 'quote_not_substring_of_segment'
    } else if (input.transcript.alignmentStatus !== 'legacy_unaligned') {
      if (
        typeof cand.startMs !== 'number' ||
        typeof cand.endMs !== 'number' ||
        segment.startMs === null ||
        segment.endMs === null ||
        cand.startMs < segment.startMs ||
        cand.endMs > segment.endMs ||
        cand.endMs < cand.startMs
      ) {
        rejectionReason = 'timestamp_out_of_segment_bounds'
      }
    }

    if (!rejectionReason && segment) {
      const grounding = isSubjectGroundedInSegment(cand, segment.text)
      if (!grounding.ok) {
        rejectionReason = grounding.reason
      }
    }

    // Never fall back to whole-transcript verification when segment/quote verification fails
    const isVerified = rejectionReason === null
    const isSevere = !isVerified && SEVERE_CATEGORIES.has(cand.assertionType)

    return {
      id,
      projectId: input.transcript.projectId,
      storyId: input.transcript.storyId,
      transcriptVersionId: input.transcript.id,
      segmentId: segment ? segment.id : null,
      assertionType: cand.assertionType,
      subject: cand.subject.trim(),
      claimText: cand.claimText.trim(),
      sourceQuote: cand.sourceQuote?.trim() ?? null,
      startMs: isVerified ? cand.startMs : null,
      endMs: isVerified ? cand.endMs : null,
      datePrecision,
      memoryAttribution: attribution,
      verificationStatus: isVerified ? 'verified' : 'unverified_rejected',
      reviewDecision: 'unreviewed',
      isSevereFabrication: isSevere,
      rejectionReason,
      disputedAlternativeText: null,
      disputedBy: null,
      reviewedBy: null,
      reviewerNote: null,
    }
  })

  const provenanceLinks: ProvenanceLinkItem[] = verifiedAssertions.map((a, idx) => ({
    paragraphIndex: idx,
    segmentId: a.segmentId,
    startMs: a.startMs,
    endMs: a.endMs,
    verificationStatus: a.verificationStatus,
  }))

  const contentSha256 = createHash('sha256')
    .update(
      JSON.stringify({
        storyId: input.transcript.storyId,
        transcriptVersionId: input.transcript.id,
        revisionNumber: input.revisionNumber,
        title,
        body,
        summary,
        provenanceLinks,
      }),
    )
    .digest('hex')

  const revision: StoryRevisionSnapshot = {
    id: input.revisionId?.trim() || randomUUID(),
    projectId: input.transcript.projectId,
    storyId: input.transcript.storyId,
    transcriptVersionId: input.transcript.id,
    revisionNumber: input.revisionNumber,
    status: 'draft',
    title,
    body,
    summary,
    provenanceLinks,
    contentSha256,
    createdBy: input.createdBy,
    approvedBy: null,
    approvedAt: null,
  }

  return { revision, assertions: verifiedAssertions }
}

export function applyFamilyReviewDecision(
  assertion: VerifiedStoryAssertion,
  decision: {
    action: 'accept' | 'modify' | 'dispute' | 'skip' | 'reject'
    reviewerId: string
    modifiedClaimText?: string
    disputedAlternativeText?: string
    reviewerNote?: string
  },
): VerifiedStoryAssertion {
  if (decision.action === 'accept') {
    if (assertion.verificationStatus === 'unverified_rejected') {
      throw new Error('Cannot directly accept an unverified_rejected assertion without modifying or marking as family supplement')
    }
    return {
      ...assertion,
      reviewDecision: 'accepted',
      reviewedBy: decision.reviewerId,
      reviewerNote: decision.reviewerNote ?? assertion.reviewerNote,
    }
  }

  if (decision.action === 'modify') {
    const updatedClaim = decision.modifiedClaimText?.trim()
    if (!updatedClaim) {
      throw new Error('modifiedClaimText is required when action is modify')
    }
    return {
      ...assertion,
      claimText: updatedClaim,
      memoryAttribution:
        assertion.verificationStatus === 'unverified_rejected'
          ? 'family_supplement'
          : assertion.memoryAttribution,
      verificationStatus:
        assertion.verificationStatus === 'unverified_rejected'
          ? 'family_supplement'
          : assertion.verificationStatus,
      reviewDecision: 'modified',
      isSevereFabrication: false,
      reviewedBy: decision.reviewerId,
      reviewerNote: decision.reviewerNote ?? null,
    }
  }

  if (decision.action === 'dispute') {
    const alt = decision.disputedAlternativeText?.trim()
    if (!alt) {
      throw new Error('disputedAlternativeText is required when action is dispute')
    }
    // Preserve both the original storyteller memory AND the family member's alternative memory
    return {
      ...assertion,
      memoryAttribution: 'disputed_memory',
      verificationStatus: 'disputed',
      reviewDecision: 'disputed',
      isSevereFabrication: false,
      disputedAlternativeText: alt,
      disputedBy: decision.reviewerId,
      reviewedBy: decision.reviewerId,
      reviewerNote: decision.reviewerNote ?? null,
    }
  }

  if (decision.action === 'reject') {
    return {
      ...assertion,
      reviewDecision: 'rejected',
      reviewedBy: decision.reviewerId,
      reviewerNote: decision.reviewerNote ?? null,
    }
  }

  return {
    ...assertion,
    reviewDecision: 'skipped',
    reviewedBy: decision.reviewerId,
    reviewerNote: decision.reviewerNote ?? null,
  }
}

export function approveStoryRevision(
  revision: StoryRevisionSnapshot,
  assertions: VerifiedStoryAssertion[],
  approverId: string,
  now = new Date().toISOString(),
): StoryRevisionSnapshot {
  if (revision.status === 'invalidated') {
    throw new Error('g2_approval_blocked: invalidated draft revision cannot be approved')
  }

  const activeAssertions = assertions.filter(a => a.reviewDecision !== 'rejected')
  const unresolvedSevere = activeAssertions.filter(a => a.isSevereFabrication)
  if (unresolvedSevere.length > 0) {
    throw new Error(
      `g2_approval_blocked: ${unresolvedSevere.length} unresolved severe fabrication(s) cannot enter approved story revision`,
    )
  }

  const unverifiedRemaining = activeAssertions.filter(
    a => a.verificationStatus === 'unverified_rejected' || a.verificationStatus === 'invalidated',
  )
  if (unverifiedRemaining.length > 0) {
    throw new Error(
      `g2_approval_blocked: ${unverifiedRemaining.length} unverified or invalidated assertion(s) lack valid provenance or family supplement`,
    )
  }

  return {
    ...revision,
    status: 'approved',
    approvedBy: approverId,
    approvedAt: now,
  }
}

export function propagateTranscriptCorrection(input: {
  previousRevisions: StoryRevisionSnapshot[]
  previousAssertions: VerifiedStoryAssertion[]
  correctedSegmentIds: string[]
}): {
  updatedRevisions: StoryRevisionSnapshot[]
  updatedAssertions: VerifiedStoryAssertion[]
} {
  const correctedSet = new Set(input.correctedSegmentIds)

  // Approved revisions are immutable snapshots and must never be overwritten or invalidated;
  // only unapproved draft revisions are invalidated when the underlying transcript changes.
  const updatedRevisions = input.previousRevisions.map(rev => {
    if (rev.status === 'approved') {
      return { ...rev }
    }
    if (rev.status === 'draft') {
      return { ...rev, status: 'invalidated' as const }
    }
    return { ...rev }
  })

  const updatedAssertions = input.previousAssertions.map(assertion => {
    if (assertion.segmentId && correctedSet.has(assertion.segmentId)) {
      return {
        ...assertion,
        verificationStatus: 'invalidated' as const,
      }
    }
    return { ...assertion }
  })

  return { updatedRevisions, updatedAssertions }
}
