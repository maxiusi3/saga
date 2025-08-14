/**
 * Payment Retry Service
 * Handles payment failures and retry logic
 */

import { PaymentService } from './payment-service'
import { ResourceWalletService } from './resource-wallet-service'
import { BaseModel } from '../models/base'
import type { 
  PackagePurchaseRequest,
  PackagePurchaseResult,
  PaymentError
} from '@saga/shared/types'

interface PaymentAttempt {
  id: string
  userId: string
  packageId: string
  paymentIntentId?: string
  attemptNumber: number
  status: 'pending' | 'succeeded' | 'failed' | 'abandoned'
  errorCode?: string
  errorMessage?: string
  retryAfter?: Date
  createdAt: Date
  updatedAt: Date
}

export class PaymentRetryService {
  private static readonly MAX_RETRY_ATTEMPTS = 3
  private static readonly RETRY_DELAYS = [
    5 * 60 * 1000,   // 5 minutes
    30 * 60 * 1000,  // 30 minutes
    2 * 60 * 60 * 1000 // 2 hours
  ]

  /**
   * Process payment with automatic retry logic
   */
  static async processPaymentWithRetry(
    request: PackagePurchaseRequest,
    attemptNumber: number = 1
  ): Promise<PackagePurchaseResult> {
    try {
      // Create payment attempt record
      const attemptId = await this.createPaymentAttempt(
        request.userId,
        request.packageId,
        attemptNumber
      )

      // Attempt payment
      const result = await PaymentService.confirmPaymentAndPurchase(
        request.paymentMethodId || '',
        request.userId
      )

      if (result.success) {
        // Update attempt as successful
        await this.updatePaymentAttempt(attemptId, {
          status: 'succeeded',
          paymentIntentId: result.transactionId
        })

        return result
      } else {
        // Handle payment failure
        return await this.handlePaymentFailure(
          attemptId,
          request,
          result.error || 'Unknown payment error',
          attemptNumber
        )
      }
    } catch (error) {
      console.error('Error in payment retry process:', error)
      return {
        success: false,
        error: 'Payment processing failed'
      }
    }
  }

  /**
   * Handle payment failure and determine retry strategy
   */
  private static async handlePaymentFailure(
    attemptId: string,
    request: PackagePurchaseRequest,
    errorMessage: string,
    attemptNumber: number
  ): Promise<PackagePurchaseResult> {
    try {
      const errorInfo = this.analyzePaymentError(errorMessage)
      
      // Update attempt record
      await this.updatePaymentAttempt(attemptId, {
        status: 'failed',
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message
      })

      // Determine if retry is appropriate
      const shouldRetry = this.shouldRetryPayment(errorInfo, attemptNumber)

      if (shouldRetry && attemptNumber < this.MAX_RETRY_ATTEMPTS) {
        // Schedule retry
        const retryDelay = this.RETRY_DELAYS[attemptNumber - 1] || this.RETRY_DELAYS[2]
        const retryAfter = new Date(Date.now() + retryDelay)

        await this.updatePaymentAttempt(attemptId, {
          retryAfter
        })

        // For immediate retries (like network errors), retry now
        if (errorInfo.retryImmediately) {
          return await this.processPaymentWithRetry(request, attemptNumber + 1)
        }

        return {
          success: false,
          error: `Payment failed: ${errorInfo.userMessage}. We'll retry automatically in ${Math.round(retryDelay / 60000)} minutes.`
        }
      } else {
        // Mark as abandoned
        await this.updatePaymentAttempt(attemptId, {
          status: 'abandoned'
        })

        return {
          success: false,
          error: errorInfo.userMessage
        }
      }
    } catch (error) {
      console.error('Error handling payment failure:', error)
      return {
        success: false,
        error: 'Payment processing failed'
      }
    }
  }

  /**
   * Analyze payment error and determine retry strategy
   */
  private static analyzePaymentError(errorMessage: string): {
    code: string
    message: string
    userMessage: string
    retryable: boolean
    retryImmediately: boolean
  } {
    const errorLower = errorMessage.toLowerCase()

    // Card declined errors
    if (errorLower.includes('card_declined') || errorLower.includes('declined')) {
      if (errorLower.includes('insufficient_funds')) {
        return {
          code: 'insufficient_funds',
          message: errorMessage,
          userMessage: 'Your card was declined due to insufficient funds. Please try a different payment method.',
          retryable: false,
          retryImmediately: false
        }
      } else if (errorLower.includes('expired_card')) {
        return {
          code: 'expired_card',
          message: errorMessage,
          userMessage: 'Your card has expired. Please update your payment method.',
          retryable: false,
          retryImmediately: false
        }
      } else {
        return {
          code: 'card_declined',
          message: errorMessage,
          userMessage: 'Your card was declined. Please try a different payment method or contact your bank.',
          retryable: false,
          retryImmediately: false
        }
      }
    }

    // Network/temporary errors
    if (errorLower.includes('network') || errorLower.includes('timeout') || 
        errorLower.includes('connection') || errorLower.includes('temporary')) {
      return {
        code: 'network_error',
        message: errorMessage,
        userMessage: 'We experienced a temporary connection issue. Please try again.',
        retryable: true,
        retryImmediately: true
      }
    }

    // Rate limiting
    if (errorLower.includes('rate_limit') || errorLower.includes('too_many_requests')) {
      return {
        code: 'rate_limit',
        message: errorMessage,
        userMessage: 'Too many payment attempts. Please wait a moment before trying again.',
        retryable: true,
        retryImmediately: false
      }
    }

    // Authentication errors
    if (errorLower.includes('authentication') || errorLower.includes('3d_secure')) {
      return {
        code: 'authentication_required',
        message: errorMessage,
        userMessage: 'Additional authentication is required. Please complete the verification process.',
        retryable: true,
        retryImmediately: false
      }
    }

    // Processing errors
    if (errorLower.includes('processing_error') || errorLower.includes('issuer')) {
      return {
        code: 'processing_error',
        message: errorMessage,
        userMessage: 'There was an issue processing your payment. Please try again or contact support.',
        retryable: true,
        retryImmediately: false
      }
    }

    // Default case
    return {
      code: 'unknown_error',
      message: errorMessage,
      userMessage: 'An unexpected error occurred. Please try again or contact support.',
      retryable: true,
      retryImmediately: false
    }
  }

