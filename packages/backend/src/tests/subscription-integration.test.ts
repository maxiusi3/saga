import request from 'supertest'
import { app } from '../index'
import { setupTestDatabase, cleanupTestDatabase } from './setup'

// Mock Stripe to avoid real API calls during testing
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

describe('Subscription Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  describe('API Routes', () => {
    it('should have subscription routes registered', async () => {
      const response = await request(app)
        .get('/api/subscriptions/status')
        .expect(401) // Should require authentication

      expect(response.body.error.code).toBe('UNAUTHORIZED')
    })

    it('should handle webhook endpoint', async () => {
      const response = await request(app)
        .post('/api/subscriptions/webhook')
        .expect(400) // Should require stripe signature

      expect(response.body.error.code).toBe('MISSING_SIGNATURE')
    })

    it('should handle checkout endpoint', async () => {
      const response = await request(app)
        .post('/api/subscriptions/checkout')
        .expect(401) // Should require authentication

      expect(response.body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('Health Check', () => {
    it('should respond to health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.body.status).toBe('ok')
    })
  })
})