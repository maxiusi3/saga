/** @jest-environment node */
import { NextRequest } from 'next/server'
import { GET, POST } from '../route'

const mockRpc = jest.fn()
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({ rpc: mockRpc }) }))
const env = process.env
const command = { action: 'close_cohort', requestId: '11111111-1111-4111-8111-111111111111', cohortKey: 'pilot-test', observationKind: 'synthetic', recordedBy: 'test-operator', reason: 'recruitment_complete' }
const request = (body: unknown, secret = 'local-secret') => new NextRequest('http://localhost/api/admin/pilot-ledger', { method: 'POST', headers: { 'x-cron-secret': secret }, body: JSON.stringify(body) })

beforeEach(() => { process.env = { ...env, MEDIA_ASSETS_ENABLED: 'true', ADMIN_CRON_SECRET: 'local-secret' }; mockRpc.mockReset().mockResolvedValue({ data: { closed: true }, error: null }) })
afterEach(() => { process.env = env })

it('rejects unauthenticated writes before parsing or touching database', async () => {
  const response = await POST(request(command, 'wrong'))
  expect(response.status).toBe(401); expect(response.headers.get('cache-control')).toBe('no-store'); expect(mockRpc).not.toHaveBeenCalled()
})
it('validates body rather than forwarding arbitrary objects to the privileged RPC', async () => {
  const response = await POST(request({ ...command, untrusted: true }))
  expect(response.status).toBe(400); expect(mockRpc).not.toHaveBeenCalled()
})
it('passes a normalized command and preserves idempotency receipt', async () => {
  const response = await POST(request(command))
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ closed: true })
  expect(mockRpc).toHaveBeenCalledWith('record_pilot_observation', { p_command: command })
})
it.each(['23505', '40001', '55000'])('maps conflict %s without private database messages', async code => {
  mockRpc.mockResolvedValue({ data: null, error: { code, message: 'private evidence' } })
  const response = await POST(request(command)); expect(response.status).toBe(409); expect(await response.text()).not.toContain('private evidence')
})
it('bounds actual request bytes', async () => {
  const response = await POST(request({ ...command, reason: 'x'.repeat(140000) }))
  expect(response.status).toBe(400); expect(mockRpc).not.toHaveBeenCalled()
})
it('does not expose history to an ordinary family credential', async () => {
  const response = await GET(new NextRequest('http://localhost/api/admin/pilot-ledger?householdId=' + command.requestId))
  expect(response.status).toBe(401); expect(mockRpc).not.toHaveBeenCalled()
})
