/**
 * Payment Controller
 * Handles payment-related API endpoints for package purchases
 */

import { Request, Response } from 'express'
import { PaymentService } from '../services/payment-service'
import { ResourceWalletService } from '../services/resource-wallet-service'
import { UserModel } from '../models/user'

export class PaymentController {
  
  /**
   * Get available packages
   */
  static async getPackages(req: Request, res: Response) {
    try {
      const packages = await PaymentService.getAvailablePackages()
      
      res.json({
        success: true,
        data: packages
      })
    } catch (error) {
      console.error('Error getting packages:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get packages'
      })
    }
  }

  /**
   * Create payment intent for package purchase
   */
  static async createPaymentIntent(req: Request, res: Response) {
    try {
      const { packageId } = req.body
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        })
      }

      if (!packageId) {
        return res.status(400).json({
          success: false,
          error: 'Package ID is required'
        })
      }

      // Get package details
      const packageDetails = await PaymentService.getPackageDetails(packageId)
      if (!packageDetails) {
        return res.status(404).json({
          success: false,
          error: 'Package not found'
        })
      }

      // Get user details
      const user = await UserModel.findById(userId)
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        })
      }

      // Create or get Stripe customer
      const customer = await PaymentService.createOrGetCustomer(
        userId,
        user.email,
        user.name
      )

      // Create payment intent
      const paymentIntent = await PaymentService.createPaymentIntent(
        packageDetails,
        customer.id,
        { userId }
      )

      res.json({
        success: true,
        data: {
          paymentIntent,
          package: packageDetails,
          customer
        }
      })
    } catch (error) {
      console.error('Error creating payment intent:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to create payment intent'
      })
    }
  }

  /**
   * Confirm payment and complete purchase
   */
  static async confirmPayment(req: Request, res: Response) {
    try {
      const { paymentIntentId, enableRetry = true } = req.body
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        })
      }

      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          error: 'Payment intent ID is required'
        })
      }

      let result

      if (enableRetry) {
        // Use retry service for better error handling
        const { PaymentRetryService } = await import('../services/payment-retry-service')
        result = await PaymentRetryService.processPaymentWithRetry({
          packageId: req.body.packageId || 'saga-package-v1', // Default package
          userId,
          paymentMethodId: paymentIntentId
        })
      } else {
        // Direct payment confirmation
        result = await PaymentService.confirmPaymentAndPurchase(
          paymentIntentId,
          userId
        )
      }

      if (result.success) {
        res.json({
          success: true,
          data: {
            transactionId: result.transactionId,
            walletBalance: result.walletBalance,
            receipt: result.receipt
          }
        })
      } else {
        // Determine appropriate HTTP status based on error type
        const statusCode = this.getErrorStatusCode(result.error || '')
        
        res.status(statusCode).json({
          success: false,
          error: result.error,
          retryable: statusCode < 500 && statusCode !== 402 // Client errors except payment required
        })
      }
    } catch (error) {
      console.error('Error confirming payment:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to confirm payment',
        retryable: true
      })
    }
  }

  /**
   * Get customer payment methods
   */
  static async getPaymentMethods(req: Request, res: Response) {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        })
      }

      // Get user details
      const user = await UserModel.findById(userId)
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        })
      }

      // Get or create customer
      const customer = await PaymentService.createOrGetCustomer(
        userId,
        user.email,
        user.name
      )

      // Get payment methods
      const paymentMethods = await PaymentService.getCustomerPaymentMethods(customer.id)

      res.json({
        success: true,
        data: {
          paymentMethods,
          defaultPaymentMethod: customer.defaultPaymentMethod
        }
      })
    } catch (error) {
      console.error('Error getting payment methods:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get payment methods'
      })
    }
  }

  /**
   * Create setup intent for saving payment method
   */
  static async createSetupIntent(req: Request, res: Response) {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        })
      }

      // Get user details
      const user = await UserModel.findById(userId)
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        })
      }

      // Get or create customer
      const customer = await PaymentService.createOrGetCustomer(
        userId,
        user.email,
        user.name
      )

      // Create setup intent
      const setupIntent = await PaymentService.createSetupIntent(customer.id)

      res.json({
        success: true,
        data: setupIntent
      })
    } catch (error) {
      console.error('Error creating setup intent:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to create setup intent'
      })
    }
  }

  /**
   * Set default payment method
   */
  static async setDefaultPaymentMethod(req: Request, res: Response) {
    try {
      const { paymentMethodId } = req.body
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        })
      }

      if (!paymentMethodId) {
        return res.status(400).json({
          success: false,
          error: 'Payment method ID is required'
        })
      }

      // Get user details
      const user = await UserModel.findById(userId)
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        })
      }

      // Get customer
      const customer = await PaymentService.createOrGetCustomer(
        userId,
        user.email,
        user.name
      )

      // Set default payment method
      const success = await PaymentService.setDefaultPaymentMethod(
        customer.id,
        paymentMethodId
      )

      if (success) {
        res.json({
          success: true,
          message: 'Default payment method updated'
        })
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to set default payment method'
        })
      }
    } catch (error) {
      console.error('Error setting default payment method:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to set default payment method'
      })
    }
  }

  /**
   * Handle Stripe webhooks
   */
  static async handleWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['stripe-signature'] as string
      const payload = req.body

      if (!signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing Stripe signature'
        })
      }

      const result = await PaymentService.handleWebhook(payload, signature)

      if (result.success) {
        res.json({ received: true })
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        })
      }
    } catch (error) {
      console.error('Error handling webhook:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to handle webhook'
      })
    }
  }

  /**
   * Get payment intent status
   */
  static async getPaymentStatus(req: Request, res: Response) {
    try {
      const { paymentIntentId } = req.params

      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          error: 'Payment intent ID is required'
        })
      }

      const status = await PaymentService.getPaymentIntentStatus(paymentIntentId)

      res.json({
        success: true,
        data: { status }
      })
    } catch (error) {
      console.error('Error getting payment status:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get payment status'
      })
    }
  }

  /**
   * Get payment attempts for user
   */
  static async getPaymentAttempts(req: Request, res: Response) {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        })
      }

      const { PaymentRetryService } = await import('../services/payment-retry-service')
      const attempts = await PaymentRetryService.getPaymentAttempts(userId)

      res.json({
        success: true,
        data: attempts
      })
    } catch (error) {
      console.error('Error getting payment attempts:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get payment attempts'
      })
    }
  }

  /**
   * Validate payment method
   */
  static async validatePaymentMethod(req: Request, res: Response) {
    try {
      const { paymentMethodId } = req.body

      if (!paymentMethodId) {
        return res.status(400).json({
          success: false,
          error: 'Payment method ID is required'
        })
      }

      const { PaymentRetryService } = await import('../services/payment-retry-service')
      const validation = await PaymentRetryService.validatePaymentMethod(paymentMethodId)

      res.json({
        success: true,
        data: validation
      })
    } catch (error) {
      console.error('Error validating payment method:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to validate payment method'
      })
    }
  }

  /**
   * Get error status code based on error message
   */
  private static getErrorStatusCode(errorMessage: string): number {
    const errorLower = errorMessage.toLowerCase()

    if (errorLower.includes('insufficient') || errorLower.includes('declined')) {
      return 402 // Payment Required
    } else if (errorLower.includes('not found') || errorLower.includes('invalid')) {
      return 400 // Bad Request
    } else if (errorLower.includes('unauthorized') || errorLower.includes('authentication')) {
      return 401 // Unauthorized
    } else if (errorLower.includes('rate_limit') || errorLower.includes('too_many')) {
      return 429 // Too Many Requests
    } else {
      return 500 // Internal Server Error
    }
  }

  /**
   * Process refund (admin only)
   */
  static async processRefund(req: Request, res: Response) {
    try {
      const { paymentIntentId, amount, reason } = req.body
      const userId = req.user?.id

      // Check if user is admin (this would need proper admin role checking)
      // For now, we'll just check if the user exists
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        })
      }

      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          error: 'Payment intent ID is required'
        })
      }

      const result = await PaymentService.processRefund(
        paymentIntentId,
        amount,
        reason
      )

      if (result.success) {
        res.json({
          success: true,
          data: {
            refundId: result.refundId
          }
        })
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        })
      }
    } catch (error) {
      console.error('Error processing refund:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to process refund'
      })
    }
  }
}