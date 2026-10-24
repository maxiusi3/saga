import {
  computeCohortUnitEconomics,
  type CohortUnitEconomicsReport,
} from '@/lib/server/entitlement-fulfillment'

export type PilotCohortType = 'prototype_study' | 'ai_eval_holdout' | 'longitudinal_pilot'
export type PilotPricingTier = 'free' | 'half_price' | 'subsidized' | 'paid_59'
export type PilotSupportMode = 'self_serve' | 'family_assisted'

export interface PilotHouseholdEntry {
  id: string
  projectId: string
  cohortType: PilotCohortType
  pricingTier: PilotPricingTier
  supportMode: PilotSupportMode
  acquisitionChannel: string
  country: string
  productVersion: string
  enrolledAt: string
  inviteAcceptedAt?: string | null
  firstRecordingSavedAt?: string | null
  firstApprovedDownloadAt?: string | null
  projectCompletedAt?: string | null
  deliveredAt?: string | null
  replayedWithin14dAt?: string | null
  withdrawnAt?: string | null
  incompleteReason?: string | null
  familyRevisionMinutes: number
  opsSupportMinutes: number
  paidAmountCents: number
  refundedAmountCents: number
  paymentFeeCents: number
  aiAndStorageCostCents: number
  npsScore?: number | null
  wouldRecommend?: boolean | null
  referralsCount?: number
  severeDataIncidents?: number
}

export interface RatioMetric {
  numerator: number
  denominator: number
  proportion: number | null
  status: 'measured' | 'insufficient_sample'
}

export interface LaborDistributionMetric {
  sampleSize: number
  medianMinutes: number | null
  p90Minutes: number | null
  targetMinutes: number
  withinTarget: boolean | null
}

export type G4RecommendationCode =
  | 'expand_channel'
  | 'optimize_workflow_or_higher_tier'
  | 'retest_packaging_and_pricing'
  | 'narrow_or_pivot'
  | 'blocked_by_incident_or_immature_window'

export interface G4DecisionReport {
  evaluatedAt: string
  cohortSeparationVerified: boolean
  countsByCohort: Record<PilotCohortType, number>
  countsByPricingTier: Record<PilotPricingTier, number>
  effectiveActivationAll: RatioMetric
  effectiveActivationSelfServe: RatioMetric
  effectiveActivationAssisted: RatioMetric
  firstOutcomeWithin7d: RatioMetric
  completionWithin28dStartedPaid: RatioMetric
  completionWithin28dAllPaid: RatioMetric
  replayWithin14dPostDelivery: RatioMetric
  familyRevisionLabor: LaborDistributionMetric
  opsSupportLabor: LaborDistributionMetric
  unitEconomicsPaidCohort: CohortUnitEconomicsReport
  npsScore: number | null
  wouldRecommendRate: RatioMetric
  totalReferrals: number
  severeDataIncidentsTotal: number
  incompleteReasonsBreakdown: Record<string, number>
  g4GateReady: boolean
  recommendation: {
    code: G4RecommendationCode
    rationale: string
    requiresOwnerDecision: true
  }
}

function makeRatio(numerator: number, denominator: number): RatioMetric {
  if (denominator <= 0) {
    return {
      numerator: 0,
      denominator: 0,
      proportion: null,
      status: 'insufficient_sample',
    }
  }
  return {
    numerator,
    denominator,
    proportion: Number((numerator / denominator).toFixed(4)),
    status: 'measured',
  }
}

function computePercentile(sortedValues: readonly number[], p: number): number | null {
  if (sortedValues.length === 0) return null
  const idx = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1),
  )
  return Number(sortedValues[idx].toFixed(2))
}

function computeLaborMetric(values: readonly number[], targetMinutes: number): LaborDistributionMetric {
  if (values.length === 0) {
    return {
      sampleSize: 0,
      medianMinutes: null,
      p90Minutes: null,
      targetMinutes,
      withinTarget: null,
    }
  }
  const sorted = [...values].sort((a, b) => a - b)
  const median = computePercentile(sorted, 50)
  const p90 = computePercentile(sorted, 90)
  return {
    sampleSize: sorted.length,
    medianMinutes: median,
    p90Minutes: p90,
    targetMinutes,
    withinTarget: median !== null ? median <= targetMinutes : null,
  }
}

/**
 * Evaluates longitudinal pilot cohort metrics and G4 decision criteria
 * per docs/2026-10-10-integrated-upgrade-plan.md §7.1, §10.2 & §10.3.
 */
