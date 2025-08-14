/**
 * Payment-related types for Saga platform
 */

// ResourcePackage is exported from resource-wallet.ts

export interface PaymentIntent {
  id: string
  clientSecret: string
  amount: number
  currency: string
  status: string
}

// PaymentMethod is exported from subscription.ts

export interface StripeCustomer {
  id: string
  email: string
  name?: string
  defaultPaymentMethod?: string
}

// PackagePurchaseRequest is exported from resource-wallet.ts

// PackagePurchaseResult is exported from resource-wallet.ts

export interface BillingAddress {
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
  country: string
}

export interface PurchaseReceipt {
  id: string
  transactionId: string
  packageId: string
  packageName: string
  amount: number
  currency: string
  purchaseDate: Date
  billingAddress?: BillingAddress
  paymentMethod: {
    type: string
    last4?: string
    brand?: string
  }
  resources: {
    projectVouchers: number
    facilitatorSeats: number
    storytellerSeats: number
  }
}

export interface WalletBalance {
  projectVouchers: number
  facilitatorSeats: number
  storytellerSeats: number
  totalValue: number
}

export interface PaymentHistory {
  id: string
  transactionId: string
  type: 'purchase' | 'refund'
  packageId?: string
  packageName?: string
  amount: number
  currency: string
  status: 'succeeded' | 'failed' | 'pending' | 'refunded'
  createdAt: Date
  receipt?: PurchaseReceipt
}

export interface RefundRequest {
  paymentIntentId: string
  amount?: number
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  description?: string
}

export interface RefundResult {
  success: boolean
  refundId?: string
  amount?: number
  status?: string
  error?: string
}

export interface SetupIntent {
  clientSecret: string
  setupIntentId: string
}

export interface PaymentAnalytics {
  totalRevenue: number
  totalTransactions: number
  successRate: number
  averageOrderValue: number
  topPackages: Array<{
    packageId: string
    packageName: string
    sales: number
    revenue: number
  }>
  conversionRate: number
  refundRate: number
}

// Mobile payment specific types
export interface ApplePayRequest {
  countryCode: string
  currencyCode: string
  merchantIdentifier: string
  merchantCapabilities: string[]
  supportedNetworks: string[]
  paymentSummaryItems: ApplePaySummaryItem[]
}

export interface ApplePaySummaryItem {
  label: string
  amount: string
  type?: 'final' | 'pending'
}

export interface GooglePayRequest {
  apiVersion: number
  apiVersionMinor: number
  allowedPaymentMethods: GooglePayPaymentMethod[]
  transactionInfo: GooglePayTransactionInfo
  merchantInfo: GooglePayMerchantInfo
}

export interface GooglePayPaymentMethod {
  type: string
  parameters: {
    allowedAuthMethods: string[]
    allowedCardNetworks: string[]
  }
  tokenizationSpecification: {
    type: string
    parameters: {
      gateway: string
      gatewayMerchantId: string
    }
  }
}

export interface GooglePayTransactionInfo {
  totalPriceStatus: string
  totalPrice: string
  currencyCode: string
  countryCode: string
}

export interface GooglePayMerchantInfo {
  merchantName: string
  merchantId: string
}

// Webhook event types
export interface StripeWebhookEvent {
  id: string
  type: string
  data: {
    object: any
  }
  created: number
  livemode: boolean
}

export interface PaymentWebhookData {
  paymentIntentId: string
  customerId: string
  amount: number
  currency: string
  status: string
  metadata: Record<string, string>
}

// Error types
export interface PaymentError {
  code: string
  message: string
  type: 'card_error' | 'validation_error' | 'api_error' | 'authentication_error'
  param?: string
  decline_code?: string
}

export interface InsufficientFundsError {
  code: 'INSUFFICIENT_RESOURCES'
  message: string
  requiredResource: string
  requiredAmount: number
  availableAmount: number
}

// Configuration types
export interface PaymentConfig {
  stripePublishableKey: string
  appleMerchantId?: string
  googleMerchantId?: string
  supportedCountries: string[]
  supportedCurrencies: string[]
  minimumAmount: number
  maximumAmount: number
}