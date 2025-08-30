import request from 'supertest'
import { app } from '../../app'
import { db } from '../../lib/database'

// PLACEHOLDER: Mock Stripe for testing
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret',
        amount: 12900,
        currency: 'usd',
        status: 'requires_payment_method',
        metadata: {}
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        status: 'succeeded',
        amount: 12900,
        currency: 'usd',
        metadata: {
          packageId: 'saga-package'
        }
      })
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            status: 'succeeded',
            metadata: {
              packageId: 'saga-package'
            }
          }
        }
      })
    }
  }))
})

describe('Payment Flow Integration Tests', () => {
  let testUser: any
  let authToken: string

  beforeAll(async () => {
    // Setup test database
    await db.migrate.latest()
    
    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'testpassword123',
        name: 'Test User'
      })
    
    testUser = userResponse.body.user
    authToken = userResponse.body.token
  })

  afterAll(async () => {
    // Cleanup test database
    await db.migrate.rollback()
    await db.destroy()
  })

  beforeEach(async () => {
    // Reset user wallet before each test
    await db('user_resource_wallets')
      .where('user_id', testUser.id)
      .update({
        project_vouchers: 0,
        facilitator_seats: 0,
        storyteller_seats: 0
      })
  })

  describe('Payment Intent Creation', () => {
    it('should create payment intent for valid package', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageId: 'saga-package',
          amount: 12900,
          currency: 'usd'
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('client_secret')
      expect(response.body.amount).toBe(12900)
      expect(response.body.currency).toBe('usd')
    })

    it('should reject invalid package ID', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageId: 'invalid-package',
          amount: 12900,
          currency: 'usd'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid package ID')
    })

    it('should reject mismatched amount', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageId: 'saga-package',
          amount: 10000, // Wrong amount
          currency: 'usd'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Amount does not match package price')
    })
  })

  describe('Payment Completion', () => {
    it('should complete payment and activate package', async () => {
      // First create payment intent
      const intentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageId: 'saga-package',
          amount: 12900,
          currency: 'usd'
        })

      const paymentIntentId = intentResponse.body.id

      // Complete payment
      const completeResponse = await request(app)
        .post('/api/payments/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId
        })

      expect(completeResponse.status).toBe(200)
      expect(completeResponse.body.success).toBe(true)
      expect(completeResponse.body.packageId).toBe('saga-package')
      expect(completeResponse.body.walletUpdate).toEqual({
        projectVouchers: 1,
        facilitatorSeats: 2,
        storytellerSeats: 8
      })

      // Verify wallet was updated
      const walletResponse = await request(app)
        .get('/api/wallets/me')
        .set('Authorization', `Bearer ${authToken}`)

      expect(walletResponse.body.projectVouchers).toBe(1)
      expect(walletResponse.body.facilitatorSeats).toBe(2)
      expect(walletResponse.body.storytellerSeats).toBe(8)
    })

    it('should handle payment completion idempotency', async () => {
      // Create payment intent
      const intentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageId: 'saga-package',
          amount: 12900,
          currency: 'usd'
        })

      const paymentIntentId = intentResponse.body.id

      // Complete payment twice
      const firstComplete = await request(app)
        .post('/api/payments/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ paymentIntentId })

      const secondComplete = await request(app)
        .post('/api/payments/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ paymentIntentId })

      expect(firstComplete.status).toBe(200)
      expect(secondComplete.status).toBe(200)

      // Wallet should only be updated once
      const walletResponse = await request(app)
        .get('/api/wallets/me')
        .set('Authorization', `Bearer ${authToken}`)

      expect(walletResponse.body.projectVouchers).toBe(1) // Not 2
    })
  })

  describe('Payment Status Tracking', () => {
    it('should retrieve payment status', async () => {
      const intentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageId: 'saga-package',
          amount: 12900,
          currency: 'usd'
        })

      const paymentIntentId = intentResponse.body.id

      const statusResponse = await request(app)
        .get(`/api/payments/${paymentIntentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(statusResponse.status).toBe(200)
      expect(statusResponse.body.id).toBe(paymentIntentId)
      expect(statusResponse.body).toHaveProperty('status')
      expect(statusResponse.body).toHaveProperty('amount')
    })

    it('should handle non-existent payment intent', async () => {
      const statusResponse = await request(app)
        .get('/api/payments/nonexistent/status')
        .set('Authorization', `Bearer ${authToken}`)

      expect(statusResponse.status).toBe(404)
    })
  })

  describe('Package Activation', () => {
    it('should activate different package types correctly', async () => {
      const packages = [
        {
          id: 'saga-package',
          amount: 12900,
          expected: { projectVouchers: 1, facilitatorSeats: 2, storytellerSeats: 8 }
        },
        {
          id: 'saga-package-family',
          amount: 19900,
          expected: { projectVouchers: 3, facilitatorSeats: 5, storytellerSeats: 20 }
        },
        {
          id: 'saga-package-premium',
          amount: 29900,
          expected: { projectVouchers: 5, facilitatorSeats: 10, storytellerSeats: 50 }
        }
      ]

      for (const pkg of packages) {
        // Reset wallet
        await db('user_resource_wallets')
          .where('user_id', testUser.id)
          .update({
            project_vouchers: 0,
            facilitator_seats: 0,
            storyteller_seats: 0
          })

        // Create and complete payment
        const intentResponse = await request(app)
          .post('/api/payments/create-intent')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            packageId: pkg.id,
            amount: pkg.amount,
            currency: 'usd'
          })

        await request(app)
          .post('/api/payments/complete')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            paymentIntentId: intentResponse.body.id
          })

        // Verify wallet
        const walletResponse = await request(app)
          .get('/api/wallets/me')
          .set('Authorization', `Bearer ${authToken}`)

        expect(walletResponse.body.projectVouchers).toBe(pkg.expected.projectVouchers)
        expect(walletResponse.body.facilitatorSeats).toBe(pkg.expected.facilitatorSeats)
        expect(walletResponse.body.storytellerSeats).toBe(pkg.expected.storytellerSeats)
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle Stripe API errors', async () => {
      // Mock Stripe error
      const mockStripe = require('stripe')
      mockStripe().paymentIntents.create.mockRejectedValueOnce(
        new Error('Stripe API error')
      )

      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageId: 'saga-package',
          amount: 12900,
          currency: 'usd'
        })

      expect(response.status).toBe(500)
      expect(response.body.error).toContain('Internal server error')
    })

    it('should handle database errors during wallet update', async () => {
      // Mock database error
      jest.spyOn(db, 'transaction').mockRejectedValueOnce(
        new Error('Database error')
      )

      const intentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageId: 'saga-package',
          amount: 12900,
          currency: 'usd'
        })

      const completeResponse = await request(app)
        .post('/api/payments/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: intentResponse.body.id
        })

      expect(completeResponse.status).toBe(500)
      expect(completeResponse.body.error).toContain('Failed to complete payment')

      // Restore mock
      jest.restoreAllMocks()
    })
  })

  describe('Security', () => {
    it('should require authentication for payment endpoints', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .send({
          packageId: 'saga-package',
          amount: 12900,
          currency: 'usd'
        })

      expect(response.status).toBe(401)
    })

    it('should validate payment intent ownership', async () => {
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'testpassword123',
          name: 'Other User'
        })

      const otherToken = otherUserResponse.body.token

      // Create payment intent with first user
      const intentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageId: 'saga-package',
          amount: 12900,
          currency: 'usd'
        })

      // Try to complete with second user
      const completeResponse = await request(app)
        .post('/api/payments/complete')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          paymentIntentId: intentResponse.body.id
        })

      expect(completeResponse.status).toBe(403)
    })
  })
})
