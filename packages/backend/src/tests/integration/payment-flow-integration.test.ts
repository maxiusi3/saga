/**
 * Payment Flow Integration Tests
 * End-to-end tests for complete payment workflows
 */

import request from 'supertest'
import { app } from '../../index'
import { BaseModel } from '../../models/base'
import { stripe } from '../../config/stripe'
import { PaymentService } from '../../services/payment-service'
import { ResourceWalletService } from '../../services/resource-wallet-service'

// Mock Stripe for integration tests
jest.mock('../../config/stripe')
const mockStripe = stripe as jest.Mocked<typeof stripe>

describe('Payment Flow Integration Tests', () => {
  let authToken: string
  let userId: string
  let customerId: string

  beforeAll(async () => {
    // Setup test database
    await BaseModel.migrate()
    
    // Create test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'testpassword123',
        name: 'Test User'
      })

    userId = userResponse.body.data.user.id
    authToken = userResponse.body.data.token

    // Mock Stripe customer creation
    customerId = 'cus_test123'
    mockStripe.customers.list.mockResolvedValue({
      data: [],
      has_more: false,
      object: 'list',
      url: '/v1/customers'
    })
    mockStripe.customers.create.mockResolvedValue({
      id: customerId,
      email: 'test@example.com',
      name: 'Test User',
      invoice_settings: { default_payment_method: null }
    } as any)
  })

  afterAll(async () => {
    // Cleanup test database
    await BaseModel.destroy()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Complete Purchase Flow', () => {
    it('should complete full purchase workflow', async () => {
      // Step 1: Get available packages
      const packagesResponse = await request(app)
        .get('/api/packages')
        .set('Authorization', `Bearer ${authToken}`)

      expect(packagesResponse.status).toBe(200)
      expect(packagesResponse.body.data.packages).toBeDefined()

      const packageId = packagesResponse.body.data.packages[0]?.id || 'pkg_saga_package'

      // Step 2: Create payment intent
      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_test',
        amount: 9999,
        currency: 'usd',
        status: 'requires_payment_method'
      }

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent as any)

      const paymentIntentResponse = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageId,
          metadata: { userId }
        })

      expect(paymentIntentResponse.status).toBe(200)
      expect(paymentIntentResponse.body.data.clientSecret).toBe('pi_test123_secret_test')

      // Step 3: Simulate successful payment
      const mockSucceededPaymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 9999,
        currency: 'usd',
        customer: customerId,
        payment_method: 'pm_test123',
        metadata: { packageId }
      }

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockSucceededPaymentIntent as any)

      // Step 4: Confirm payment and process purchase
      const confirmResponse = await request(app)
        .post('/api/payments/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'pi_test123'
        })

      expect(confirmResponse.status).toBe(200)
      expect(confirmResponse.body.data.success).toBe(true)
      expect(confirmResponse.body.data.transactionId).toBe('pi_test123')
      expect(confirmResponse.body.data.receipt).toBeDefined()

      // Step 5: Verify wallet was credited
      const walletResponse = await request(app)
        .get('/api/wallets/balance')
        .set('Authorization', `Bearer ${authToken}`)

      expect(walletResponse.status).toBe(200)
      expect(walletResponse.body.data.projectVouchers).toBeGreaterThan(0)
      expect(walletResponse.body.data.facilitatorSeats).toBeGreaterThan(0)
      expect(walletResponse.body.data.storytellerSeats).toBeGreaterThan(0)

      // Step 6: Verify receipt was generated
      const receiptId = confirmResponse.body.data.receipt.receiptId
      const receiptResponse = await request(app)
        .get(`/api/receipts/${receiptId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(receiptResponse.status).toBe(200)
      expect(receiptResponse.body.data.receiptId).toBe(receiptId)
      expect(receiptResponse.body.data.amount).toBe(9999)

      // Step 7: Verify purchase history
      const historyResponse = await request(app)
        .get('/api/receipts/history')
        .set('Authorization', `Bearer ${authToken}`)

      expect(historyResponse.status).toBe(200)
      expect(historyResponse.body.data.receipts).toHaveLength(1)
      expect(historyResponse.body.data.receipts[0].receiptId).toBe(receiptId)
    })

    it('should handle payment failure gracefully', async () => {
      // Mock failed payment intent
      const mockFailedPaymentIntent = {
        id: 'pi_failed123',
        status: 'requires_payment_method',
        amount: 9999,
        currency: 'usd'
      }

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockFailedPaymentIntent as any)

      const confirmResponse = await request(app)
        .post('/api/payments/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'pi_failed123'
        })

      expect(confirmResponse.status).toBe(400)
      expect(confirmResponse.body.success).toBe(false)
      expect(confirmResponse.body.error).toContain('Payment not completed')
    })

    it('should handle insufficient wallet resources', async () => {
      // First, consume all resources
      await ResourceWalletService.consumeProjectVoucher(userId, 'test_project_1')
      await ResourceWalletService.consumeProjectVoucher(userId, 'test_project_2')

      // Try to create project without resources
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: 'A test project'
        })

      expect(projectResponse.status).toBe(400)
      expect(projectResponse.body.error).toContain('Insufficient project vouchers')
    })
  })

  describe('Payment Method Management Flow', () => {
    it('should manage payment methods end-to-end', async () => {
      // Step 1: Create setup intent
      const mockSetupIntent = {
        id: 'seti_test123',
        client_secret: 'seti_test123_secret_test'
      }

      mockStripe.setupIntents.create.mockResolvedValue(mockSetupIntent as any)

      const setupResponse = await request(app)
        .post('/api/payment-methods/setup-intent')
        .set('Authorization', `Bearer ${authToken}`)

      expect(setupResponse.status).toBe(200)
      expect(setupResponse.body.data.clientSecret).toBe('seti_test123_secret_test')

      // Step 2: Confirm setup intent (simulate successful card setup)
      const mockSucceededSetupIntent = {
        id: 'seti_test123',
        status: 'succeeded',
        payment_method: 'pm_test123'
      }

      const mockPaymentMethod = {
        id: 'pm_test123',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2025,
          funding: 'credit'
        },
        created: Math.floor(Date.now() / 1000)
      }

      mockStripe.setupIntents.retrieve.mockResolvedValue(mockSucceededSetupIntent as any)
      mockStripe.paymentMethods.retrieve.mockResolvedValue(mockPaymentMethod as any)

      const confirmSetupResponse = await request(app)
        .post('/api/payment-methods/confirm-setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          setupIntentId: 'seti_test123'
        })

      expect(confirmSetupResponse.status).toBe(200)
      expect(confirmSetupResponse.body.data.paymentMethod.id).toBe('pm_test123')

      // Step 3: List payment methods
      mockStripe.paymentMethods.list.mockResolvedValue({
        data: [mockPaymentMethod]
      } as any)

      mockStripe.customers.retrieve.mockResolvedValue({
        invoice_settings: { default_payment_method: null }
      } as any)

      const listResponse = await request(app)
        .get('/api/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)

      expect(listResponse.status).toBe(200)
      expect(listResponse.body.data.paymentMethods).toHaveLength(1)
      expect(listResponse.body.data.paymentMethods[0].id).toBe('pm_test123')

      // Step 4: Set as default payment method
      mockStripe.customers.update.mockResolvedValue({} as any)
      mockPaymentMethod.customer = customerId

      const setDefaultResponse = await request(app)
        .post(`/api/payment-methods/pm_test123/set-default`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(setDefaultResponse.status).toBe(200)

      // Step 5: Remove payment method
      mockStripe.paymentMethods.detach.mockResolvedValue({} as any)

      const removeResponse = await request(app)
        .delete(`/api/payment-methods/pm_test123`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(removeResponse.status).toBe(200)
    })
  })

  describe('Refund Flow', () => {
    it('should process refund end-to-end', async () => {
      // First, create a successful purchase
      const mockPaymentIntent = {
        id: 'pi_refund_test123',
        status: 'succeeded',
        amount: 9999,
        currency: 'usd',
        customer: customerId,
        payment_method: 'pm_test123',
        metadata: { packageId: 'pkg_saga_package' }
      }

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent as any)

      const confirmResponse = await request(app)
        .post('/api/payments/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'pi_refund_test123'
        })

      expect(confirmResponse.status).toBe(200)

      // Process refund
      const mockRefund = {
        id: 'ref_test123',
        status: 'succeeded',
        amount: 9999,
        currency: 'usd'
      }

      mockStripe.refunds.create.mockResolvedValue(mockRefund as any)

      const refundResponse = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'pi_refund_test123',
          reason: 'requested_by_customer'
        })

      expect(refundResponse.status).toBe(200)
      expect(refundResponse.body.data.refundId).toBe('ref_test123')

      // Verify wallet resources were reversed
      const walletResponse = await request(app)
        .get('/api/wallets/balance')
        .set('Authorization', `Bearer ${authToken}`)

      // Resources should be back to original state or less
      expect(walletResponse.status).toBe(200)
    })
  })

  describe('Error Handling', () => {
    it('should handle Stripe API errors gracefully', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Your card was declined'))

      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageId: 'pkg_saga_package'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Failed to create payment intent')
    })

    it('should handle invalid payment intent IDs', async () => {
      mockStripe.paymentIntents.retrieve.mockRejectedValue(new Error('No such payment_intent'))

      const response = await request(app)
        .post('/api/payments/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'pi_invalid123'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Failed to process purchase')
    })

    it('should handle unauthorized requests', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .send({
          packageId: 'pkg_saga_package'
        })

      expect(response.status).toBe(401)
      expect(response.body.error).toContain('Authentication required')
    })
  })

  describe('Webhook Handling', () => {
    it('should handle payment_intent.succeeded webhook', async () => {
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_webhook_test123',
            metadata: {
              userId: userId
            }
          }
        }
      }

      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123'
      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload as any)

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'test_signature')
        .send(webhookPayload)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    it('should handle invalid webhook signatures', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'invalid_signature')
        .send({ type: 'payment_intent.succeeded' })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid signature')
    })
  })
})