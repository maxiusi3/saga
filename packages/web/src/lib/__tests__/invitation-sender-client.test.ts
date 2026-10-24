/** @jest-environment node */
import { supabaseApi } from '../api-supabase'
import { api } from '../api'
import { InvitationHttpError } from '../invitation-acceptance-client'
import { fixtureBearer, fixtureProject, otherUser } from '../server/test-support/invitation-fixture'
import { sendInput, releaseInput, lookupInput, sendHttp, releaseHttp, lookupHttp } from '../server/test-support/invitation-sender-fixture'

const boundary = { getSession: jest.fn(), getUser: jest.fn(), rpc: jest.fn(), from: jest.fn() }
jest.mock('@/lib/supabase', () => ({ createClientSupabase: () => ({ auth: { getSession: (...args: unknown[]) => boundary.getSession(...args), getUser: (...args: unknown[]) => boundary.getUser(...args) }, rpc: (...args: unknown[]) => boundary.rpc(...args), from: (...args: unknown[]) => boundary.from(...args) }) }))
let fetchBoundary: jest.SpyInstance
beforeEach(() => {
  fetchBoundary = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(sendHttp))
  boundary.getSession.mockResolvedValue({ data: { session: { access_token: fixtureBearer } }, error: null })
  boundary.getUser.mockResolvedValue({ data: { user: { id: otherUser } }, error: null })
  boundary.rpc.mockResolvedValue({ data: {}, error: null })
  boundary.from.mockImplementation(() => { throw new Error('Unexpected legacy table access') })
})
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks() })
async function failure(work: Promise<unknown>, outcome: string) {
  const error = await work.then(() => null, e => e)
  expect(error).toBeInstanceOf(InvitationHttpError)
  expect(error).toMatchObject({ outcome, canQueryStatus: outcome === 'unknown' })
  expect(String(error).includes('PRIVATE_UPSTREAM_ERROR')).toBe(false)
}
test('old send/generate/list facades are unavailable before session, RPC, table or HTTP access', async () => {
  await failure(supabaseApi.invitations.send(fixtureProject, sendInput.email, 'storyteller'), 'not_attempted')
  await failure(api.invitations.send(fixtureProject, sendInput.email, 'storyteller'), 'not_attempted')
  await failure(api.projects.generateInvitation(fixtureProject, { email: sendInput.email, role: 'storyteller' }), 'not_attempted')
  await failure(supabaseApi.invitations.list(fixtureProject), 'not_attempted')
  await failure(api.invitations.list(fixtureProject), 'not_attempted')
  for (const fn of Object.values(boundary)) expect(fn).not.toHaveBeenCalled()
  expect(fetchBoundary).not.toHaveBeenCalled()
})
test('facade sends with the current session and retains stable data wrappers', async () => {
  const options = { request_id: sendInput.request_id, source_id: sendInput.source_id, message: ' keep ' }
  for (const call of [
    () => supabaseApi.invitations.send(fixtureProject, ' INVITEE@EXAMPLE.INVALID ', 'storyteller', options),
    async () => (await api.invitations.send(fixtureProject, ' INVITEE@EXAMPLE.INVALID ', 'storyteller', options)).data,
    async () => (await api.projects.generateInvitation(fixtureProject, { email: ' INVITEE@EXAMPLE.INVALID ', role: 'storyteller', ...options })).data,
  ]) expect(await call()).toEqual(sendHttp)
  expect(boundary.getSession).toHaveBeenCalledTimes(3)
  expect(boundary.getUser).not.toHaveBeenCalled()
  expect(boundary.rpc).not.toHaveBeenCalled()
  for (const [path, init] of fetchBoundary.mock.calls) {
    expect(path).toBe(`/api/projects/${fixtureProject}/invitations`)
    expect(JSON.parse(init.body)).toEqual({ ...sendInput, message: ' keep ' })
    expect(init).toMatchObject({ headers: { Authorization: `Bearer ${fixtureBearer}` }, credentials: 'omit', redirect: 'error', cache: 'no-store' })
  }
})
test('facade release/lookup call HTTP once per operation and preserve data wrappers', async () => {
  fetchBoundary.mockImplementation(async () => Response.json(releaseHttp))
  expect(await supabaseApi.invitations.release(releaseInput, fixtureProject)).toEqual(releaseHttp)
  expect(await api.invitations.release(releaseInput, fixtureProject)).toEqual({ data: releaseHttp })
  fetchBoundary.mockImplementation(async () => Response.json(lookupHttp))
  expect(await supabaseApi.invitations.lookup(lookupInput)).toEqual(lookupHttp)
  expect(await api.invitations.lookup(lookupInput)).toEqual({ data: lookupHttp })
  expect(fetchBoundary.mock.calls.map(([url, init]) => [url, JSON.parse(init.body)])).toEqual([
    ['/api/invitations/release', releaseInput], ['/api/invitations/release', releaseInput], ['/api/invitations/lookup', lookupInput], ['/api/invitations/lookup', lookupInput],
  ])
  expect(boundary.rpc).not.toHaveBeenCalled()
})
test('invalid or unavailable current session sends no HTTP and never leaks provider error', async () => {
  for (const session of [null, { access_token: '' }, { access_token: 'bad token' }]) {
    boundary.getSession.mockResolvedValue({ data: { session }, error: null })
    await failure(supabaseApi.invitations.send(fixtureProject, sendInput.email, 'storyteller', sendInput), 'not_attempted')
  }
  boundary.getSession.mockRejectedValue(new Error('PRIVATE_UPSTREAM_ERROR'))
  await failure(supabaseApi.invitations.release(releaseInput), 'not_attempted')
  await failure(supabaseApi.invitations.lookup(lookupInput), 'not_attempted')
  expect(fetchBoundary).not.toHaveBeenCalled()
})

