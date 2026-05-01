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

  it('creates Stripe intents from server-owned package amount, currency, and metadata', async () => {
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
        }),
      }),
    )
    expect(createPaymentIntent.mock.calls[0][0].metadata).not.toHaveProperty('note')
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

  it('returns 400 for malformed JSON bodies', async () => {
    const request = new NextRequest('http://localhost/api/payments/create-intent', {
      method: 'POST',
      body: '{not-json',
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid payment request' })
    expect(createPaymentIntent).not.toHaveBeenCalled()
  })

  it.each(['null', '[]', '"starter"'])(
    'returns 400 for non-object JSON body %s',
    async (body) => {
      const request = new NextRequest('http://localhost/api/payments/create-intent', {
        method: 'POST',
        body,
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: 'Invalid payment request' })
      expect(createPaymentIntent).not.toHaveBeenCalled()
    },
  )

  it('returns 503 when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const request = new NextRequest('http://localhost/api/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'starter' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Payment service is not configured' })
    expect(createPaymentIntent).not.toHaveBeenCalled()
  })

  it('returns 502 with a sanitized error when Stripe rejects creation', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    createPaymentIntent.mockRejectedValueOnce(new Error('card processor secret details'))
    const request = new NextRequest('http://localhost/api/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'starter' }),
    })

    try {
      const response = await POST(request)

      expect(response.status).toBe(502)
      await expect(response.json()).resolves.toEqual({ error: 'Unable to create payment intent' })
      expect(errorSpy).toHaveBeenCalledWith('Failed to create Stripe payment intent')
    } finally {
      errorSpy.mockRestore()
    }
  })
})
