export type PilotCohortType = 'prototype_study' | 'ai_eval_holdout' | 'longitudinal_pilot'
export type PilotPricingTier = 'free' | 'half_price' | 'subsidized' | 'paid_59'
export type PilotSupportMode = 'self_serve' | 'family_assisted'
export type PilotObservationKind = 'observed' | 'synthetic' | 'unclassified'
export type PilotMaterialEntryMode = 'new_recording' | 'existing_audio'

export interface PilotQualityEvidence {
  reviewedClaims: number
  incorrectClaims: number
  invalidSourceClaims: number
  seededErrors: number
  detectedSeededErrors: number
  negativeClaims: number
  falsePositiveClaims: number
  unresolvedSevereErrors: number
}

export interface PilotHouseholdEntry {
  id: string
  projectId: string
  householdKey?: string
  cohortKey?: string
  cohortType: PilotCohortType
  observationKind?: PilotObservationKind
  pricingTier: PilotPricingTier
  supportMode: PilotSupportMode
  acquisitionChannel: string
  country: string
  productVersion: string
  materialEntryMode?: PilotMaterialEntryMode
  enrolledAt: string
  inviteSentAt?: string | null
  consentedAt?: string | null
  inviteAcceptedAt?: string | null
  /** Legacy field name: first verified saved source, whether a new recording or imported existing audio. */
  firstRecordingSavedAt?: string | null
  firstApprovedDownloadAt?: string | null
  projectCompletedAt?: string | null
  deliveredAt?: string | null
  replayedWithin14dAt?: string | null
  selfReportedReplayAt?: string | null
  withdrawnAt?: string | null
  incompleteReason?: string | null
  familyRevisionMinutes: number
  familyRevisionMeasured?: boolean
  familyRevisionStoryMinutes?: number[]
  opsSupportMinutes: number
  opsSupportMeasured?: boolean
  opsHourlyRateCents?: number | null
  paidAmountCents: number
  refundedAmountCents: number
  paymentFeeCents: number
  aiAndStorageCostCents: number
  acquisitionCostCents?: number
  fulfillmentCostCents?: number
  hostingReserveCents?: number
  fixedCostAllocationCents?: number | null
  /** Set by the server only after the observation ledger and its evidence have been validated. */
  evidenceComplete?: boolean
  costsComplete?: boolean
  qualityReviewed?: boolean
  quality?: PilotQualityEvidence
  npsScore?: number | null
  wouldRecommend?: boolean | null
  referralsCount?: number
  severeDataIncidents?: number
}

export interface PilotEvaluationOptions {
  asOf?: string
  observationKind?: Exclude<PilotObservationKind, 'unclassified'>
  cohortKey?: string
  cohortClosedAt?: string | null
  erasedHouseholds?: number
}

export interface RatioMetric {
  numerator: number
  denominator: number
  proportion: number | null
  status: 'measured' | 'insufficient_sample'
}

export interface PilotQualityReport {
  qualityTotals: PilotQualityEvidence
  qualityMetrics: {
    reviewedClaimErrorRate: RatioMetric
    invalidSourceRate: RatioMetric
    seededErrorDetectionRate: RatioMetric
    falsePositiveRate: RatioMetric
  }
  incorrectClaimsPer100: number | null
  invalidSourceClaimsPer100: number | null
  qualityAcceptable: boolean
}

export interface PilotResponseReport {
  npsScore: number | null
  npsResponseCount: number
  npsMissingCount: number
  wouldRecommendRate: RatioMetric
  recommendResponseCount: number
  recommendMissingCount: number
  totalReferrals: number
  incompleteReasonsBreakdown: Record<string, number>
}

export interface LaborDistributionMetric {
  sampleSize: number
  medianMinutes: number | null
  p90Minutes: number | null
  targetMinutes: number | null
  targetStatistic: 'median' | null
  withinTarget: boolean | null
}

interface ObservationWindow {
  eligible: number
  mature: number
  pending: number
}

export interface PilotMaturityReport {
  enrolled28d: ObservationWindow
  invited7d: ObservationWindow
  delivered14d: ObservationWindow
}

/** All totals are cents. Missing inputs make derived costs/contributions null, never assumed zero. */
export interface PilotUnitEconomicsReport {
  complete: boolean
  status: 'complete' | 'incomplete'
  incompleteCostHouseholds: number
  totalHouseholds: number
  paidHouseholds: number
  completedHouseholds: number
  incompleteHouseholds: number
  refundedHouseholds: number
  grossRevenueCents: number
  refundedCents: number
  netRevenueCents: number
  paymentProcessingFeeCents: number
  aiAndStorageCostCents: number
  laborCostCents: number | null
  acquisitionCostCents: number | null
  fulfillmentCostCents: number | null
  hostingReserveCents: number | null
  fixedCostAllocationCents: number | null
  totalVariableCostCents: number | null
  totalCostCents: number | null
  contributionBeforeAcquisitionCents: number | null
  contributionAfterAcquisitionCents: number | null
  totalContributionCents: number | null
  contributionPerPaidHouseholdCents: number | null
  contributionPerCompletedHouseholdCents: number | null
  costDisclosure: {
    hourlyRate: 'explicit_per_household'
    acquisition: 'included' | 'incomplete'
    fulfillment: 'included' | 'incomplete'
    hostingReserve: 'included' | 'incomplete'
    fixedAllocation: 'included' | 'incomplete'
    familyRevision: 'reported_minutes_not_monetized'
  }
}