// These helpers exercise the real request builder/parser; only the external HTTP boundary is replaced.
import { sendInvitationOverHttp, releaseInvitationOverHttp, lookupInvitationOverHttp } from '../invitation-sender-client'
test('send helper uses exact normalized command and no browser cookies/storage', async () => {
  expect(await sendInvitationOverHttp(fixtureProject, { ...sendInput, email: ' INVITEE@EXAMPLE.INVALID ' }, fixtureBearer)).toEqual(sendHttp)
  expect(fetchBoundary.mock.calls.map(([url, init]) => [url, JSON.parse(init.body)])).toEqual([[`/api/projects/${fixtureProject}/invitations`, sendInput]])
})
test.each(['send', 'release', 'lookup'] as const)('%s helper rejects a malformed 2xx with no retry or implicit recovery', async mode => {
  const invoke = () => mode === 'send' ? sendInvitationOverHttp(fixtureProject, sendInput, fixtureBearer) : mode === 'release' ? releaseInvitationOverHttp(releaseInput, fixtureBearer, fixtureProject) : lookupInvitationOverHttp(lookupInput, fixtureBearer)
  for (const body of [null, [], {}, { success: true }, { ...{ send: sendHttp, release: releaseHttp, lookup: lookupHttp }[mode], project_id: otherUser }]) {
    fetchBoundary.mockResolvedValue(Response.json(body))
    await failure(invoke(), 'unknown')
  }
  expect(fetchBoundary).toHaveBeenCalledTimes(5)
})
test('failure responses need compatible status and complete failure contract before implying no write', async () => {
  for (const [status, body, outcome] of [
    [503, { success: false, outcome: 'not_attempted', error: 'safe', can_query_status: false }, 'not_attempted'],
    [400, { success: false, outcome: 'rejected', error: 'safe', can_query_status: false }, 'rejected'],
    [503, { success: false, outcome: 'not_attempted' }, 'unknown'],
    [500, { success: false, outcome: 'not_attempted', error: 'safe', can_query_status: false }, 'unknown'],
    [503, { ...sendHttp, outcome: 'unknown' }, 'unknown'],
  ] as const) {
    fetchBoundary.mockResolvedValue(Response.json(body, { status }))
    await failure(sendInvitationOverHttp(fixtureProject, sendInput, fixtureBearer), outcome)
  }
})
test('lost write response and invalid JSON are unknown; explicit lookup never resends', async () => {
  fetchBoundary.mockRejectedValueOnce(new Error('PRIVATE_UPSTREAM_ERROR'))
  await failure(sendInvitationOverHttp(fixtureProject, sendInput, fixtureBearer), 'unknown')
  fetchBoundary.mockResolvedValueOnce(new Response('{', { status: 200 }))
  await failure(releaseInvitationOverHttp(releaseInput, fixtureBearer), 'unknown')
  fetchBoundary.mockResolvedValueOnce(Response.json(lookupHttp))
  expect(await lookupInvitationOverHttp(lookupInput, fixtureBearer)).toEqual(lookupHttp)
  expect(fetchBoundary.mock.calls.map(([path]) => path)).toEqual([`/api/projects/${fixtureProject}/invitations`, '/api/invitations/release', '/api/invitations/lookup'])
})
test('invalid local commands and pre-abort stop before any fetch', async () => {
  await failure(sendInvitationOverHttp(fixtureProject, { email: 'a@b', role: 'storyteller' }, fixtureBearer), 'not_attempted')
  await failure(sendInvitationOverHttp('%32' + fixtureProject, sendInput, fixtureBearer), 'rejected')
  await failure(releaseInvitationOverHttp({ ...releaseInput, project_id: fixtureProject }, fixtureBearer), 'rejected')
  await failure(lookupInvitationOverHttp({ ...lookupInput, role: 'owner' }, fixtureBearer), 'rejected')
  await failure(releaseInvitationOverHttp(releaseInput, 'bad token'), 'not_attempted')
  const caller = new AbortController(); caller.abort()
  await failure(sendInvitationOverHttp(fixtureProject, sendInput, fixtureBearer, caller.signal), 'not_attempted')
  expect(fetchBoundary).not.toHaveBeenCalled()
})
test('client bounds body reading on caller abort and keeps an attempted write unknown', async () => {
  let started!: () => void
  const reading = new Promise<void>(resolve => { started = resolve })
  fetchBoundary.mockResolvedValue({ ok: true, status: 200, json: () => { started(); return new Promise(() => {}) } })
  const caller = new AbortController()
  const pending = sendInvitationOverHttp(fixtureProject, sendInput, fixtureBearer, caller.signal)
  await reading; caller.abort()
  await failure(pending, 'unknown')
  expect(fetchBoundary).toHaveBeenCalledTimes(1)
})
