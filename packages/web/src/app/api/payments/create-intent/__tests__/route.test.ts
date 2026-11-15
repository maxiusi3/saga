/** @jest-environment node */
import { NextRequest } from 'next/server'
import { POST } from '../route'
const getAuthenticatedUser=jest.fn()
jest.mock('@/lib/server/auth',()=>({getAuthenticatedUser:(...args:unknown[])=>getAuthenticatedUser(...args)}))
describe('payment intent request gate',()=>{
 beforeEach(()=>getAuthenticatedUser.mockResolvedValue({ok:true,user:{id:'11111111-1111-4111-8111-111111111111'},headers:new Headers()}))
 it.each([{packageId:'starter'}, {packageId:'digital_project_59'}, {packageId:'digital_project_59',requestId:'bad'},null,[]])('rejects malformed or retired package request %p',async body=>{
  expect((await POST(new NextRequest('http://localhost/api/payments/create-intent',{method:'POST',body:JSON.stringify(body)}))).status).toBe(400)
 })
 it('rejects oversized input before attempting payment',async()=>{
  const response=await POST(new NextRequest('http://localhost/api/payments/create-intent',{method:'POST',body:JSON.stringify({padding:'x'.repeat(20000)})}))
  expect(response.status).toBe(413)
 })
 it('fails closed without explicit server test-mode gate',async()=>{
  delete process.env.PAYMENTS_MODE;process.env.STRIPE_SECRET_KEY='sk_live_forbidden'
  const response=await POST(new NextRequest('http://localhost/api/payments/create-intent',{method:'POST',body:JSON.stringify({packageId:'digital_project_59',requestId:'22222222-2222-4222-8222-222222222222'})}))
  expect(response.status).toBe(503)
  delete process.env.STRIPE_SECRET_KEY
 })
})
