import { randomUUID } from 'crypto'
import { getPaymentPackage, type PaymentPackage } from '@/lib/payments/catalog'

export type EntitlementEventKind = 'grant' | 'revoke' | 'refund' | 'cancel' | 'failed'
export type EntitlementOutcome =
  | 'granted'
  | 'already_granted'
  | 'revoked'
  | 'already_revoked'
  | 'grant_suppressed'
  | 'recorded_failure'

export interface EntitlementSourceRecord {
  id: string
  provider: string
  sourceKey: string
  packageId: PaymentPackage['id']
  payerId: string
  projectId?: string | null
  amountCents: number
  currency: 'usd'
  projectVouchersIssued: number
  facilitatorSeatsIssued: number
  storytellerSeatsIssued: number
  status: 'active' | 'revoked' | 'refunded'
  firstEventId: string
  revokedAt?: string | null
  createdAt: string
}

export interface EntitlementEventRecord {
  provider: string
  eventId: string
  sourceKey: string
  eventKind: EntitlementEventKind
  packageId: PaymentPackage['id']
  payerId: string
  amountCents: number
  sourceId: string | null
  outcome: EntitlementOutcome
  createdAt: string
}

export interface EntitlementLedgerState {
  sources: Map<string, EntitlementSourceRecord>
  events: Map<string, EntitlementEventRecord>
  wallets: Map<
    string,
    {
      projectVouchers: number
      facilitatorSeats: number
      storytellerSeats: number
    }
  >
}

export function createEmptyEntitlementLedger(): EntitlementLedgerState {
  return {
    sources: new Map(),
    events: new Map(),
    wallets: new Map(),
  }
}

export function applyPaymentEntitlementEvent(
  ledger: EntitlementLedgerState,
  input: {
    provider: string
    eventId: string
    sourceKey: string
    eventKind: EntitlementEventKind
    packageId: string
    payerId: string
    amountCents?: number
    projectId?: string | null
    now?: string
  },
): {
  sourceId: string | null
  outcome: EntitlementOutcome
  status: 'active' | 'revoked' | 'refunded' | 'failed'
  wallet: {
    projectVouchers: number
    facilitatorSeats: number
    storytellerSeats: number
  }
} {
  const pkg = getPaymentPackage(input.packageId)
  if (!pkg) {
    throw new Error(`invalid_package_id: Unknown packageId "${input.packageId}"`)
  }
  const amountCents = input.amountCents ?? pkg.amount
  const now = input.now ?? new Date().toISOString()
  const eventKey = `${input.provider}:${input.eventId}`
  const sourceMapKey = `${input.provider}:${input.sourceKey}`

  const existingEvent = ledger.events.get(eventKey)
  if (existingEvent) {
    if (
      existingEvent.sourceKey !== input.sourceKey ||
      existingEvent.eventKind !== input.eventKind ||
      existingEvent.packageId !== pkg.id ||
      existingEvent.payerId !== input.payerId ||
      existingEvent.amountCents !== amountCents
    ) {
      throw new Error(`entitlement_event_payload_conflict: Conflicting payload for ${eventKey}`)
    }
    const existingSource = existingEvent.sourceId
      ? Array.from(ledger.sources.values()).find(s => s.id === existingEvent.sourceId)
      : undefined
    const replayOutcome: EntitlementOutcome =
      existingEvent.outcome === 'granted'
        ? 'already_granted'
        : existingEvent.outcome === 'revoked'
          ? 'already_revoked'
          : existingEvent.outcome
    const wallet = ledger.wallets.get(input.payerId) ?? {
      projectVouchers: 0,
      facilitatorSeats: 0,
      storytellerSeats: 0,
    }
    return {
      sourceId: existingEvent.sourceId,
      outcome: replayOutcome,
      status: existingSource?.status ?? 'failed',
      wallet: { ...wallet },
    }
  }

  const wallet = ledger.wallets.get(input.payerId) ?? {
    projectVouchers: 0,
    facilitatorSeats: 0,
    storytellerSeats: 0,
  }
  ledger.wallets.set(input.payerId, wallet)

  if (input.eventKind === 'cancel' || input.eventKind === 'failed') {
    const record: EntitlementEventRecord = {
      provider: input.provider,
      eventId: input.eventId,
      sourceKey: input.sourceKey,
      eventKind: input.eventKind,
      packageId: pkg.id,
      payerId: input.payerId,
      amountCents,
      sourceId: null,
      outcome: 'recorded_failure',
      createdAt: now,
    }
    ledger.events.set(eventKey, record)
    return {
      sourceId: null,
      outcome: 'recorded_failure',
      status: 'failed',
      wallet: { ...wallet },
    }
  }

  let source = ledger.sources.get(sourceMapKey)
  let outcome: EntitlementOutcome

  if (!source) {
    const id = randomUUID()
    const isGrant = input.eventKind === 'grant'
    source = {
      id,
      provider: input.provider,
      sourceKey: input.sourceKey,
      packageId: pkg.id,
      payerId: input.payerId,
      projectId: input.projectId ?? null,
      amountCents,
      currency: 'usd',
      projectVouchersIssued: isGrant ? pkg.projectVouchers : 0,
      facilitatorSeatsIssued: isGrant ? pkg.facilitatorSeats : 0,
      storytellerSeatsIssued: isGrant ? pkg.storytellerSeats : 0,
      status: isGrant ? 'active' : input.eventKind === 'refund' ? 'refunded' : 'revoked',
      firstEventId: input.eventId,
      revokedAt: isGrant ? null : now,
      createdAt: now,
    }
    ledger.sources.set(sourceMapKey, source)

    if (isGrant) {
      wallet.projectVouchers += pkg.projectVouchers
      wallet.facilitatorSeats += pkg.facilitatorSeats
      wallet.storytellerSeats += pkg.storytellerSeats
      outcome = 'granted'
    } else {
      outcome = 'revoked'
    }
  } else {
    if (source.payerId !== input.payerId || source.packageId !== pkg.id) {
      throw new Error(`entitlement_source_payload_conflict: Conflicting source ${sourceMapKey}`)
    }
    if (input.eventKind === 'grant') {
      if (source.status === 'revoked' || source.status === 'refunded') {
        outcome = 'grant_suppressed'
      } else {
        outcome = 'already_granted'
      }
    } else {
      if (source.status === 'revoked' || source.status === 'refunded') {
        outcome = 'already_revoked'
      } else {
        source.status = input.eventKind === 'refund' ? 'refunded' : 'revoked'
        source.revokedAt = now
        outcome = 'revoked'
      }
    }
  }

  ledger.events.set(eventKey, {
    provider: input.provider,
    eventId: input.eventId,
    sourceKey: input.sourceKey,
    eventKind: input.eventKind,
    packageId: pkg.id,
    payerId: input.payerId,
    amountCents,
    sourceId: source.id,
    outcome,
    createdAt: now,
  })

  return {
    sourceId: source.id,
    outcome,
    status: source.status,
    wallet: { ...wallet },
  }
}

