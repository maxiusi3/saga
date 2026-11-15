import { NextRequest, NextResponse } from 'next/server'
import { PaymentError, receivePaymentEvent } from '@/lib/server/payment-orders'
import { readPaymentBody } from '@/lib/server/payment-request-body'
export async function POST(request: NextRequest) {
  try {
    const raw = await readPaymentBody(request, 256 * 1024)
    return NextResponse.json(await receivePaymentEvent(raw, request.headers.get('stripe-signature')))
  } catch (e) { return NextResponse.json({ error: e instanceof PaymentError ? e.message : 'Payment reconciliation is unavailable.' }, { status: e instanceof PaymentError ? e.status : 503 }) }
}
