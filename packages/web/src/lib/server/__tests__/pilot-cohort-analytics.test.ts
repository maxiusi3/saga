import {
  evaluatePilotCohortMetrics,
  type PilotHouseholdEntry,
} from '@/lib/server/pilot-cohort-analytics'

const AS_OF = '2026-11-30T00:00:00.000Z'
const OPTIONS = { asOf: AS_OF, cohortKey: 'autumn', cohortClosedAt: '2026-10-10T00:00:00.000Z' }

function household(index: number, overrides: Partial<PilotHouseholdEntry> = {}): PilotHouseholdEntry {
  return {
    id: `entry-${index}`,
    householdKey: `household-${index}`,
    projectId: `project-${index}`,
    cohortKey: 'autumn',
    cohortType: 'longitudinal_pilot',
    observationKind: 'observed',
    pricingTier: 'paid_59',
    supportMode: 'self_serve',
    acquisitionChannel: 'direct_invite',
    country: 'US',
    productVersion: '2026.11',
    materialEntryMode: 'new_recording',
    enrolledAt: '2026-10-01T00:00:00.000Z',
    inviteSentAt: '2026-10-01T00:00:00.000Z',
    consentedAt: '2026-10-01T00:30:00.000Z',
    inviteAcceptedAt: '2026-10-01T01:00:00.000Z',
    firstRecordingSavedAt: '2026-10-02T00:00:00.000Z',
    firstApprovedDownloadAt: '2026-10-05T00:00:00.000Z',
    projectCompletedAt: '2026-10-20T00:00:00.000Z',
    deliveredAt: '2026-10-21T00:00:00.000Z',
    replayedWithin14dAt: '2026-10-24T00:00:00.000Z',
    familyRevisionMinutes: 16,
    familyRevisionStoryMinutes: [8, 8],
    opsSupportMinutes: 20,
    opsHourlyRateCents: 1200,
    paidAmountCents: 5900,
    refundedAmountCents: 0,
    paymentFeeCents: 200,
    aiAndStorageCostCents: 200,
    acquisitionCostCents: 100,
    fulfillmentCostCents: 100,
    hostingReserveCents: 100,
    fixedCostAllocationCents: 100,
    evidenceComplete: true,
    costsComplete: true,
    qualityReviewed: true,
    quality: {
      reviewedClaims: 10, incorrectClaims: 0, invalidSourceClaims: 0,
      seededErrors: 10, detectedSeededErrors: 10, negativeClaims: 10,
      falsePositiveClaims: 0, unresolvedSevereErrors: 0,
    },
    npsScore: 9,
    wouldRecommend: true,
    referralsCount: 1,
    severeDataIncidents: 0,
    ...overrides,
  }
}

const cohort = (overrides: Partial<PilotHouseholdEntry> = {}) =>
  Array.from({ length: 20 }, (_, i) => household(i, overrides))

const incomplete = {
  firstRecordingSavedAt: null,
  firstApprovedDownloadAt: null,
  projectCompletedAt: null,
  deliveredAt: null,
  replayedWithin14dAt: null,
  familyRevisionMinutes: 0,
  familyRevisionStoryMinutes: [],
}

