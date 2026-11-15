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
  /** Author of primary family wording, distinct from later reviewers. */
  supplementedBy?: string | null
  reviewerNote: string | null
  /** Append-only alternatives; singular fields remain for older readers. */
  disputedAlternatives?: AttributedDisputedAlternative[]
}

export interface AttributedDisputedAlternative {
  text: string
  reviewerId: string
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
  sourceContentSha256?: string
  assertionSnapshot?: VerifiedStoryAssertion[]
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function claimPreservesSourceContext(claimText: string, sourceQuote: string | null, segmentText: string): boolean {
  const claim = normalizeWhitespace(claimText)
  // A substring can remove a negation, uncertainty, or a later correction.
  // This deterministic helper can verify only the entire source segment.
  return !!claim && claim === normalizeWhitespace(sourceQuote ?? '') && claim === normalizeWhitespace(segmentText)
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
    if (normSubject.includes(retracted) || (normClaim !== normSegment && normClaim.includes(retracted))) {
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
      if (!normSegment.includes(yr) || (normClaim !== normSegment && retractedTerms.includes(yr))) {
        return { ok: false, reason: 'year_not_grounded_in_segment' }
      }
    }
  }

  return { ok: true, reason: null }
}

const SEVERE_CATEGORIES = new Set<AssertionCategory>(['person', 'relation', 'year_date', 'event'])

function alternativesFor(assertion: VerifiedStoryAssertion): AttributedDisputedAlternative[] {
  if (assertion.disputedAlternatives?.length) return assertion.disputedAlternatives
  return assertion.disputedAlternativeText && assertion.disputedBy
    ? [{ text: assertion.disputedAlternativeText, reviewerId: assertion.disputedBy, reviewerNote: assertion.reviewerNote }]
    : []
}

function assertionParagraph(assertion: VerifiedStoryAssertion): string {
  const claim = assertion.claimText.trim()
  const primary = assertion.memoryAttribution === 'family_supplement'
    ? `Family supplement (${assertion.supplementedBy ?? 'unreviewed'}): ${claim}`
    : assertion.memoryAttribution === 'disputed_memory' ? `Disputed memory: ${claim}` : claim
  return [primary, ...alternativesFor(assertion).map(alt => `Family alternative (${alt.reviewerId}): ${alt.text}`)].join('\n')
}

function provenanceFor(assertions: VerifiedStoryAssertion[]): ProvenanceLinkItem[] {
  return assertions.map((assertion, paragraphIndex) => ({
    paragraphIndex,
    segmentId: assertion.segmentId,
    startMs: assertion.startMs,
    endMs: assertion.endMs,
    verificationStatus: assertion.verificationStatus,
  }))
}

