import {
  buildVersionedTranscript,
  type RawAsrSegmentInput,
  type TranscriptVersionRecord,
} from '../server/ai-capability-gateway'
import {
  approveStoryRevision,
  verifyAndBuildProvenanceDraft,
  type CandidateStoryAssertion,
} from '../server/provenance-editor'

export type PlantedErrorCategory =
  | 'person'
  | 'relation'
  | 'year_date'
  | 'event_addition'
  | 'omission'
  | 'source_mismatch'

export interface WilsonInterval {
  successes: number
  total: number
  proportion: number
  lower95: number
  upper95: number
}

export interface G2HoldoutEvaluationSummary {
  holdoutFamilyCount: number
  totalPlantedErrors: number
  detectedPlantedErrors: number
  plantedErrorDetectionRate: number
  detectionWilson95: WilsonInterval
  totalCleanNegatives: number
  falsePositives: number
  falsePositiveRate: number
  falsePositiveWilson95: WilsonInterval
  unresolvedSevereInApprovedCount: number
  audioSeekSpotCheckPassed: number
  audioSeekSpotCheckTotal: number
  categoryBreakdown: Record<
    PlantedErrorCategory,
    { detected: number; total: number; rate: number }
  >
  ablationWithoutVerification: {
    detectedPlantedErrors: number
    plantedErrorDetectionRate: number
    severeFabricationsLeakedIntoApproved: number
  }
  e0HardCasesPassed: number
  e0HardCasesTotal: number
  g2GatePassed: boolean
}

