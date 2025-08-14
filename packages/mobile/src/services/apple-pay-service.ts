/**
 * Apple Pay Service
 * Handles Apple Pay integration for iOS app
 */

import { Platform } from 'react-native'
import { 
  ApplePayRequest, 
  ApplePaySummaryItem, 
  ResourcePackage,
  PaymentMethod 
} from '@saga/shared/types'

// Mock Apple Pay for development - replace with actual Apple Pay SDK
interface ApplePaySDK {
  canMakePayments(): Promise<boolean>
  canMakePaymentsUsingNetworks(networks: string[]): Promise<boolean>
  requestPayment(request: ApplePayRequest): Promise<ApplePayPaymentResult>
}

interface ApplePayPaymentResult {
  paymentData: string
  transactionIdentifier: string
  paymentMethod: {
    displayName: string
    network: string
    type: string
  }
  billingContact?: {
    name: string
    addressLines: string[]
    city: string
    state: string
    postalCode: string
    country: string
  }
}

// Mock implementation - replace with actual Apple Pay SDK
const mockApplePaySDK: ApplePaySDK = {
  async canMakePayments(): Promise<boolean> {
    return Platform.OS === 'ios' && __DEV__ // Only available on iOS and in dev mode for testing
  },

  async canMakePaymentsUsingNetworks(networks: string[]): Promise<boolean> {
    return Platform.OS === 'ios' && networks.length > 0
  },

  async requestPayment(request: ApplePayRequest): Promise<ApplePayPaymentResult> {
    // Mock implementation for development
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate for testing
          resolve({
            paymentData: 'mock_payment_data_' + Date.now(),
            transactionIdentifier: 'mock_transaction_' + Date.now(),
            paymentMethod: {
              displayName: 'Visa •••• 1234',
              network: 'Visa',
              type: 'debit'
            },
            billingContact: {
              name: 'John Doe',
              addressLines: ['123 Main St'],
              city: 'San Francisco',
              state: 'CA',
              postalCode: '94105',
              country: 'US'
            }
          })
        } else {
          reject(new Error('Payment cancelled by user'))
        }
      }, 2000) // Simulate processing time
    })
  }
}

export class ApplePayService {
  private static readonly MERCHANT_ID = 'merchant.com.saga.app'
  private static readonly SUPPORTED_NETWORKS = [
    'visa',
    'masterCard',
    'amex',
    'discover'
  ]
  private static readonly MERCHANT_CAPABILITIES = [
    'supports3DS',
    'supportsEMV',
    'supportsCredit',
    'supportsDebit'
  ]

  /**
   * Check if Apple Pay is available on this device
   */
  static async isAvailable(): Promise<boolean> {
    try {
      if (Platform.OS !== 'ios') {
        return false
      }

      const canMakePayments = await mockApplePaySDK.canMakePayments()
      const canMakePaymentsWithNetworks = await mockApplePaySDK.canMakePaymentsUsingNetworks(
        this.SUPPORTED_NETWORKS
      )

      return canMakePayments && canMakePaymentsWithNetworks
    } catch (error) {
      console.error('Error checking Apple Pay availability:', error)
      return false
    }
  }

  /**
   * Create Apple Pay request for package purchase
   */
  static createPaymentRequest(
    packageDetails: ResourcePackage,
    countryCode: string = 'US'
  ): ApplePayRequest {
    const paymentSummaryItems: ApplePaySummaryItem[] = [
      {
        label: packageDetails.name,
        amount: packageDetails.price.toFixed(2),
        type: 'final'
      },
      {
        label: 'Saga Family Biography',
        amount: packageDetails.price.toFixed(2),
        type: 'final'
      }
    ]

    return {
      countryCode,
      currencyCode: packageDetails.currency,
      merchantIdentifier: this.MERCHANT_ID,
      merchantCapabilities: this.MERCHANT_CAPABILITIES,
      supportedNetworks: this.SUPPORTED_NETWORKS,
      paymentSummaryItems
    }
  }