describe('G4 longitudinal cohort decision evidence', () => {
  it('keeps zero denominators null and never treats an empty ledger as ready', () => {
    const report = evaluatePilotCohortMetrics([], OPTIONS)
    expect(report.effectiveActivationAll).toEqual({ numerator: 0, denominator: 0, proportion: null, status: 'insufficient_sample' })
    expect(report.completionWithin28dStartedPaid.proportion).toBeNull()
    expect(report.g4GateReady).toBe(false)
    expect(report.simulationReady).toBe(false)
    expect(report.recommendation.code).toBe('blocked_by_incident_or_immature_window')
    expect(report.recommendation.requiresOwnerDecision).toBe(true)
  })

  it('requires a whole mature roster of at least twenty unique longitudinal households', () => {
    const four = evaluatePilotCohortMetrics(cohort().slice(0, 4), OPTIONS)
    const nineteen = evaluatePilotCohortMetrics(cohort().slice(0, 19), OPTIONS)
    const twenty = evaluatePilotCohortMetrics(cohort(), OPTIONS)
    expect(four.g4GateReady).toBe(false)
    expect(nineteen.blockingReasons).toContain('insufficient_longitudinal_households')
    expect(twenty.g4GateReady).toBe(true)
    expect(twenty.simulationReady).toBe(false)
    expect(twenty.blockingReasons).toEqual([])
    expect(twenty.uniqueLongitudinalHouseholds).toBe(20)
    expect(twenty.recommendation.code).toBe('expand_channel')
  })

  it('does not add prototype or AI holdout households to the longitudinal sample', () => {
    const entries = [
      ...cohort().slice(0, 18),
      household(18, { cohortType: 'prototype_study' }),
      household(19, { cohortType: 'ai_eval_holdout' }),
    ]
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.countsByCohort).toEqual({ prototype_study: 1, ai_eval_holdout: 1, longitudinal_pilot: 18 })
    expect(report.effectiveActivationAll.denominator).toBe(18)
    expect(report.g4GateReady).toBe(false)
  })

  it('rejects duplicate canonical households even when the row count reaches twenty', () => {
    const entries = cohort()
    entries[19] = household(19, { householdKey: entries[0].householdKey })
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.uniqueLongitudinalHouseholds).toBe(19)
    expect(report.blockingReasons).toContain('duplicate_households')
    expect(report.g4GateReady).toBe(false)
  })

  it('never uses a row or project identifier as proof of a unique household', () => {
    const report = evaluatePilotCohortMetrics(cohort({ householdKey: undefined }), OPTIONS)
    expect(report.blockingReasons).toContain('missing_household_keys')
    expect(report.g4GateReady).toBe(false)
  })

  it.each([undefined, null, 'invalid', '2026-12-01T00:00:00.000Z'])(
    'requires a valid closed roster as of the reporting date (%s)', cohortClosedAt => {
      const report = evaluatePilotCohortMetrics(cohort(), { ...OPTIONS, cohortClosedAt })
      expect(report.blockingReasons).toContain('cohort_not_closed')
      expect(report.g4GateReady).toBe(false)
    },
  )

  it('does not bless a mature subset while a newly enrolled household is still pending', () => {
    const entries = cohort()
    entries[19] = household(19, { ...incomplete, enrolledAt: '2026-11-29T00:00:00.000Z', inviteSentAt: null, inviteAcceptedAt: null, consentedAt: null })
    const report = evaluatePilotCohortMetrics(entries, { ...OPTIONS, cohortClosedAt: AS_OF })
    expect(report.maturity.enrolled28d).toEqual({ eligible: 20, mature: 19, pending: 1 })
    expect(report.blockingReasons).toContain('immature_enrollment_window')
    expect(report.g4GateReady).toBe(false)
  })

  it('waits for every accepted invitation and every delivery observation window', () => {
    const entries = cohort()
    entries[18] = household(18, { ...incomplete, inviteSentAt: '2026-11-29T00:00:00.000Z', inviteAcceptedAt: '2026-11-29T00:00:00.000Z' })
    entries[19] = household(19, { deliveredAt: '2026-11-29T00:00:00.000Z', replayedWithin14dAt: null })
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.maturity.invited7d).toEqual({ eligible: 20, mature: 19, pending: 1 })
    expect(report.maturity.delivered14d).toEqual({ eligible: 19, mature: 18, pending: 1 })
    expect(report.blockingReasons).toEqual(expect.arrayContaining(['immature_invitation_window', 'immature_delivery_window']))
    expect(report.g4GateReady).toBe(false)
  })

  it('treats exact 7d, 28d and 14d boundaries inclusively', () => {
    const entries = cohort({
      enrolledAt: '2026-11-02T00:00:00.000Z',
      inviteSentAt: '2026-11-02T00:00:00.000Z',
      consentedAt: '2026-11-02T00:00:00.000Z',
      inviteAcceptedAt: '2026-11-02T00:00:00.000Z',
      firstRecordingSavedAt: '2026-11-03T00:00:00.000Z',
      firstApprovedDownloadAt: '2026-11-09T00:00:00.000Z',
      projectCompletedAt: '2026-11-15T00:00:00.000Z',
      deliveredAt: '2026-11-16T00:00:00.000Z',
      replayedWithin14dAt: AS_OF,
    })
    const report = evaluatePilotCohortMetrics(entries, { ...OPTIONS, cohortClosedAt: '2026-11-02T00:00:00.000Z' })
    expect(report.g4GateReady).toBe(true)
    expect(report.firstOutcomeWithin7d.proportion).toBe(1)
    expect(report.replayWithin14dPostDelivery.proportion).toBe(1)
  })

  it.each([
    ['future recording', { firstRecordingSavedAt: '2026-12-01T00:00:00.000Z' }],
    ['pre-enrollment invitation', { inviteAcceptedAt: '2026-09-30T00:00:00.000Z' }],
    ['download before recording', { firstApprovedDownloadAt: '2026-10-01T02:00:00.000Z' }],
    ['delivery before completion', { deliveredAt: '2026-10-19T00:00:00.000Z' }],
    ['replay before delivery', { replayedWithin14dAt: '2026-10-20T00:00:00.000Z' }],
    ['invalid timestamp', { firstRecordingSavedAt: 'not-a-date' }],
    ['event after withdrawal', { withdrawnAt: '2026-10-01T12:00:00.000Z' }],
  ])('blocks %s and retains its household in the roster', (_description, change) => {
    const entries = cohort()
    entries[0] = household(0, change)
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.selectedLongitudinalHouseholds).toBe(20)
    expect(report.blockingReasons).toContain('invalid_event_chronology')
    expect(report.g4GateReady).toBe(false)
  })

  it('does not count future or unconsented recordings as effective activation', () => {
    const future = evaluatePilotCohortMetrics(cohort({ firstRecordingSavedAt: '2026-12-01T00:00:00.000Z' }), OPTIONS)
    const noConsent = evaluatePilotCohortMetrics(cohort({ consentedAt: null }), OPTIONS)
    expect(future.effectiveActivationAll).toMatchObject({ numerator: 0, denominator: 20 })
    expect(noConsent.effectiveActivationAll).toMatchObject({ numerator: 0, denominator: 20 })
    expect(noConsent.g4GateReady).toBe(false)
  })

  it('rejects impossible calendar dates instead of accepting Date.parse normalization', () => {
    const report = evaluatePilotCohortMetrics(cohort({ enrolledAt: '2026-02-29T00:00:00.000Z' }), OPTIONS)
    expect(report.blockingReasons).toContain('invalid_event_chronology')
    expect(report.g4GateReady).toBe(false)
    expect(() => evaluatePilotCohortMetrics(cohort(), { ...OPTIONS, asOf: '2026-02-29T00:00:00.000Z' })).toThrow('Invalid asOf')
  })

  it('accepts explicit timezone offsets and PostgreSQL fractional timestamps', () => {
    const report = evaluatePilotCohortMetrics(cohort({ enrolledAt: '2026-10-01T00:00:00.000000+00:00' }), OPTIONS)
    expect(report.g4GateReady).toBe(true)
  })

  it('retains withdrawal, non-start and refunds in mature denominators and economics', () => {
    const entries = cohort()
    entries[0] = household(0, { ...incomplete, withdrawnAt: '2026-10-05T00:00:00.000Z', refundedAmountCents: 5900, incompleteReason: 'withdrew' })
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.g4GateReady).toBe(true)
    expect(report.completionWithin28dStartedPaid).toMatchObject({ numerator: 19, denominator: 19 })
    expect(report.completionWithin28dAllPaid).toMatchObject({ numerator: 19, denominator: 20 })
    expect(report.unitEconomicsAllCohort).toMatchObject({ totalHouseholds: 20, incompleteHouseholds: 1, refundedHouseholds: 1, refundedCents: 5900 })
    expect(report.incompleteReasonsBreakdown).toEqual({ withdrew: 1 })
  })

  it('separates synthetic metrics and keeps them incapable of passing the real G4 gate', () => {
    const entries = [...cohort(), ...cohort({ observationKind: 'synthetic' }).map(e => ({ ...e, id: `synthetic-${e.id}`, householdKey: `synthetic-${e.householdKey}` }))]
    const observed = evaluatePilotCohortMetrics(entries, OPTIONS)
    const synthetic = evaluatePilotCohortMetrics(entries, { ...OPTIONS, observationKind: 'synthetic' })
    expect(observed.countsByObservationKind).toEqual({ observed: 20, synthetic: 20, unclassified: 0 })
    expect(observed.selectedLongitudinalHouseholds).toBe(20)
    expect(observed.g4GateReady).toBe(true)
    expect(synthetic.observationKind).toBe('synthetic')
    expect(synthetic.g4GateReady).toBe(false)
    expect(synthetic.simulationReady).toBe(true)
    expect(synthetic.recommendation.code).toBe('expand_channel')
  })

  it('quarantines legacy rows with no observation provenance', () => {
    const report = evaluatePilotCohortMetrics(cohort({ observationKind: undefined }), OPTIONS)
    expect(report.countsByObservationKind.unclassified).toBe(20)
    expect(report.effectiveActivationAll.denominator).toBe(0)
    expect(report.blockingReasons).toContain('unclassified_observations')
    expect(report.g4GateReady).toBe(false)
    expect(report.simulationReady).toBe(false)
  })

  it('requires review after erasure so an apparently successful surviving subset cannot pass', () => {
    const report = evaluatePilotCohortMetrics(cohort(), { ...OPTIONS, erasedHouseholds: 2 })
    expect(report.erasedHouseholds).toBe(2)
    expect(report.blockingReasons).toContain('erased_households_require_owner_review')
    expect(report.g4GateReady).toBe(false)
  })

  it('filters an explicit batch and blocks mixed batches when no selector is supplied', () => {
    const entries = [...cohort(), ...cohort({ cohortKey: 'winter', severeDataIncidents: 1 }).map(e => ({ ...e, householdKey: `winter-${e.householdKey}` }))]
    const selected = evaluatePilotCohortMetrics(entries, OPTIONS)
    const mixed = evaluatePilotCohortMetrics(entries, { asOf: AS_OF, cohortClosedAt: OPTIONS.cohortClosedAt })
    expect(selected.cohortKey).toBe('autumn')
    expect(selected.selectedLongitudinalHouseholds).toBe(20)
    expect(selected.g4GateReady).toBe(true)
    expect(mixed.blockingReasons).toContain('mixed_cohorts')
    expect(mixed.g4GateReady).toBe(false)
  })

  it.each(['evidenceComplete', 'qualityReviewed', 'costsComplete'] as const)('suppresses recommendations when %s is missing', field => {
    const report = evaluatePilotCohortMetrics(cohort({ [field]: false }), OPTIONS)
    expect(report.g4GateReady).toBe(false)
    expect(report.recommendation.code).toBe('blocked_by_incident_or_immature_window')
  })

  it('does not treat a paid_59 label or an unsupported payment assertion as paid evidence', () => {
    const labeled = evaluatePilotCohortMetrics(cohort({ paidAmountCents: 0 }), OPTIONS)
    const unverified = evaluatePilotCohortMetrics(cohort({ evidenceComplete: false }), OPTIONS)
    expect(labeled.paid59Households).toBe(0)
    expect(labeled.completionWithin28dStartedPaid.denominator).toBe(0)
    expect(labeled.g4GateReady).toBe(true)
    expect(labeled.recommendation.code).toBe('retest_packaging_and_pricing')
    expect(unverified.paid59Households).toBe(0)
    expect(unverified.g4GateReady).toBe(false)
  })

  it.each([1, 5899, 5901])('does not mistake a %i-cent payment for the US$59 full-price offer', paidAmountCents => {
    const report = evaluatePilotCohortMetrics(cohort({
      paidAmountCents,
      paymentFeeCents: 0,
      aiAndStorageCostCents: 0,
      opsHourlyRateCents: 0,
      acquisitionCostCents: 0,
      fulfillmentCostCents: 0,
      hostingReserveCents: 0,
      fixedCostAllocationCents: 0,
    }), OPTIONS)
    expect(report.paid59Households).toBe(0)
    expect(report.completionWithin28dStartedPaid.denominator).toBe(0)
    expect(report.unitEconomicsAllCohort.paidHouseholds).toBe(20)
    expect(report.unitEconomicsAllCohort.complete).toBe(false)
    expect(report.unitEconomicsAllCohort.totalContributionCents).toBeNull()
    expect(report.blockingReasons).toEqual(expect.arrayContaining(['invalid_measurements', 'incomplete_costs']))
    expect(report.g4GateReady).toBe(false)
    expect(report.recommendation.code).toBe('blocked_by_incident_or_immature_window')
  })

  it('makes mature no-pay and insufficient-pay outcomes actionable without waiting forever', () => {
    const free = evaluatePilotCohortMetrics(cohort({ pricingTier: 'free', paidAmountCents: 0 }), OPTIONS)
    const elevenPaid = evaluatePilotCohortMetrics(cohort().map((e, i) => i < 11 ? e : { ...e, pricingTier: 'free', paidAmountCents: 0 }), OPTIONS)
    expect(free.g4GateReady).toBe(true)
    expect(free.recommendation.code).toBe('retest_packaging_and_pricing')
    expect(elevenPaid.g4GateReady).toBe(true)
    expect(elevenPaid.recommendation.code).toBe('retest_packaging_and_pricing')
  })

  it('does not require a nonzero replay denominator to recognize mature demand failure', () => {
    const report = evaluatePilotCohortMetrics(cohort({
      ...incomplete, pricingTier: 'free', paidAmountCents: 0,
      inviteAcceptedAt: null, consentedAt: null, incompleteReason: 'declined',
      quality: {
        reviewedClaims: 0, incorrectClaims: 0, invalidSourceClaims: 0,
        seededErrors: 0, detectedSeededErrors: 0, negativeClaims: 0,
        falsePositiveClaims: 0, unresolvedSevereErrors: 0,
      },
    }), OPTIONS)
    expect(report.g4GateReady).toBe(true)
    expect(report.replayWithin14dPostDelivery.proportion).toBeNull()
    expect(report.qualityTotals.reviewedClaims).toBe(0)
    expect(report.qualityAcceptable).toBe(false)
    expect(report.incompleteReasonsBreakdown).toEqual({ declined: 20 })
    expect(report.recommendation.code).toBe('narrow_or_pivot')
    expect(report.recommendation.rationale).toContain('No approved outcome')
  })

  it('requires first outcomes >=80% as well as completion before recommending expansion', () => {
    const entries = cohort().map((e, i) => i < 5 ? { ...e, firstApprovedDownloadAt: '2026-10-10T00:00:00.000Z' } : e)
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.firstOutcomeWithin7d.proportion).toBe(0.75)
    expect(report.completionWithin28dStartedPaid.proportion).toBe(1)
    expect(report.g4GateReady).toBe(true)
    expect(report.recommendation.code).toBe('narrow_or_pivot')
  })

  it('keeps uninvited and refused households in the first-outcome denominator', () => {
    const entries = cohort().map((e, i) => i === 0 ? e : {
      ...e, ...incomplete, inviteSentAt: i < 10 ? e.inviteSentAt : null,
      inviteAcceptedAt: null, consentedAt: null,
    })
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.firstOutcomeWithin7d).toMatchObject({ numerator: 1, denominator: 20, proportion: 0.05 })
    expect(report.completionWithin28dAllPaid.proportion).toBe(0.05)
    expect(report.g4GateReady).toBe(true)
    expect(report.recommendation.code).toBe('narrow_or_pivot')
  })

  it('measures first outcome from sending the invitation and does not reset the clock at acceptance', () => {
    const report = evaluatePilotCohortMetrics(cohort({
      inviteSentAt: '2026-10-01T00:00:00.000Z',
      inviteAcceptedAt: '2026-10-10T00:00:00.000Z',
      firstRecordingSavedAt: '2026-10-11T00:00:00.000Z',
      firstApprovedDownloadAt: '2026-10-12T00:00:00.000Z',
    }), OPTIONS)
    expect(report.firstOutcomeWithin7d.proportion).toBe(0)
    expect(report.recommendation.code).toBe('narrow_or_pivot')
  })

  it('requires a valid sent invitation for an accepted invitation or downstream outcomes', () => {
    const report = evaluatePilotCohortMetrics(cohort({ inviteSentAt: undefined }), OPTIONS)
    expect(report.firstOutcomeWithin7d).toMatchObject({ numerator: 0, denominator: 20 })
    expect(report.blockingReasons).toContain('invalid_event_chronology')
    expect(report.g4GateReady).toBe(false)
  })

  it('requires both all-paid and started-paid completion targets for expansion', () => {
    const entries = cohort().map((e, i) => i < 4 ? { ...e, ...incomplete } : i < 8 ? {
      ...e, projectCompletedAt: null, deliveredAt: null, replayedWithin14dAt: null,
    } : e)
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.firstOutcomeWithin7d.proportion).toBe(0.8)
    expect(report.completionWithin28dStartedPaid.proportion).toBe(0.75)
    expect(report.completionWithin28dAllPaid.proportion).toBe(0.6)
    expect(report.recommendation.code).not.toBe('expand_channel')
  })

  it('includes recommendations, referral counts and incomplete outcomes in every comparison segment', () => {
    const entries = cohort().map((e, i) => ({
      ...e, pricingTier: i < 10 ? 'free' as const : 'paid_59' as const,
      paidAmountCents: i < 10 ? 0 : 5900,
      npsScore: i < 10 ? 5 : i < 15 ? 10 : null,
      wouldRecommend: i < 10 ? false : i < 15 ? true : null,
      referralsCount: i < 10 ? 0 : 1,
      ...(i === 0 ? { ...incomplete, incompleteReason: 'declined' } : {}),
    }))
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.perPricingTier.free).toMatchObject({
      npsScore: -100, npsResponseCount: 10, npsMissingCount: 0,
      recommendResponseCount: 10, recommendMissingCount: 0,
      wouldRecommendRate: { proportion: 0 }, totalReferrals: 0,
      incompleteReasonsBreakdown: { declined: 1 },
    })
    expect(report.perPricingTier.paid_59).toMatchObject({
      npsScore: 100, npsResponseCount: 5, npsMissingCount: 5,
      recommendResponseCount: 5, recommendMissingCount: 5, totalReferrals: 10,
    })
    expect(report.dimensions.country.US).toMatchObject({ npsResponseCount: 15, npsMissingCount: 5, totalReferrals: 10 })
  })

  it('reports every pricing tier independently and attaches the audit dimensions', () => {
    const tiers = ['free', 'half_price', 'subsidized', 'paid_59'] as const
    const entries = cohort().map((e, i) => ({ ...e, pricingTier: tiers[i % 4], paidAmountCents: i % 4 === 0 ? 0 : e.paidAmountCents, country: i % 2 ? 'GB' : 'US', supportMode: i % 2 ? 'family_assisted' as const : 'self_serve' as const }))
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(Object.keys(report.perPricingTier).sort()).toEqual([...tiers].sort())
    for (const tier of tiers) {
      expect(report.perPricingTier[tier].households).toBe(5)
      expect(report.perPricingTier[tier].firstOutcomeWithin7d.denominator).toBe(5)
    }
    expect(report.dimensions.productVersion['2026.11'].households).toBe(20)
    expect(report.dimensions.acquisitionChannel.direct_invite.households).toBe(20)
    expect(report.dimensions.country.GB.households).toBe(10)
    expect(report.dimensions.supportMode.family_assisted.households).toBe(10)
  })

  it('counts a verified existing-audio source as activation and compares entry modes separately', () => {
    const entries = cohort().map((e, i) => ({ ...e, materialEntryMode: i < 10 ? 'existing_audio' as const : 'new_recording' as const }))
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.effectiveActivationAll).toMatchObject({ numerator: 20, denominator: 20 })
    expect(report.dimensions.materialEntryMode.existing_audio).toMatchObject({
      households: 10, effectiveActivationAll: { numerator: 10, denominator: 10 },
    })
    expect(report.dimensions.materialEntryMode.new_recording.households).toBe(10)
    expect(report.g4GateReady).toBe(true)
  })

  it('does not accept complete evidence without a known material entry mode', () => {
    const report = evaluatePilotCohortMetrics(cohort({ materialEntryMode: undefined }), OPTIONS)
    expect(report.blockingReasons).toContain('incomplete_evidence')
    expect(report.g4GateReady).toBe(false)
  })

  it('blocks incidents and never lets unrelated cohorts inflate a recommendation', () => {
    const report = evaluatePilotCohortMetrics(cohort({ severeDataIncidents: 1 }), OPTIONS)
    expect(report.severeDataIncidentsTotal).toBe(20)
    expect(report.g4GateReady).toBe(false)
    expect(report.blockingReasons).toContain('unresolved_severe_incidents')
    expect(report.recommendation.requiresOwnerDecision).toBe(true)
  })
})

