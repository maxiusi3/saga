import { z } from 'zod'
import type { PilotHouseholdEntry } from './pilot-cohort-analytics'

const code = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.:-]+$/)
const instant = z.string().datetime({ offset: true })
const optionalInstant = instant.nullable().default(null)
const minutes = z.number().finite().min(0).max(100000).nullable().default(null)
const cents = z.number().int().min(0).max(100000000).nullable().default(null)
const count = z.number().int().min(0).max(1000000)
const qualitySchema = z.object({ reviewedClaims: count, incorrectClaims: count, invalidSourceClaims: count,
  seededErrors: count, detectedSeededErrors: count, negativeClaims: count, falsePositiveClaims: count, unresolvedSevereErrors: count }).strict()
const evidenceItem = z.object({
  source: z.enum(['system_record', 'operator_record', 'interview_self_report', 'synthetic_fixture']),
  // An opaque index into the restricted evidence store, never a person's name or story content.
  reference: z.string().min(1).max(180).regex(/^[a-zA-Z0-9_.:/-]+$/),
}).strict()

const valuesSchema = z.object({
  pricingTier: z.enum(['free', 'half_price', 'subsidized', 'paid_59']),
  supportMode: z.enum(['self_serve', 'family_assisted']), acquisitionChannel: code,
  materialEntryMode: z.enum(['new_recording', 'existing_audio']).optional(),
  country: z.string().regex(/^[A-Z]{2}$/), productVersion: code, enrolledAt: instant,
  inviteSentAt: optionalInstant, inviteAcceptedAt: optionalInstant, consentedAt: optionalInstant, firstRecordingSavedAt: optionalInstant,
  firstApprovedDownloadAt: optionalInstant, projectCompletedAt: optionalInstant, deliveredAt: optionalInstant,
  replayedWithin14dAt: optionalInstant, selfReportedReplayAt: optionalInstant, withdrawnAt: optionalInstant,
  incompleteReason: code.nullable().default(null), familyRevisionMinutes: minutes, opsSupportMinutes: minutes,
  paidAmountCents: cents, refundedAmountCents: cents, paymentFeeCents: cents, aiAndStorageCostCents: cents,
  opsHourlyRateCents: cents, acquisitionCostCents: cents, fulfillmentCostCents: cents, hostingReserveCents: cents,
  fixedCostAllocationCents: cents, familyRevisionStoryMinutes: z.array(z.number().finite().min(0).max(100000)).max(10000).default([]),
  qualityReviewed: z.boolean().default(false), npsScore: z.number().int().min(0).max(10).nullable().default(null),
  quality: qualitySchema.optional(),
  wouldRecommend: z.boolean().nullable().default(null), referralsCount: z.number().int().min(0).max(10000).nullable().default(null),
  severeDataIncidents: z.number().int().min(0).max(10000).nullable().default(null),
}).strict()

const identity = {
  requestId: z.string().uuid(), cohortKey: code, observationKind: z.enum(['observed', 'synthetic']),
  recordedBy: code, reason: code,
} as const
const recordSchema = z.object({
  ...identity, action: z.literal('record'), householdId: z.string().uuid(), householdKey: z.string().uuid(),
  projectId: z.string().uuid(), cohortType: z.enum(['prototype_study', 'ai_eval_holdout', 'longitudinal_pilot']),
  expectedRevision: z.number().int().min(0).max(100000), values: valuesSchema,
  evidence: z.record(z.string(), evidenceItem),
}).strict()
const commandSchema = z.discriminatedUnion('action', [recordSchema, z.object({ ...identity, action: z.literal('close_cohort') }).strict()])
export type PilotObservation = z.infer<typeof recordSchema>
export type PilotLedgerCommand = z.infer<typeof commandSchema>

const times = ['inviteSentAt', 'inviteAcceptedAt', 'consentedAt', 'firstRecordingSavedAt', 'firstApprovedDownloadAt', 'projectCompletedAt', 'deliveredAt', 'replayedWithin14dAt', 'selfReportedReplayAt', 'withdrawnAt'] as const
const measurements = ['familyRevisionMinutes', 'opsSupportMinutes', 'paidAmountCents', 'refundedAmountCents', 'paymentFeeCents', 'aiAndStorageCostCents', 'opsHourlyRateCents', 'acquisitionCostCents', 'fulfillmentCostCents', 'hostingReserveCents', 'fixedCostAllocationCents', 'npsScore', 'wouldRecommend', 'referralsCount', 'severeDataIncidents'] as const
const costFields = ['opsSupportMinutes', 'paidAmountCents', 'refundedAmountCents', 'paymentFeeCents', 'aiAndStorageCostCents', 'opsHourlyRateCents', 'acquisitionCostCents', 'fulfillmentCostCents', 'hostingReserveCents', 'fixedCostAllocationCents'] as const