  /**
   * Determine if payment should be retried
   */
  private static shouldRetryPayment(
    errorInfo: { retryable: boolean },
    attemptNumber: number
  ): boolean {
    return errorInfo.retryable && attemptNumber < this.MAX_RETRY_ATTEMPTS
  }

  /**
   * Create payment attempt record
   */
  private static async createPaymentAttempt(
    userId: string,
    packageId: string,
    attemptNumber: number
  ): Promise<string> {
    const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const attemptData: PaymentAttempt = {
      id: attemptId,
      userId,
      packageId,
      attemptNumber,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // In a real implementation, this would be stored in a payment_attempts table
    console.log('Created payment attempt:', attemptData)
    
    return attemptId
  }

  /**
   * Update payment attempt record
   */
  private static async updatePaymentAttempt(
    attemptId: string,
    updates: Partial<PaymentAttempt>
  ): Promise<void> {
    const updateData = {
      ...updates,
      updatedAt: new Date()
    }

    // In a real implementation, this would update the payment_attempts table
    console.log('Updated payment attempt:', attemptId, updateData)
  }

  /**
   * Get payment attempts for user
   */
  static async getPaymentAttempts(userId: string): Promise<PaymentAttempt[]> {
    // In a real implementation, this would query the payment_attempts table
    // For now, return empty array
    return []
  }

  /**
   * Process scheduled retries
   */
  static async processScheduledRetries(): Promise<{
    processed: number
    succeeded: number
    failed: number
  }> {
    try {
      // In a real implementation, this would:
      // 1. Query payment_attempts table for attempts with retryAfter <= now
      // 2. Process each retry
      // 3. Update attempt records
      
      console.log('Processing scheduled payment retries...')
      
      return {
        processed: 0,
        succeeded: 0,
        failed: 0
      }
    } catch (error) {
      console.error('Error processing scheduled retries:', error)
      throw error
    }
  }

  /**
   * Cancel pending payment attempts for user
   */
  static async cancelPendingAttempts(userId: string): Promise<number> {
    try {
      // In a real implementation, this would update all pending attempts to cancelled
      console.log('Cancelled pending payment attempts for user:', userId)
      return 0
    } catch (error) {
      console.error('Error cancelling pending attempts:', error)
      throw error
    }
  }

  /**
   * Get payment failure statistics
   */
  static async getFailureStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalAttempts: number
    failedAttempts: number
    failureRate: number
    commonErrors: Array<{
      code: string
      count: number
      percentage: number
    }>
    retrySuccessRate: number
  }> {
    try {
      // In a real implementation, this would query payment_attempts table
      // and calculate statistics
      
      return {
        totalAttempts: 0,
        failedAttempts: 0,
        failureRate: 0,
        commonErrors: [],
        retrySuccessRate: 0
      }
    } catch (error) {
      console.error('Error getting failure statistics:', error)
      throw error
    }
  }

  /**
   * Handle webhook for failed payments
   */
  static async handleFailedPaymentWebhook(
    paymentIntentId: string,
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    try {
      console.log('Handling failed payment webhook:', {
        paymentIntentId,
        errorCode,
        errorMessage
      })

      // In a real implementation, this would:
      // 1. Find the associated payment attempt
      // 2. Update the attempt status
      // 3. Determine if retry is appropriate
      // 4. Schedule retry if needed
      // 5. Notify user if appropriate
    } catch (error) {
      console.error('Error handling failed payment webhook:', error)
    }
  }

  /**
   * Validate payment method before attempting payment
   */
  static async validatePaymentMethod(
    paymentMethodId: string
  ): Promise<{
    valid: boolean
    issues: string[]
    recommendations: string[]
  }> {
    try {
      // In a real implementation, this would validate the payment method
      // Check for expired cards, insufficient funds indicators, etc.
      
      return {
        valid: true,
        issues: [],
        recommendations: []
      }
    } catch (error) {
      console.error('Error validating payment method:', error)
      return {
        valid: false,
        issues: ['Unable to validate payment method'],
        recommendations: ['Please try a different payment method']
      }
    }
  }
}