describe('G4 labor and full-batch economics', () => {
  it('does not present unknown labor projected to zero as a measured zero-minute sample', () => {
    const report = evaluatePilotCohortMetrics(cohort({
      familyRevisionMinutes: 0, familyRevisionStoryMinutes: [], opsSupportMinutes: 0,
      familyRevisionMeasured: false, opsSupportMeasured: false,
    }), OPTIONS)
    expect(report.familyRevisionLabor).toMatchObject({ sampleSize: 0, medianMinutes: null, withinTarget: null })
    expect(report.familyRevisionPerStoryLabor).toMatchObject({ sampleSize: 0, medianMinutes: null, withinTarget: null })
    expect(report.opsSupportLabor).toMatchObject({ sampleSize: 0, medianMinutes: null, withinTarget: null })
    expect(report.unitEconomicsAllCohort.laborCostCents).toBeNull()
    expect(report.blockingReasons).toContain('incomplete_labor_evidence')
    expect(report.g4GateReady).toBe(false)
  })

  it('uses the arithmetic median, reports household and per-story labor separately, and preserves P90', () => {
    const entries = cohort().map((e, i) => ({ ...e, familyRevisionMinutes: i < 10 ? 10 : 30, familyRevisionStoryMinutes: i < 10 ? [5, 5] : [15, 15], opsSupportMinutes: i < 10 ? 20 : 40 }))
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.familyRevisionLabor).toMatchObject({ sampleSize: 20, medianMinutes: 20, p90Minutes: 30, targetMinutes: null, withinTarget: null })
    expect(report.familyRevisionPerStoryLabor).toMatchObject({ sampleSize: 40, medianMinutes: 10, p90Minutes: 15, targetMinutes: 10, withinTarget: true })
    expect(report.opsSupportLabor).toMatchObject({ medianMinutes: 30, p90Minutes: 40, withinTarget: true })
  })

  it('uses explicit cents-per-hour rates and includes CAC, fulfillment, hosting reserve and fixed allocations', () => {
    const report = evaluatePilotCohortMetrics(cohort(), OPTIONS)
    expect(report.unitEconomicsAllCohort).toMatchObject({
      complete: true, status: 'complete', totalHouseholds: 20, paidHouseholds: 20,
      grossRevenueCents: 118000, laborCostCents: 8000, acquisitionCostCents: 2000,
      fulfillmentCostCents: 2000, hostingReserveCents: 2000, fixedCostAllocationCents: 2000,
      totalCostCents: 24000, contributionBeforeAcquisitionCents: 96000,
      totalContributionCents: 94000, contributionPerPaidHouseholdCents: 4700,
    })
    expect(report.unitEconomicsAllCohort.costDisclosure).toMatchObject({ hourlyRate: 'explicit_per_household', acquisition: 'included', fulfillment: 'included', hostingReserve: 'included', fixedAllocation: 'included' })
  })

  it.each([
    { opsHourlyRateCents: null }, { acquisitionCostCents: undefined },
    { fulfillmentCostCents: undefined }, { hostingReserveCents: undefined },
    { fixedCostAllocationCents: null }, { costsComplete: false },
  ])('does not substitute $30/hour or zero for missing costs (%j)', change => {
    const entries = cohort()
    entries[0] = household(0, change)
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.unitEconomicsAllCohort.complete).toBe(false)
    expect(report.unitEconomicsAllCohort.totalContributionCents).toBeNull()
    expect(report.unitEconomicsAllCohort.contributionPerPaidHouseholdCents).toBeNull()
    expect(report.recommendation.code).toBe('blocked_by_incident_or_immature_window')
  })

  it('accepts explicit zero rates and costs and rounds labor once per household', () => {
    const report = evaluatePilotCohortMetrics(cohort({ opsHourlyRateCents: 100, opsSupportMinutes: 1, fixedCostAllocationCents: 0 }), OPTIONS)
    expect(report.unitEconomicsAllCohort.complete).toBe(true)
    expect(report.unitEconomicsAllCohort.laborCostCents).toBe(40)
    const zeroRate = evaluatePilotCohortMetrics(cohort({ opsHourlyRateCents: 0 }), OPTIONS)
    expect(zeroRate.unitEconomicsAllCohort.laborCostCents).toBe(0)
    expect(zeroRate.g4GateReady).toBe(true)
  })

  it('cannot expand using only profitable paid households while the full roster loses money', () => {
    const entries = cohort().map((e, i) => i < 12 ? e : { ...e, pricingTier: 'free' as const, paidAmountCents: 0, acquisitionCostCents: 10000 })
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.unitEconomicsPaidCohort.totalContributionCents).toBeGreaterThan(0)
    expect(report.unitEconomicsAllCohort.totalHouseholds).toBe(20)
    expect(report.unitEconomicsAllCohort.totalContributionCents).toBeLessThan(0)
    expect(report.recommendation.code).not.toBe('expand_channel')
  })

  it('recommends workflow or a higher tier for good outcomes with excessive story or operations labor', () => {
    const storyHeavy = evaluatePilotCohortMetrics(cohort({ familyRevisionMinutes: 22, familyRevisionStoryMinutes: [11, 11] }), OPTIONS)
    const opsHeavy = evaluatePilotCohortMetrics(cohort({ opsSupportMinutes: 31 }), OPTIONS)
    expect(storyHeavy.recommendation.code).toBe('optimize_workflow_or_higher_tier')
    expect(opsHeavy.recommendation.code).toBe('optimize_workflow_or_higher_tier')
  })

  it('requires per-household revision minutes to reconcile with its per-story ledger', () => {
    const report = evaluatePilotCohortMetrics(cohort({ familyRevisionMinutes: 1000, familyRevisionStoryMinutes: [1] }), OPTIONS)
    expect(report.blockingReasons).toContain('invalid_measurements')
    expect(report.g4GateReady).toBe(false)
    expect(report.recommendation.code).toBe('blocked_by_incident_or_immature_window')
  })

  it('accepts the inclusive 0.01-minute reconciliation tolerance without floating-point drift', () => {
    const boundary = evaluatePilotCohortMetrics(cohort({ familyRevisionMinutes: 16.01 }), OPTIONS)
    const outside = evaluatePilotCohortMetrics(cohort({ familyRevisionMinutes: 16.0101 }), OPTIONS)
    expect(boundary.g4GateReady).toBe(true)
    expect(outside.blockingReasons).toContain('invalid_measurements')
  })

  it('keeps self-reported listening separate from observed behavioral replay', () => {
    const report = evaluatePilotCohortMetrics(cohort({ replayedWithin14dAt: null, selfReportedReplayAt: '2026-10-24T00:00:00.000Z' }), OPTIONS)
    expect(report.replayWithin14dPostDelivery).toMatchObject({ numerator: 0, denominator: 20, proportion: 0 })
    expect(report.selfReportedReplayWithin14dPostDelivery).toMatchObject({ numerator: 20, denominator: 20, proportion: 1 })
  })

  it.each([
    { familyRevisionMinutes: -1 }, { opsSupportMinutes: Number.NaN },
    { paidAmountCents: Number.POSITIVE_INFINITY }, { paidAmountCents: -1 },
    { familyRevisionStoryMinutes: [8, -1] }, { npsScore: 11 },
    { refundedAmountCents: 6000 }, { referralsCount: 1.5 },
  ])('blocks malformed measurements instead of turning them into valid evidence (%j)', change => {
    const report = evaluatePilotCohortMetrics(cohort(change), OPTIONS)
    expect(report.blockingReasons).toContain('invalid_measurements')
    expect(report.g4GateReady).toBe(false)
  })

  it('separates NPS, willingness to recommend, and actual referrals', () => {
    const entries = cohort().map((e, i) => ({ ...e, npsScore: i < 10 ? 10 : 5, wouldRecommend: i < 15, referralsCount: i === 0 ? 3 : 0 }))
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.npsScore).toBe(0)
    expect(report.wouldRecommendRate.proportion).toBe(0.75)
    expect(report.totalReferrals).toBe(3)
  })

  it('rejects an invalid asOf date rather than returning misleading mature metrics', () => {
    expect(() => evaluatePilotCohortMetrics(cohort(), { ...OPTIONS, asOf: 'invalid' })).toThrow('Invalid asOf')
  })
})