export interface PilotSegmentReport extends PilotResponseReport, PilotQualityReport {
  households: number
  paidHouseholds: number
  maturity: PilotMaturityReport
  effectiveActivationAll: RatioMetric
  effectiveActivationSelfServe: RatioMetric
  effectiveActivationAssisted: RatioMetric
  firstOutcomeWithin7d: RatioMetric
  completionWithin28dStartedPaid: RatioMetric
  completionWithin28dAllPaid: RatioMetric
  replayWithin14dPostDelivery: RatioMetric
  selfReportedReplayWithin14dPostDelivery: RatioMetric
  familyRevisionLabor: LaborDistributionMetric
  familyRevisionPerStoryLabor: LaborDistributionMetric
  opsSupportLabor: LaborDistributionMetric
  unitEconomics: PilotUnitEconomicsReport
}

export type G4RecommendationCode =
  | 'expand_channel'
  | 'optimize_workflow_or_higher_tier'
  | 'retest_packaging_and_pricing'
  | 'narrow_or_pivot'
  | 'blocked_by_incident_or_immature_window'

export interface G4DecisionReport extends PilotResponseReport, PilotQualityReport {
  evaluatedAt: string
  observationKind: Exclude<PilotObservationKind, 'unclassified'>
  cohortKey: string | null
  cohortClosedAt: string | null
  cohortSeparationVerified: boolean
  countsByCohort: Record<PilotCohortType, number>
  countsByPricingTier: Record<PilotPricingTier, number>
  countsByObservationKind: Record<PilotObservationKind, number>
  selectedLongitudinalHouseholds: number
  uniqueLongitudinalHouseholds: number
  paid59Households: number
  erasedHouseholds: number
  maturity: PilotMaturityReport
  blockingReasons: string[]
  effectiveActivationAll: RatioMetric
  effectiveActivationSelfServe: RatioMetric
  effectiveActivationAssisted: RatioMetric
  firstOutcomeWithin7d: RatioMetric
  completionWithin28dStartedPaid: RatioMetric
  completionWithin28dAllPaid: RatioMetric
  replayWithin14dPostDelivery: RatioMetric
  selfReportedReplayWithin14dPostDelivery: RatioMetric
  familyRevisionLabor: LaborDistributionMetric
  familyRevisionPerStoryLabor: LaborDistributionMetric
  opsSupportLabor: LaborDistributionMetric
  unitEconomicsPaidCohort: PilotUnitEconomicsReport
  unitEconomicsAllCohort: PilotUnitEconomicsReport
  perPricingTier: Record<PilotPricingTier, PilotSegmentReport>
  dimensions: Record<'productVersion' | 'acquisitionChannel' | 'country' | 'supportMode' | 'materialEntryMode', Record<string, PilotSegmentReport>>
  severeDataIncidentsTotal: number
  g4GateReady: boolean
  simulationReady: boolean
  recommendation: {
    code: G4RecommendationCode
    rationale: string
    requiresOwnerDecision: true
  }
}

const DAY_MS = 24 * 60 * 60 * 1000
const PRICING_TIERS: PilotPricingTier[] = ['free', 'half_price', 'subsidized', 'paid_59']
const MONEY_FIELDS = [
  'paidAmountCents', 'refundedAmountCents', 'paymentFeeCents', 'aiAndStorageCostCents',
  'acquisitionCostCents', 'fulfillmentCostCents', 'hostingReserveCents',
  'fixedCostAllocationCents', 'opsHourlyRateCents',
] as const
const OPTIONAL_COST_FIELDS = [
  'acquisitionCostCents', 'fulfillmentCostCents', 'hostingReserveCents',
  'fixedCostAllocationCents', 'opsHourlyRateCents',
] as const
const QUALITY_FIELDS = [
  'reviewedClaims', 'incorrectClaims', 'invalidSourceClaims', 'seededErrors',
  'detectedSeededErrors', 'negativeClaims', 'falsePositiveClaims', 'unresolvedSevereErrors',
] as const

type EventField = 'enrolledAt' | 'inviteSentAt' | 'inviteAcceptedAt' | 'consentedAt' | 'firstRecordingSavedAt'
  | 'firstApprovedDownloadAt' | 'projectCompletedAt' | 'deliveredAt' | 'replayedWithin14dAt'
  | 'selfReportedReplayAt' | 'withdrawnAt'

interface AssessedEntry {
  entry: PilotHouseholdEntry
  times: Record<EventField, number | null>
  invalidChronology: boolean
  invalidMeasurements: boolean
  costsComplete: boolean
  laborComplete: boolean
  qualityComplete: boolean
  qualityValid: boolean
  paid: boolean
}

function isNonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isCents(value: unknown): value is number {
  return isNonnegative(value) && Number.isSafeInteger(value)
}

function timestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const parts = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value)
  if (!parts) return null
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = parts
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  // Date.parse silently normalizes dates such as February 29 in a non-leap year.
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1] ||
      (hourText !== undefined && (Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59))) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function observationKind(entry: PilotHouseholdEntry): PilotObservationKind {
  return entry.observationKind === 'observed' || entry.observationKind === 'synthetic'
    ? entry.observationKind : 'unclassified'
}

function makeRatio(numerator: number, denominator: number): RatioMetric {
  return denominator > 0
    ? { numerator, denominator, proportion: Number((numerator / denominator).toFixed(4)), status: 'measured' }
    : { numerator: 0, denominator: 0, proportion: null, status: 'insufficient_sample' }
}

function reaches(metric: RatioMetric, threshold: number): boolean {
  // Decide on the counts, not the rounded display proportion.
  return metric.denominator > 0 && metric.numerator / metric.denominator >= threshold
}

function computeLaborMetric(values: readonly number[], targetMinutes: number | null): LaborDistributionMetric {
  const sorted = values.filter(isNonnegative).sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const median = sorted.length === 0 ? null : sorted.length % 2
    ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  const p90 = sorted.length ? sorted[Math.ceil(sorted.length * 0.9) - 1] : null
  return {
    sampleSize: sorted.length,
    medianMinutes: median === null ? null : Number(median.toFixed(2)),
    p90Minutes: p90 === null ? null : Number(p90.toFixed(2)),
    targetMinutes,
    targetStatistic: targetMinutes === null ? null : 'median',
    withinTarget: median === null || targetMinutes === null ? null : median <= targetMinutes,
  }
}

function assessEntry(entry: PilotHouseholdEntry, asOfMs: number): AssessedEntry {
  let invalidChronology = false
  const parsed = (field: EventField): number | null => {
    const value = entry[field]
    if (value === null || value === undefined) return null
    const ms = timestamp(value)
    if (ms === null || ms > asOfMs) {
      invalidChronology = true
      return null
    }
    return ms
  }
  const enrolledAt = parsed('enrolledAt')
  if (enrolledAt === null) invalidChronology = true
  const rawWithdrawal = parsed('withdrawnAt')
  const withdrawnAt = rawWithdrawal !== null && enrolledAt !== null && rawWithdrawal >= enrolledAt
    ? rawWithdrawal : null
  if (rawWithdrawal !== null && withdrawnAt === null) invalidChronology = true

  const event = (field: EventField, prerequisite: number | null): number | null => {
    const ms = parsed(field)
    if (ms === null) return null
    if (enrolledAt === null || ms < enrolledAt || prerequisite === null || ms < prerequisite ||
        (withdrawnAt !== null && ms > withdrawnAt)) {
      invalidChronology = true
      return null
    }
    return ms
  }
  const inviteSentAt = event('inviteSentAt', enrolledAt)
  const inviteAcceptedAt = event('inviteAcceptedAt', inviteSentAt)
  // Consent may have been obtained at recruitment before enrollment, but must precede saving material.
  const consentedAt = parsed('consentedAt')
  const firstRecordingSavedAt = event('firstRecordingSavedAt',
    inviteAcceptedAt !== null && consentedAt !== null ? Math.max(inviteAcceptedAt, consentedAt) : null)
  const firstApprovedDownloadAt = event('firstApprovedDownloadAt', firstRecordingSavedAt)
  const projectCompletedAt = event('projectCompletedAt', firstApprovedDownloadAt)
  const deliveredAt = event('deliveredAt', projectCompletedAt)
  const replayedWithin14dAt = event('replayedWithin14dAt', deliveredAt)
  const selfReportedReplayAt = event('selfReportedReplayAt', deliveredAt)

  const requiredMoneyValid = MONEY_FIELDS.every(field =>
    OPTIONAL_COST_FIELDS.some(optional => optional === field) && entry[field] == null
      ? true : isCents(entry[field]))
  const stories = entry.familyRevisionStoryMinutes
  const storyMeasurementsValid = stories === undefined ||
    (Array.isArray(stories) && stories.every(isNonnegative))
  const storyTotal = Array.isArray(stories) ? stories.reduce((total, value) => total + value, 0) : Number.NaN
  const reconciliationTolerance = 0.01 + Number.EPSILON * Math.max(1, Math.abs(storyTotal), Math.abs(entry.familyRevisionMinutes))
  const storyTotalMatches = Array.isArray(stories) && stories.every(isNonnegative) &&
    Math.abs(storyTotal - entry.familyRevisionMinutes) <= reconciliationTolerance
  const priceMatches = entry.pricingTier !== 'paid_59' || entry.paidAmountCents === 0 || entry.paidAmountCents === 5900
  const countValid = (value: unknown) => value == null || isCents(value)
  const npsValid = entry.npsScore == null || (Number.isInteger(entry.npsScore) && entry.npsScore >= 0 && entry.npsScore <= 10)
  const invalidMeasurements = !requiredMoneyValid || !isNonnegative(entry.familyRevisionMinutes) ||
    !isNonnegative(entry.opsSupportMinutes) || !storyMeasurementsValid || !npsValid ||
    !countValid(entry.referralsCount) || !countValid(entry.severeDataIncidents) ||
    (entry.wouldRecommend != null && typeof entry.wouldRecommend !== 'boolean') ||
    entry.refundedAmountCents > entry.paidAmountCents || !priceMatches ||
    (Array.isArray(stories) && !storyTotalMatches)
  const costsComplete = entry.costsComplete === true && entry.evidenceComplete === true &&
    MONEY_FIELDS.every(field => isCents(entry[field])) && isNonnegative(entry.opsSupportMinutes) &&
    entry.refundedAmountCents <= entry.paidAmountCents && priceMatches && entry.opsSupportMeasured !== false
  const laborComplete = isNonnegative(entry.familyRevisionMinutes) && isNonnegative(entry.opsSupportMinutes) &&
    entry.familyRevisionMeasured !== false && entry.opsSupportMeasured !== false &&
    Array.isArray(stories) && stories.every(isNonnegative) && storyTotalMatches &&
    (!(entry.firstApprovedDownloadAt || entry.familyRevisionMinutes > 0) || stories.length > 0)
  const quality = entry.quality
  const qualityValid = quality !== undefined && quality !== null &&
    QUALITY_FIELDS.every(field => isCents(quality[field])) &&
    quality.detectedSeededErrors <= quality.seededErrors && quality.falsePositiveClaims <= quality.negativeClaims &&
    quality.incorrectClaims <= quality.reviewedClaims && quality.invalidSourceClaims <= quality.reviewedClaims
  const qualityComplete = qualityValid && (!entry.firstApprovedDownloadAt || quality!.reviewedClaims > 0)

  return {
    entry,
    times: { enrolledAt, withdrawnAt, inviteSentAt, inviteAcceptedAt, consentedAt, firstRecordingSavedAt,
      firstApprovedDownloadAt, projectCompletedAt, deliveredAt, replayedWithin14dAt, selfReportedReplayAt },
    invalidChronology,
    invalidMeasurements,
    costsComplete,
    laborComplete,
    qualityComplete,
    qualityValid,
    paid: entry.evidenceComplete === true && isCents(entry.paidAmountCents) && entry.paidAmountCents > 0,
  }
}

