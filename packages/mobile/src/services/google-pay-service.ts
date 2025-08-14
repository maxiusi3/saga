/**
 * Google Pay Service
 * Handles Google Pay integration for Android app
 */

import { Platform } from 'react-native'
import { 
  GooglePayRequest, 
  GooglePayPaymentMethod,
  GooglePayTransactionInfo,
  GooglePayMerchantInfo,
  ResourcePackage,
  PaymentMethod 
} from '@saga/shared/types'

// Mock Google Pay for development - replace with actual Google Pay SDK
interface GooglePaySDK {
  isReadyToPay(request: any): Promise<boolean>
  loadPaymentData(request: GooglePayRequest): Promise<GooglePayPaymentResult>
}

interface GooglePayPaymentResult {
  paymentMethodData: {
    tokenizationData: {
      token: string
    }
    info: {
      cardNetwork: string
      cardDetails: string
    }
  }
  shippingAddress?: {
    name: string
    address1: string
    address2?: string
    locality: string
    administrativeArea: string
    postalCode: string
    countryCode: string
  }
  email?: string
}

// Mock implementation - replace with actual Google Pay SDK
const mockGooglePaySDK: GooglePaySDK = {
  async isReadyToPay(request: any): Promise<boolean> {
    return Platform.OS === 'android' && __DEV__ // Only available on Android and in dev mode for testing
  },

  async loadPaymentData(request: GooglePayRequest): Promise<GooglePayPaymentResult> {
    // Mock implementation for development
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate for testing
          resolve({
            paymentMethodData: {
              tokenizationData: {
                token: 'mock_google_pay_token_' + Date.now()
              },
              info: {
                cardNetwork: 'VISA',
                cardDetails: '1234'
              }
            },
            shippingAddress: {
              name: 'John Doe',
              address1: '123 Main St',
              locality: 'San Francisco',
              administrativeArea: 'CA',
              postalCode: '94105',
              countryCode: 'US'
            },
            email: 'john.doe@example.com'
          })
        } else {
          reject(new Error('Payment cancelled by user'))
        }
      }, 2000) // Simulate processing time
    })
  }
}

export class GooglePayService {
  private static readonly GATEWAY = 'stripe'
  private static readonly GATEWAY_MERCHANT_ID = 'your_stripe_merchant_id'
  private static readonly MERCHANT_NAME = 'Saga Family Biography'
  private static readonly MERCHANT_ID = 'your_google_merchant_id'
  
  private static readonly ALLOWED_CARD_NETWORKS = [
    'AMEX',
    'DISCOVER',
    'INTERAC',
    'JCB',
    'MASTERCARD',
    'VISA'
  ]
  
  private static readonly ALLOWED_AUTH_METHODS = [
    'PAN_ONLY',
    'CRYPTOGRAM_3DS'
  ]

  /**
   * Check if Google Pay is available on this device
   */
  static async isAvailable(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return false
      }

      const isReadyToPayRequest = {
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [this.getBaseCardPaymentMethod()]
      }

