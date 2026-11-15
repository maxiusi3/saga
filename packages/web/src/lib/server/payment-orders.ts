import { createHash } from 'crypto'
import Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/supabase'

export class PaymentError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export interface PaymentOrder {
  id: string; payer_id: string; package_id: string; amount_cents: number; currency: string; mode: 'test'
  intent_id: string | null; status: 'created' | 'awaiting_payment' | 'paid' | 'refunded' | 'refund_review' | 'failed' | 'canceled'
  rights?: { project_id: string | null; hosting_started_at: string | null; hosting_expires_at: string | null } | null; available_projects?: { id: string; name: string }[]
  created_at: string; paid_at: string | null; refunded_at: string | null; refunded_cents: number
}
export const paymentUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
export function paymentConfiguration() {
  const key = process.env.STRIPE_SECRET_KEY, secret = process.env.STRIPE_WEBHOOK_SECRET
  if (process.env.PAYMENTS_MODE !== 'test' || !key?.startsWith('sk_test_') || !secret?.startsWith('whsec_')) {
    throw new PaymentError(503, 'Test payments are not enabled. Live payments are unavailable.')
  }
  return { stripe: new Stripe(key, { maxNetworkRetries: 0, timeout: 10000 }), secret }
}
async function rpc(name: string, args: Record<string, unknown>): Promise<PaymentOrder> {
  const { data, error } = await getSupabaseAdmin().rpc(name, args)
  if (error) throw new PaymentError(error.code === '42501' ? 404 : error.code === '22023' ? 409 : 503, 'Payment status could not be confirmed. Retry the same request.')
  if (!data?.id) throw new PaymentError(503, 'Payment status could not be confirmed. Retry the same request.')
  return data as PaymentOrder
}
export function readPaymentOrder(actor: string, orderId: string) {
  return rpc('read_payment_order', { p_actor: actor, p_order: orderId })
}
function verifyIntent(intent: Stripe.PaymentIntent, order: PaymentOrder) {
  if (intent.object !== 'payment_intent' || intent.livemode !== false || intent.amount !== order.amount_cents || intent.currency !== order.currency ||
    intent.metadata?.orderId !== order.id || intent.metadata?.payerId !== order.payer_id || intent.metadata?.packageId !== order.package_id ||
    (order.intent_id !== null && intent.id !== order.intent_id)) throw new PaymentError(409, 'Payment identity did not match its order.')
}
export function orderView(order: PaymentOrder) {
  return { orderId: order.id, packageId: order.package_id, amount: order.amount_cents, currency: order.currency, mode: order.mode,
    status: order.status, projectId: order.rights?.project_id ?? null, hostingStartedAt: order.rights?.hosting_started_at ?? null, hostingExpiresAt: order.rights?.hosting_expires_at ?? null, availableProjects: order.available_projects ?? [], paidAt: order.paid_at, refundedAt: order.refunded_at, refundedAmount: order.refunded_cents }
}
export async function createPaymentOrder(actor: string, requestId: string, packageId: string) {
  const { stripe } = paymentConfiguration()
  let order = await rpc('reserve_payment_order', { p_actor: actor, p_request: requestId, p_package: packageId })
  if (order.status === 'paid' || order.status === 'refunded' || order.status === 'refund_review' || order.status === 'canceled') return orderView(order)
  // Stripe may prune an idempotency key after 24h. Never recreate an uncertain
  // unbound intent beyond the safety window; operator reconciliation is required.
  if (!order.intent_id && Date.now() - Date.parse(order.created_at) >= 23 * 60 * 60 * 1000) throw new PaymentError(409, 'This order needs payment reconciliation before retrying.')
  let intent: Stripe.PaymentIntent
  try {
    intent = order.intent_id ? await stripe.paymentIntents.retrieve(order.intent_id) : await stripe.paymentIntents.create({
      amount: order.amount_cents, currency: order.currency, payment_method_types: ['card'],
      metadata: { orderId: order.id, payerId: order.payer_id, packageId: order.package_id },
    }, { idempotencyKey: `saga-order-${order.id}` })
  } catch { throw new PaymentError(502, 'Payment response is uncertain. Retry the same request to recover this order.') }
  verifyIntent(intent, order)
  order = await rpc('bind_payment_intent', { p_order: order.id, p_actor: actor, p_intent: intent.id })
  return { ...orderView(order), id: intent.id, client_secret: intent.client_secret }
}
export async function receivePaymentEvent(raw: string, signature: string | null) {
  const { stripe, secret } = paymentConfiguration()
  let event: Stripe.Event
  try { event = stripe.webhooks.constructEvent(raw, signature ?? '', secret) }
  catch { throw new PaymentError(400, 'Invalid Stripe signature.') }
  if (!event || typeof event.id !== 'string' || event.livemode !== false || event.id.length > 100 || !/^evt_[A-Za-z0-9_]+$/.test(event.id)) throw new PaymentError(400, 'Invalid payment event mode or identity.')
  if (!['payment_intent.succeeded', 'payment_intent.payment_failed', 'payment_intent.canceled', 'charge.refunded'].includes(event.type)) return { received: true, ignored: true }
  const object = event.data?.object as Stripe.PaymentIntent | Stripe.Charge
  const refund = event.type === 'charge.refunded'
  if (!object || object.livemode !== false || object.object !== (refund ? 'charge' : 'payment_intent')) throw new PaymentError(400, 'Invalid payment event object.')
  const intentId = refund ? (object as Stripe.Charge).payment_intent : object.id
  if (typeof intentId !== 'string' || !/^pi_[A-Za-z0-9]+$/.test(intentId)) throw new PaymentError(400, 'Missing payment identity.')
  let intent: Stripe.PaymentIntent
  try { intent = await stripe.paymentIntents.retrieve(intentId) }
  catch { throw new PaymentError(503, 'Payment reconciliation is unavailable.') }
  if (!paymentUuid(intent.metadata?.orderId) || !paymentUuid(intent.metadata?.payerId)) throw new PaymentError(409, 'Unbound payment event.')
  let order = await readPaymentOrder(intent.metadata.payerId, intent.metadata.orderId)
  verifyIntent(intent, order)
  if (!refund) {
    verifyIntent(object as Stripe.PaymentIntent, order)
    const expected = event.type === 'payment_intent.succeeded' ? 'succeeded' : event.type === 'payment_intent.canceled' ? 'canceled' : 'requires_payment_method'
    if ((event.type === 'payment_intent.succeeded' && (intent.status !== 'succeeded' || intent.amount_received !== order.amount_cents)) || (object as Stripe.PaymentIntent).status !== expected || (event.type === 'payment_intent.succeeded' && (object as Stripe.PaymentIntent).amount_received !== order.amount_cents)) throw new PaymentError(409, 'Payment event state mismatch.')
  } else {
    const charge = object as Stripe.Charge
    const latestCharge = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id
    if (!/^ch_[A-Za-z0-9]+$/.test(charge.id) || latestCharge !== charge.id || charge.amount !== order.amount_cents || charge.currency !== order.currency || charge.paid !== true ||
      !Number.isInteger(charge.amount_refunded) || charge.amount_refunded < 1 || charge.amount_refunded > order.amount_cents || charge.refunded !== (charge.amount_refunded === order.amount_cents)) throw new PaymentError(409, 'Refund identity mismatch.')
    // The signed snapshot is bound to the provider's current charge as well.
    let current: Stripe.Charge
    try { current = await stripe.charges.retrieve(charge.id) } catch { throw new PaymentError(503, 'Refund reconciliation is unavailable.') }
    if (current.livemode !== false || current.payment_intent !== intentId || current.amount !== order.amount_cents || current.currency !== order.currency || current.amount_refunded < charge.amount_refunded) throw new PaymentError(409, 'Refund state mismatch.')
  }
  // An event can arrive before the create request receives its response.
  order = await rpc('bind_payment_intent', { p_order: order.id, p_actor: order.payer_id, p_intent: intentId })
  order = await rpc('apply_verified_payment_event', {
    p_order: order.id, p_event: event.id, p_type: event.type, p_intent: intentId, p_payer: order.payer_id,
    p_amount: order.amount_cents, p_currency: order.currency, p_live: false,
    p_hash: createHash('sha256').update(raw).digest('hex'), p_refunded: refund ? (object as Stripe.Charge).amount_refunded : 0,
  })
  return { received: true, ...orderView(order) }
}

export async function allocatePaymentProject(actor: string, orderId: string, projectId: string | null, name: string | null, description: string | null) {
  return orderView(await rpc('allocate_payment_project', { p_actor: actor, p_order: orderId, p_project: projectId, p_name: name, p_description: description }))
}
