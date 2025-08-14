/**
 * Payment Method Service Tests
 * Test suite for payment method management
 */

import { PaymentMethodService } from '../services/payment-method-service'
import { stripe } from '../config/stripe'

// Mock Stripe
jest.mock('../config/stripe')

const mockStripe = stripe as jest.Mocked<typeof stripe>

describe('PaymentMethodService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getCustomerPaymentMethods', () => {
    it('should return formatted payment methods', async () => {
      const mockPaymentMethods = {
        data: [
          {
            id: 'pm_test123',
            type: 'card',
            card: {
              brand: 'visa',
              last4: '4242',
              exp_month: 12,
              exp_year: 2025,
              funding: 'credit'
            },
            created: 1640995200 // 2022-01-01
          }
        ]
      }

      mockStripe.paymentMethods.list.mockResolvedValue(mockPaymentMethods as any)

      const result = await PaymentMethodService.getCustomerPaymentMethods('cus_test123')

      expect(result).toEqual([
        {
          id: 'pm_test123',
          type: 'card',
          card: {
            brand: 'visa',
            last4: '4242',
            expMonth: 12,
            expYear: 2025,
            funding: 'credit'
          },
          isDefault: false,
          createdAt: new Date(1640995200 * 1000)
        }
      ])

      expect(mockStripe.paymentMethods.list).toHaveBeenCalledWith({
        customer: 'cus_test123',
        type: 'card'
      })
    })

    it('should handle errors gracefully', async () => {
      mockStripe.paymentMethods.list.mockRejectedValue(new Error('Stripe error'))

      const result = await PaymentMethodService.getCustomerPaymentMethods('cus_test123')

      expect(result).toEqual([])
    })
  })

  describe('addPaymentMethod', () => {
    it('should attach payment method to customer successfully', async () => {
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
        created: 1640995200
      }

      mockStripe.paymentMethods.attach.mockResolvedValue(mockPaymentMethod as any)
      mockStripe.paymentMethods.retrieve.mockResolvedValue(mockPaymentMethod as any)

      const result = await PaymentMethodService.addPaymentMethod('cus_test123', 'pm_test123')

      expect(result.success).toBe(true)
      expect(result.paymentMethod).toEqual({
        id: 'pm_test123',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          expMonth: 12,
          expYear: 2025,
          funding: 'credit'
        },
        isDefault: false,
        createdAt: new Date(1640995200 * 1000)
      })

      expect(mockStripe.paymentMethods.attach).toHaveBeenCalledWith('pm_test123', {
        customer: 'cus_test123'
      })
    })

    it('should handle attachment errors', async () => {
      mockStripe.paymentMethods.attach.mockRejectedValue(new Error('Payment method already attached'))

      const result = await PaymentMethodService.addPaymentMethod('cus_test123', 'pm_test123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Payment method already attached')
    })
  })

  describe('removePaymentMethod', () => {
    it('should detach payment method successfully', async () => {
      mockStripe.paymentMethods.detach.mockResolvedValue({} as any)

      const result = await PaymentMethodService.removePaymentMethod('pm_test123')

      expect(result.success).toBe(true)
      expect(mockStripe.paymentMethods.detach).toHaveBeenCalledWith('pm_test123')
    })

    it('should handle detachment errors', async () => {
      mockStripe.paymentMethods.detach.mockRejectedValue(new Error('Payment method not found'))

      const result = await PaymentMethodService.removePaymentMethod('pm_test123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Payment method not found')
    })
  })

  describe('setDefaultPaymentMethod', () => {
    it('should set default payment method successfully', async () => {
      mockStripe.customers.update.mockResolvedValue({} as any)

      const result = await PaymentMethodService.setDefaultPaymentMethod('cus_test123', 'pm_test123')

      expect(result.success).toBe(true)
      expect(mockStripe.customers.update).toHaveBeenCalledWith('cus_test123', {
        invoice_settings: {
          default_payment_method: 'pm_test123'
        }
      })
    })

    it('should handle update errors', async () => {
      mockStripe.customers.update.mockRejectedValue(new Error('Customer not found'))

      const result = await PaymentMethodService.setDefaultPaymentMethod('cus_test123', 'pm_test123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Customer not found')
    })
  })

  describe('getDefaultPaymentMethod', () => {
    it('should return default payment method', async () => {
      const mockCustomer = {
        invoice_settings: {
          default_payment_method: 'pm_test123'
        }
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
        created: 1640995200
      }

      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer as any)
      mockStripe.paymentMethods.retrieve.mockResolvedValue(mockPaymentMethod as any)

      const result = await PaymentMethodService.getDefaultPaymentMethod('cus_test123')

      expect(result).toEqual({
        id: 'pm_test123',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          expMonth: 12,
          expYear: 2025,
          funding: 'credit'
        },
        isDefault: true,
        createdAt: new Date(1640995200 * 1000)
      })
    })

    it('should return null when no default payment method', async () => {
      const mockCustomer = {
        invoice_settings: {
          default_payment_method: null
        }
      }

      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer as any)

      const result = await PaymentMethodService.getDefaultPaymentMethod('cus_test123')

      expect(result).toBeNull()
    })

    it('should return null when customer is deleted', async () => {
      const mockCustomer = {
        deleted: true
      }

      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer as any)

      const result = await PaymentMethodService.getDefaultPaymentMethod('cus_test123')

      expect(result).toBeNull()
    })
  })

  describe('createSetupIntent', () => {
    it('should create setup intent successfully', async () => {
      const mockSetupIntent = {
        id: 'seti_test123',
        client_secret: 'seti_test123_secret_test'
      }

      mockStripe.setupIntents.create.mockResolvedValue(mockSetupIntent as any)

      const result = await PaymentMethodService.createSetupIntent('cus_test123')

      expect(result.success).toBe(true)
      expect(result.clientSecret).toBe('seti_test123_secret_test')
      expect(result.setupIntentId).toBe('seti_test123')

      expect(mockStripe.setupIntents.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        payment_method_types: ['card'],
        usage: 'off_session'
      })
    })

    it('should handle setup intent creation errors', async () => {
      mockStripe.setupIntents.create.mockRejectedValue(new Error('Setup intent failed'))

      const result = await PaymentMethodService.createSetupIntent('cus_test123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Setup intent failed')
    })
  })

  describe('confirmSetupIntent', () => {
    it('should confirm setup intent successfully', async () => {
      const mockSetupIntent = {
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
        created: 1640995200
      }

      mockStripe.setupIntents.retrieve.mockResolvedValue(mockSetupIntent as any)
      mockStripe.paymentMethods.retrieve.mockResolvedValue(mockPaymentMethod as any)

      const result = await PaymentMethodService.confirmSetupIntent('seti_test123', 'cus_test123')

      expect(result.success).toBe(true)
      expect(result.paymentMethod).toEqual({
        id: 'pm_test123',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          expMonth: 12,
          expYear: 2025,
          funding: 'credit'
        },
        isDefault: false,
        createdAt: new Date(1640995200 * 1000)
      })
    })

    it('should fail when setup intent is not succeeded', async () => {
      const mockSetupIntent = {
        id: 'seti_test123',
        status: 'requires_payment_method'
      }

      mockStripe.setupIntents.retrieve.mockResolvedValue(mockSetupIntent as any)

      const result = await PaymentMethodService.confirmSetupIntent('seti_test123', 'cus_test123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Setup intent not completed. Status: requires_payment_method')
    })

    it('should fail when no payment method attached', async () => {
      const mockSetupIntent = {
        id: 'seti_test123',
        status: 'succeeded',
        payment_method: null
      }

      mockStripe.setupIntents.retrieve.mockResolvedValue(mockSetupIntent as any)

      const result = await PaymentMethodService.confirmSetupIntent('seti_test123', 'cus_test123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('No payment method attached to setup intent')
    })
  })

  describe('validatePaymentMethod', () => {
    it('should validate payment method belongs to customer', async () => {
      const mockPaymentMethod = {
        customer: 'cus_test123'
      }

      mockStripe.paymentMethods.retrieve.mockResolvedValue(mockPaymentMethod as any)

      const result = await PaymentMethodService.validatePaymentMethod('cus_test123', 'pm_test123')

      expect(result).toBe(true)
    })

    it('should reject payment method that does not belong to customer', async () => {
      const mockPaymentMethod = {
        customer: 'cus_different123'
      }

      mockStripe.paymentMethods.retrieve.mockResolvedValue(mockPaymentMethod as any)

      const result = await PaymentMethodService.validatePaymentMethod('cus_test123', 'pm_test123')

      expect(result).toBe(false)
    })

    it('should handle validation errors', async () => {
      mockStripe.paymentMethods.retrieve.mockRejectedValue(new Error('Payment method not found'))

      const result = await PaymentMethodService.validatePaymentMethod('cus_test123', 'pm_test123')

      expect(result).toBe(false)
    })
  })

  describe('handleExpiredPaymentMethods', () => {
    it('should identify expired payment methods', async () => {
      const currentDate = new Date()
      const currentYear = currentDate.getFullYear()
      const currentMonth = currentDate.getMonth() + 1

      const mockPaymentMethods = {
        data: [
          {
            id: 'pm_active123',
            type: 'card',
            card: {
              brand: 'visa',
              last4: '4242',
              exp_month: 12,
              exp_year: currentYear + 1, // Future year
              funding: 'credit'
            },
            created: 1640995200
          },
          {
            id: 'pm_expired123',
            type: 'card',
            card: {
              brand: 'visa',
              last4: '1234',
              exp_month: currentMonth - 1 || 12,
              exp_year: currentMonth === 1 ? currentYear - 1 : currentYear, // Past month/year
              funding: 'credit'
            },
            created: 1640995200
          }
        ]
      }

      mockStripe.paymentMethods.list.mockResolvedValue(mockPaymentMethods as any)

      const result = await PaymentMethodService.handleExpiredPaymentMethods('cus_test123')

      expect(result.expiredMethods).toHaveLength(1)
      expect(result.expiredMethods[0].id).toBe('pm_expired123')
      expect(result.activeCount).toBe(1)
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

      const result = await PaymentMethodService.createTestPaymentMethod()

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

      await expect(PaymentMethodService.createTestPaymentMethod()).rejects.toThrow(
        'Test payment methods can only be created in non-production environments'
      )

      process.env.NODE_ENV = originalEnv
    })
  })
})