describe('G4 explicit quality evidence', () => {
  it('aggregates quality denominators and rates instead of trusting the reviewed checkbox', () => {
    const report = evaluatePilotCohortMetrics(cohort(), OPTIONS)
    expect(report.qualityTotals).toEqual({ reviewedClaims: 200, incorrectClaims: 0, invalidSourceClaims: 0, seededErrors: 200, detectedSeededErrors: 200, negativeClaims: 200, falsePositiveClaims: 0, unresolvedSevereErrors: 0 })
    expect(report.qualityMetrics.seededErrorDetectionRate).toMatchObject({ numerator: 200, denominator: 200, proportion: 1 })
    expect(report.incorrectClaimsPer100).toBe(0)
    expect(report.invalidSourceClaimsPer100).toBe(0)
    expect(report.qualityAcceptable).toBe(true)
    const missing = evaluatePilotCohortMetrics(cohort({ quality: undefined }), OPTIONS)
    expect(missing.qualityAcceptable).toBe(false)
    expect(missing.g4GateReady).toBe(false)
    expect(missing.blockingReasons).toContain('incomplete_quality_evidence')
  })

  it('does not turn undersized error and negative samples into a quality pass', () => {
    const entries = cohort()
    entries[0].quality = { ...entries[0].quality!, seededErrors: 9, detectedSeededErrors: 9, negativeClaims: 9 }
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.qualityTotals.seededErrors).toBe(199)
    expect(report.qualityTotals.negativeClaims).toBe(199)
    expect(report.blockingReasons).toContain('insufficient_quality_sample')
    expect(report.g4GateReady).toBe(false)
  })

  it('requires actual reviewed claims for an approved output even when a checkbox says reviewed', () => {
    const report = evaluatePilotCohortMetrics(cohort({ quality: {
      reviewedClaims: 0, incorrectClaims: 0, invalidSourceClaims: 0,
      seededErrors: 0, detectedSeededErrors: 0, negativeClaims: 0,
      falsePositiveClaims: 0, unresolvedSevereErrors: 0,
    } }), OPTIONS)
    expect(report.qualityAcceptable).toBe(false)
    expect(report.blockingReasons).toContain('incomplete_quality_evidence')
    expect(report.g4GateReady).toBe(false)
    expect(report.recommendation.code).toBe('blocked_by_incident_or_immature_window')
  })

  it('uses inclusive 95% detection and 10% false-positive thresholds on unrounded counts', () => {
    const entries = cohort().map((e, i) => ({ ...e, quality: {
      ...e.quality!, detectedSeededErrors: i < 10 ? 9 : 10, falsePositiveClaims: 1,
    } }))
    const report = evaluatePilotCohortMetrics(entries, OPTIONS)
    expect(report.qualityMetrics.seededErrorDetectionRate.proportion).toBe(0.95)
    expect(report.qualityMetrics.falsePositiveRate.proportion).toBe(0.1)
    expect(report.qualityAcceptable).toBe(true)
    expect(report.recommendation.code).toBe('expand_channel')
  })

  it.each([
    { incorrectClaims: 1 }, { invalidSourceClaims: 1 },
    { detectedSeededErrors: 9 }, { falsePositiveClaims: 2 },
  ])('keeps poor quality as an observed outcome but prevents expansion (%j)', changes => {
    const report = evaluatePilotCohortMetrics(cohort().map(e => ({ ...e, quality: { ...e.quality!, ...changes } })), OPTIONS)
    expect(report.g4GateReady).toBe(true)
    expect(report.qualityAcceptable).toBe(false)
    expect(report.recommendation.code).toBe('narrow_or_pivot')
  })

  it.each([
    { detectedSeededErrors: 11 }, { falsePositiveClaims: 11 },
    { incorrectClaims: 11 }, { invalidSourceClaims: 11 },
    { reviewedClaims: -1 }, { negativeClaims: 1.5 },
  ])('blocks inconsistent quality counts (%j)', changes => {
    const report = evaluatePilotCohortMetrics(cohort().map(e => ({ ...e, quality: { ...e.quality!, ...changes } })), OPTIONS)
    expect(report.blockingReasons).toContain('invalid_quality_evidence')
    expect(report.g4GateReady).toBe(false)
  })

  it('blocks unresolved severe quality errors independently of data incidents', () => {
    const report = evaluatePilotCohortMetrics(cohort().map(e => ({ ...e, quality: { ...e.quality!, unresolvedSevereErrors: 1 } })), OPTIONS)
    expect(report.blockingReasons).toContain('unresolved_severe_quality_errors')
    expect(report.g4GateReady).toBe(false)
  })
})