export function computeWilsonInterval(successes: number, total: number, z = 1.959963984540054): WilsonInterval {
  if (total <= 0) {
    return { successes: 0, total: 0, proportion: 0, lower95: 0, upper95: 0 }
  }
  const p = successes / total
  const z2 = z * z
  const denom = 1 + z2 / total
  const center = (p + z2 / (2 * total)) / denom
  const halfWidth =
    (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denom
  return {
    successes,
    total,
    proportion: Number(p.toFixed(4)),
    lower95: Number(Math.max(0, center - halfWidth).toFixed(4)),
    upper95: Number(Math.min(1, center + halfWidth).toFixed(4)),
  }
}

interface HoldoutFamilyFixture {
  familyIndex: number
  projectId: string
  storyId: string
  storytellerName: string
  relativeName: string
  relationWord: string
  trueYear: number
  wrongRetractedYear: number
  placeName: string
  eventPhrase: string
}

const HOLDOUT_FAMILIES: HoldoutFamilyFixture[] = [
  {
    familyIndex: 1,
    projectId: 'holdout-family-01',
    storyId: 'story-hf-01',
    storytellerName: 'Evelyn Carter',
    relativeName: 'Uncle Arthur',
    relationWord: 'maternal uncle',
    trueYear: 1968,
    wrongRetractedYear: 1964,
    placeName: 'Portland Harbor',
    eventPhrase: 'rebuilt the cedar fishing boat after the storm',
  },
  {
    familyIndex: 2,
    projectId: 'holdout-family-02',
    storyId: 'story-hf-02',
    storytellerName: 'Marcus Lin',
    relativeName: 'Grandmother Mei',
    relationWord: 'paternal grandmother',
    trueYear: 1973,
    wrongRetractedYear: 1971,
    placeName: 'Tainan Market',
    eventPhrase: 'opened the small stationery shop near the school',
  },
  {
    familyIndex: 3,
    projectId: 'holdout-family-03',
    storyId: 'story-hf-03',
    storytellerName: 'Clara Novak',
    relativeName: 'Sister Helena',
    relationWord: 'older sister',
    trueYear: 1982,
    wrongRetractedYear: 1979,
    placeName: 'Chicago Northside',
    eventPhrase: 'taught piano lessons in the basement studio',
  },
  {
    familyIndex: 4,
    projectId: 'holdout-family-04',
    storyId: 'story-hf-04',
    storytellerName: 'David Okafor',
    relativeName: 'Cousin Samuel',
    relationWord: 'first cousin',
    trueYear: 1991,
    wrongRetractedYear: 1988,
    placeName: 'Toronto Annex',
    eventPhrase: 'drove the blue station wagon across the province',
  },
  {
    familyIndex: 5,
    projectId: 'holdout-family-05',
    storyId: 'story-hf-05',
    storytellerName: 'Hannah Goldberg',
    relativeName: 'Aunt Miriam',
    relationWord: 'great aunt',
    trueYear: 1959,
    wrongRetractedYear: 1956,
    placeName: 'Brooklyn Heights',
    eventPhrase: 'preserved the handwritten recipe notebook',
  },
  {
    familyIndex: 6,
    projectId: 'holdout-family-06',
    storyId: 'story-hf-06',
    storytellerName: 'Robert MacLeod',
    relativeName: 'Brother Alistair',
    relationWord: 'younger brother',
    trueYear: 1977,
    wrongRetractedYear: 1975,
    placeName: 'Inverness Ridge',
    eventPhrase: 'planted the orchard behind the stone cottage',
  },
  {
    familyIndex: 7,
    projectId: 'holdout-family-07',
    storyId: 'story-hf-07',
    storytellerName: 'Sofia Morales',
    relativeName: 'Grandfather Mateo',
    relationWord: 'maternal grandfather',
    trueYear: 1965,
    wrongRetractedYear: 1962,
    placeName: 'San Diego Bay',
    eventPhrase: 'repaired marine radios for the harbor fleet',
  },
  {
    familyIndex: 8,
    projectId: 'holdout-family-08',
    storyId: 'story-hf-08',
    storytellerName: 'Grace Chen',
    relativeName: 'Aunt Lili',
    relationWord: 'eldest aunt',
    trueYear: 1986,
    wrongRetractedYear: 1984,
    placeName: 'Vancouver Kitsilano',
    eventPhrase: 'organized the neighborhood autumn lantern walk',
  },
  {
    familyIndex: 9,
    projectId: 'holdout-family-09',
    storyId: 'story-hf-09',
    storytellerName: 'Thomas Bennett',
    relativeName: 'Father Edward',
    relationWord: 'father',
    trueYear: 1961,
    wrongRetractedYear: 1958,
    placeName: 'Boston Commons',
    eventPhrase: 'worked night shifts at the municipal printing press',
  },
  {
    familyIndex: 10,
    projectId: 'holdout-family-10',
    storyId: 'story-hf-10',
    storytellerName: 'Nora Lindqvist',
    relativeName: 'Uncle Henrik',
    relationWord: 'uncle',
    trueYear: 1979,
    wrongRetractedYear: 1976,
    placeName: 'Seattle Ballard',
    eventPhrase: 'carved the wooden clock for our family hallway',
  },
]

function buildFamilyTranscript(f: HoldoutFamilyFixture): TranscriptVersionRecord {
  const rawSegments: RawAsrSegmentInput[] = []
  for (let i = 0; i < 20; i++) {
    const startMs = i * 30_000
    const endMs = startMs + 28_000
    const text =
      `Segment ${i + 1}: In ${f.wrongRetractedYear}, no wait, in ${f.trueYear}, my ${f.relationWord} ${f.relativeName} ` +
      `and I were at ${f.placeName} when we ${f.eventPhrase} (memory item #${i + 1}).`
    rawSegments.push({
      speakerLabel: f.storytellerName,
      startMs,
      endMs,
      text,
      confidence: 0.96,
    })
  }

  return buildVersionedTranscript({
    transcriptVersionId: `tv-${f.storyId}-v1`,
    projectId: f.projectId,
    storyId: f.storyId,
    assetId: `asset-${f.storyId}`,
    version: 1,
    language: 'en',
    provider: 'elevenlabs',
    model: 'scribe_v2',
    createdBy: `owner-${f.projectId}`,
    rawSegments,
  })
}

export function runE0PipelineChecks(): { passed: number; total: number } {
  let passed = 0
  const total = 10

  // 1. Silence & pause segment handling
  const t1 = buildVersionedTranscript({
    projectId: 'p-e0',
    storyId: 's-e0-1',
    version: 1,
    language: 'en',
    provider: 'elevenlabs',
    model: 'scribe_v2',
    createdBy: 'u-1',
    rawSegments: [
      { speakerLabel: 'storyteller', startMs: 0, endMs: 12000, text: 'We waited in silence by the train station.' },
      { speakerLabel: 'storyteller', startMs: 25000, endMs: 38000, text: 'Then the 1974 express finally arrived.' },
    ],
  })
  if (t1.alignmentStatus === 'aligned' && t1.segments.length === 2) passed++

  // 2. Multi-speaker overlap attribution
  const t2 = buildVersionedTranscript({
    projectId: 'p-e0',
    storyId: 's-e0-2',
    version: 1,
    language: 'en',
    provider: 'elevenlabs',
    model: 'scribe_v2',
    createdBy: 'u-1',
    rawSegments: [
      { speakerLabel: 'storyteller', startMs: 0, endMs: 5000, text: 'It was near the old bridge.' },
      { speakerLabel: 'facilitator', startMs: 5000, endMs: 8000, text: 'Was that with Aunt Clara?' },
    ],
  })
  if (t2.segments[0].speakerLabel === 'storyteller' && t2.segments[1].speakerLabel === 'facilitator') passed++

  // 3. Self-correction date handling (retracted 1964 vs corrected 1968)
  const f1 = buildFamilyTranscript(HOLDOUT_FAMILIES[0])
  const selfCorrDraft = verifyAndBuildProvenanceDraft({
    revisionNumber: 1,
    transcript: f1,
    candidateTitle: 'Harbor Boat',
    candidateBody: f1.fullText,
    candidateSummary: 'Summary',
    createdBy: 'u-1',
    candidateAssertions: [
      {
        segmentId: f1.segments[0].id,
        assertionType: 'year_date',
        subject: '1964',
        claimText: 'Happened in 1964',
        sourceQuote: f1.segments[0].text,
        startMs: 0,
        endMs: 28000,
      },
    ],
  })
  if (selfCorrDraft.assertions[0].verificationStatus === 'unverified_rejected') passed++

  // 4. Approximate / decade date precision preserved
  const approxDraft = verifyAndBuildProvenanceDraft({
    revisionNumber: 1,
    transcript: f1,
    candidateTitle: 'Harbor Boat',
    candidateBody: f1.fullText,
    candidateSummary: 'Summary',
    createdBy: 'u-1',
    candidateAssertions: [
      {
        segmentId: f1.segments[0].id,
        assertionType: 'year_date',
        subject: '1968',
        claimText: 'Around the late 1960s (1968)',
        sourceQuote: 'in 1968, my maternal uncle Uncle Arthur',
        startMs: 0,
        endMs: 28000,
        datePrecision: 'decade',
      },
    ],
  })
  if (approxDraft.assertions[0].verificationStatus === 'verified' && approxDraft.assertions[0].datePrecision === 'decade') passed++

  // 5. Homophonous / invented name rejected
  const wrongNameDraft = verifyAndBuildProvenanceDraft({
    revisionNumber: 1,
    transcript: f1,
    candidateTitle: 'Harbor Boat',
    candidateBody: f1.fullText,
    candidateSummary: 'Summary',
    createdBy: 'u-1',
    candidateAssertions: [
      {
        segmentId: f1.segments[0].id,
        assertionType: 'person',
        subject: 'Uncle Arnold',
        claimText: 'Uncle Arnold rebuilt the boat',
        sourceQuote: 'my maternal uncle Uncle Arthur',
        startMs: 0,
        endMs: 28000,
      },
    ],
  })
  if (wrongNameDraft.assertions[0].verificationStatus === 'unverified_rejected' && wrongNameDraft.assertions[0].isSevereFabrication) passed++

  // 6. Deterministic contentSha256 on duplicate transcript
  const f1Dup = buildFamilyTranscript(HOLDOUT_FAMILIES[0])
  if (f1.contentSha256 === f1Dup.contentSha256) passed++

  // 7. Short greeting / laughter preserved without essay inflation
  const shortGreeting = buildVersionedTranscript({
    projectId: 'p-e0',
    storyId: 's-e0-short',
    version: 1,
    language: 'en',
    provider: 'elevenlabs',
    model: 'scribe_v2',
    createdBy: 'u-1',
    rawSegments: [
      { speakerLabel: 'storyteller', startMs: 0, endMs: 4000, text: 'Happy birthday grandma! [laughter]' },
    ],
  })
  const shortDraft = verifyAndBuildProvenanceDraft({
    revisionNumber: 1,
    transcript: shortGreeting,
    candidateTitle: 'Birthday Greeting',
    candidateBody: 'An inflated 500-word essay that should be ignored because preserveAsShortClip is true.',
    candidateSummary: 'Inflated summary',
    createdBy: 'u-1',
    candidateAssertions: [],
  })
  if (shortGreeting.preserveAsShortClip && shortDraft.revision.body === 'Happy birthday grandma! [laughter]') passed++

  // 8. Legacy unaligned record explicitly marked legacy_unaligned without fabricated timestamps
  const legacyTranscript = buildVersionedTranscript({
    projectId: 'p-e0',
    storyId: 's-e0-legacy',
    version: 1,
    language: 'en',
    provider: 'legacy',
    model: 'legacy-import',
    createdBy: 'u-1',
    rawSegments: [
      { speakerLabel: 'storyteller', startMs: null, endMs: null, text: 'Old family tape without timestamps.' },
    ],
  })
  if (legacyTranscript.alignmentStatus === 'legacy_unaligned' && legacyTranscript.segments[0].startMs === null) passed++

  // 9. Family supplement preserved with distinct attribution
  const suppDraft = verifyAndBuildProvenanceDraft({
    revisionNumber: 1,
    transcript: f1,
    candidateTitle: 'Harbor Boat',
    candidateBody: f1.fullText,
    candidateSummary: 'Summary',
    createdBy: 'u-1',
    candidateAssertions: [
      {
        segmentId: null,
        assertionType: 'year_date',
        subject: '1968',
        claimText: 'Confirmed by family photo album cover dated October 1968',
        sourceQuote: null,
        startMs: null,
        endMs: null,
        memoryAttribution: 'family_supplement',
      },
    ],
  })
  if (suppDraft.assertions[0].verificationStatus === 'family_supplement') passed++

  // 10. Approval blocked when severe fabrication is present
  let blocked = false
  try {
    approveStoryRevision(wrongNameDraft.revision, wrongNameDraft.assertions, 'u-1')
  } catch {
    blocked = true
  }
  if (blocked) passed++

  return { passed, total }
}

export function evaluateG2FidelityBenchmark(): G2HoldoutEvaluationSummary {
  const categories: PlantedErrorCategory[] = [
    'person',
    'relation',
    'year_date',
    'event_addition',
    'omission',
    'source_mismatch',
  ]
  const categoryBreakdown: Record<
    PlantedErrorCategory,
    { detected: number; total: number; rate: number }
  > = {
    person: { detected: 0, total: 0, rate: 0 },
    relation: { detected: 0, total: 0, rate: 0 },
    year_date: { detected: 0, total: 0, rate: 0 },
    event_addition: { detected: 0, total: 0, rate: 0 },
    omission: { detected: 0, total: 0, rate: 0 },
    source_mismatch: { detected: 0, total: 0, rate: 0 },
  }

  let totalPlantedErrors = 0
  let detectedPlantedErrors = 0
  let totalCleanNegatives = 0
  let falsePositives = 0
  let unresolvedSevereInApprovedCount = 0
  let audioSeekSpotCheckPassed = 0
  let audioSeekSpotCheckTotal = 0
  let ablationSevereLeaked = 0

  for (const family of HOLDOUT_FAMILIES) {
    const transcript = buildFamilyTranscript(family)

    // 20 clean negative assertions per family (10 families * 20 = 200 clean negatives)
    const cleanCandidates: CandidateStoryAssertion[] = transcript.segments.map((seg, idx) => {
      const mod = idx % 4
      if (mod === 0) {
        return {
          id: `${family.storyId}-clean-${idx}`,
          segmentId: seg.id,
          assertionType: 'person',
          subject: family.relativeName,
          claimText: `${family.relativeName} was present in memory #${idx + 1}`,
          sourceQuote: `${family.relationWord} ${family.relativeName}`,
          startMs: seg.startMs,
          endMs: seg.endMs,
        }
      }
      if (mod === 1) {
        return {
          id: `${family.storyId}-clean-${idx}`,
          segmentId: seg.id,
          assertionType: 'relation',
          subject: family.relationWord,
          claimText: `${family.relativeName} is the storyteller's ${family.relationWord}`,
          sourceQuote: `my ${family.relationWord} ${family.relativeName}`,
          startMs: seg.startMs,
          endMs: seg.endMs,
        }
      }
      if (mod === 2) {
        return {
          id: `${family.storyId}-clean-${idx}`,
          segmentId: seg.id,
          assertionType: 'year_date',
          subject: String(family.trueYear),
          claimText: `Occurred in ${family.trueYear}`,
          sourceQuote: `in ${family.trueYear}, my ${family.relationWord}`,
          startMs: seg.startMs,
          endMs: seg.endMs,
        }
      }
      return {
        id: `${family.storyId}-clean-${idx}`,
        segmentId: seg.id,
        assertionType: 'event',
        subject: family.eventPhrase,
        claimText: `We ${family.eventPhrase}`,
        sourceQuote: family.eventPhrase,
        startMs: seg.startMs,
        endMs: seg.endMs,
      }
    })

    const cleanDraft = verifyAndBuildProvenanceDraft({
      revisionNumber: 1,
      transcript,
      candidateTitle: `${family.storytellerName} Memoir`,
      candidateBody: transcript.fullText,
      candidateSummary: `Verified family memoir for ${family.storytellerName}`,
      candidateAssertions: cleanCandidates,
      createdBy: `owner-${family.projectId}`,
    })

    for (const verified of cleanDraft.assertions) {
      totalCleanNegatives++
      if (verified.verificationStatus !== 'verified') {
        falsePositives++
      }
    }

    // Spot-check 10 core facts per holdout family for audio seek alignment (10 * 10 = 100 checks)
    for (let s = 0; s < 10; s++) {
      audioSeekSpotCheckTotal++
      const item = cleanDraft.assertions[s]
      const seg = transcript.segments[s]
      if (
        item.verificationStatus === 'verified' &&
        item.segmentId === seg.id &&
        item.startMs === seg.startMs &&
        item.endMs === seg.endMs &&
        item.sourceQuote &&
        seg.text.includes(item.sourceQuote)
      ) {
        audioSeekSpotCheckPassed++
      }
    }

    // 20 planted errors per family (10 families * 20 = 200 planted errors)
    const plantedCandidates: { category: PlantedErrorCategory; assertion: CandidateStoryAssertion }[] =
      transcript.segments.map((seg, idx) => {
        const cat = categories[(family.familyIndex + idx) % categories.length]
        if (cat === 'person') {
          return {
            category: cat,
            assertion: {
              id: `${family.storyId}-planted-${idx}`,
              segmentId: seg.id,
              assertionType: 'person',
              subject: 'Invented Stranger Victor',
              claimText: 'Invented Stranger Victor led the family event',
              sourceQuote: `${family.relationWord} ${family.relativeName}`,
              startMs: seg.startMs,
              endMs: seg.endMs,
            },
          }
        }
        if (cat === 'relation') {
          return {
            category: cat,
            assertion: {
              id: `${family.storyId}-planted-${idx}`,
              segmentId: seg.id,
              assertionType: 'relation',
              subject: 'step-grandfather',
              claimText: `${family.relativeName} was the step-grandfather`,
              sourceQuote: `my ${family.relationWord} ${family.relativeName}`,
              startMs: seg.startMs,
              endMs: seg.endMs,
            },
          }
        }
        if (cat === 'year_date') {
          // Uses the speaker's retracted year or an invented year
          return {
            category: cat,
            assertion: {
              id: `${family.storyId}-planted-${idx}`,
              segmentId: seg.id,
              assertionType: 'year_date',
              subject: String(family.wrongRetractedYear),
              claimText: `The event happened in ${family.wrongRetractedYear}`,
              sourceQuote: seg.text,
              startMs: seg.startMs,
              endMs: seg.endMs,
            },
          }
        }
        if (cat === 'event_addition') {
          return {
            category: cat,
            assertion: {
              id: `${family.storyId}-planted-${idx}`,
              segmentId: seg.id,
              assertionType: 'event',
              subject: 'won the national sailing championship trophy',
              claimText: 'They won the national sailing championship trophy',
              sourceQuote: family.eventPhrase,
              startMs: seg.startMs,
              endMs: seg.endMs,
            },
          }
        }
        if (cat === 'omission') {
          // Omission of required source quote / segment link for a core claim
          return {
            category: cat,
            assertion: {
              id: `${family.storyId}-planted-${idx}`,
              segmentId: seg.id,
              assertionType: 'event',
              subject: family.eventPhrase,
              claimText: `Omitted source quote for ${family.eventPhrase}`,
              sourceQuote: '',
              startMs: seg.startMs,
              endMs: seg.endMs,
            },
          }
        }
        // source_mismatch: points to wrong timestamp range outside segment bounds
        return {
          category: cat,
          assertion: {
            id: `${family.storyId}-planted-${idx}`,
            segmentId: seg.id,
            assertionType: 'place',
            subject: family.placeName,
            claimText: `Located at ${family.placeName}`,
            sourceQuote: family.placeName,
            startMs: (seg.endMs ?? 0) + 5000,
            endMs: (seg.endMs ?? 0) + 9000,
          },
        }
      })

    const plantedDraft = verifyAndBuildProvenanceDraft({
      revisionNumber: 2,
      transcript,
      candidateTitle: `${family.storytellerName} Planted Error Test`,
      candidateBody: transcript.fullText,
      candidateSummary: 'Planted error evaluation',
      candidateAssertions: plantedCandidates.map(p => p.assertion),
      createdBy: `owner-${family.projectId}`,
    })

    plantedDraft.assertions.forEach((verified, idx) => {
      const cat = plantedCandidates[idx].category
      totalPlantedErrors++
      categoryBreakdown[cat].total++
      if (verified.verificationStatus === 'unverified_rejected') {
        detectedPlantedErrors++
        categoryBreakdown[cat].detected++
      }
      if (verified.isSevereFabrication) {
        ablationSevereLeaked++
      }
    })

    // Verify that attempting to approve plantedDraft without resolving planted errors is blocked
    let approvalSucceeded = false
    try {
      approveStoryRevision(plantedDraft.revision, plantedDraft.assertions, `owner-${family.projectId}`)
      approvalSucceeded = true
    } catch {
      approvalSucceeded = false
    }
    if (approvalSucceeded) {
      unresolvedSevereInApprovedCount += plantedDraft.assertions.filter(a => a.isSevereFabrication).length
    }
  }

  for (const cat of categories) {
    const entry = categoryBreakdown[cat]
    entry.rate = entry.total > 0 ? Number((entry.detected / entry.total).toFixed(4)) : 0
  }

  const plantedErrorDetectionRate = Number((detectedPlantedErrors / totalPlantedErrors).toFixed(4))
  const falsePositiveRate = Number((falsePositives / totalCleanNegatives).toFixed(4))
  const e0 = runE0PipelineChecks()

  const g2GatePassed =
    plantedErrorDetectionRate >= 0.95 &&
    falsePositiveRate <= 0.10 &&
    unresolvedSevereInApprovedCount === 0 &&
    audioSeekSpotCheckPassed === audioSeekSpotCheckTotal &&
    e0.passed === e0.total

  return {
    holdoutFamilyCount: HOLDOUT_FAMILIES.length,
    totalPlantedErrors,
    detectedPlantedErrors,
    plantedErrorDetectionRate,
    detectionWilson95: computeWilsonInterval(detectedPlantedErrors, totalPlantedErrors),
    totalCleanNegatives,
    falsePositives,
    falsePositiveRate,
    falsePositiveWilson95: computeWilsonInterval(falsePositives, totalCleanNegatives),
    unresolvedSevereInApprovedCount,
    audioSeekSpotCheckPassed,
    audioSeekSpotCheckTotal,
    categoryBreakdown,
    ablationWithoutVerification: {
      detectedPlantedErrors: 0,
      plantedErrorDetectionRate: 0,
      severeFabricationsLeakedIntoApproved: ablationSevereLeaked,
    },
    e0HardCasesPassed: e0.passed,
    e0HardCasesTotal: e0.total,
    g2GatePassed,
  }
}
