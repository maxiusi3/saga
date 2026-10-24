import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getPaymentPackage } from '@/lib/payments/catalog'

export async function POST(request: NextRequest) {
  if (process.env.MEDIA_ASSETS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Entitlement webhook is not enabled' }, { status: 503 })
  }

  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET
  const providedSecret = request.headers.get('x-saga-webhook-secret')
  if (!webhookSecret || providedSecret !== webhookSecret) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const provider = typeof body.provider === 'string' ? body.provider : 'stripe'
  const eventId = typeof body.eventId === 'string' ? body.eventId : ''
  const sourceKey = typeof body.sourceKey === 'string' ? body.sourceKey : ''
  const eventKind = typeof body.eventKind === 'string' ? body.eventKind : ''
  const packageId = typeof body.packageId === 'string' ? body.packageId : ''
  const payerId = typeof body.payerId === 'string' ? body.payerId : ''
  const projectId = typeof body.projectId === 'string' ? body.projectId : null

  const pkg = getPaymentPackage(packageId)
  if (!eventId || !sourceKey || !eventKind || !payerId || !pkg) {
    return NextResponse.json({ error: 'Invalid entitlement event payload' }, { status: 400 })
  }

  let admin: ReturnType<typeof getSupabaseAdmin>
  try {
    admin = getSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Entitlement database is not configured' }, { status: 503 })
  }

  const { data, error } = await admin.rpc('apply_entitlement_event', {
    p_provider: provider,
    p_event_id: eventId,
    p_source_key: sourceKey,
    p_event_kind: eventKind,
    p_package_id: pkg.id,
    p_payer_id: payerId,
    p_amount_cents: typeof body.amountCents === 'number' ? body.amountCents : pkg.amount,
    p_project_id: projectId,
  })

  if (error) {
    const status = error.code === '22023' ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json(
    {
      sourceId: row?.source_id ?? null,
      outcome: row?.outcome ?? 'recorded_failure',
      status: row?.status ?? 'failed',
    },
    { status: 200 },
  )
}