function mature(time: number | null, days: number, asOfMs: number): boolean {
  return time !== null && asOfMs - time >= days * DAY_MS
}

function within(start: number | null, end: number | null, days: number): boolean {
  return start !== null && end !== null && end >= start && end - start <= days * DAY_MS
}

function firstOutcomeBaseline(entry: AssessedEntry): number | null {
  // Uninvited roster members remain in the denominator; only a valid sent invitation can begin a success window.
  return entry.entry.inviteSentAt == null ? entry.times.enrolledAt : entry.times.inviteSentAt
}

function makeMaturity(entries: readonly AssessedEntry[], asOfMs: number): PilotMaturityReport {
  const window = (field: EventField, days: number, required = false): ObservationWindow => {
    const eligible = entries.filter(e => required || e.entry[field] != null)
    const matureCount = eligible.filter(e => mature(e.times[field], days, asOfMs)).length
    return { eligible: eligible.length, mature: matureCount, pending: eligible.length - matureCount }
  }
  return {
    enrolled28d: window('enrolledAt', 28, true),
    invited7d: {
      eligible: entries.length,
      mature: entries.filter(e => mature(firstOutcomeBaseline(e), 7, asOfMs)).length,
      pending: entries.filter(e => !mature(firstOutcomeBaseline(e), 7, asOfMs)).length,
    },
    delivered14d: window('deliveredAt', 14),
  }
}

