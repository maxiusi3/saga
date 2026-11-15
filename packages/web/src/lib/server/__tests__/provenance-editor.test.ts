/** @jest-environment node */

import { buildVersionedTranscript } from '@/lib/server/ai-capability-gateway'
import {
  applyFamilyReviewDecision,
  approveStoryRevision,
  propagateTranscriptCorrection,
  verifyAndBuildProvenanceDraft,
  type CandidateStoryAssertion,
  type VerifiedStoryAssertion,
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
          claimText: transcript.segments[0].text,
          sourceQuote: transcript.segments[0].text,
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
    expect(() => approveStoryRevision(revision, assertions, 'user-owner', transcript)).toThrow(/g2_approval_blocked/)
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
          claimText: transcript.segments[0].text,
          sourceQuote: transcript.segments[0].text,
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
    expect(disputedYear.claimText).toBe(transcript.segments[0].text)
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

    const approved = approveStoryRevision(revision, [disputedYear, correctedPerson], 'user-owner', transcript)
    expect(approved.status).toBe('approved')
    expect(approved.approvedBy).toBe('user-owner', transcript)
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

  const excerptDraft = (overrides: Partial<CandidateStoryAssertion> = {}) => verifyAndBuildProvenanceDraft({
    revisionNumber: 3, transcript, candidateTitle: 'Family memory',
    candidateBody: 'Uncle Arthur won a Nobel Prize.', candidateSummary: 'Nobel laureate.', createdBy: 'user-owner',
    candidateAssertions: [{
      segmentId: transcript.segments[1].id, assertionType: 'event', subject: 'We',
      claimText: 'We sailed out every Sunday morning.', sourceQuote: 'We sailed out every Sunday morning.',
      startMs: 15000, endMs: 30000, ...overrides,
    }],
  })

  it('never verifies a new event or semantic paraphrase just because its subject occurs in the source', () => {
    for (const claimText of ['We won a Nobel Prize.', 'We went sailing each Sunday.']) {
      const { assertions } = excerptDraft({ claimText })
      expect(assertions[0].verificationStatus).toBe('pending_review')
      expect(assertions[0].rejectionReason).toBe('claim_not_source_excerpt')
    }
  })

  it('keeps negation and uncertainty in source excerpts instead of verifying their removal', () => {
    const negativeTranscript = buildVersionedTranscript({
      projectId: 'proj-alpha', storyId: 'story-alpha-1', version: 2, language: 'en',
      provider: 'imported', model: 'legacy-import', createdBy: 'user-owner',
      rawSegments: [{ text: 'John did not travel to Paris. Perhaps Mary went in 1970.' }],
    })
    const draft = verifyAndBuildProvenanceDraft({
      revisionNumber: 1, transcript: negativeTranscript, candidateTitle: 'Memory',
      candidateBody: 'John traveled to Paris.', candidateSummary: 'Certain.', createdBy: 'user-owner',
      candidateAssertions: [{ segmentId: negativeTranscript.segments[0].id, assertionType: 'event',
        subject: 'John', claimText: 'John traveled to Paris.', sourceQuote: negativeTranscript.fullText,
        startMs: null, endMs: null }],
    })
    expect(draft.assertions[0].verificationStatus).toBe('pending_review')
  })

  it('builds the draft and approved text from reviewed claims, excluding arbitrary candidate prose', () => {
    const { revision, assertions } = excerptDraft()
    expect(revision.body).toBe('We sailed out every Sunday morning.')
    expect(revision.summary).not.toContain('Nobel')
    const accepted = applyFamilyReviewDecision(assertions[0], { action: 'accept', reviewerId: 'member-clara' })
    const approved = approveStoryRevision(revision, [accepted], 'user-owner', transcript)
    expect(approved.body).toBe('We sailed out every Sunday morning.')
    expect(approved.summary).not.toContain('Nobel')
    expect(approved.contentSha256).not.toBe(revision.contentSha256)
  })

  it('generates persistable UUID assertion identifiers', () => {
    expect(excerptDraft().assertions[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it.each(['unreviewed', 'skipped'] as const)('blocks approval of %s claims', reviewDecision => {
    const { revision, assertions } = excerptDraft()
    expect(() => approveStoryRevision(revision, [{ ...assertions[0], reviewDecision }], 'user-owner', transcript)).toThrow(/g2_approval_blocked/)
  })

  it.each(['pending_review', 'invalidated'] as const)('blocks approval of accepted claims whose evidence is %s', verificationStatus => {
    const { revision, assertions } = excerptDraft()
    expect(() => approveStoryRevision(revision, [{ ...assertions[0], verificationStatus, reviewDecision: 'accepted' }], 'user-owner', transcript)).toThrow(/g2_approval_blocked/)
  })

  it('blocks approval with zero claims or only rejected claims', () => {
    const { revision, assertions } = excerptDraft()
    expect(() => approveStoryRevision(revision, [], 'user-owner', transcript)).toThrow(/g2_approval_blocked/)
    expect(() => approveStoryRevision(revision, [{ ...assertions[0], reviewDecision: 'rejected' }], 'user-owner', transcript)).toThrow(/g2_approval_blocked/)
  })

  it('rejecting a claim removes its paragraph and regenerates contiguous provenance links', () => {
    const { revision, assertions } = excerptDraft()
    const kept = applyFamilyReviewDecision(assertions[0], { action: 'accept', reviewerId: 'member-clara' })
    const rejected = { ...kept, id: 'rejected-claim', claimText: 'Uncle Arthur won a Nobel Prize.', reviewDecision: 'rejected' as const }
    const approved = approveStoryRevision({ ...revision, body: 'Uncle Arthur won a Nobel Prize.' }, [rejected, kept], 'user-owner', transcript)
    expect(approved.body).toBe('We sailed out every Sunday morning.')
    expect(approved.provenanceLinks).toEqual([{ paragraphIndex: 0, segmentId: transcript.segments[1].id,
      startMs: 15000, endMs: 30000, verificationStatus: 'verified' }])
  })

  it('marks all modified text as an attributed supplement and removes its obsolete audio claim', () => {
    const { assertions } = excerptDraft()
    const modified = applyFamilyReviewDecision(assertions[0], {
      action: 'modify', reviewerId: 'member-clara', modifiedClaimText: 'We sailed on Saturdays.',
    })
    expect(modified).toMatchObject({ memoryAttribution: 'family_supplement', verificationStatus: 'family_supplement',
      sourceQuote: null, segmentId: null, startMs: null, endMs: null, reviewedBy: 'member-clara' })
    expect(assertions[0].claimText).toBe('We sailed out every Sunday morning.')
  })

  it('preserves multiple attributed alternatives and includes them in the approved story', () => {
    const { revision, assertions } = excerptDraft()
    const first = applyFamilyReviewDecision(assertions[0], {
      action: 'dispute', reviewerId: 'member-clara', disputedAlternativeText: 'I remember Saturdays.',
    })
    const second = applyFamilyReviewDecision(first, {
      action: 'dispute', reviewerId: 'member-ben', disputedAlternativeText: 'I remember Mondays.',
    })
    const approved = approveStoryRevision(revision, [second], 'user-owner', transcript)
    expect(approved.body).toContain('We sailed out every Sunday morning.')
    expect(approved.body).toContain('member-clara')
    expect(approved.body).toContain('I remember Saturdays.')
    expect(approved.body).toContain('member-ben')
    expect(approved.body).toContain('I remember Mondays.')
    expect(first.disputedAlternativeText).toBe('I remember Saturdays.')
  })

  it.each(['approved', 'superseded', 'invalidated'] as const)('does not approve or rewrite an existing %s snapshot', status => {
    const { revision, assertions } = excerptDraft()
    const accepted = applyFamilyReviewDecision(assertions[0], { action: 'accept', reviewerId: 'member-clara' })
    expect(() => approveStoryRevision({ ...revision, status }, [accepted], 'other-approver', transcript)).toThrow(/g2_approval_blocked/)
  })

  it('blocks accepting evidence that still needs review or has been invalidated', () => {
    const { assertions } = excerptDraft()
    for (const verificationStatus of ['pending_review', 'invalidated'] as const) {
      expect(() => applyFamilyReviewDecision({ ...assertions[0], verificationStatus }, {
        action: 'accept', reviewerId: 'member-clara',
      })).toThrow(/Cannot directly accept/)
    }
  })

  it('rejects nonfinite timestamps instead of advertising a valid audio citation', () => {
    for (const timestamp of [NaN, Infinity, -Infinity]) {
      expect(excerptDraft({ startMs: timestamp, endMs: timestamp }).assertions[0].verificationStatus).toBe('unverified_rejected')
    }
  })

  it('rejects another story or transcript assertion during approval', () => {
    const { revision, assertions } = excerptDraft()
    const accepted: VerifiedStoryAssertion = { ...assertions[0], reviewDecision: 'accepted', reviewedBy: 'member-clara', storyId: 'other-story' }
    expect(() => approveStoryRevision(revision, [accepted], 'user-owner', transcript)).toThrow(/g2_approval_blocked/)
  })

  it('does not trust an obsolete verified label after its claim text has changed', () => {
    const { revision, assertions } = excerptDraft()
    const legacyEditedAssertion: VerifiedStoryAssertion = { ...assertions[0],
      reviewDecision: 'accepted', reviewedBy: 'member-clara', claimText: 'We won a Nobel Prize.',
    }
    expect(() => approveStoryRevision(revision, [legacyEditedAssertion], 'user-owner', transcript)).toThrow(/g2_approval_blocked/)
  })

  const johnDraft = (source: string, claimText = source, candidateTitle = 'Family Memory') => {
    const trustedTranscript = buildVersionedTranscript({
      projectId: 'proj-alpha', storyId: 'story-alpha-1', version: 1, language: 'en',
      provider: 'fixture', model: 'synthetic', createdBy: 'user-owner',
      rawSegments: [{ text: source, startMs: 0, endMs: 5000 }],
    })
    return { trustedTranscript, ...verifyAndBuildProvenanceDraft({
      revisionNumber: 1, transcript: trustedTranscript, candidateTitle, candidateBody: '', candidateSummary: '',
      createdBy: 'user-owner', candidateAssertions: [{
        segmentId: trustedTranscript.segments[0].id, assertionType: 'event', subject: 'John',
        claimText, sourceQuote: source, startMs: 0, endMs: 5000,
      }],
    }) }
  }

  it.each([
    ['Perhaps John won the race.', 'John won the race.'],
    ['It is not true that John won the race.', 'John won the race.'],
    ['John won the race. Or perhaps he only watched it.', 'John won the race.'],
  ])('does not remove qualifiers or later context from %s', (source, narrowed) => {
    const { assertions } = johnDraft(source, narrowed)
    expect(assertions[0].verificationStatus).toBe('pending_review')
    expect(() => applyFamilyReviewDecision(assertions[0], { action: 'accept', reviewerId: 'member-clara' })).toThrow()
  })

  it('does not turn an unsupported generated primary into storyteller memory by disputing it', () => {
    const { assertions } = johnDraft('John planted the tree.', 'John won the Nobel Prize.')
    expect(() => applyFamilyReviewDecision(assertions[0], {
      action: 'dispute', reviewerId: 'member-clara', disputedAlternativeText: 'I remember a different story.',
    })).toThrow(/Cannot dispute/)
  })

  it('rechecks both mutated claim and quote against the trusted transcript during approval', () => {
    const { revision, assertions, trustedTranscript } = johnDraft('John planted the tree.')
    const accepted = applyFamilyReviewDecision(assertions[0], { action: 'accept', reviewerId: 'member-clara' })
    const forged = { ...accepted, claimText: 'John won the Nobel Prize.', sourceQuote: 'John won the Nobel Prize.' }
    expect(() => approveStoryRevision(revision, [forged], 'user-owner', trustedTranscript)).toThrow(/g2_approval_blocked/)
  })

  it('rechecks source evidence when a disputed primary is edited after review', () => {
    const { revision, assertions, trustedTranscript } = johnDraft('John planted the tree.')
    const disputed = applyFamilyReviewDecision(assertions[0], {
      action: 'dispute', reviewerId: 'member-clara', disputedAlternativeText: 'I remember an apple tree.',
    })
    const forged = { ...disputed, claimText: 'John won the Nobel Prize.', sourceQuote: 'John won the Nobel Prize.' }
    expect(() => approveStoryRevision(revision, [forged], 'user-owner', trustedTranscript)).toThrow(/g2_approval_blocked/)
  })

  it('does not approve factual model title prose alongside a supported body', () => {
    const { revision, assertions, trustedTranscript } = johnDraft('John planted the tree.', undefined, 'John won the Nobel Prize')
    const accepted = applyFamilyReviewDecision(assertions[0], { action: 'accept', reviewerId: 'member-clara' })
    const approved = approveStoryRevision({ ...revision, title: 'John won the Nobel Prize' }, [accepted], 'user-owner', trustedTranscript)
    expect(revision.title).toBe('Family Memory')
    expect(approved.title).toBe('Family Memory')
  })

  it('preserves an unchanged full self-correction as an honest quoted account', () => {
    const source = 'John sailed in 1964, no wait, in 1968.'
    const { revision, assertions, trustedTranscript } = johnDraft(source)
    expect(assertions[0].verificationStatus).toBe('verified')
    const accepted = applyFamilyReviewDecision(assertions[0], { action: 'accept', reviewerId: 'member-clara' })
    expect(approveStoryRevision(revision, [accepted], 'user-owner', trustedTranscript).body).toBe(source)
  })


  it('keeps the supplement author distinct from later reviewers and alternative authors', () => {
    const { revision, assertions, trustedTranscript } = johnDraft('John planted the tree.')
    const modified = applyFamilyReviewDecision(assertions[0], {
      action: 'modify', reviewerId: 'member-clara', modifiedClaimText: 'John planted an oak tree.',
    })
    const disputed = applyFamilyReviewDecision(modified, {
      action: 'dispute', reviewerId: 'member-ben', disputedAlternativeText: 'I remember an apple tree.',
    })
    const accepted = applyFamilyReviewDecision(disputed, { action: 'accept', reviewerId: 'user-owner' })
    const approved = approveStoryRevision(revision, [accepted], 'user-owner', trustedTranscript)
    expect(accepted.reviewedBy).toBe('user-owner')
    expect(approved.body).toContain('Family supplement (member-clara): John planted an oak tree.')
    expect(approved.body).toContain('Family alternative (member-ben): I remember an apple tree.')
  })

})
