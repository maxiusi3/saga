import { getPaymentPackage } from '../catalog'

describe('payment package catalog', () => {
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
