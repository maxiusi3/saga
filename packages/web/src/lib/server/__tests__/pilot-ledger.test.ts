import { parsePilotObservation, toPilotEntry } from '../pilot-ledger'

export function observation(overrides: Record<string, unknown> = {}) {
  return {
    action: 'record', requestId: '11111111-1111-4111-8111-111111111111', expectedRevision: 0,
    householdId: '22222222-2222-4222-8222-222222222222', householdKey: '33333333-3333-4333-8333-333333333333',
    projectId: '44444444-4444-4444-8444-444444444444', cohortKey: 'pilot-test',
    cohortType: 'longitudinal_pilot', observationKind: 'synthetic', recordedBy: 'ops-fixture', reason: 'initial_observation',
    values: { pricingTier: 'free', supportMode: 'self_serve', acquisitionChannel: 'direct_invite', country: 'US', productVersion: 'g4', enrolledAt: '2026-01-01T00:00:00Z' },
    evidence: { enrollment: { source: 'synthetic_fixture', reference: 'fixture:enrollment-1' } }, ...overrides,
  }
}

describe('pilot observation input and evidence', () => {
  it('preserves unknown costs and excludes a partial intake from gate evidence', () => {
    const command = parsePilotObservation(observation())
    if (command.action !== 'record') throw new Error('record expected')
    expect(command.values.paidAmountCents).toBeNull()
    expect(toPilotEntry(command).costsComplete).toBe(false)
    expect(toPilotEntry(command).evidenceComplete).toBe(false)
    expect(toPilotEntry(command).opsSupportMeasured).toBe(false)
    expect(toPilotEntry(command).familyRevisionMeasured).toBe(false)
    expect(toPilotEntry(command).acquisitionCostCents).toBeUndefined()
    expect(toPilotEntry(command).observationKind).toBe('synthetic')
  })

  it('rejects synthetic evidence presented as observed', () => {
    expect(() => parsePilotObservation(observation({ observationKind: 'observed' }))).toThrow()
  })

  it.each([
    { paidAmountCents: -1 }, { paymentFeeCents: 1.5 }, { npsScore: 11 },
    { enrolledAt: '2099-01-01T00:00:00Z' }, { firstRecordingSavedAt: '2026-01-02T00:00:00Z' },
    { deliveredAt: '2026-01-02T00:00:00Z' }, { opsSupportMinutes: Infinity },
    { unknownField: true },
  ])('rejects invalid values or milestones without prerequisite/evidence: %j', values => {
    const input = observation()
    expect(() => parsePilotObservation({ ...input, values: { ...input.values, ...values } })).toThrow()
  })

  it('requires evidence even for a zero measured amount and validates refunds', () => {
    const input = observation()
    expect(() => parsePilotObservation({ ...input, values: { ...input.values, paidAmountCents: 0 } })).toThrow()
    expect(() => parsePilotObservation({ ...input, values: { ...input.values, paidAmountCents: 0, refundedAmountCents: 1 }, evidence: {
      ...input.evidence, paidAmountCents: { source: 'synthetic_fixture', reference: 'fixture:paid' }, refundedAmountCents: { source: 'synthetic_fixture', reference: 'fixture:refund' },
    } })).toThrow()
  })

  it('does not allow interview recall to masquerade as instrumented replay', () => {
    const input = observation()
    expect(() => parsePilotObservation({ ...input, evidence: { ...input.evidence, replayedWithin14dAt: { source: 'interview_self_report', reference: 'interview:1' } } })).toThrow()
  })

  it('validates close-cohort requests with a stable retry identity', () => {
    expect(parsePilotObservation({ action: 'close_cohort', requestId: observation().requestId, cohortKey: 'pilot-test', observationKind: 'synthetic', recordedBy: 'ops-fixture', reason: 'recruitment_complete' }).action).toBe('close_cohort')
  })
})
