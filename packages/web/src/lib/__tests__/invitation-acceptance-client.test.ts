/** @jest-environment node */
import { acceptInvitationOverHttp, getInvitationStatusOverHttp, InvitationHttpError } from '@/lib/invitation-acceptance-client'
import { supabaseApi } from '@/lib/api-supabase'
import { api } from '@/lib/api'
import { acceptedHttp, pendingHttp, fixtureToken, fixtureBearer } from '@/lib/server/test-support/invitation-fixture'

const sessionBoundary = {
  getSession: jest.fn(), getUser: jest.fn(), rpc: jest.fn(),
}
jest.mock('@/lib/supabase', () => ({
  createClientSupabase: () => ({
    auth: {
      getSession: (...args: unknown[]) => sessionBoundary.getSession(...args),
      getUser: (...args: unknown[]) => sessionBoundary.getUser(...args),
    },
    rpc: (...args: unknown[]) => sessionBoundary.rpc(...args),
  }),
}))
let fetchBoundary: jest.SpyInstance
beforeEach(() => {
  fetchBoundary = jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(acceptedHttp))
  sessionBoundary.getSession.mockResolvedValue({ data: { session: { access_token: fixtureBearer } }, error: null })
  sessionBoundary.getUser.mockResolvedValue({ data: { user: { id: 'synthetic-legacy-user' } }, error: null })
  sessionBoundary.rpc.mockResolvedValue({ data: null, error: null })
})
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks() })
async function safeFailure(work: Promise<unknown>, outcome: string) {
  const error = await work.then(() => null, failure => failure)
  expect(error).toBeInstanceOf(InvitationHttpError)
  expect(error).toMatchObject({ outcome, canQueryStatus: outcome === 'unknown' })
  for (const secret of [fixtureToken, fixtureBearer, 'PRIVATE_UPSTREAM_ERROR']) expect(String(error)).not.toContain(secret)
}