function contentHash(revision: Pick<StoryRevisionSnapshot, 'storyId' | 'transcriptVersionId' | 'revisionNumber' | 'title' | 'body' | 'summary' | 'provenanceLinks'>,
  assertions: VerifiedStoryAssertion[]): string {
  return createHash('sha256').update(JSON.stringify({
    storyId: revision.storyId,
    transcriptVersionId: revision.transcriptVersionId,
    revisionNumber: revision.revisionNumber,
    title: revision.title,
    body: revision.body,
    summary: revision.summary,
    provenanceLinks: revision.provenanceLinks,
    assertions,
  })).digest('hex')
}

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

  // Generated factual titles are prose too; no title-review contract exists.
  const title = 'Family Memory'

  const verifiedAssertions: VerifiedStoryAssertion[] = input.candidateAssertions.map(cand => {
    const id = cand.id?.trim() || randomUUID()
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
        sourceQuote: null,
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
        !Number.isSafeInteger(cand.startMs) ||
        !Number.isSafeInteger(cand.endMs) ||
        cand.startMs === null ||
        cand.endMs === null ||
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

    // This verifies an excerpt, not semantic entailment. Paraphrases require a
    // review decision; a shared subject is never sufficient to verify a claim.
    if (!rejectionReason && segment && !claimPreservesSourceContext(cand.claimText, cand.sourceQuote, segment.text)) {
      rejectionReason = 'claim_not_source_excerpt'
    }

    // Never fall back to whole-transcript verification when segment/quote verification fails
    const isVerified = rejectionReason === null
    const requiresSemanticReview = rejectionReason === 'claim_not_source_excerpt'
    const isSevere = !isVerified && !requiresSemanticReview && SEVERE_CATEGORIES.has(cand.assertionType)

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
      startMs: isVerified && input.transcript.alignmentStatus !== 'legacy_unaligned' ? cand.startMs : null,
      endMs: isVerified && input.transcript.alignmentStatus !== 'legacy_unaligned' ? cand.endMs : null,
      datePrecision,
      memoryAttribution: attribution,
      verificationStatus: isVerified ? 'verified' : requiresSemanticReview ? 'pending_review' : 'unverified_rejected',
      reviewDecision: 'unreviewed',
      isSevereFabrication: isSevere,
      rejectionReason,
      disputedAlternativeText: null,
      disputedBy: null,
      reviewedBy: null,
      reviewerNote: null,
    }
  })

  // Candidate prose is not evidence. Drafts display the exact claims requiring
  // review; approval regenerates this text after removing rejected claims.
  const body = verifiedAssertions.length
    ? verifiedAssertions.map(assertionParagraph).join('\n\n')
    : input.transcript.preserveAsShortClip ? input.transcript.fullText : ''
  const summary = body.slice(0, 180)
  const provenanceLinks = provenanceFor(verifiedAssertions)

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
    contentSha256: '',
    createdBy: input.createdBy,
    approvedBy: null,
    approvedAt: null,
    sourceContentSha256: input.transcript.contentSha256,
  }
  revision.contentSha256 = contentHash(revision, verifiedAssertions)

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
    if (!['verified', 'family_supplement', 'disputed'].includes(assertion.verificationStatus)) {
      throw new Error('Cannot directly accept an assertion without verified evidence or an explicit family supplement')
    }
    return {
      ...assertion,
      reviewDecision: 'accepted',
      supplementedBy: assertion.memoryAttribution === 'family_supplement'
        ? assertion.supplementedBy ?? decision.reviewerId : assertion.supplementedBy,
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
      memoryAttribution: 'family_supplement',
      verificationStatus: 'family_supplement',
      segmentId: null,
      sourceQuote: null,
      startMs: null,
      endMs: null,
      rejectionReason: null,
      reviewDecision: 'modified',
      isSevereFabrication: false,
      reviewedBy: decision.reviewerId,
      supplementedBy: decision.reviewerId,
      reviewerNote: decision.reviewerNote ?? null,
    }
  }

  if (decision.action === 'dispute') {
    if (!['verified', 'family_supplement', 'disputed'].includes(assertion.verificationStatus)) {
      throw new Error('Cannot dispute an unsupported generated primary; modify it into an attributed family supplement first')
    }
    if (assertion.memoryAttribution === 'family_supplement' && !assertion.supplementedBy) {
      throw new Error('Cannot dispute an unattributed family supplement; accept or modify it first')
    }
    const alt = decision.disputedAlternativeText?.trim()
    if (!alt) {
      throw new Error('disputedAlternativeText is required when action is dispute')
    }
    // Preserve both the original storyteller memory AND the family member's alternative memory
    return {
      ...assertion,
      memoryAttribution: assertion.memoryAttribution === 'family_supplement' ? 'family_supplement' : 'disputed_memory',
      verificationStatus: 'disputed',
      reviewDecision: 'disputed',
      isSevereFabrication: false,
      disputedAlternativeText: alt,
      disputedBy: decision.reviewerId,
      disputedAlternatives: [...alternativesFor(assertion), {
        text: alt, reviewerId: decision.reviewerId, reviewerNote: decision.reviewerNote ?? null,
      }],
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
  // The caller must load this from its authoritative source, never a submitted
  // assertion payload. This pure helper does not authenticate its caller.
  trustedTranscript: TranscriptVersionRecord,
  now = new Date().toISOString(),
): StoryRevisionSnapshot {
  if (revision.status !== 'draft' || revision.approvedAt || revision.approvedBy) {
    throw new Error('g2_approval_blocked: only a new draft revision can be approved')
  }
  if (!trustedTranscript || trustedTranscript.projectId !== revision.projectId ||
    trustedTranscript.storyId !== revision.storyId || trustedTranscript.id !== revision.transcriptVersionId ||
    !revision.sourceContentSha256 || trustedTranscript.contentSha256 !== revision.sourceContentSha256) {
    throw new Error('g2_approval_blocked: authoritative transcript does not match the draft source')
  }

  const activeAssertions = assertions.filter(a => a.reviewDecision !== 'rejected')
  if (!activeAssertions.length || activeAssertions.some(a => !a.claimText.trim())) {
    throw new Error('g2_approval_blocked: at least one nonempty reviewed claim is required')
  }
  if (assertions.some(a => a.projectId !== revision.projectId || a.storyId !== revision.storyId ||
    a.transcriptVersionId !== revision.transcriptVersionId)) {
    throw new Error('g2_approval_blocked: assertion source does not match the revision')
  }
  if (activeAssertions.some(a => !['accepted', 'modified', 'disputed'].includes(a.reviewDecision) || !a.reviewedBy)) {
    throw new Error('g2_approval_blocked: every included claim requires an attributed review decision')
  }
  const sourceSegments = new Map(trustedTranscript.segments.map(segment => [segment.id, segment]))
  if (activeAssertions.some(a => {
    if (a.memoryAttribution === 'family_supplement') {
      return !a.supplementedBy || a.segmentId !== null || a.sourceQuote !== null || a.startMs !== null || a.endMs !== null
    }
    const segment = a.segmentId ? sourceSegments.get(a.segmentId) : undefined
    return !segment || segment.projectId !== revision.projectId || segment.transcriptVersionId !== revision.transcriptVersionId ||
      !claimPreservesSourceContext(a.claimText, a.sourceQuote, segment.text) ||
      a.startMs !== segment.startMs || a.endMs !== segment.endMs
  })) {
    throw new Error('g2_approval_blocked: verified claim no longer matches its source excerpt')
  }
  const unresolvedSevere = activeAssertions.filter(a => a.isSevereFabrication)
  if (unresolvedSevere.length > 0) {
    throw new Error(
      `g2_approval_blocked: ${unresolvedSevere.length} unresolved severe fabrication(s) cannot enter approved story revision`,
    )
  }

  const unverifiedRemaining = activeAssertions.filter(
    a => !['verified', 'family_supplement', 'disputed'].includes(a.verificationStatus),
  )
  if (unverifiedRemaining.length > 0) {
    throw new Error(
      `g2_approval_blocked: ${unverifiedRemaining.length} unverified or invalidated assertion(s) lack valid provenance or family supplement`,
    )
  }

  const body = activeAssertions.map(assertionParagraph).join('\n\n')
  const approved: StoryRevisionSnapshot = {
    ...revision,
    title: 'Family Memory',
    body,
    summary: body.slice(0, 180),
    provenanceLinks: provenanceFor(activeAssertions),
    assertionSnapshot: activeAssertions.map(a => ({ ...a,
      disputedAlternatives: alternativesFor(a).map(alt => ({ ...alt })),
    })),
    status: 'approved',
    approvedBy: approverId,
    approvedAt: now,
  }
  approved.contentSha256 = contentHash(approved, approved.assertionSnapshot!)
  return approved
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