/** Independent from the legacy entitlement helper, whose implicit hourly rate is unsuitable for evidence. */
function computeEconomics(entries: readonly AssessedEntry[]): PilotUnitEconomicsReport {
  const sum = (field: typeof MONEY_FIELDS[number]) => entries.reduce((total, e) =>
    total + (isCents(e.entry[field]) ? e.entry[field] : 0), 0)
  const costSum = (field: typeof OPTIONAL_COST_FIELDS[number]): number | null =>
    entries.every(e => isCents(e.entry[field])) ? sum(field) : null
  const incompleteCostHouseholds = entries.filter(e => !e.costsComplete).length
  const complete = incompleteCostHouseholds === 0
  const grossRevenueCents = sum('paidAmountCents')
  const refundedCents = sum('refundedAmountCents')
  const netRevenueCents = grossRevenueCents - refundedCents
  const paymentProcessingFeeCents = sum('paymentFeeCents')
  const aiAndStorageCostCents = sum('aiAndStorageCostCents')
  const laborCostCents = entries.every(e => e.entry.opsSupportMeasured !== false && isCents(e.entry.opsHourlyRateCents) && isNonnegative(e.entry.opsSupportMinutes))
    ? entries.reduce((total, e) => total + Math.round(e.entry.opsSupportMinutes * e.entry.opsHourlyRateCents! / 60), 0) : null
  const acquisitionCostCents = costSum('acquisitionCostCents')
  const fulfillmentCostCents = costSum('fulfillmentCostCents')
  const hostingReserveCents = costSum('hostingReserveCents')
  const fixedCostAllocationCents = costSum('fixedCostAllocationCents')
  const totalVariableCostCents = complete
    ? paymentProcessingFeeCents + aiAndStorageCostCents + laborCostCents! + acquisitionCostCents! + fulfillmentCostCents! + hostingReserveCents! : null
  const totalCostCents = complete ? totalVariableCostCents! + fixedCostAllocationCents! : null
  const totalContributionCents = complete ? netRevenueCents - totalCostCents! : null
  const paidHouseholds = entries.filter(e => e.paid).length
  const completedHouseholds = entries.filter(e => e.times.projectCompletedAt !== null).length
  const inclusion = (value: number | null) => value === null || !complete ? 'incomplete' as const : 'included' as const
  return {
    complete,
    status: complete ? 'complete' : 'incomplete',
    incompleteCostHouseholds,
    totalHouseholds: entries.length,
    paidHouseholds,
    completedHouseholds,
    incompleteHouseholds: entries.length - completedHouseholds,
    refundedHouseholds: entries.filter(e => isCents(e.entry.refundedAmountCents) && e.entry.refundedAmountCents > 0).length,
    grossRevenueCents, refundedCents, netRevenueCents,
    paymentProcessingFeeCents, aiAndStorageCostCents, laborCostCents, acquisitionCostCents,
    fulfillmentCostCents, hostingReserveCents, fixedCostAllocationCents, totalVariableCostCents,
    totalCostCents, totalContributionCents,
    contributionBeforeAcquisitionCents: complete ? totalContributionCents! + acquisitionCostCents! : null,
    contributionAfterAcquisitionCents: totalContributionCents,
    contributionPerPaidHouseholdCents: totalContributionCents !== null && paidHouseholds > 0
      ? Math.round(totalContributionCents / paidHouseholds) : null,
    contributionPerCompletedHouseholdCents: totalContributionCents !== null && completedHouseholds > 0
      ? Math.round(totalContributionCents / completedHouseholds) : null,
    costDisclosure: {
      hourlyRate: 'explicit_per_household',
      acquisition: inclusion(acquisitionCostCents), fulfillment: inclusion(fulfillmentCostCents),
      hostingReserve: inclusion(hostingReserveCents), fixedAllocation: inclusion(fixedCostAllocationCents),
      familyRevision: 'reported_minutes_not_monetized',
    },
  }
}

function responseReport(entries: readonly AssessedEntry[]): PilotResponseReport {
  const npsEntries = entries.filter(e => e.entry.evidenceComplete === true && Number.isInteger(e.entry.npsScore) && e.entry.npsScore! >= 0 && e.entry.npsScore! <= 10)
  const promoters = npsEntries.filter(e => e.entry.npsScore! >= 9).length
  const detractors = npsEntries.filter(e => e.entry.npsScore! <= 6).length
  const recommendRespondents = entries.filter(e => e.entry.evidenceComplete === true && typeof e.entry.wouldRecommend === 'boolean')
  const incompleteReasonsBreakdown = Object.create(null) as Record<string, number>
  for (const e of entries) {
    if (e.times.projectCompletedAt === null && e.entry.incompleteReason) {
      incompleteReasonsBreakdown[e.entry.incompleteReason] = (incompleteReasonsBreakdown[e.entry.incompleteReason] ?? 0) + 1
    }
  }
  return {
    npsScore: npsEntries.length ? Math.round(((promoters - detractors) / npsEntries.length) * 100) : null,
    npsResponseCount: npsEntries.length,
    npsMissingCount: entries.length - npsEntries.length,
    wouldRecommendRate: makeRatio(recommendRespondents.filter(e => e.entry.wouldRecommend).length, recommendRespondents.length),
    recommendResponseCount: recommendRespondents.length,
    recommendMissingCount: entries.length - recommendRespondents.length,
    totalReferrals: entries.reduce((total, e) => total + (e.entry.evidenceComplete === true && isCents(e.entry.referralsCount) ? e.entry.referralsCount : 0), 0),
    incompleteReasonsBreakdown,
  }
}

function qualityReport(entries: readonly AssessedEntry[]): PilotQualityReport {
  const qualityTotals = Object.fromEntries(QUALITY_FIELDS.map(field => [field, entries.reduce((total, e) =>
    total + (isCents(e.entry.quality?.[field]) ? e.entry.quality[field] : 0), 0)])) as unknown as PilotQualityEvidence
  const qualityMetrics = {
    reviewedClaimErrorRate: makeRatio(qualityTotals.incorrectClaims, qualityTotals.reviewedClaims),
    invalidSourceRate: makeRatio(qualityTotals.invalidSourceClaims, qualityTotals.reviewedClaims),
    seededErrorDetectionRate: makeRatio(qualityTotals.detectedSeededErrors, qualityTotals.seededErrors),
    falsePositiveRate: makeRatio(qualityTotals.falsePositiveClaims, qualityTotals.negativeClaims),
  }
  return {
    qualityTotals,
    qualityMetrics,
    incorrectClaimsPer100: qualityTotals.reviewedClaims > 0
      ? Number((qualityTotals.incorrectClaims / qualityTotals.reviewedClaims * 100).toFixed(2)) : null,
    invalidSourceClaimsPer100: qualityTotals.reviewedClaims > 0
      ? Number((qualityTotals.invalidSourceClaims / qualityTotals.reviewedClaims * 100).toFixed(2)) : null,
    qualityAcceptable: entries.length > 0 && entries.every(e => e.qualityComplete && e.entry.qualityReviewed === true && e.entry.evidenceComplete === true) &&
      qualityTotals.reviewedClaims > 0 && qualityTotals.seededErrors >= 200 && qualityTotals.negativeClaims >= 200 &&
      qualityTotals.incorrectClaims === 0 && qualityTotals.invalidSourceClaims === 0 && qualityTotals.unresolvedSevereErrors === 0 &&
      reaches(qualityMetrics.seededErrorDetectionRate, 0.95) && qualityTotals.falsePositiveClaims / qualityTotals.negativeClaims <= 0.1,
  }
}