export function evaluatePilotCohortMetrics(
  entries: readonly PilotHouseholdEntry[],
  options?: { asOf?: string },
): G4DecisionReport {
  const asOfIso = options?.asOf ?? new Date().toISOString()
  const asOfMs = new Date(asOfIso).getTime()
  const DAY_MS = 24 * 60 * 60 * 1000

  const countsByCohort: Record<PilotCohortType, number> = {
    prototype_study: 0,
    ai_eval_holdout: 0,
    longitudinal_pilot: 0,
  }
  const countsByPricingTier: Record<PilotPricingTier, number> = {
    free: 0,
    half_price: 0,
    subsidized: 0,
    paid_59: 0,
  }

  for (const e of entries) {
    countsByCohort[e.cohortType] += 1
    countsByPricingTier[e.pricingTier] += 1
  }

  // Only longitudinal_pilot is used for product funnel & commercial analysis (never mix prototype_study or ai_eval_holdout)
  const pilotEntries = entries.filter(e => e.cohortType === 'longitudinal_pilot')
  const invitedPilot = pilotEntries.filter(e => Boolean(e.inviteAcceptedAt))
  const invitedSelfServe = invitedPilot.filter(e => e.supportMode === 'self_serve')
  const invitedAssisted = invitedPilot.filter(e => e.supportMode === 'family_assisted')

  const activatedAll = invitedPilot.filter(e => Boolean(e.firstRecordingSavedAt))
  const activatedSelfServe = invitedSelfServe.filter(e => Boolean(e.firstRecordingSavedAt))
  const activatedAssisted = invitedAssisted.filter(e => Boolean(e.firstRecordingSavedAt))

  // 7-day first outcome window (among invited households whose invite was accepted >= 7 days ago)
  const mature7dInvited = invitedPilot.filter(e => {
    const inviteMs = new Date(e.inviteAcceptedAt!).getTime()
    return asOfMs - inviteMs >= 7 * DAY_MS
  })
  const achieved7dOutcome = mature7dInvited.filter(e => {
    if (!e.firstApprovedDownloadAt || !e.inviteAcceptedAt) return false
    const diff = new Date(e.firstApprovedDownloadAt).getTime() - new Date(e.inviteAcceptedAt).getTime()
    return diff >= 0 && diff <= 7 * DAY_MS
  })

  // 28-day project completion window among paid_59 longitudinal pilot households
  const paidPilot = pilotEntries.filter(e => e.pricingTier === 'paid_59')
  const mature28dPaidAll = paidPilot.filter(
    e => asOfMs - new Date(e.enrolledAt).getTime() >= 28 * DAY_MS,
  )
  const mature28dPaidStarted = mature28dPaidAll.filter(e => Boolean(e.firstRecordingSavedAt))

  const completedWithin28d = (list: readonly PilotHouseholdEntry[]) =>
    list.filter(e => {
      if (!e.projectCompletedAt) return false
      const diff = new Date(e.projectCompletedAt).getTime() - new Date(e.enrolledAt).getTime()
      return diff >= 0 && diff <= 28 * DAY_MS
    })

  // 14-day post-delivery replay window
  const mature14dDelivered = pilotEntries.filter(e => {
    if (!e.deliveredAt) return false
    return asOfMs - new Date(e.deliveredAt).getTime() >= 14 * DAY_MS
  })
  const replayedWithin14d = mature14dDelivered.filter(e => {
    if (!e.replayedWithin14dAt || !e.deliveredAt) return false
    const diff = new Date(e.replayedWithin14dAt).getTime() - new Date(e.deliveredAt).getTime()
    return diff >= 0 && diff <= 14 * DAY_MS
  })

  const familyRevisionLabor = computeLaborMetric(
    pilotEntries.map(e => e.familyRevisionMinutes),
    10,
  )
  const opsSupportLabor = computeLaborMetric(
    pilotEntries.map(e => e.opsSupportMinutes),
    30,
  )

  const unitEconomicsPaidCohort = computeCohortUnitEconomics(
    paidPilot.map(e => ({
      householdId: e.id,
      paidAmountCents: e.paidAmountCents,
      refundedAmountCents: e.refundedAmountCents,
      paymentProcessingFeeCents: e.paymentFeeCents,
      aiAndStorageCostCents: e.aiAndStorageCostCents,
      supportMinutes: e.opsSupportMinutes,
      completedProject: Boolean(e.projectCompletedAt),
      refunded: e.refundedAmountCents > 0,
    })),
  )

  // NPS = % Promoters (9-10) - % Detractors (0-6), range [-100, 100]
  const npsEntries = pilotEntries.filter(
    e => typeof e.npsScore === 'number' && !Number.isNaN(e.npsScore),
  )
  let npsScore: number | null = null
  if (npsEntries.length > 0) {
    const promoters = npsEntries.filter(e => (e.npsScore as number) >= 9).length
    const detractors = npsEntries.filter(e => (e.npsScore as number) <= 6).length
    npsScore = Math.round(((promoters - detractors) / npsEntries.length) * 100)
  }

  const recommendRespondents = pilotEntries.filter(e => typeof e.wouldRecommend === 'boolean')
  const recommendYes = recommendRespondents.filter(e => e.wouldRecommend === true)

  const incompleteReasonsBreakdown: Record<string, number> = {}
  let totalReferrals = 0
  let severeDataIncidentsTotal = 0

  for (const e of pilotEntries) {
    totalReferrals += e.referralsCount ?? 0
    severeDataIncidentsTotal += e.severeDataIncidents ?? 0
    if (!e.projectCompletedAt && e.incompleteReason) {
      incompleteReasonsBreakdown[e.incompleteReason] =
        (incompleteReasonsBreakdown[e.incompleteReason] ?? 0) + 1
    }
  }

  const completionStartedMetric = makeRatio(
    completedWithin28d(mature28dPaidStarted).length,
    mature28dPaidStarted.length,
  )
  const firstOutcomeMetric = makeRatio(achieved7dOutcome.length, mature7dInvited.length)
  const replayMetric = makeRatio(replayedWithin14d.length, mature14dDelivered.length)

  let recCode: G4RecommendationCode
  let rationale: string

  if (
    severeDataIncidentsTotal > 0 ||
    completionStartedMetric.status === 'insufficient_sample' ||
    replayMetric.status === 'insufficient_sample'
  ) {
    recCode = 'blocked_by_incident_or_immature_window'
    rationale =
      severeDataIncidentsTotal > 0
        ? `Blocked by ${severeDataIncidentsTotal} unresolved severe data incident(s).`
        : 'Observation maturity windows (28d completion + 14d post-delivery replay) do not yet have a non-zero mature sample.'
  } else if (
    (completionStartedMetric.proportion ?? 0) >= 0.7 &&
    unitEconomicsPaidCohort.totalContributionCents > 0 &&
    opsSupportLabor.withinTarget === true
  ) {
    recCode = 'expand_channel'
    rationale =
      'Completion >= 70%, positive unit contribution, and ops labor within 30 min target: recommend expanding one acquisition channel.'
  } else if ((completionStartedMetric.proportion ?? 0) >= 0.7 && opsSupportLabor.withinTarget === false) {
    recCode = 'optimize_workflow_or_higher_tier'
    rationale =
      'Quality and completion are strong, but ops/revision labor exceeds target: recommend workflow automation or higher-priced concierge tier.'
  } else if ((firstOutcomeMetric.proportion ?? 0) >= 0.6 && paidPilot.length === 0) {
    recCode = 'retest_packaging_and_pricing'
    rationale =
      'Families complete and value the outcome, but paid conversion is insufficient: recommend retesting offer packaging and pricing.'
  } else {
    recCode = 'narrow_or_pivot'
    rationale =
      'Core completion or activation below threshold: distinguish UX friction vs demand gap before scaling spend.'
  }

  const g4GateReady =
    severeDataIncidentsTotal === 0 &&
    completionStartedMetric.status === 'measured' &&
    replayMetric.status === 'measured'

  return {
    evaluatedAt: asOfIso,
    cohortSeparationVerified: true,
    countsByCohort,
    countsByPricingTier,
    effectiveActivationAll: makeRatio(activatedAll.length, invitedPilot.length),
    effectiveActivationSelfServe: makeRatio(activatedSelfServe.length, invitedSelfServe.length),
    effectiveActivationAssisted: makeRatio(activatedAssisted.length, invitedAssisted.length),
    firstOutcomeWithin7d: firstOutcomeMetric,
    completionWithin28dStartedPaid: completionStartedMetric,
    completionWithin28dAllPaid: makeRatio(
      completedWithin28d(mature28dPaidAll).length,
      mature28dPaidAll.length,
    ),
    replayWithin14dPostDelivery: replayMetric,
    familyRevisionLabor,
    opsSupportLabor,
    unitEconomicsPaidCohort,
    npsScore,
    wouldRecommendRate: makeRatio(recommendYes.length, recommendRespondents.length),
    totalReferrals,
    severeDataIncidentsTotal,
    incompleteReasonsBreakdown,
    g4GateReady,
    recommendation: {
      code: recCode,
      rationale,
      requiresOwnerDecision: true,
    },
  }
}
