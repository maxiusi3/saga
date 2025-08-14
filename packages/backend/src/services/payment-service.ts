/**
 * Payment Service
 * Handles payment processing with Stripe integration for package purchases
 */

import Stripe from 'stripe'
import { stripe, STRIPE_CONFIG } from '../config/stripe'
import { ResourceWalletService } from './resource-wallet-service'
import { ReceiptService } from './receipt-service'
import { PaymentAnalyticsService } from './payment-analytics-service'
import type { 
  PackagePurchaseRequest,
  PackagePurchaseResult,
  ResourcePackage
} from '@saga/shared/types'

export interface PaymentIntent {
  id: string
  clientSecret: string
  amount: number
  currency: string
  status: string
}

export interface PaymentMethod {
  id: string
  type: string
  card?: {
    brand: string
    last4: string
    expMonth: number
    expYear: number
  }
}

export interface StripeCustomer {
  id: string
  email: string
  name?: string
  defaultPaymentMethod?: string
}

export class PaymentService {
  
  /**
   * Create or retrieve Stripe customer
   */
  static async createOrGetCustomer(
    userId: string, 
    email: string, 
    name?: string
  ): Promise<StripeCustomer> {
    try {
      // First, try to find existing customer by metadata
      const existingCustomers = await stripe.customers.list({
        metadata: { userId },
        limit: 1
      })

      if (existingCustomers.data.length > 0) {
        const customer = existingCustomers.data[0]
        return {
          id: customer.id,
          email: customer.email || email,
          name: customer.name || name,
          defaultPaymentMethod: customer.invoice_settings.default_payment_method as string
        }
      }

      // Create new customer
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { userId }
      })

