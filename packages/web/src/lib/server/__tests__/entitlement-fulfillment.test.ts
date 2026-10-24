import {
  applyPaymentEntitlementEvent,
  computeCohortUnitEconomics,
  createEmptyEntitlementLedger,
} from '@/lib/server/entitlement-fulfillment'

describe('T11 Payment Entitlement Fulfillment & Cohort Unit Economics', () => {
  it('grants US$59 package once and deduplicates duplicate webhook deliveries without double-granting', () => {
    const ledger = createEmptyEntitlementLedger()

    const first = applyPaymentEntitlementEvent(ledger, {
      provider: 'stripe',
      eventId: 'evt_grant_1',
      sourceKey: 'pi_59_001',
      eventKind: 'grant',
      packageId: 'digital_project_59',
      payerId: 'user-payer-1',
    })
    expect(first.outcome).toBe('granted')
    expect(first.status).toBe('active')
    expect(first.wallet).toEqual({
      projectVouchers: 1,
      facilitatorSeats: 1,
      storytellerSeats: 1,
    })

    const duplicate = applyPaymentEntitlementEvent(ledger, {
      provider: 'stripe',
      eventId: 'evt_grant_1',
      sourceKey: 'pi_59_001',
      eventKind: 'grant',
      packageId: 'digital_project_59',
      payerId: 'user-payer-1',
    })
    expect(duplicate.outcome).toBe('already_granted')
    expect(duplicate.wallet).toEqual({
      projectVouchers: 1,
      facilitatorSeats: 1,
      storytellerSeats: 1,
    })

    expect(() =>
      applyPaymentEntitlementEvent(ledger, {
        provider: 'stripe',
        eventId: 'evt_grant_1',
        sourceKey: 'pi_59_001',
        eventKind: 'refund',
        packageId: 'digital_project_59',
        payerId: 'user-payer-1',
      }),
    ).toThrow(/entitlement_event_payload_conflict/)
  })

  it('suppresses out-of-order grant when refund or revoke arrives first', () => {
    const ledger = createEmptyEntitlementLedger()

    const earlyRefund = applyPaymentEntitlementEvent(ledger, {
      provider: 'stripe',
      eventId: 'evt_refund_early',
      sourceKey: 'pi_59_out_of_order',
      eventKind: 'refund',
      packageId: 'digital_project_59',
      payerId: 'user-payer-2',
    })
    expect(earlyRefund.outcome).toBe('revoked')
    expect(earlyRefund.status).toBe('refunded')
    expect(earlyRefund.wallet.projectVouchers).toBe(0)

    const lateGrant = applyPaymentEntitlementEvent(ledger, {
      provider: 'stripe',
      eventId: 'evt_grant_late',
      sourceKey: 'pi_59_out_of_order',
      eventKind: 'grant',
      packageId: 'digital_project_59',
      payerId: 'user-payer-2',
    })
    expect(lateGrant.outcome).toBe('grant_suppressed')
    expect(lateGrant.status).toBe('refunded')
    expect(lateGrant.wallet.projectVouchers).toBe(0)
  })

  it('computes cohort unit economics including incomplete and refunded households', () => {
    const report = computeCohortUnitEconomics([
      {
        householdId: 'hh-completed-1',
        paidAmountCents: 5900,
        refundedAmountCents: 0,
        paymentProcessingFeeCents: 210,
        aiAndStorageCostCents: 362,
        supportMinutes: 20,
        completedProject: true,
        refunded: false,
      },
      {
        householdId: 'hh-incomplete-2',
        paidAmountCents: 5900,
        refundedAmountCents: 0,
        paymentProcessingFeeCents: 210,
        aiAndStorageCostCents: 150,
        supportMinutes: 10,
        completedProject: false,
        refunded: false,
      },
      {
        householdId: 'hh-refunded-3',
        paidAmountCents: 5900,
        refundedAmountCents: 5900,
        paymentProcessingFeeCents: 210,
        aiAndStorageCostCents: 80,
        supportMinutes: 15,
        completedProject: false,
        refunded: true,
      },
    ])

    expect(report.totalHouseholds).toBe(3)
    expect(report.paidHouseholds).toBe(3)
    expect(report.completedHouseholds).toBe(1)
    expect(report.incompleteHouseholds).toBe(2)
    expect(report.refundedHouseholds).toBe(1)
    expect(report.grossRevenueCents).toBe(17700)
    expect(report.refundedCents).toBe(5900)
    expect(report.netRevenueCents).toBe(11800)
    expect(report.totalContributionCents).toBeGreaterThan(0)
  })
})
