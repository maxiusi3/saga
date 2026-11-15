import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { allocatePaymentProject, PaymentError, paymentUuid } from '@/lib/server/payment-orders'
import { readPaymentBody } from '@/lib/server/payment-request-body'
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  const headers = new Headers(auth.headers); headers.set('Cache-Control', 'no-store')
  try {
  const raw = await readPaymentBody(request, 16 * 1024)
  let body; try { body = JSON.parse(raw) } catch { body = null }
  if (!body || !paymentUuid(body.orderId) || (body.projectId ? !paymentUuid(body.projectId) || body.name !== undefined : typeof body.name !== 'string') || (body.description !== undefined && typeof body.description !== 'string')) return NextResponse.json({ error: 'Invalid project allocation.' }, { status: 400, headers })
  return NextResponse.json(await allocatePaymentProject(auth.user.id, body.orderId, body.projectId ?? null, body.name ?? null, body.description ?? null), { headers })
  } catch (e) { return NextResponse.json({ error: e instanceof PaymentError ? e.message : 'Allocation unavailable. Retry the same project.' }, { status: e instanceof PaymentError ? e.status : 503, headers }) }
}