  /**
   * Process Apple Pay payment
   */
  static async processPayment(
    packageDetails: ResourcePackage,
    countryCode: string = 'US'
  ): Promise<{
    success: boolean
    paymentData?: string
    transactionId?: string
    paymentMethod?: PaymentMethod
    error?: string
  }> {
    try {
      // Check if Apple Pay is available
      const isAvailable = await this.isAvailable()
      if (!isAvailable) {
        return {
          success: false,
          error: 'Apple Pay is not available on this device'
        }
      }

      // Create payment request
      const paymentRequest = this.createPaymentRequest(packageDetails, countryCode)

      // Request payment from Apple Pay
      const paymentResult = await mockApplePaySDK.requestPayment(paymentRequest)

      // Convert to our PaymentMethod format
      const paymentMethod: PaymentMethod = {
        id: paymentResult.transactionIdentifier,
        type: 'apple_pay',
        applePay: {
          displayName: paymentResult.paymentMethod.displayName
        }
      }

      return {
        success: true,
        paymentData: paymentResult.paymentData,
        transactionId: paymentResult.transactionIdentifier,
        paymentMethod
      }
    } catch (error) {
      console.error('Apple Pay payment failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Apple Pay payment failed'
      }
    }
  }

  /**
   * Validate Apple Pay payment data with backend
   */
  static async validatePaymentWithBackend(
    paymentData: string,
    transactionId: string,
    packageId: string
  ): Promise<{
    success: boolean
    paymentIntentId?: string
    error?: string
  }> {
    try {
      // This would make an API call to your backend to validate the Apple Pay payment
      // The backend would then create a Stripe payment intent or process the payment
      
      const response = await fetch('/api/payments/apple-pay/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentData,
          transactionId,
          packageId
        })
      })

      const result = await response.json()

      if (result.success) {
        return {
          success: true,
          paymentIntentId: result.data.paymentIntentId
        }
      } else {
        return {
          success: false,
          error: result.error || 'Payment validation failed'
        }
      }
    } catch (error) {
      console.error('Error validating Apple Pay payment:', error)
      return {
        success: false,
        error: 'Failed to validate payment with server'
      }
    }
  }

  /**
   * Complete purchase flow with Apple Pay
   */
  static async completePurchase(
    packageDetails: ResourcePackage,
    userId: string,
    countryCode: string = 'US'
  ): Promise<{
    success: boolean
    transactionId?: string
    walletBalance?: any
    error?: string
  }> {
    try {
      // Step 1: Process Apple Pay payment
      const paymentResult = await this.processPayment(packageDetails, countryCode)
      
      if (!paymentResult.success) {
        return {
          success: false,
          error: paymentResult.error
        }
      }

      // Step 2: Validate payment with backend
      const validationResult = await this.validatePaymentWithBackend(
        paymentResult.paymentData!,
        paymentResult.transactionId!,
        packageDetails.id
      )

      if (!validationResult.success) {
        return {
          success: false,
          error: validationResult.error
        }
      }

      // Step 3: Confirm purchase with backend
      const confirmResponse = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: validationResult.paymentIntentId,
          userId
        })
      })

      const confirmResult = await confirmResponse.json()

      if (confirmResult.success) {
        return {
          success: true,
          transactionId: confirmResult.data.transactionId,
          walletBalance: confirmResult.data.walletBalance
        }
      } else {
        return {
          success: false,
          error: confirmResult.error || 'Failed to confirm purchase'
        }
      }
    } catch (error) {
      console.error('Error completing Apple Pay purchase:', error)
      return {
        success: false,
        error: 'Failed to complete purchase'
      }
    }
  }

  /**
   * Get Apple Pay button style configuration
   */
  static getButtonStyle() {
    return {
      type: 'buy', // 'plain', 'buy', 'setUp', 'inStore', 'donate'
      style: 'black', // 'white', 'whiteOutline', 'black'
      cornerRadius: 8,
      height: 44
    }
  }

  /**
   * Handle Apple Pay errors
   */
  static handleError(error: any): string {
    if (error.code === 'UserCancel') {
      return 'Payment was cancelled'
    } else if (error.code === 'SystemCancel') {
      return 'Payment was cancelled by the system'
    } else if (error.code === 'PaymentNotAllowed') {
      return 'Payment not allowed'
    } else if (error.code === 'PaymentInvalid') {
      return 'Payment information is invalid'
    } else if (error.code === 'PaymentNotSupported') {
      return 'Apple Pay is not supported on this device'
    } else {
      return error.message || 'An unknown error occurred'
    }
  }
}

// Export types for use in components
export type { ApplePayPaymentResult }