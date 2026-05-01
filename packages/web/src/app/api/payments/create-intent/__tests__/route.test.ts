/**
 * @jest-environment node
 */

import Stripe from 'stripe'
import { NextRequest } from 'next/server'
import { POST } from '../route'

const getAuthenticatedUser = jest.fn()
const createPaymentIntent = jest.fn()

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUser(...args),
}))

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: createPaymentIntent,
    },
  })),
)

describe('/api/payments/create-intent', () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_1'
    getAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      headers: new Headers(),
    })
    createPaymentIntent.mockResolvedValue({
      id: 'pi_1',
      client_secret: 'pi_secret_1',
      amount: 9900,
      currency: 'usd',
      status: 'requires_payment_method',
    })
  })

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = originalSecret
    jest.clearAllMocks()
  })

  it('creates Stripe intents from server-owned package amount and currency', async () => {
    const request = new NextRequest('http://localhost/api/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({
        packageId: 'starter',
        amount: 1,
        currency: 'jpy',
        metadata: {
          packageId: 'free-money',
          packageName: 'Fake Package',
          note: 'safe metadata',
        },
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(Stripe).toHaveBeenCalledWith('sk_test_1')
    expect(createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 9900,
        currency: 'usd',
        metadata: expect.objectContaining({
          packageId: 'starter',
          packageName: 'Family Starter',
          userId: 'user-1',
          note: 'safe metadata',
        }),
      }),
    )
  })

  it('rejects unknown package IDs before creating a Stripe intent', async () => {
    const request = new NextRequest('http://localhost/api/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'free-money' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid package' })
    expect(createPaymentIntent).not.toHaveBeenCalled()
  })
})
