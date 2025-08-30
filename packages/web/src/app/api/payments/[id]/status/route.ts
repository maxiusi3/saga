import { NextRequest, NextResponse } from 'next/server'

// PLACEHOLDER IMPLEMENTATION - Replace with actual Stripe integration in production

interface PaymentIntentStatus {
  id: string
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled'
  amount: number
  currency: string
  created: number
  metadata: Record<string, string>
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paymentIntentId = params.id

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      )
    }

    // PLACEHOLDER: In production, this would query Stripe API
    // For now, we return mock status based on the ID pattern
    
    const mockStatus: PaymentIntentStatus = generateMockStatus(paymentIntentId)

    // Log for development purposes
    console.log('PLACEHOLDER: Retrieved payment status:', {
      id: paymentIntentId,
      status: mockStatus.status
    })

    return NextResponse.json(mockStatus)

  } catch (error) {
    console.error('Error retrieving payment status:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve payment status' },
      { status: 500 }
    )
  }
}

function generateMockStatus(paymentIntentId: string): PaymentIntentStatus {
  // PLACEHOLDER: Generate realistic mock status based on ID
  
  const baseStatus: PaymentIntentStatus = {
    id: paymentIntentId,
    status: 'requires_payment_method',
    amount: 12900, // Default to basic package price
    currency: 'usd',
    created: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
    metadata: {
      packageId: 'saga-package'
    }
  }

  // Simulate different statuses based on ID patterns (for testing)
  if (paymentIntentId.includes('succeeded')) {
    baseStatus.status = 'succeeded'
  } else if (paymentIntentId.includes('processing')) {
    baseStatus.status = 'processing'
  } else if (paymentIntentId.includes('requires_action')) {
    baseStatus.status = 'requires_action'
  } else if (paymentIntentId.includes('canceled')) {
    baseStatus.status = 'canceled'
  }

  return baseStatus
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