      return await mockGooglePaySDK.isReadyToPay(isReadyToPayRequest)
    } catch (error) {
      console.error('Error checking Google Pay availability:', error)
      return false
    }
  }

  /**
   * Get base card payment method configuration
   */
  private static getBaseCardPaymentMethod(): GooglePayPaymentMethod {
    return {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: this.ALLOWED_AUTH_METHODS,
        allowedCardNetworks: this.ALLOWED_CARD_NETWORKS
      },
      tokenizationSpecification: {
        type: 'PAYMENT_GATEWAY',
        parameters: {
          gateway: this.GATEWAY,
          gatewayMerchantId: this.GATEWAY_MERCHANT_ID
        }
      }
    }
  }

  /**
   * Create Google Pay request for package purchase
   */
  static createPaymentRequest(
    packageDetails: ResourcePackage,
    countryCode: string = 'US'
  ): GooglePayRequest {
    const transactionInfo: GooglePayTransactionInfo = {
      totalPriceStatus: 'FINAL',
      totalPrice: packageDetails.price.toFixed(2),
      currencyCode: packageDetails.currency,
      countryCode
    }

    const merchantInfo: GooglePayMerchantInfo = {
      merchantName: this.MERCHANT_NAME,
      merchantId: this.MERCHANT_ID
    }

    return {
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [this.getBaseCardPaymentMethod()],
      transactionInfo,
      merchantInfo
    }
  }

  /**
   * Process Google Pay payment
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
      // Check if Google Pay is available
      const isAvailable = await this.isAvailable()
      if (!isAvailable) {
        return {
          success: false,
          error: 'Google Pay is not available on this device'
        }
      }

      // Create payment request
      const paymentRequest = this.createPaymentRequest(packageDetails, countryCode)

      // Request payment from Google Pay
      const paymentResult = await mockGooglePaySDK.loadPaymentData(paymentRequest)

      // Generate transaction ID
      const transactionId = 'gp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

      // Convert to our PaymentMethod format
      const paymentMethod: PaymentMethod = {
        id: transactionId,
        type: 'google_pay',
        googlePay: {
          displayName: `${paymentResult.paymentMethodData.info.cardNetwork} •••• ${paymentResult.paymentMethodData.info.cardDetails}`
        }
      }

      return {
        success: true,
        paymentData: paymentResult.paymentMethodData.tokenizationData.token,
        transactionId,
        paymentMethod
      }
    } catch (error) {
      console.error('Google Pay payment failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google Pay payment failed'
      }
    }
  }

  /**
   * Validate Google Pay payment data with backend
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
      // This would make an API call to your backend to validate the Google Pay payment
      // The backend would then create a Stripe payment intent or process the payment
      
      const response = await fetch('/api/payments/google-pay/validate', {
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
      console.error('Error validating Google Pay payment:', error)
      return {
        success: false,
        error: 'Failed to validate payment with server'
      }
    }
  }

  /**
   * Complete purchase flow with Google Pay
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
      // Step 1: Process Google Pay payment
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
      console.error('Error completing Google Pay purchase:', error)
      return {
        success: false,
        error: 'Failed to complete purchase'
      }
    }
  }

  /**
   * Get Google Pay button style configuration
   */
  static getButtonStyle() {
    return {
      type: 'buy', // 'book', 'buy', 'checkout', 'donate', 'order', 'pay', 'plain', 'subscribe'
      theme: 'dark', // 'dark', 'light'
      cornerRadius: 8,
      height: 44
    }
  }

  /**
   * Handle Google Pay errors
   */
  static handleError(error: any): string {
    if (error.statusCode === 'CANCELED') {
      return 'Payment was cancelled'
    } else if (error.statusCode === 'DEVELOPER_ERROR') {
      return 'Developer error occurred'
    } else if (error.statusCode === 'INTERNAL_ERROR') {
      return 'Internal error occurred'
    } else if (error.statusCode === 'NETWORK_ERROR') {
      return 'Network error occurred'
    } else if (error.statusCode === 'RESOLUTION_REQUIRED') {
      return 'Resolution required'
    } else {
      return error.message || 'An unknown error occurred'
    }
  }

  /**
   * Prefetch payment data to improve performance
   */
  static async prefetchPaymentData(packageDetails: ResourcePackage): Promise<void> {
    try {
      const isAvailable = await this.isAvailable()
      if (isAvailable) {
        // Prefetch payment data in the background
        const paymentRequest = this.createPaymentRequest(packageDetails)
        // This would typically prefetch the payment sheet
        console.log('Prefetching Google Pay data for package:', packageDetails.id)
      }
    } catch (error) {
      console.error('Error prefetching Google Pay data:', error)
    }
  }
}

// Export types for use in components
export type { GooglePayPaymentResult }