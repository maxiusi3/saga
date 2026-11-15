/** @jest-environment node */
import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { POST } from '../route'

const secret = 'whsec_local_g3_signature'
const rpc = jest.fn()
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({ rpc }) }))
const request = (payload: string, signature?: string) => new NextRequest('http://localhost/api/payments/webhook', {
  method: 'POST', body: payload, headers: signature ? { 'stripe-signature': signature } : {},
})
const sign = (payload: string, timestamp?: number) => Stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp })
describe('verified payment webhook boundary', () => {
  beforeEach(() => {
    process.env.PAYMENTS_MODE = 'test'; process.env.STRIPE_SECRET_KEY = 'sk_test_local'; process.env.STRIPE_WEBHOOK_SECRET = secret
    process.env.MEDIA_ASSETS_ENABLED = 'true'; process.env.PAYMENT_WEBHOOK_SECRET = secret
    rpc.mockReset()
  })
  afterAll(() => { for (const key of ['PAYMENTS_MODE', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'MEDIA_ASSETS_ENABLED', 'PAYMENT_WEBHOOK_SECRET']) delete process.env[key] })
  it('rejects the former shared header even if it knows the secret', async () => {
    const res = await POST(new NextRequest('http://localhost/api/payments/webhook', { method: 'POST', headers: { 'x-saga-webhook-secret': secret }, body: JSON.stringify({ provider:'stripe',eventId:'evt_1',sourceKey:'pi_1',eventKind:'grant',packageId:'digital_project_59',payerId:'payer' }) }))
    expect(res.status).toBe(400)
  })
  it('accepts a signed irrelevant test event without fulfilling anything', async () => {
    const payload = JSON.stringify({ id:'evt_ignore',object:'event',type:'customer.updated',livemode:false,data:{object:{}} })
    const res = await POST(request(payload, sign(payload)))
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ received:true, ignored:true })
    expect(rpc).not.toHaveBeenCalled()
  })
  it.each(['changed', 'expired', 'live'])('rejects %s signed input', async mode => {
    const raw=JSON.stringify({ id:'evt_ignore',object:'event',type:'customer.updated',livemode:mode==='live',data:{object:{}} })
    const res=await POST(request(mode==='changed'?raw+' ':raw,sign(raw,mode==='expired'?1:undefined)))
    expect(res.status).toBe(400)
  })
  it.each([{}, { id: null }, { id: 'evt_missing', type: 'payment_intent.succeeded' }])('rejects malformed signed event %p', async fields => {
    const raw=JSON.stringify({object:'event',livemode:false,...fields})
    expect((await POST(request(raw,sign(raw)))).status).toBe(400)
  })
  it('bounds a streaming payload without buffering the whole body', async () => {
    let pulled=0,cancelled=false
    const body=new ReadableStream<Uint8Array>({pull(controller){pulled++;controller.enqueue(new Uint8Array(100*1024));if(pulled===20)controller.close()},cancel(){cancelled=true}})
    const res=await POST(new NextRequest('http://localhost/api/payments/webhook',{method:'POST',body,...{duplex:'half'}}))
    expect(res.status).toBe(413);expect(cancelled).toBe(true);expect(pulled).toBeLessThan(6)
  })
  it('disables live charging independently of media flags', async () => {
    process.env.PAYMENTS_MODE='live';process.env.STRIPE_SECRET_KEY='sk_live_forbidden'
    expect((await POST(request('{}'))).status).toBe(503)
  })
})