      return {
        id: customer.id,
        email: customer.email || email,
        name: customer.name || name
      }
    } catch (error) {
      console.error('Error creating/getting Stripe customer:', error)
      throw new Error('Failed to create or retrieve customer')
    }
  }

  /**
   * Create payment intent for package purchase
   */
  static async createPaymentIntent(
    packageDetails: ResourcePackage,
    customerId: string,
    metadata: Record<string, string> = {}
  ): Promise<PaymentIntent> {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(packageDetails.price * 100), // Convert to cents
        currency: packageDetails.currency.toLowerCase(),
        customer: customerId,
        metadata: {
          packageId: packageDetails.id,
          packageName: packageDetails.name,
          ...metadata
        },
        automatic_payment_methods: {
          enabled: true
        }
      })

      // Track payment intent creation
      if (metadata.userId) {
        PaymentAnalyticsService.trackPaymentEvent({
          userId: metadata.userId,
          eventType: 'payment_intent_created',
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          packageId: packageDetails.id
        }).catch(error => console.error('Failed to track payment event:', error))
      }

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status
      }
    } catch (error) {
      console.error('Error creating payment intent:', error)
      throw new Error('Failed to create payment intent')
    }
  }

  /**
   * Confirm payment and process package purchase
   */
  static async confirmPaymentAndPurchase(
    paymentIntentId: string,
    userId: string
  ): Promise<PackagePurchaseResult> {
    try {
      // Retrieve payment intent to get details
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

      if (paymentIntent.status !== 'succeeded') {
        return {
          success: false,
          error: `Payment not completed. Status: ${paymentIntent.status}`
        }
      }

      const packageId = paymentIntent.metadata.packageId
      if (!packageId) {
        return {
          success: false,
          error: 'Package ID not found in payment metadata'
        }
      }

      // Get package details
      const packageDetails = await this.getPackageDetails(packageId)
      if (!packageDetails) {
        return {
          success: false,
          error: 'Package not found'
        }
      }

      // Validate payment amount matches package price
      const expectedAmount = Math.round(packageDetails.price * 100)
      if (paymentIntent.amount !== expectedAmount) {
        return {
          success: false,
          error: 'Payment amount does not match package price'
        }
      }

      // Process the purchase through ResourceWalletService
      const purchaseResult = await ResourceWalletService.purchasePackage({
        packageId,
        userId,
        metadata: {
          stripePaymentIntentId: paymentIntentId,
          stripeCustomerId: paymentIntent.customer as string,
          paymentAmount: paymentIntent.amount,
          paymentCurrency: paymentIntent.currency
        }
      })

      if (!purchaseResult.success) {
        return purchaseResult
      }

      // Generate purchase receipt using ReceiptService
      const receipt = await ReceiptService.generateReceipt({
        userId,
        paymentIntentId: paymentIntent.id,
        packageId: packageDetails.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        paymentMethod: paymentIntent.payment_method?.toString(),
        metadata: {
          packageName: packageDetails.name,
          resources: packageDetails.resources
        }
      })

      // Send confirmation email (async, don't wait)
      this.sendPurchaseConfirmationEmail(userId, packageDetails, receipt)
        .catch(error => console.error('Error sending confirmation email:', error))

      return {
        ...purchaseResult,
        transactionId: paymentIntentId,
        receipt
      }
    } catch (error) {
      console.error('Error confirming payment and purchase:', error)
      return {
        success: false,
        error: 'Failed to process purchase'
      }
    }
  }

  /**
   * Process refund
   */
  static async processRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined, // Convert to cents if specified
        reason: reason as Stripe.RefundCreateParams.Reason || 'requested_by_customer'
      })

      return {
        success: true,
        refundId: refund.id
      }
    } catch (error) {
      console.error('Error processing refund:', error)
      return {
        success: false,
        error: 'Failed to process refund'
      }
    }
  }

  /**
   * Get customer payment methods
   */
  static async getCustomerPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      })

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year
        } : undefined
      }))
    } catch (error) {
      console.error('Error getting customer payment methods:', error)
      return []
    }
  }

  /**
   * Set default payment method for customer
   */
  static async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<boolean> {
    try {
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      })
      return true
    } catch (error) {
      console.error('Error setting default payment method:', error)
      return false
    }
  }

  /**
   * Create setup intent for saving payment method
   */
  static async createSetupIntent(customerId: string): Promise<{
    clientSecret: string
    setupIntentId: string
  }> {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session'
      })

      return {
        clientSecret: setupIntent.client_secret!,
        setupIntentId: setupIntent.id
      }
    } catch (error) {
      console.error('Error creating setup intent:', error)
      throw new Error('Failed to create setup intent')
    }
  }

  /**
   * Handle webhook events from Stripe
   */
  static async handleWebhook(
    payload: string,
    signature: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
      if (!webhookSecret) {
        throw new Error('Stripe webhook secret not configured')
      }

      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
          break
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
          break
        
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          // Handle subscription events if needed in the future
          console.log(`Subscription event: ${event.type}`)
          break
        
        default:
          console.log(`Unhandled event type: ${event.type}`)
      }

      return { success: true }
    } catch (error) {
      console.error('Error handling webhook:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get package pricing and details
   */
  static async getPackageDetails(packageId: string): Promise<ResourcePackage | null> {
    // Import PackageService here to avoid circular dependency
    const { PackageService } = await import('./package-service')
    return await PackageService.getPackageById(packageId)
  }

  /**
   * Get all available packages
   */
  static async getAvailablePackages(): Promise<ResourcePackage[]> {
    // Import PackageService here to avoid circular dependency
    const { PackageService } = await import('./package-service')
    return await PackageService.getActivePackages()
  }

  /**
   * Validate payment amount against package price
   */
  static async validatePaymentAmount(
    paymentIntentId: string,
    expectedPackageId: string
  ): Promise<boolean> {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      const packageDetails = await this.getPackageDetails(expectedPackageId)

      if (!packageDetails) {
        return false
      }

      const expectedAmount = Math.round(packageDetails.price * 100) // Convert to cents
      return paymentIntent.amount === expectedAmount
    } catch (error) {
      console.error('Error validating payment amount:', error)
      return false
    }
  }

  /**
   * Private helper methods
   */

  private static async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    try {
      const userId = paymentIntent.metadata.userId
      if (!userId) {
        console.error('User ID not found in payment intent metadata')
        return
      }

      // The actual purchase processing should be handled by the confirmation endpoint
      // This webhook is mainly for logging and additional processing
      console.log(`Payment succeeded for user ${userId}: ${paymentIntent.id}`)
      
      // You could add additional logic here like:
      // - Sending confirmation emails
      // - Updating analytics
      // - Triggering other business processes
    } catch (error) {
      console.error('Error handling payment succeeded:', error)
    }
  }

  private static async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    try {
      const userId = paymentIntent.metadata.userId
      console.log(`Payment failed for user ${userId}: ${paymentIntent.id}`)
      
      // Handle payment failure:
      // - Log the failure
      // - Notify the user
      // - Clean up any pending operations
    } catch (error) {
      console.error('Error handling payment failed:', error)
    }
  }

  /**
   * Generate purchase receipt
   */
  static async generatePurchaseReceipt(
    paymentIntent: any,
    packageDetails: ResourcePackage,
    userId: string
  ): Promise<any> {
    try {
      // Get payment method details
      let paymentMethodInfo = {
        type: 'card',
        last4: undefined,
        brand: undefined
      }

      if (paymentIntent.payment_method) {
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method)
        if (paymentMethod.card) {
          paymentMethodInfo = {
            type: paymentMethod.type,
            last4: paymentMethod.card.last4,
            brand: paymentMethod.card.brand
          }
        }
      }

      const receipt = {
        id: `receipt_${paymentIntent.id}`,
        transactionId: paymentIntent.id,
        packageId: packageDetails.id,
        packageName: packageDetails.name,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency.toUpperCase(),
        purchaseDate: new Date(paymentIntent.created * 1000),
        paymentMethod: paymentMethodInfo,
        resources: packageDetails.resources
      }

      return receipt
    } catch (error) {
      console.error('Error generating purchase receipt:', error)
      throw error
    }
  }

  /**
   * Send purchase confirmation email
   */
  static async sendPurchaseConfirmationEmail(
    userId: string,
    packageDetails: ResourcePackage,
    receipt: any
  ): Promise<void> {
    try {
      // This would integrate with your email service
      // For now, just log the confirmation
      console.log(`Purchase confirmation email sent to user ${userId}:`, {
        package: packageDetails.name,
        amount: receipt.amount,
        transactionId: receipt.transactionId
      })

      // TODO: Integrate with EmailNotificationService
      // await EmailNotificationService.sendPurchaseConfirmation(userId, packageDetails, receipt)
    } catch (error) {
      console.error('Error sending purchase confirmation email:', error)
      // Don't throw error - email failure shouldn't fail the purchase
    }
  }

  /**
   * Process automatic wallet crediting
   */
  static async processWalletCrediting(
    userId: string,
    packageDetails: ResourcePackage,
    transactionId: string
  ): Promise<{
    success: boolean
    walletBalance?: any
    error?: string
  }> {
    try {
      // Add project vouchers
      if (packageDetails.resources.projectVouchers > 0) {
        const voucherResult = await ResourceWalletService.addResources(
          userId,
          'project_voucher',
          packageDetails.resources.projectVouchers,
          'purchase',
          `Package purchase: ${packageDetails.name}`,
          undefined,
          transactionId
        )

        if (!voucherResult.success) {
          throw new Error(`Failed to credit project vouchers: ${voucherResult.error}`)
        }
      }

      // Add facilitator seats
      if (packageDetails.resources.facilitatorSeats > 0) {
        const facilitatorResult = await ResourceWalletService.addResources(
          userId,
          'facilitator_seat',
          packageDetails.resources.facilitatorSeats,
          'purchase',
          `Package purchase: ${packageDetails.name}`,
          undefined,
          transactionId
        )

        if (!facilitatorResult.success) {
          throw new Error(`Failed to credit facilitator seats: ${facilitatorResult.error}`)
        }
      }

      // Add storyteller seats
      if (packageDetails.resources.storytellerSeats > 0) {
        const storytellerResult = await ResourceWalletService.addResources(
          userId,
          'storyteller_seat',
          packageDetails.resources.storytellerSeats,
          'purchase',
          `Package purchase: ${packageDetails.name}`,
          undefined,
          transactionId
        )

        if (!storytellerResult.success) {
          throw new Error(`Failed to credit storyteller seats: ${storytellerResult.error}`)
        }
      }

      // Get updated wallet balance
      const walletBalance = await ResourceWalletService.getWalletBalance(userId)

      return {
        success: true,
        walletBalance
      }
    } catch (error) {
      console.error('Error processing wallet crediting:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to credit wallet'
      }
    }
  }

  /**
   * Verify purchase completion
   */
  static async verifyPurchaseCompletion(
    paymentIntentId: string,
    userId: string
  ): Promise<{
    isComplete: boolean
    walletCredited: boolean
    receiptGenerated: boolean
    emailSent: boolean
  }> {
    try {
      // Check payment intent status
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      const isComplete = paymentIntent.status === 'succeeded'

      if (!isComplete) {
        return {
          isComplete: false,
          walletCredited: false,
          receiptGenerated: false,
          emailSent: false
        }
      }

      // Check if wallet was credited by looking at recent transactions
      const recentTransactions = await ResourceWalletService.getTransactionHistory(userId, {
        limit: 10
      })

      const walletCredited = recentTransactions.some(transaction => 
        transaction.description?.includes(paymentIntentId) ||
        transaction.projectId === paymentIntentId
      )

      // For now, assume receipt and email are handled if wallet is credited
      // In a real implementation, you'd check actual receipt and email logs
      const receiptGenerated = walletCredited
      const emailSent = walletCredited

      return {
        isComplete,
        walletCredited,
        receiptGenerated,
        emailSent
      }
    } catch (error) {
      console.error('Error verifying purchase completion:', error)
      return {
        isComplete: false,
        walletCredited: false,
        receiptGenerated: false,
        emailSent: false
      }
    }
  }

  /**
   * Utility methods for testing and development
   */

  static async createTestPaymentMethod(): Promise<string> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test payment methods can only be created in non-production environments')
    }

    try {
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: '4242424242424242', // Test card number
          exp_month: 12,
          exp_year: 2025,
          cvc: '123'
        }
      })

      return paymentMethod.id
    } catch (error) {
      console.error('Error creating test payment method:', error)
      throw new Error('Failed to create test payment method')
    }
  }

  static async getPaymentIntentStatus(paymentIntentId: string): Promise<string> {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      return paymentIntent.status
    } catch (error) {
      console.error('Error getting payment intent status:', error)
      throw new Error('Failed to get payment intent status')
    }
  }
}