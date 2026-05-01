import { stripeService } from '../stripe.service'

const getAccessToken = jest.fn()

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({ getAccessToken }),
  },
}))

describe('StripeService', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    getAccessToken.mockResolvedValue('access-token-1')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'pi_1',
        client_secret: 'pi_secret_1',
        amount: 9900,
        currency: 'usd',
        status: 'requires_payment_method',
      }),
    })
    global.fetch = fetchMock
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('creates payment intents with only package ID and bearer auth', async () => {
    await stripeService.createPaymentIntent({ packageId: 'starter' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/payments/create-intent',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer access-token-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packageId: 'starter' }),
      }),
    )
  })
})