export interface HouseholdCohortRecord {
  householdId: string
  paidAmountCents: number
  refundedAmountCents: number
  paymentProcessingFeeCents: number
  aiAndStorageCostCents: number
  supportMinutes: number
  supportHourlyRateUsd?: number
  completedProject: boolean
  refunded: boolean
}

export interface CohortUnitEconomicsReport {
  totalHouseholds: number
  paidHouseholds: number
  completedHouseholds: number
  incompleteHouseholds: number
  refundedHouseholds: number
  grossRevenueCents: number
  refundedCents: number
  netRevenueCents: number
  totalVariableCostCents: number
  totalContributionCents: number
  contributionPerPaidHouseholdCents: number | null
  contributionPerCompletedHouseholdCents: number | null
}

/**
 * Computes full-cohort unit economics including incomplete and refunded households
 * per docs/2026-10-10-integrated-upgrade-plan.md §9.2 & §10.3.
 */
export function computeCohortUnitEconomics(
  households: readonly HouseholdCohortRecord[],
): CohortUnitEconomicsReport {
  let grossRevenueCents = 0
  let refundedCents = 0
  let totalVariableCostCents = 0
  let paidHouseholds = 0
  let completedHouseholds = 0
  let incompleteHouseholds = 0
  let refundedHouseholds = 0

  for (const h of households) {
    if (h.paidAmountCents > 0) paidHouseholds += 1
    if (h.completedProject) completedHouseholds += 1
    else incompleteHouseholds += 1
    if (h.refunded) refundedHouseholds += 1

    grossRevenueCents += h.paidAmountCents
    refundedCents += h.refundedAmountCents

    const supportRateCentsPerMin = Math.round(((h.supportHourlyRateUsd ?? 30) * 100) / 60)
    const supportCostCents = Math.round(h.supportMinutes * supportRateCentsPerMin)
    totalVariableCostCents +=
      h.paymentProcessingFeeCents + h.aiAndStorageCostCents + supportCostCents
  }

  const netRevenueCents = grossRevenueCents - refundedCents
  const totalContributionCents = netRevenueCents - totalVariableCostCents

  return {
    totalHouseholds: households.length,
    paidHouseholds,
    completedHouseholds,
    incompleteHouseholds,
    refundedHouseholds,
    grossRevenueCents,
    refundedCents,
    netRevenueCents,
    totalVariableCostCents,
    totalContributionCents,
    contributionPerPaidHouseholdCents:
      paidHouseholds > 0 ? Math.round(totalContributionCents / paidHouseholds) : null,
    contributionPerCompletedHouseholdCents:
      completedHouseholds > 0 ? Math.round(totalContributionCents / completedHouseholds) : null,
  }
}
