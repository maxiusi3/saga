import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required')
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
})

export const STRIPE_CONFIG = {
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  currency: 'usd',
  successUrl: process.env.NODE_ENV === 'production' 
    ? 'https://saga.app/payment/success'
    : 'http://localhost:3000/payment/success',
  cancelUrl: process.env.NODE_ENV === 'production'
    ? 'https://saga.app/payment/cancel'
    : 'http://localhost:3000/payment/cancel',
  
  // Package pricing (in cents)
  packages: {
    'saga-package-v1': {
      price: 9900, // $99.00
      name: 'The Saga Package',
      description: 'Complete family storytelling package'
    },
    'saga-package-premium': {
      price: 14900, // $149.00
      name: 'The Saga Premium Package', 
      description: 'Premium family storytelling package with extra resources'
    }
  }
} as const