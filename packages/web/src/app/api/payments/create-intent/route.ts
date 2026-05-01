import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getPaymentPackage } from '@/lib/payments/catalog'
import { getAuthenticatedUser } from '@/lib/server/auth'

interface CreateIntentBody {
  packageId?: unknown
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Payment service is not configured' }, { status: 503, headers: auth.headers })
  }

  let body: CreateIntentBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid payment request' }, { status: 400, headers: auth.headers })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payment request' }, { status: 400, headers: auth.headers })
  }

  const { packageId } = body
  if (typeof packageId !== 'string') {
    return NextResponse.json({ error: 'Invalid package' }, { status: 400, headers: auth.headers })
  }

  const paymentPackage = getPaymentPackage(packageId)

  if (!paymentPackage) {
    return NextResponse.json({ error: 'Invalid package' }, { status: 400, headers: auth.headers })
  }

  const stripe = new Stripe(stripeSecretKey)
  let paymentIntent
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: paymentPackage.amount,
      currency: paymentPackage.currency,
      metadata: {
        packageId: paymentPackage.id,
        packageName: paymentPackage.name,
        userId: auth.user.id,
      },
    })
  } catch {
    console.error('Failed to create Stripe payment intent')
    return NextResponse.json({ error: 'Unable to create payment intent' }, { status: 502, headers: auth.headers })
  }

  return NextResponse.json(
    {
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    },
    { headers: auth.headers },
  )
}
