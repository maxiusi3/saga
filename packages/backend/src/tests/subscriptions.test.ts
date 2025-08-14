import request from 'supertest'
import { app } from '../index'
import { SubscriptionModel } from '../models/subscription'
import { UserModel } from '../models/user'
import { SubscriptionService } from '../services/subscription-service'
import { stripe } from '../config/stripe'
import { setupTestDatabase, cleanupTestDatabase } from './setup'

// Mock Stripe
jest.mock('../config/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
  STRIPE_CONFIG: {
    webhookSecret: 'whsec_test_secret',
    sagaPackagePrice: 12900,
    currency: 'usd',
    successUrl: 'http://localhost:3000/payment/success',
    cancelUrl: 'http://localhost:3000/payment/cancel',
  },
}))

describe('Subscription API', () => {
  let facilitatorToken: string
  let storytellerToken: string
  let facilitatorId: string
  let storytellerId: string

  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(async () => {
    // Create test users
    const facilitator = await UserModel.create({
      email: 'facilitator@test.com',
      name: 'Test Facilitator',
      role: 'facilitator',
    })
    facilitatorId = facilitator.id

    const storyteller = await UserModel.create({
      email: 'storyteller@test.com',
      name: 'Test Storyteller',
      role: 'storyteller',
    })
    storytellerId = storyteller.id

    // Get auth tokens
    const facilitatorAuth = await request(app)
      .post('/api/auth/signin')
      .send({
        email: 'facilitator@test.com',
        password: 'password123',
      })
    facilitatorToken = facilitatorAuth.body.accessToken

    const storytellerAuth = await request(app)
      .post('/api/auth/signin')
      .send({
        email: 'storyteller@test.com',
        password: 'password123',
      })
    storytellerToken = storytellerAuth.body.accessToken
  })

  afterEach(async () => {
    // Clean up test data
    await SubscriptionModel.db('subscriptions').del()
    await UserModel.db('users').del()
    jest.clearAllMocks()
  })

  describe('POST /api/subscriptions/checkout', () => {
    it('should create a checkout session for facilitator', async () => {
      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      }

      ;(stripe.checkout.sessions.create as jest.Mock).mockResolvedValue(mockSession)

      const response = await request(app)
        .post('/api/subscriptions/checkout')
        .set('Authorization', `Bearer ${facilitatorToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        sessionId: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      })

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'The Saga Package',
                description: 'One year of family storytelling with AI-guided prompts and unlimited storage',
              },
              unit_amount: 12900,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: 'http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/payment/cancel',
        customer_email: 'facilitator@test.com',
        metadata: {
          facilitatorId,
          packageType: 'saga_package',
        },
      })
    })

    it('should reject checkout for storyteller', async () => {
      const response = await request(app)
        .post('/api/subscriptions/checkout')
        .set('Authorization', `Bearer ${storytellerToken}`)

      expect(response.status).toBe(403)
      expect(response.body.error.code).toBe('FORBIDDEN')
    })

    it('should reject checkout if facilitator already has active subscription', async () => {
      // Create active subscription
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      await SubscriptionModel.create({
        facilitatorId,
        currentPeriodEnd: futureDate,
      })

      const response = await request(app)
        .post('/api/subscriptions/checkout')
        .set('Authorization', `Bearer ${facilitatorToken}`)

      expect(response.status).toBe(409)
      expect(response.body.error.code).toBe('SUBSCRIPTION_EXISTS')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/subscriptions/checkout')

      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('POST /api/subscriptions/payment-success', () => {
    it('should handle successful payment', async () => {
      const mockSession = {
        id: 'cs_test_123',
        payment_status: 'paid',
        metadata: {
          facilitatorId,
          packageType: 'saga_package',
        },
      }

      ;(stripe.checkout.sessions.retrieve as jest.Mock).mockResolvedValue(mockSession)

      const response = await request(app)
        .post('/api/subscriptions/payment-success')
        .send({
          sessionId: 'cs_test_123',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.subscription).toMatchObject({
        status: 'active',
      })

      // Verify subscription was created in database
      const subscription = await SubscriptionModel.findByFacilitatorId(facilitatorId)
      expect(subscription).toBeTruthy()
      expect(subscription?.status).toBe('active')
    })

    it('should reject unpaid sessions', async () => {
      const mockSession = {
        id: 'cs_test_123',
        payment_status: 'unpaid',
        metadata: {
          facilitatorId,
        },
      }

      ;(stripe.checkout.sessions.retrieve as jest.Mock).mockResolvedValue(mockSession)

      const response = await request(app)
        .post('/api/subscriptions/payment-success')
        .send({
          sessionId: 'cs_test_123',
        })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_SESSION')
    })

    it('should validate session ID', async () => {
      const response = await request(app)
        .post('/api/subscriptions/payment-success')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/subscriptions/status', () => {
    it('should return subscription status for facilitator', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      await SubscriptionModel.create({
        facilitatorId,
        currentPeriodEnd: futureDate,
      })

      const response = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', `Bearer ${facilitatorToken}`)

      expect(response.status).toBe(200)
      expect(response.body.hasActiveSubscription).toBe(true)
      expect(response.body.subscription).toBeTruthy()
      expect(response.body.daysRemaining).toBeGreaterThan(360)
    })

    it('should return no subscription for facilitator without subscription', async () => {
      const response = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', `Bearer ${facilitatorToken}`)

      expect(response.status).toBe(200)
      expect(response.body.hasActiveSubscription).toBe(false)
      expect(response.body.subscription).toBeNull()
      expect(response.body.daysRemaining).toBeNull()
    })

    it('should reject storyteller access', async () => {
      const response = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', `Bearer ${storytellerToken}`)

      expect(response.status).toBe(403)
      expect(response.body.error.code).toBe('FORBIDDEN')
    })
  })

  describe('POST /api/subscriptions/cancel', () => {
    it('should cancel subscription for facilitator', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      await SubscriptionModel.create({
        facilitatorId,
        currentPeriodEnd: futureDate,
      })

      const response = await request(app)
        .post('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${facilitatorToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // Verify subscription was canceled
      const subscription = await SubscriptionModel.findByFacilitatorId(facilitatorId)
      expect(subscription?.status).toBe('canceled')
    })

    it('should return 404 if no subscription exists', async () => {
      const response = await request(app)
        .post('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${facilitatorToken}`)

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('SUBSCRIPTION_NOT_FOUND')
    })
  })

  describe('POST /api/subscriptions/webhook', () => {
    it('should handle checkout.session.completed event', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            payment_status: 'paid',
            metadata: {
              facilitatorId,
              packageType: 'saga_package',
            },
          },
        },
      }

      ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent)
      ;(stripe.checkout.sessions.retrieve as jest.Mock).mockResolvedValue(mockEvent.data.object)

      const response = await request(app)
        .post('/api/subscriptions/webhook')
        .set('stripe-signature', 'test_signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))

      expect(response.status).toBe(200)
      expect(response.body.received).toBe(true)

      // Verify subscription was created
      const subscription = await SubscriptionModel.findByFacilitatorId(facilitatorId)
      expect(subscription).toBeTruthy()
    })

    it('should reject webhook without signature', async () => {
      const response = await request(app)
        .post('/api/subscriptions/webhook')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('MISSING_SIGNATURE')
    })

    it('should reject webhook with invalid signature', async () => {
      ;(stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const response = await request(app)
        .post('/api/subscriptions/webhook')
        .set('stripe-signature', 'invalid_signature')
        .send(Buffer.from('{}'))

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_SIGNATURE')
    })
  })
})

