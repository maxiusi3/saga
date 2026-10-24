import { getPaymentPackage } from '../catalog'

describe('payment package catalog', () => {
  it('returns the D09/D10 US$59 single-narrator digital project package with scope limits', () => {
    expect(getPaymentPackage('digital_project_59')).toMatchObject({
      id: 'digital_project_59',
      amount: 5900,
      currency: 'usd',
      projectVouchers: 1,
      facilitatorSeats: 1,
      storytellerSeats: 1,
      scopeLimits: {
        storytellers: 1,
        audioMinutes: 120,
        photos: 20,
        hostingMonths: 12,
        reminderDaysBeforeExpiry: [90, 30],
      },
    })
  })

  it('returns server-owned cents for starter package', () => {
    expect(getPaymentPackage('starter')).toMatchObject({
      id: 'starter',
      amount: 9900,
      currency: 'usd',
    })
  })

  it('returns null for unknown package IDs', () => {
    expect(getPaymentPackage('free-money')).toBeNull()
  })
})
