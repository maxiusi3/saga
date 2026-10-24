/** @jest-environment node */
import { NextRequest } from 'next/server'
import { GET, POST, DELETE } from '@/app/api/projects/[id]/invitations/route'
import { GET as cleanupGet, POST as cleanupPost } from '@/app/api/admin/cleanup-invitations/route'

const externalBoundary = jest.fn(async () => ({ data: { user: null }, error: null }))
jest.mock('@supabase/auth-helpers-nextjs', () => ({ createRouteHandlerClient: () => ({ auth: { getUser: externalBoundary } }) }))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => { externalBoundary(); throw new Error('Unexpected admin access') } }))
jest.mock('@/lib/email-service', () => ({ EmailService: { sendInvitationEmail: () => externalBoundary() } }))
const savedEnv = { ...process.env }
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon'
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { process.env = { ...savedEnv }; jest.restoreAllMocks(); jest.clearAllMocks() })

test.each([['POST', POST], ['GET', GET], ['DELETE', DELETE]] as const)('disabled legacy %s stops before authentication', async (method, handler) => {
  delete process.env.INVITATION_TRANSACTIONS_ENABLED
  const request = new NextRequest('http://localhost/api/projects/22222222-2222-4222-8222-222222222222/invitations', { method })
  const response = await handler(request, { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) })
  expect({ status: response.status, externalCalls: externalBoundary.mock.calls.length }).toEqual({ status: 503, externalCalls: 0 })
  expect(await response.json()).toMatchObject({ success: false, outcome: 'not_attempted' })
})
test.each([['GET', GET], ['DELETE', DELETE], ['cleanup GET', cleanupGet], ['cleanup POST', cleanupPost]] as const)('%s is permanently unavailable even with enabled flag and valid cron header', async (_, handler) => {
  process.env.INVITATION_TRANSACTIONS_ENABLED = 'true'
  process.env.ADMIN_CRON_SECRET = 'synthetic-cron'
  const request = new NextRequest('http://localhost/api/invitations', { headers: { 'x-cron-secret': 'synthetic-cron' } })
  const response = await handler(request, { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) })
  expect({ status: response.status, externalCalls: externalBoundary.mock.calls.length }).toEqual({ status: 503, externalCalls: 0 })
})
