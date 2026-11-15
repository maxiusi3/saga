import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createPaymentOrder, PaymentError, paymentUuid } from '@/lib/server/payment-orders'
import { readPaymentBody } from '@/lib/server/payment-request-body'
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  const headers = new Headers(auth.headers); headers.set('Cache-Control', 'no-store')
  try {
    const raw = await readPaymentBody(request, 16 * 1024)
    let body; try { body = JSON.parse(raw) } catch { body = null }
    if (!body || body.packageId !== 'digital_project_59' || !paymentUuid(body.requestId)) return NextResponse.json({ error: 'Invalid payment request' }, { status: 400, headers })
    return NextResponse.json(await createPaymentOrder(auth.user.id, body.requestId, body.packageId), { headers })
  } catch (e) { return NextResponse.json({ error: e instanceof PaymentError ? e.message : 'Payment service is unavailable. Retry the same request.' }, { status: e instanceof PaymentError ? e.status : 503, headers }) }
}