describe('SubscriptionService', () => {
  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(async () => {
    await SubscriptionModel.db('subscriptions').del()
    await UserModel.db('users').del()
  })

  describe('createCheckoutSession', () => {
    it('should create checkout session for valid facilitator', async () => {
      const facilitator = await UserModel.create({
        email: 'test@example.com',
        name: 'Test User',
        role: 'facilitator',
      })

      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      }

      ;(stripe.checkout.sessions.create as jest.Mock).mockResolvedValue(mockSession)

      const session = await SubscriptionService.createCheckoutSession(facilitator.id)

      expect(session).toEqual(mockSession)
      expect(stripe.checkout.sessions.create).toHaveBeenCalled()
    })

    it('should throw error for non-existent facilitator', async () => {
      await expect(
        SubscriptionService.createCheckoutSession('non-existent-id')
      ).rejects.toThrow('Facilitator not found')
    })

    it('should throw error if facilitator already has active subscription', async () => {
      const facilitator = await UserModel.create({
        email: 'test@example.com',
        name: 'Test User',
        role: 'facilitator',
      })

      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      await SubscriptionModel.create({
        facilitatorId: facilitator.id,
        currentPeriodEnd: futureDate,
      })

      await expect(
        SubscriptionService.createCheckoutSession(facilitator.id)
      ).rejects.toThrow('Facilitator already has an active subscription')
    })
  })

  describe('getSubscriptionStatus', () => {
    it('should return active subscription status', async () => {
      const facilitator = await UserModel.create({
        email: 'test@example.com',
        name: 'Test User',
        role: 'facilitator',
      })

      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      await SubscriptionModel.create({
        facilitatorId: facilitator.id,
        currentPeriodEnd: futureDate,
      })

      const status = await SubscriptionService.getSubscriptionStatus(facilitator.id)

      expect(status.hasActiveSubscription).toBe(true)
      expect(status.subscription).toBeTruthy()
      expect(status.daysRemaining).toBeGreaterThan(360)
    })

    it('should return inactive status for expired subscription', async () => {
      const facilitator = await UserModel.create({
        email: 'test@example.com',
        name: 'Test User',
        role: 'facilitator',
      })

      const pastDate = new Date()
      pastDate.setFullYear(pastDate.getFullYear() - 1)

      await SubscriptionModel.create({
        facilitatorId: facilitator.id,
        currentPeriodEnd: pastDate,
      })

      const status = await SubscriptionService.getSubscriptionStatus(facilitator.id)

      expect(status.hasActiveSubscription).toBe(false)
      expect(status.daysRemaining).toBe(0)
    })

    it('should return no subscription status', async () => {
      const facilitator = await UserModel.create({
        email: 'test@example.com',
        name: 'Test User',
        role: 'facilitator',
      })

      const status = await SubscriptionService.getSubscriptionStatus(facilitator.id)

      expect(status.hasActiveSubscription).toBe(false)
      expect(status.subscription).toBeNull()
      expect(status.daysRemaining).toBeNull()
    })
  })
})