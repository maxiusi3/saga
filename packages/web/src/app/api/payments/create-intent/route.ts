import { NextRequest, NextResponse } from 'next/server'

// PLACEHOLDER IMPLEMENTATION - Replace with actual Stripe integration in production
// This is a mock implementation for development purposes

// PLACEHOLDER: Replace with actual Stripe secret key in production
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key'

interface CreatePaymentIntentRequest {
  packageId: string
  amount: number
  currency: string
  metadata?: Record<string, string>
}

// Mock package pricing (in cents)
const PACKAGE_PRICES = {
  'saga-package': 12900, // $129.00
  'saga-package-family': 19900, // $199.00
  'saga-package-premium': 29900, // $299.00
}

export async function POST(request: NextRequest) {
  try {
    const body: CreatePaymentIntentRequest = await request.json()
    const { packageId, amount, currency = 'usd', metadata = {} } = body

    // Validate request
    if (!packageId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: packageId and amount' },
        { status: 400 }
      )
    }

    // Validate package exists and amount matches
    const expectedAmount = PACKAGE_PRICES[packageId as keyof typeof PACKAGE_PRICES]
    if (!expectedAmount) {
      return NextResponse.json(
        { error: 'Invalid package ID' },
        { status: 400 }
      )
    }

    if (amount !== expectedAmount) {
      return NextResponse.json(
        { error: 'Amount does not match package price' },
        { status: 400 }
      )
    }

    // PLACEHOLDER: In production, this would create a real Stripe PaymentIntent
    // For now, we return a mock PaymentIntent
    const mockPaymentIntent = {
      id: `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      client_secret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
      amount: amount,
      currency: currency,
      status: 'requires_payment_method' as const,
      created: Math.floor(Date.now() / 1000),
      metadata: {
        packageId,
        ...metadata
      }
    }

    // Log for development purposes
    console.log('PLACEHOLDER: Created mock PaymentIntent:', {
      id: mockPaymentIntent.id,
      amount: mockPaymentIntent.amount,
      packageId
    })

    return NextResponse.json(mockPaymentIntent)

  } catch (error) {
    console.error('Error creating payment intent:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