export function parsePilotObservation(input: unknown, now = new Date()): PilotLedgerCommand {
  const command = commandSchema.parse(input)
  if (command.action !== 'record') return command
  const { values: v, evidence: proof } = command
  const fail = () => { throw new Error('Invalid pilot observation or evidence') }
  const enrolled = Date.parse(v.enrolledAt)
  if (enrolled > now.getTime()) fail()
  const proofFields = new Set<string>(['enrollment', ...times, ...measurements, 'qualityReviewed', 'quality', 'familyRevisionStoryMinutes', 'incompleteReason'])
  for (const [key, evidence] of Object.entries(proof)) {
    if (!proofFields.has(key)) fail()
    if (command.observationKind === 'synthetic' && evidence.source !== 'synthetic_fixture') fail()
    if (command.observationKind === 'observed' && (evidence.source === 'synthetic_fixture' || /^(fixture|synthetic|test):/.test(evidence.reference))) fail()
  }
  if (!proof.enrollment) fail()
  for (const key of [...times, ...measurements, 'incompleteReason'] as const) {
    if (v[key] !== null && !proof[key]) fail()
  }
  for (const key of times) {
    if (v[key] && ((key !== 'consentedAt' && Date.parse(v[key]) < enrolled) || Date.parse(v[key]) > now.getTime())) fail()
    if (key !== 'withdrawnAt' && v[key] && v.withdrawnAt && Date.parse(v[key]) > Date.parse(v.withdrawnAt)) fail()
  }
  for (const [later, earlier] of [
    ['inviteAcceptedAt', 'inviteSentAt'],
    ['firstRecordingSavedAt', 'consentedAt'], ['firstRecordingSavedAt', 'inviteAcceptedAt'],
    ['firstApprovedDownloadAt', 'firstRecordingSavedAt'], ['projectCompletedAt', 'firstApprovedDownloadAt'],
    ['deliveredAt', 'projectCompletedAt'], ['replayedWithin14dAt', 'deliveredAt'], ['selfReportedReplayAt', 'deliveredAt'],
  ] as const) {
    if (v[later] && (!v[earlier] || Date.parse(v[later]) < Date.parse(v[earlier]!))) fail()
  }
  if (v.refundedAmountCents !== null && (v.paidAmountCents === null || v.refundedAmountCents > v.paidAmountCents)) fail()
  if (v.pricingTier === 'paid_59' && v.paidAmountCents !== null && ![0, 5900].includes(v.paidAmountCents)) fail()
  if (v.qualityReviewed && !proof.qualityReviewed) fail()
  if (v.quality && (!proof.quality || v.quality.incorrectClaims > v.quality.reviewedClaims || v.quality.invalidSourceClaims > v.quality.reviewedClaims || v.quality.detectedSeededErrors > v.quality.seededErrors || v.quality.falsePositiveClaims > v.quality.negativeClaims)) fail()
  if (v.familyRevisionStoryMinutes.length > 0 && !proof.familyRevisionStoryMinutes) fail()
  if (v.familyRevisionMinutes !== null && Math.abs(v.familyRevisionStoryMinutes.reduce((sum, n) => sum + n, 0) - v.familyRevisionMinutes) > 0.01) fail()
  if (command.observationKind === 'observed') {
    if (v.replayedWithin14dAt && proof.replayedWithin14dAt.source !== 'system_record') fail()
    if (v.selfReportedReplayAt && proof.selfReportedReplayAt.source !== 'interview_self_report') fail()
    for (const key of ['paidAmountCents', 'refundedAmountCents'] as const) {
      if (v[key] !== null && !['system_record', 'operator_record'].includes(proof[key].source)) fail()
    }
  }
  return command
}

export function toPilotEntry(command: PilotObservation): PilotHouseholdEntry {
  const v = command.values
  const costsComplete = costFields.every(key => v[key] !== null)
  return {
    ...v, id: command.householdId, projectId: command.projectId, householdKey: command.householdKey,
    cohortKey: command.cohortKey, cohortType: command.cohortType, observationKind: command.observationKind,
    costsComplete, evidenceComplete: costsComplete && v.familyRevisionMinutes !== null && v.severeDataIncidents !== null && v.materialEntryMode !== undefined,
    familyRevisionMeasured: v.familyRevisionMinutes !== null, opsSupportMeasured: v.opsSupportMinutes !== null,
    familyRevisionMinutes: v.familyRevisionMinutes ?? 0, opsSupportMinutes: v.opsSupportMinutes ?? 0,
    paidAmountCents: v.paidAmountCents ?? 0, refundedAmountCents: v.refundedAmountCents ?? 0,
    paymentFeeCents: v.paymentFeeCents ?? 0, aiAndStorageCostCents: v.aiAndStorageCostCents ?? 0,
    acquisitionCostCents: v.acquisitionCostCents ?? undefined, fulfillmentCostCents: v.fulfillmentCostCents ?? undefined,
    hostingReserveCents: v.hostingReserveCents ?? undefined, referralsCount: v.referralsCount ?? 0,
    severeDataIncidents: v.severeDataIncidents ?? 0,
  }
}