test('accept HTTP uses a session Bearer and only the canonical token in JSON', async () => {
  await expect(acceptInvitationOverHttp(fixtureToken, fixtureBearer)).resolves.toEqual(acceptedHttp)
  expect(fetchBoundary.mock.calls).toEqual([['/api/invitations/accept', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fixtureBearer}` },
    body: JSON.stringify({ token: fixtureToken }), credentials: 'omit', cache: 'no-store', redirect: 'error',
  }]])
})
test.each([
  null, {}, [], { success: true, project_id: acceptedHttp.project_id, role: 'storyteller' },
  { ...acceptedHttp, member_id: null }, { ...acceptedHttp, user_id: null },
  { ...acceptedHttp, outcome: 'unknown' }, { ...acceptedHttp, success: false },
])('malformed 2xx case %# is unknown and never retried or automatically queried', async response => {
  fetchBoundary.mockResolvedValue(Response.json(response))
  await safeFailure(acceptInvitationOverHttp(fixtureToken, fixtureBearer), 'unknown')
  expect(fetchBoundary).toHaveBeenCalledTimes(1)
})
test('invalid JSON 2xx is an unknown acceptance result', async () => {
  fetchBoundary.mockResolvedValue(new Response('{', { status: 200 }))
  await safeFailure(acceptInvitationOverHttp(fixtureToken, fixtureBearer), 'unknown')
  expect(fetchBoundary).toHaveBeenCalledTimes(1)
})
test.each([
  [400, 'rejected'], [401, 'not_attempted'], [403, 'rejected'], [409, 'rejected'], [503, 'unknown'],
] as const)('non-2xx %s safely preserves recognized outcome', async (status, outcome) => {
  fetchBoundary.mockResolvedValue(Response.json({ success: false, outcome, error: `PRIVATE_UPSTREAM_ERROR ${fixtureToken}` }, { status }))
  await safeFailure(acceptInvitationOverHttp(fixtureToken, fixtureBearer), outcome)
  expect(fetchBoundary).toHaveBeenCalledTimes(1)
})
test('non-2xx claiming acceptance success is still unknown', async () => {
  fetchBoundary.mockResolvedValue(Response.json(acceptedHttp, { status: 500 }))
  await safeFailure(acceptInvitationOverHttp(fixtureToken, fixtureBearer), 'unknown')
})
test('network error is safe and sends exactly one request', async () => {
  fetchBoundary.mockRejectedValue(new Error(`PRIVATE_UPSTREAM_ERROR ${fixtureBearer}`))
  await safeFailure(acceptInvitationOverHttp(fixtureToken, fixtureBearer), 'unknown')
  expect(fetchBoundary).toHaveBeenCalledTimes(1)
})
test.each([
  ['legacy', fixtureBearer, 'rejected'], [fixtureToken, '', 'not_attempted'],
  [fixtureToken, 'bad token', 'not_attempted'], [fixtureToken + '\n', fixtureBearer, 'rejected'],
])('invalid local input case %# sends no request', async (token, bearer, outcome) => {
  await safeFailure(acceptInvitationOverHttp(token, bearer), outcome)
  expect(fetchBoundary).not.toHaveBeenCalled()
})
test('explicit status validates a complete read without posting accept', async () => {
  fetchBoundary.mockResolvedValue(Response.json({ ...pendingHttp, token: fixtureToken }))
  await expect(getInvitationStatusOverHttp(fixtureToken, fixtureBearer)).resolves.toEqual(pendingHttp)
  expect(fetchBoundary).toHaveBeenCalledTimes(1)
  expect(fetchBoundary.mock.calls[0][0]).toBe('/api/invitations/status')
  expect(JSON.parse(fetchBoundary.mock.calls[0][1].body)).toEqual({ token: fixtureToken })
})
test('malformed explicit status remains unknown', async () => {
  fetchBoundary.mockResolvedValue(Response.json({ ...pendingHttp, user_id: acceptedHttp.user_id }))
  await safeFailure(getInvitationStatusOverHttp(fixtureToken, fixtureBearer), 'unknown')
  expect(fetchBoundary).toHaveBeenCalledTimes(1)
})
test('Supabase facade uses current session HTTP and ApiClient preserves data wrapper', async () => {
  await expect(api.invitations.accept(fixtureToken)).resolves.toEqual({ data: acceptedHttp })
  expect(fetchBoundary).toHaveBeenCalledTimes(1)
  expect(fetchBoundary.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${fixtureBearer}`)
  expect(sessionBoundary.getUser).not.toHaveBeenCalled()
  expect(sessionBoundary.rpc).not.toHaveBeenCalled()
})
test.each([
  { data: { session: null }, error: null },
  { data: { session: { access_token: '' } }, error: null },
  { data: { session: null }, error: { message: 'PRIVATE_UPSTREAM_ERROR' } },
])('facade missing usable session case %# sends no HTTP or RPC', async session => {
  sessionBoundary.getSession.mockResolvedValue(session)
  await safeFailure(supabaseApi.invitations.accept(fixtureToken), 'not_attempted')
  expect(fetchBoundary).not.toHaveBeenCalled()
  expect(sessionBoundary.rpc).not.toHaveBeenCalled()
})
test('facade unknown HTTP result never falls back to legacy RPC', async () => {
  fetchBoundary.mockResolvedValue(Response.json({ success: false, outcome: 'unknown' }, { status: 503 }))
  await safeFailure(supabaseApi.invitations.accept(fixtureToken), 'unknown')
  expect(fetchBoundary).toHaveBeenCalledTimes(1)
  expect(sessionBoundary.rpc).not.toHaveBeenCalled()
})
test('session boundary rejection is safe and cannot initiate acceptance', async () => {
  sessionBoundary.getSession.mockRejectedValue(new Error(`PRIVATE_UPSTREAM_ERROR ${fixtureBearer}`))
  await safeFailure(supabaseApi.invitations.accept(fixtureToken), 'not_attempted')
  expect(fetchBoundary).not.toHaveBeenCalled()
  expect(sessionBoundary.rpc).not.toHaveBeenCalled()
})