function segmentReport(entries: readonly AssessedEntry[], asOfMs: number): PilotSegmentReport {
  const invited = entries.filter(e => e.times.inviteAcceptedAt !== null)
  const activation = (list: readonly AssessedEntry[]) => makeRatio(
    list.filter(e => e.times.firstRecordingSavedAt !== null && e.entry.evidenceComplete === true).length, list.length)
  const matureFirstOutcome = entries.filter(e => mature(firstOutcomeBaseline(e), 7, asOfMs))
  const paid = entries.filter(e => e.paid)
  const maturePaid = paid.filter(e => mature(e.times.enrolledAt, 28, asOfMs))
  const startedPaid = maturePaid.filter(e => e.times.firstRecordingSavedAt !== null)
  const completion = (list: readonly AssessedEntry[]) => makeRatio(
    list.filter(e => within(e.times.enrolledAt, e.times.projectCompletedAt, 28)).length, list.length)
  const matureDelivered = entries.filter(e => mature(e.times.deliveredAt, 14, asOfMs))
  const replay = (field: 'replayedWithin14dAt' | 'selfReportedReplayAt') => makeRatio(
    matureDelivered.filter(e => e.entry.evidenceComplete === true && within(e.times.deliveredAt, e.times[field], 14)).length,
    matureDelivered.length)
  return {
    ...responseReport(entries),
    ...qualityReport(entries),
    households: entries.length,
    paidHouseholds: paid.length,
    maturity: makeMaturity(entries, asOfMs),
    effectiveActivationAll: activation(invited),
    effectiveActivationSelfServe: activation(invited.filter(e => e.entry.supportMode === 'self_serve')),
    effectiveActivationAssisted: activation(invited.filter(e => e.entry.supportMode === 'family_assisted')),
    firstOutcomeWithin7d: makeRatio(matureFirstOutcome.filter(e => e.entry.evidenceComplete === true &&
      within(e.times.inviteSentAt, e.times.firstApprovedDownloadAt, 7)).length, matureFirstOutcome.length),
    completionWithin28dStartedPaid: completion(startedPaid),
    completionWithin28dAllPaid: completion(maturePaid),
    replayWithin14dPostDelivery: replay('replayedWithin14dAt'),
    selfReportedReplayWithin14dPostDelivery: replay('selfReportedReplayAt'),
    familyRevisionLabor: computeLaborMetric(entries.filter(e => e.entry.familyRevisionMeasured !== false).map(e => e.entry.familyRevisionMinutes), null),
    familyRevisionPerStoryLabor: computeLaborMetric(entries.flatMap(e =>
      e.entry.familyRevisionMeasured !== false && Array.isArray(e.entry.familyRevisionStoryMinutes) ? e.entry.familyRevisionStoryMinutes : []), 10),
    opsSupportLabor: computeLaborMetric(entries.filter(e => e.entry.opsSupportMeasured !== false).map(e => e.entry.opsSupportMinutes), 30),
    unitEconomics: computeEconomics(entries),
  }
}

/**
 * Evaluate one closed longitudinal batch per plan §7.1, §10.2 and §10.3.
 * Withdrawn/incomplete households stay in the roster. Unclassified data cannot prove a real trial.
 * The server validates receipts and evidence references; this function never infers a payment or replay.
 */
