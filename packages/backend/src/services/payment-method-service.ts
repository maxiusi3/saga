/**
 * Payment Method Service
 * Handles payment method management for users
 */

import { stripe } from '../config/stripe'
import { BaseModel } from '../models/base'
import type { 
  PaymentMethod, 
  SavedPaymentMethod,
  PaymentMethodResult 
} from '@saga/shared/types'

export class PaymentMethodService {
  /**
   * Get all payment methods for a customer
   */
  static async getCustomerPaymentMethods(customerId: string): Promise<SavedPaymentMethod[]> {
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
          expYear: pm.card.exp_year,
          funding: pm.card.funding
        } : undefined,
        isDefault: false, // Will be updated below
        createdAt: new Date(pm.created * 1000)
      }))
    } catch (error) {
      console.error('Error getting customer payment methods:', error)
      return []
    }
  }

  /**
   * Add a new payment method to customer
   */
  static async addPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<PaymentMethodResult> {
    try {
      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      })

      // Get the payment method details
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)

      const savedPaymentMethod: SavedPaymentMethod = {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
          funding: paymentMethod.card.funding
        } : undefined,
        isDefault: false,
        createdAt: new Date(paymentMethod.created * 1000)
      }

      return {
        success: true,
        paymentMethod: savedPaymentMethod
      }
    } catch (error) {
      console.error('Error adding payment method:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add payment method'
      }
    }
  }

  /**
   * Remove a payment method from customer
   */
  static async removePaymentMethod(paymentMethodId: string): Promise<PaymentMethodResult> {
    try {
      await stripe.paymentMethods.detach(paymentMethodId)

      return {
        success: true
      }
    } catch (error) {
      console.error('Error removing payment method:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove payment method'
      }
    }
  }

  /**
   * Set default payment method for customer
   */
  static async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<PaymentMethodResult> {
    try {
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      })

      return {
        success: true
      }
    } catch (error) {
      console.error('Error setting default payment method:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set default payment method'
      }
    }
  }

  /**
   * Get default payment method for customer
   */
  static async getDefaultPaymentMethod(customerId: string): Promise<SavedPaymentMethod | null> {
    try {
      const customer = await stripe.customers.retrieve(customerId)
      
      if ('deleted' in customer || !customer.invoice_settings.default_payment_method) {
        return null
      }

      const paymentMethodId = customer.invoice_settings.default_payment_method as string
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)

      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
          funding: paymentMethod.card.funding
        } : undefined,
        isDefault: true,
        createdAt: new Date(paymentMethod.created * 1000)
      }
    } catch (error) {
      console.error('Error getting default payment method:', error)
      return null
    }
  }

  /**
   * Create setup intent for saving payment method
   */
  static async createSetupIntent(customerId: string): Promise<{
    success: boolean
    clientSecret?: string
    setupIntentId?: string
    error?: string
  }> {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session'
      })

      return {
        success: true,
        clientSecret: setupIntent.client_secret!,
        setupIntentId: setupIntent.id
      }
    } catch (error) {
      console.error('Error creating setup intent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create setup intent'
      }
    }
  }

  /**
   * Confirm setup intent and save payment method
   */
  static async confirmSetupIntent(
    setupIntentId: string,
    customerId: string
  ): Promise<PaymentMethodResult> {
    try {
      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)

      if (setupIntent.status !== 'succeeded') {
        return {
          success: false,
          error: `Setup intent not completed. Status: ${setupIntent.status}`
        }
      }

      if (!setupIntent.payment_method) {
        return {
          success: false,
          error: 'No payment method attached to setup intent'
        }
      }

      // Get the payment method details
      const paymentMethod = await stripe.paymentMethods.retrieve(
        setupIntent.payment_method as string
      )

      const savedPaymentMethod: SavedPaymentMethod = {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
          funding: paymentMethod.card.funding
        } : undefined,
        isDefault: false,
        createdAt: new Date(paymentMethod.created * 1000)
      }

      return {
        success: true,
        paymentMethod: savedPaymentMethod
      }
    } catch (error) {
      console.error('Error confirming setup intent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm setup intent'
      }
    }
  }

  /**
   * Update payment method (mainly for updating billing details)
   */
  static async updatePaymentMethod(
    paymentMethodId: string,
    updates: {
      billingDetails?: {
        name?: string
        email?: string
        phone?: string
        address?: {
          line1?: string
          line2?: string
          city?: string
          state?: string
          postal_code?: string
          country?: string
        }
      }
    }
  ): Promise<PaymentMethodResult> {
    try {
      const paymentMethod = await stripe.paymentMethods.update(paymentMethodId, {
        billing_details: updates.billingDetails
      })

      const savedPaymentMethod: SavedPaymentMethod = {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
          funding: paymentMethod.card.funding
        } : undefined,
        isDefault: false,
        createdAt: new Date(paymentMethod.created * 1000)
      }

      return {
        success: true,
        paymentMethod: savedPaymentMethod
      }
    } catch (error) {
      console.error('Error updating payment method:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update payment method'
      }
    }
  }

  /**
   * Get payment method by ID
   */
  static async getPaymentMethodById(paymentMethodId: string): Promise<SavedPaymentMethod | null> {
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)

      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
          funding: paymentMethod.card.funding
        } : undefined,
        isDefault: false,
        createdAt: new Date(paymentMethod.created * 1000)
      }
    } catch (error) {
      console.error('Error getting payment method by ID:', error)
      return null
    }
  }

  /**
   * Validate payment method for customer
   */
  static async validatePaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<boolean> {
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
      return paymentMethod.customer === customerId
    } catch (error) {
      console.error('Error validating payment method:', error)
      return false
    }
  }

  /**
   * Get payment methods with default status
   */
  static async getPaymentMethodsWithDefault(customerId: string): Promise<SavedPaymentMethod[]> {
    try {
      // Get all payment methods
      const paymentMethods = await this.getCustomerPaymentMethods(customerId)
      
      // Get default payment method
      const defaultPaymentMethod = await this.getDefaultPaymentMethod(customerId)
      
      // Mark default payment method
      return paymentMethods.map(pm => ({
        ...pm,
        isDefault: defaultPaymentMethod?.id === pm.id
      }))
    } catch (error) {
      console.error('Error getting payment methods with default:', error)
      return []
    }
  }

  /**
   * Create test payment method (for development/testing)
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

  /**
   * Handle expired payment methods
   */
  static async handleExpiredPaymentMethods(customerId: string): Promise<{
    expiredMethods: SavedPaymentMethod[]
    activeCount: number
  }> {
    try {
      const paymentMethods = await this.getCustomerPaymentMethods(customerId)
      const currentDate = new Date()
      const currentYear = currentDate.getFullYear()
      const currentMonth = currentDate.getMonth() + 1 // JavaScript months are 0-indexed

      const expiredMethods = paymentMethods.filter(pm => {
        if (!pm.card) return false
        
        const expYear = pm.card.expYear
        const expMonth = pm.card.expMonth
        
        return expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)
      })

      const activeCount = paymentMethods.length - expiredMethods.length

      // Optionally remove expired methods automatically
      // for (const expiredMethod of expiredMethods) {
      //   await this.removePaymentMethod(expiredMethod.id)
      // }

      return {
        expiredMethods,
        activeCount
      }
    } catch (error) {
      console.error('Error handling expired payment methods:', error)
      return {
        expiredMethods: [],
        activeCount: 0
      }
    }
  }

  /**
   * Get payment method usage statistics
   */
  static async getPaymentMethodStats(customerId: string): Promise<{
    totalMethods: number
    activemethods: number
    expiredMethods: number
    defaultMethodSet: boolean
    lastUsedMethod?: SavedPaymentMethod
  }> {
    try {
      const paymentMethods = await this.getCustomerPaymentMethods(customerId)
      const defaultMethod = await this.getDefaultPaymentMethod(customerId)
      const expiredInfo = await this.handleExpiredPaymentMethods(customerId)

      // Find most recently used method (most recently created as proxy)
      const lastUsedMethod = paymentMethods.sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      )[0]

      return {
        totalMethods: paymentMethods.length,
        activeMethod: expiredInfo.activeCount,
        expiredMethods: expiredInfo.expiredMethods.length,
        defaultMethodSet: !!defaultMethod,
        lastUsedMethod
      }
    } catch (error) {
      console.error('Error getting payment method stats:', error)
      return {
        totalMethods: 0,
        activeMethod: 0,
        expiredMethods: 0,
        defaultMethodSet: false
      }
    }
  }
}