import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { orderView, PaymentError, paymentUuid, readPaymentOrder } from '@/lib/server/payment-orders'
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  const headers = new Headers(auth.headers); headers.set('Cache-Control', 'no-store')
  const orderId = request.nextUrl.searchParams.get('orderId')
  if (!paymentUuid(orderId)) return NextResponse.json({ error: 'Invalid order.' }, { status: 400, headers })
  try { return NextResponse.json(orderView(await readPaymentOrder(auth.user.id, orderId)), { headers }) }
  catch (e) { return NextResponse.json({ error: 'Payment status unavailable.' }, { status: e instanceof PaymentError ? e.status : 503, headers }) }
}