export function evaluatePilotCohortMetrics(
  entries: readonly PilotHouseholdEntry[],
  options: PilotEvaluationOptions = {},
): G4DecisionReport {
  const asOfIso = options.asOf ?? new Date().toISOString()
  const asOfMs = timestamp(asOfIso)
  if (asOfMs === null) throw new Error('Invalid asOf date')
  const selectedKind = options.observationKind ?? 'observed'
  if (selectedKind !== 'observed' && selectedKind !== 'synthetic') throw new Error('Invalid observationKind')
  const erasedHouseholds = options.erasedHouseholds ?? 0
  if (!isCents(erasedHouseholds)) throw new Error('Invalid erasedHouseholds count')

  const batchEntries = options.cohortKey === undefined ? entries : entries.filter(e => e.cohortKey === options.cohortKey)
  const countsByCohort = { prototype_study: 0, ai_eval_holdout: 0, longitudinal_pilot: 0 }
  const countsByPricingTier = { free: 0, half_price: 0, subsidized: 0, paid_59: 0 }
  const countsByObservationKind = { observed: 0, synthetic: 0, unclassified: 0 }
  for (const entry of batchEntries) {
    countsByObservationKind[observationKind(entry)] += 1
    if (entry.cohortType in countsByCohort) countsByCohort[entry.cohortType] += 1
    if (observationKind(entry) === selectedKind && entry.pricingTier in countsByPricingTier) countsByPricingTier[entry.pricingTier] += 1
  }
  const pilot = batchEntries.filter(e => e.cohortType === 'longitudinal_pilot' && observationKind(e) === selectedKind)
    .map(e => assessEntry(e, asOfMs))
  const batchKeys = new Set(pilot.map(e => e.entry.cohortKey).filter((key): key is string => typeof key === 'string' && key.trim().length > 0))
  const cohortKey = options.cohortKey ?? (batchKeys.size === 1 ? [...batchKeys][0] : null)
  const householdKeys = pilot.map(e => e.entry.householdKey).filter((key): key is string => typeof key === 'string' && key.trim().length > 0)
  const uniqueLongitudinalHouseholds = new Set(householdKeys).size
  const all = segmentReport(pilot, asOfMs)
  const hasApprovedOutcome = pilot.some(e => e.times.firstApprovedDownloadAt !== null)
  const perPricingTier = Object.fromEntries(PRICING_TIERS.map(tier =>
    [tier, segmentReport(pilot.filter(e => e.entry.pricingTier === tier), asOfMs)])) as Record<PilotPricingTier, PilotSegmentReport>
  const paid59 = pilot.filter(e => e.entry.pricingTier === 'paid_59' && e.paid && e.entry.paidAmountCents === 5900)
  const paid59Metrics = segmentReport(paid59, asOfMs)
  const dimensionReport = (field: 'productVersion' | 'acquisitionChannel' | 'country' | 'supportMode' | 'materialEntryMode') => {
    const groups = new Map<string, AssessedEntry[]>()
    for (const entry of pilot) {
      const value = entry.entry[field] ?? 'unclassified'
      const group = groups.get(value) ?? []
      group.push(entry)
      groups.set(value, group)
    }
    return Object.fromEntries([...groups].map(([value, group]) => [value, segmentReport(group, asOfMs)]))
  }
  const severeDataIncidentsTotal = pilot.reduce((total, e) =>
    total + (isCents(e.entry.severeDataIncidents) ? e.entry.severeDataIncidents : 0), 0)
  const closedMs = timestamp(options.cohortClosedAt)
  const blockingReasons: string[] = []
  const block = (condition: boolean, reason: string) => { if (condition) blockingReasons.push(reason) }
  block(batchKeys.size > 1, 'mixed_cohorts')
  block(!cohortKey || pilot.some(e => !e.entry.cohortKey?.trim()), 'missing_cohort_keys')
  block(batchEntries.some(e => e.cohortType === 'longitudinal_pilot' && observationKind(e) === 'unclassified'), 'unclassified_observations')
  block(householdKeys.length !== pilot.length, 'missing_household_keys')
  block(householdKeys.length !== uniqueLongitudinalHouseholds, 'duplicate_households')
  block(uniqueLongitudinalHouseholds < 20, 'insufficient_longitudinal_households')
  block(closedMs === null || closedMs > asOfMs, 'cohort_not_closed')
  block(closedMs !== null && pilot.some(e => e.times.enrolledAt !== null && e.times.enrolledAt > closedMs), 'enrollment_after_cohort_close')
  block(erasedHouseholds > 0, 'erased_households_require_owner_review')
  block(pilot.some(e => e.invalidChronology), 'invalid_event_chronology')
  block(pilot.some(e => e.invalidMeasurements), 'invalid_measurements')
  block(pilot.some(e => !PRICING_TIERS.includes(e.entry.pricingTier) ||
    !['self_serve', 'family_assisted'].includes(e.entry.supportMode) ||
    !e.entry.productVersion?.trim() || !e.entry.acquisitionChannel?.trim() || !e.entry.country?.trim()), 'invalid_dimensions')
  block(pilot.some(e => e.entry.evidenceComplete !== true ||
    (e.entry.materialEntryMode !== 'new_recording' && e.entry.materialEntryMode !== 'existing_audio')), 'incomplete_evidence')
  block(pilot.some(e => e.entry.qualityReviewed !== true), 'quality_not_reviewed')
  block(pilot.some(e => !e.qualityComplete), 'incomplete_quality_evidence')
  block(pilot.some(e => e.entry.quality !== undefined && !e.qualityValid), 'invalid_quality_evidence')
  // A fully observed refusal/no-start cohort has no output to audit; do not invent quality samples or wait forever.
  block(hasApprovedOutcome && (all.qualityTotals.seededErrors < 200 || all.qualityTotals.negativeClaims < 200 || all.qualityTotals.reviewedClaims === 0), 'insufficient_quality_sample')
  block(all.qualityTotals.unresolvedSevereErrors > 0, 'unresolved_severe_quality_errors')
  block(pilot.some(e => !e.laborComplete), 'incomplete_labor_evidence')
  block(!all.unitEconomics.complete, 'incomplete_costs')
  block(severeDataIncidentsTotal > 0, 'unresolved_severe_incidents')
  block(all.maturity.enrolled28d.pending > 0, 'immature_enrollment_window')
  block(all.maturity.invited7d.pending > 0, 'immature_invitation_window')
  block(all.maturity.delivered14d.pending > 0, 'immature_delivery_window')

  const ready = blockingReasons.length === 0
  let code: G4RecommendationCode
  let rationale: string
  const strongFirstOutcome = reaches(all.firstOutcomeWithin7d, 0.8)
  const strongPaidOutcome = reaches(paid59Metrics.firstOutcomeWithin7d, 0.8)
  const strongCompletion = reaches(paid59Metrics.completionWithin28dStartedPaid, 0.7)
  const strongAllPaidCompletion = reaches(paid59Metrics.completionWithin28dAllPaid, 0.7)
  const laborWithinTarget = all.familyRevisionPerStoryLabor.withinTarget === true && all.opsSupportLabor.withinTarget === true
  if (!ready) {
    code = 'blocked_by_incident_or_immature_window'
    rationale = `Decision evidence is incomplete: ${blockingReasons.join(', ')}.`
  } else if (!hasApprovedOutcome) {
    code = 'narrow_or_pivot'
    rationale = 'No approved outcome was obtained in the complete mature roster. Review refusals, activation friction and task demand before choosing a narrower scope or a different offer; zero quality observations do not prove quality.'
  } else if (!all.qualityAcceptable) {
    code = 'narrow_or_pivot'
    rationale = 'The complete quality evaluation has incorrect claims, invalid sources or detection/false-positive rates outside target. Resolve those quality failures before choosing expansion or a different offer.'
  } else if (strongFirstOutcome && paid59.length < 12) {
    code = 'retest_packaging_and_pricing'
    rationale = 'The mature roster has first outcomes >=80%, but fewer than 12 verified full-price paid households. Retest packaging and pricing; insufficient payment is an observed result.'
  } else if (strongFirstOutcome && strongPaidOutcome && strongCompletion && strongAllPaidCompletion && !laborWithinTarget) {
    code = 'optimize_workflow_or_higher_tier'
    rationale = 'First outcomes and paid completion meet targets, but per-story family revision or per-household operations labor exceeds its median target. Improve the workflow or test a higher service tier.'
  } else if (paid59.length >= 12 && strongFirstOutcome && strongPaidOutcome && strongCompletion && strongAllPaidCompletion &&
      laborWithinTarget && (all.unitEconomics.totalContributionCents ?? 0) > 0) {
    code = 'expand_channel'
    rationale = 'At least 12 verified US$59 paid households, first outcomes >=80%, started-paid and all-paid completion >=70%, measured quality targets, labor targets and positive full-batch contribution support testing one expanded channel.'
  } else {
    code = 'narrow_or_pivot'
    rationale = 'Mature outcomes or full-batch contribution do not support expansion. Review task demand, workflow friction and costs before choosing a narrower scope or a different offer.'
  }
  if (selectedKind === 'synthetic') rationale = `Synthetic scenario only; not observed market evidence. ${rationale}`

  return {
    ...responseReport(pilot),
    ...qualityReport(pilot),
    evaluatedAt: asOfIso,
    observationKind: selectedKind,
    cohortKey,
    cohortClosedAt: options.cohortClosedAt ?? null,
    cohortSeparationVerified: batchKeys.size === 1 && !pilot.some(e => !e.entry.cohortKey?.trim()),
    countsByCohort, countsByPricingTier, countsByObservationKind,
    selectedLongitudinalHouseholds: pilot.length,
    uniqueLongitudinalHouseholds,
    paid59Households: paid59.length,
    erasedHouseholds,
    maturity: all.maturity,
    blockingReasons,
    effectiveActivationAll: all.effectiveActivationAll,
    effectiveActivationSelfServe: all.effectiveActivationSelfServe,
    effectiveActivationAssisted: all.effectiveActivationAssisted,
    firstOutcomeWithin7d: all.firstOutcomeWithin7d,
    completionWithin28dStartedPaid: paid59Metrics.completionWithin28dStartedPaid,
    completionWithin28dAllPaid: paid59Metrics.completionWithin28dAllPaid,
    replayWithin14dPostDelivery: all.replayWithin14dPostDelivery,
    selfReportedReplayWithin14dPostDelivery: all.selfReportedReplayWithin14dPostDelivery,
    familyRevisionLabor: all.familyRevisionLabor,
    familyRevisionPerStoryLabor: all.familyRevisionPerStoryLabor,
    opsSupportLabor: all.opsSupportLabor,
    unitEconomicsPaidCohort: paid59Metrics.unitEconomics,
    unitEconomicsAllCohort: all.unitEconomics,
    perPricingTier,
    dimensions: {
      productVersion: dimensionReport('productVersion'), acquisitionChannel: dimensionReport('acquisitionChannel'),
      country: dimensionReport('country'), supportMode: dimensionReport('supportMode'),
      materialEntryMode: dimensionReport('materialEntryMode'),
    },
    severeDataIncidentsTotal,
    g4GateReady: ready && selectedKind === 'observed',
    simulationReady: ready && selectedKind === 'synthetic',
    recommendation: { code, rationale, requiresOwnerDecision: true },
  }
}
