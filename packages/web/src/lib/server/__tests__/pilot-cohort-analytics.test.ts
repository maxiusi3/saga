import { evaluatePilotCohortMetrics, type PilotHouseholdEntry } from '@/lib/server/pilot-cohort-analytics'

describe('T13 Longitudinal Pilot Cohort Analytics & G4 Decision Engine', () => {
  it('returns insufficient_sample (null proportion) when maturity denominators are 0 instead of 0% or Infinity', () => {
    const emptyReport = evaluatePilotCohortMetrics([], {
      asOf: '2026-12-15T00:00:00.000Z',
    })
    expect(emptyReport.effectiveActivationAll).toEqual({
      numerator: 0,
      denominator: 0,
      proportion: null,
      status: 'insufficient_sample',
    })
    expect(emptyReport.completionWithin28dStartedPaid.proportion).toBeNull()
    expect(emptyReport.g4GateReady).toBe(false)
    expect(emptyReport.recommendation.code).toBe('blocked_by_incident_or_immature_window')
    expect(emptyReport.recommendation.requiresOwnerDecision).toBe(true)
  })

  it('strictly separates prototype_study and ai_eval_holdout from longitudinal_pilot and computes G4 metrics after 28d+14d maturity windows', () => {
    const entries: PilotHouseholdEntry[] = [
      // Prototype study household (must NOT be counted as longitudinal paid sales)
      {
        id: 'hh-proto-1',
        projectId: 'proj-proto-1',
        cohortType: 'prototype_study',
        pricingTier: 'subsidized',
        supportMode: 'family_assisted',
        acquisitionChannel: 'research_panel',
        country: 'US',
        productVersion: '2026.10-p4',
        enrolledAt: '2026-10-01T00:00:00.000Z',
        familyRevisionMinutes: 5,
        opsSupportMinutes: 10,
        paidAmountCents: 0,
        refundedAmountCents: 0,
        paymentFeeCents: 0,
        aiAndStorageCostCents: 120,
      },
      // Mature completed paid household 1
      {
        id: 'hh-pilot-1',
        projectId: 'proj-pilot-1',
        cohortType: 'longitudinal_pilot',
        pricingTier: 'paid_59',
        supportMode: 'family_assisted',
        acquisitionChannel: 'direct_invite',
        country: 'US',
        productVersion: '2026.10-p4',
        enrolledAt: '2026-10-01T00:00:00.000Z',
        inviteAcceptedAt: '2026-10-01T02:00:00.000Z',
        firstRecordingSavedAt: '2026-10-02T00:00:00.000Z',
        firstApprovedDownloadAt: '2026-10-05T00:00:00.000Z',
        projectCompletedAt: '2026-10-20T00:00:00.000Z',
        deliveredAt: '2026-10-20T01:00:00.000Z',
        replayedWithin14dAt: '2026-10-25T00:00:00.000Z',
        familyRevisionMinutes: 8,
        opsSupportMinutes: 18,
        paidAmountCents: 5900,
        refundedAmountCents: 0,
        paymentFeeCents: 210,
        aiAndStorageCostCents: 262,
        npsScore: 10,
        wouldRecommend: true,
        referralsCount: 2,
        severeDataIncidents: 0,
      },
      // Mature completed paid household 2
      {
        id: 'hh-pilot-2',
        projectId: 'proj-pilot-2',
        cohortType: 'longitudinal_pilot',
        pricingTier: 'paid_59',
        supportMode: 'self_serve',
        acquisitionChannel: 'direct_invite',
        country: 'US',
        productVersion: '2026.10-p4',
        enrolledAt: '2026-10-02T00:00:00.000Z',
        inviteAcceptedAt: '2026-10-02T03:00:00.000Z',
        firstRecordingSavedAt: '2026-10-03T00:00:00.000Z',
        firstApprovedDownloadAt: '2026-10-06T00:00:00.000Z',
        projectCompletedAt: '2026-10-22T00:00:00.000Z',
        deliveredAt: '2026-10-22T01:00:00.000Z',
        replayedWithin14dAt: '2026-10-28T00:00:00.000Z',
        familyRevisionMinutes: 9,
        opsSupportMinutes: 22,
        paidAmountCents: 5900,
        refundedAmountCents: 0,
        paymentFeeCents: 210,
        aiAndStorageCostCents: 262,
        npsScore: 9,
        wouldRecommend: true,
        referralsCount: 1,
        severeDataIncidents: 0,
      },
      // Mature incomplete paid household 3 (kept in denominator and unit economics)
      {
        id: 'hh-pilot-3',
        projectId: 'proj-pilot-3',
        cohortType: 'longitudinal_pilot',
        pricingTier: 'paid_59',
        supportMode: 'self_serve',
        acquisitionChannel: 'direct_invite',
        country: 'US',
        productVersion: '2026.10-p4',
        enrolledAt: '2026-10-03T00:00:00.000Z',
        inviteAcceptedAt: '2026-10-03T05:00:00.000Z',
        firstRecordingSavedAt: '2026-10-04T00:00:00.000Z',
        incompleteReason: 'storyteller_travel_schedule',
        familyRevisionMinutes: 6,
        opsSupportMinutes: 15,
        paidAmountCents: 5900,
        refundedAmountCents: 0,
        paymentFeeCents: 210,
        aiAndStorageCostCents: 110,
        npsScore: 8,
        wouldRecommend: true,
        referralsCount: 0,
        severeDataIncidents: 0,
      },
      // Mature completed paid household 4
      {
        id: 'hh-pilot-4',
        projectId: 'proj-pilot-4',
        cohortType: 'longitudinal_pilot',
        pricingTier: 'paid_59',
        supportMode: 'family_assisted',
        acquisitionChannel: 'direct_invite',
        country: 'US',
        productVersion: '2026.10-p4',
        enrolledAt: '2026-10-04T00:00:00.000Z',
        inviteAcceptedAt: '2026-10-04T01:00:00.000Z',
        firstRecordingSavedAt: '2026-10-05T00:00:00.000Z',
        firstApprovedDownloadAt: '2026-10-09T00:00:00.000Z',
        projectCompletedAt: '2026-10-24T00:00:00.000Z',
        deliveredAt: '2026-10-24T02:00:00.000Z',
        replayedWithin14dAt: '2026-10-30T00:00:00.000Z',
        familyRevisionMinutes: 7,
        opsSupportMinutes: 20,
        paidAmountCents: 5900,
        refundedAmountCents: 0,
        paymentFeeCents: 210,
        aiAndStorageCostCents: 250,
        npsScore: 10,
        wouldRecommend: true,
        referralsCount: 1,
        severeDataIncidents: 0,
      },
    ]

    const report = evaluatePilotCohortMetrics(entries, {
      asOf: '2026-11-25T00:00:00.000Z',
    })

    expect(report.countsByCohort).toEqual({
      prototype_study: 1,
      ai_eval_holdout: 0,
      longitudinal_pilot: 4,
    })
    expect(report.completionWithin28dStartedPaid.proportion).toBe(0.75)
    expect(report.replayWithin14dPostDelivery.proportion).toBe(1)
    expect(report.familyRevisionLabor.withinTarget).toBe(true)
    expect(report.opsSupportLabor.withinTarget).toBe(true)
    expect(report.npsScore).toBe(75)
    expect(report.wouldRecommendRate.proportion).toBe(1)
    expect(report.incompleteReasonsBreakdown).toEqual({
      storyteller_travel_schedule: 1,
    })
    expect(report.g4GateReady).toBe(true)
    expect(report.recommendation.code).toBe('expand_channel')
  })
})
