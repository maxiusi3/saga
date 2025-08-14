/**
 * Payment Service Tests
 * Comprehensive test suite for payment processing
 */

import { PaymentService } from '../services/payment-service'
import { ResourceWalletService } from '../services/resource-wallet-service'
import { PackageService } from '../services/package-service'
import { ReceiptService } from '../services/receipt-service'
import { stripe } from '../config/stripe'

// Mock external dependencies
jest.mock('../config/stripe')
jest.mock('../services/resource-wallet-service')
jest.mock('../services/package-service')
jest.mock('../services/receipt-service')

const mockStripe = stripe as jest.Mocked<typeof stripe>

describe('PaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createOrGetCustomer', () => {
    it('should create new customer when none exists', async () => {
      const mockCustomer = {
        id: 'cus_test123',
        email: 'test@example.com',
        name: 'Test User',
        invoice_settings: { default_payment_method: null }
      }

      mockStripe.customers.list.mockResolvedValue({
        data: [],
        has_more: false,
        object: 'list',
        url: '/v1/customers'
      })

      mockStripe.customers.create.mockResolvedValue(mockCustomer as any)

      const result = await PaymentService.createOrGetCustomer(
        'user123',
        'test@example.com',
        'Test User'
      )

      expect(result).toEqual({
        id: 'cus_test123',
        email: 'test@example.com',
        name: 'Test User'
      })

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user123' }
      })
    })

    it('should return existing customer when found', async () => {
      const mockCustomer = {
        id: 'cus_existing123',
        email: 'test@example.com',
        name: 'Test User',
        invoice_settings: { default_payment_method: 'pm_test123' }
      }

      mockStripe.customers.list.mockResolvedValue({
        data: [mockCustomer],
        has_more: false,
        object: 'list',
        url: '/v1/customers'
      } as any)

      const result = await PaymentService.createOrGetCustomer(
        'user123',
        'test@example.com',
        'Test User'
      )

      expect(result).toEqual({
        id: 'cus_existing123',
        email: 'test@example.com',
        name: 'Test User',
        defaultPaymentMethod: 'pm_test123'
      })

      expect(mockStripe.customers.create).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      mockStripe.customers.list.mockRejectedValue(new Error('Stripe error'))

      await expect(
        PaymentService.createOrGetCustomer('user123', 'test@example.com', 'Test User')
      ).rejects.toThrow('Failed to create or retrieve customer')
    })
  })

  describe('createPaymentIntent', () => {
    it('should create payment intent successfully', async () => {
      const mockPackage = {
        id: 'pkg_test123',
        name: 'Test Package',
        price: 99.99,
        currency: 'USD'
      }

      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_test',
        amount: 9999,
        currency: 'usd',
        status: 'requires_payment_method'
      }

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent as any)

      const result = await PaymentService.createPaymentIntent(
        mockPackage as any,
        'cus_test123',
        { userId: 'user123' }
      )

      expect(result).toEqual({
        id: 'pi_test123',
        clientSecret: 'pi_test123_secret_test',
        amount: 9999,
        currency: 'usd',
        status: 'requires_payment_method'
      })

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 9999,
        currency: 'usd',
        customer: 'cus_test123',
        metadata: {
          packageId: 'pkg_test123',
          packageName: 'Test Package',
          userId: 'user123'
        },
        automatic_payment_methods: {
          enabled: true
        }
      })
    })

    it('should handle payment intent creation errors', async () => {
      const mockPackage = {
        id: 'pkg_test123',
        name: 'Test Package',
        price: 99.99,
        currency: 'USD'
      }

      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Payment intent failed'))

      await expect(
        PaymentService.createPaymentIntent(mockPackage as any, 'cus_test123')
      ).rejects.toThrow('Failed to create payment intent')
    })
  })

  describe('confirmPaymentAndPurchase', () => {
    it('should confirm payment and process purchase successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 9999,
        currency: 'usd',
        customer: 'cus_test123',
        payment_method: 'pm_test123',
        metadata: {
          packageId: 'pkg_test123'
        }
      }

      const mockPackage = {
        id: 'pkg_test123',
        name: 'Test Package',
        price: 99.99,
        currency: 'USD',
        resources: {
          projectVouchers: 1,
          facilitatorSeats: 2,
          storytellerSeats: 2
        }
      }

      const mockReceipt = {
        receiptId: 'rcp_test123',
        amount: 9999,
        currency: 'USD'
      }

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent as any)
      jest.mocked(PackageService.getPackageById).mockResolvedValue(mockPackage as any)
      jest.mocked(ResourceWalletService.purchasePackage).mockResolvedValue({
        success: true,
        walletBalance: { projectVouchers: 1, facilitatorSeats: 2, storytellerSeats: 2 }
      } as any)
      jest.mocked(ReceiptService.generateReceipt).mockResolvedValue(mockReceipt as any)

      const result = await PaymentService.confirmPaymentAndPurchase('pi_test123', 'user123')

      expect(result.success).toBe(true)
      expect(result.transactionId).toBe('pi_test123')
      expect(result.receipt).toEqual(mockReceipt)

      expect(ResourceWalletService.purchasePackage).toHaveBeenCalledWith({
        packageId: 'pkg_test123',
        userId: 'user123',
        metadata: {
          stripePaymentIntentId: 'pi_test123',
          stripeCustomerId: 'cus_test123',
          paymentAmount: 9999,
          paymentCurrency: 'usd'
        }
      })
    })

    it('should fail when payment is not succeeded', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'requires_payment_method',
        amount: 9999,
        currency: 'usd'
      }

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent as any)

      const result = await PaymentService.confirmPaymentAndPurchase('pi_test123', 'user123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Payment not completed. Status: requires_payment_method')
    })

    it('should fail when package is not found', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 9999,
        currency: 'usd',
        metadata: {
          packageId: 'pkg_nonexistent'
        }
      }

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent as any)
      jest.mocked(PackageService.getPackageById).mockResolvedValue(null)

      const result = await PaymentService.confirmPaymentAndPurchase('pi_test123', 'user123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Package not found')
    })

    it('should fail when payment amount does not match package price', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 5000, // $50.00
        currency: 'usd',
        metadata: {
          packageId: 'pkg_test123'
        }
      }

      const mockPackage = {
        id: 'pkg_test123',
        name: 'Test Package',
        price: 99.99, // $99.99
        currency: 'USD'
      }

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent as any)
      jest.mocked(PackageService.getPackageById).mockResolvedValue(mockPackage as any)

      const result = await PaymentService.confirmPaymentAndPurchase('pi_test123', 'user123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Payment amount does not match package price')
    })
  })

  describe('processRefund', () => {
    it('should process full refund successfully', async () => {
      const mockRefund = {
        id: 'ref_test123',
        status: 'succeeded'
      }

      mockStripe.refunds.create.mockResolvedValue(mockRefund as any)

      const result = await PaymentService.processRefund('pi_test123')

      expect(result.success).toBe(true)
      expect(result.refundId).toBe('ref_test123')

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test123',
        reason: 'requested_by_customer'
      })
    })

    it('should process partial refund successfully', async () => {
      const mockRefund = {
        id: 'ref_test123',
        status: 'succeeded'
      }

      mockStripe.refunds.create.mockResolvedValue(mockRefund as any)

      const result = await PaymentService.processRefund('pi_test123', 50.00, 'duplicate')

      expect(result.success).toBe(true)
      expect(result.refundId).toBe('ref_test123')

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test123',
        amount: 5000,
        reason: 'duplicate'
      })
    })

    it('should handle refund errors', async () => {
      mockStripe.refunds.create.mockRejectedValue(new Error('Refund failed'))

      const result = await PaymentService.processRefund('pi_test123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to process refund')
    })
  })

  describe('validatePaymentAmount', () => {
    it('should validate correct payment amount', async () => {
      const mockPaymentIntent = {
        amount: 9999
      }

      const mockPackage = {
        price: 99.99
      }

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent as any)
      jest.mocked(PackageService.getPackageById).mockResolvedValue(mockPackage as any)

      const result = await PaymentService.validatePaymentAmount('pi_test123', 'pkg_test123')

      expect(result).toBe(true)
    })

    it('should reject incorrect payment amount', async () => {
      const mockPaymentIntent = {
        amount: 5000 // $50.00
      }

      const mockPackage = {
        price: 99.99 // $99.99
      }

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent as any)
      jest.mocked(PackageService.getPackageById).mockResolvedValue(mockPackage as any)

      const result = await PaymentService.validatePaymentAmount('pi_test123', 'pkg_test123')

      expect(result).toBe(false)
    })

    it('should handle validation errors', async () => {
      mockStripe.paymentIntents.retrieve.mockRejectedValue(new Error('Payment intent not found'))

      const result = await PaymentService.validatePaymentAmount('pi_test123', 'pkg_test123')

      expect(result).toBe(false)
    })
  })

  describe('handleWebhook', () => {
    it('should handle payment_intent.succeeded webhook', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            metadata: {
              userId: 'user123'
            }
          }
        }
      }

      const mockSignature = 'test_signature'
      const mockPayload = JSON.stringify(mockEvent)

      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123'

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any)

      const result = await PaymentService.handleWebhook(mockPayload, mockSignature)

      expect(result.success).toBe(true)
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        mockPayload,
        mockSignature,
        'whsec_test123'
      )
    })

    it('should handle payment_intent.payment_failed webhook', async () => {
      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test123',
            metadata: {
              userId: 'user123'
            }
          }
        }
      }

      const mockSignature = 'test_signature'
      const mockPayload = JSON.stringify(mockEvent)

      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123'

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any)

      const result = await PaymentService.handleWebhook(mockPayload, mockSignature)

      expect(result.success).toBe(true)
    })

    it('should handle webhook signature verification failure', async () => {
      const mockSignature = 'invalid_signature'
      const mockPayload = 'invalid_payload'

      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123'

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const result = await PaymentService.handleWebhook(mockPayload, mockSignature)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid signature')
    })

    it('should handle missing webhook secret', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET

      const result = await PaymentService.handleWebhook('payload', 'signature')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Stripe webhook secret not configured')
    })
  })

  describe('getAvailablePackages', () => {
    it('should return available packages', async () => {
      const mockPackages = [
        {
          id: 'pkg_test123',
          name: 'Test Package',
          price: 99.99,
          currency: 'USD'
        }
      ]

      jest.mocked(PackageService.getActivePackages).mockResolvedValue(mockPackages as any)

      const result = await PaymentService.getAvailablePackages()

      expect(result).toEqual(mockPackages)
      expect(PackageService.getActivePackages).toHaveBeenCalled()
    })
  })

  describe('getPackageDetails', () => {
    it('should return package details', async () => {
      const mockPackage = {
        id: 'pkg_test123',
        name: 'Test Package',
        price: 99.99,
        currency: 'USD'
      }

      jest.mocked(PackageService.getPackageById).mockResolvedValue(mockPackage as any)

      const result = await PaymentService.getPackageDetails('pkg_test123')

      expect(result).toEqual(mockPackage)
      expect(PackageService.getPackageById).toHaveBeenCalledWith('pkg_test123')
    })
  })

  describe('createTestPaymentMethod', () => {
    it('should create test payment method in non-production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const mockPaymentMethod = {
        id: 'pm_test123'
      }

      mockStripe.paymentMethods.create.mockResolvedValue(mockPaymentMethod as any)

      const result = await PaymentService.createTestPaymentMethod()

      expect(result).toBe('pm_test123')
      expect(mockStripe.paymentMethods.create).toHaveBeenCalledWith({
        type: 'card',
        card: {
          number: '4242424242424242',
          exp_month: 12,
          exp_year: 2025,
          cvc: '123'
        }
      })

      process.env.NODE_ENV = originalEnv
    })

    it('should throw error in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      await expect(PaymentService.createTestPaymentMethod()).rejects.toThrow(
        'Test payment methods can only be created in non-production environments'
      )

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('getPaymentIntentStatus', () => {
    it('should return payment intent status', async () => {
      const mockPaymentIntent = {
        status: 'succeeded'
      }

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent as any)

      const result = await PaymentService.getPaymentIntentStatus('pi_test123')

      expect(result).toBe('succeeded')
      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_test123')
    })

    it('should handle errors when getting status', async () => {
      mockStripe.paymentIntents.retrieve.mockRejectedValue(new Error('Payment intent not found'))

      await expect(PaymentService.getPaymentIntentStatus('pi_test123')).rejects.toThrow(
        'Failed to get payment intent status'
      )
    })
  })
})