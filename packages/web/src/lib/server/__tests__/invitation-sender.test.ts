/** @jest-environment node */
import { NextRequest } from 'next/server'
import { POST as send } from '@/app/api/projects/[id]/invitations/route'
import { POST as release } from '@/app/api/invitations/release/route'
import { POST as lookup } from '@/app/api/invitations/lookup/route'
import { startInvitationFixture, fixtureBearer, fixtureProject, fixtureToken, providerUser, pendingRow, acceptedStatusRow, otherUser } from '../test-support/invitation-fixture'
import { sendInput, releaseInput, lookupInput, sendRow, releaseRow, sendHttp, releaseHttp, lookupHttp } from '../test-support/invitation-sender-fixture'

const savedEnv = { ...process.env }
const nativeFetch = globalThis.fetch
const authPath = '/auth/v1/user'
const pathsByMode = { send: '/rest/v1/rpc/send', release: '/rest/v1/rpc/release', lookup: '/rest/v1/rpc/lookup' }
const inputs = { send: sendInput, release: releaseInput, lookup: lookupInput }
const handlers = { send, release, lookup }
type Mode = keyof typeof handlers
let fixture: Awaited<ReturnType<typeof startInvitationFixture>>
let fetchSpy: jest.SpyInstance
let logs: jest.SpyInstance[]
const listeners: [jest.SpyInstance, jest.SpyInstance][] = []
jest.setTimeout(20000)
beforeEach(async () => {
  fixture = await startInvitationFixture()
  fixture.replies[pathsByMode.send] = { body: [sendRow] }
  fixture.replies[pathsByMode.release] = { body: [releaseRow] }
  fixture.replies[pathsByMode.lookup] = { body: [pendingRow] }
  process.env.INVITATION_TRANSACTIONS_ENABLED = 'true'
  process.env.NEXT_PUBLIC_SUPABASE_URL = fixture.url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-never-used'
  fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(nativeFetch)
  logs = ['log', 'error', 'warn'].map(method => jest.spyOn(console, method as 'log').mockImplementation(() => {}))
})
afterEach(async () => {
  const cleanup = await fixture.close()
  process.env = { ...savedEnv }
  for (const [add, remove] of listeners) expect(remove.mock.calls.filter(x => x[0] === 'abort').map(x => x[1])).toEqual(add.mock.calls.filter(x => x[0] === 'abort').map(x => x[1]))
  listeners.length = 0
  const logged = logs.some(spy => spy.mock.calls.length > 0)
  jest.restoreAllMocks()
  expect(logged).toBe(false)
  expect(cleanup).toEqual({ listening: false, sockets: 0, held: 0 })
})
function request(mode: Mode, body: unknown = inputs[mode], bearer: string | null = fixtureBearer, signal?: AbortSignal) {
  const headers: Record<string, string> = { Cookie: 'wrong-user-cookie=unrelated' }
  if (bearer !== null) headers.Authorization = `Bearer ${bearer}`
  const req = new NextRequest(`http://localhost/api/invitations/${mode}`, { method: 'POST', headers, body: JSON.stringify(body), signal })
  listeners.push([jest.spyOn(req.signal, 'addEventListener'), jest.spyOn(req.signal, 'removeEventListener')])
  return req
}
function run(mode: Mode, req = request(mode), project = fixtureProject) { return handlers[mode](req, { params: Promise.resolve({ id: project }) }) }
const paths = () => fixture.captured.map(x => x.path)
async function failure(response: Response, status: number, outcome: string) {
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('vary')).toBe('Authorization')
  const body = await response.json()
  expect(body).toMatchObject({ success: false, outcome, can_query_status: outcome === 'unknown' })
  expect([fixtureToken, fixtureBearer, providerUser.email, 'PRIVATE_UPSTREAM_ERROR', 'synthetic-service-never-used'].some(value => JSON.stringify(body).includes(value))).toBe(false)
}
test.each(['send', 'release', 'lookup'] as const)('%s gate precedes body/config/auth and uses exact true', async mode => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  for (const flag of [undefined, 'false', 'TRUE', '1', ' true']) {
    if (flag === undefined) delete process.env.INVITATION_TRANSACTIONS_ENABLED
    else process.env.INVITATION_TRANSACTIONS_ENABLED = flag
    const req = request(mode)
    const json = jest.spyOn(req, 'json').mockRejectedValue(new Error('Must not read'))
    await failure(await run(mode, req), 503, 'not_attempted')
    expect(json).not.toHaveBeenCalled()
  }
  expect(fetchSpy).not.toHaveBeenCalled()
})
test.each(['send', 'release', 'lookup'] as const)('%s verifies Bearer then issues one exact RPC without cookie or service key', async mode => {
  const response = await run(mode)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ send: sendHttp, release: releaseHttp, lookup: lookupHttp }[mode])
  expect(fixture.captured.map(x => [x.path, x.body])).toEqual([[authPath, null], [pathsByMode[mode], {
    send: { p_project_id: fixtureProject, p_request_id: sendInput.request_id, p_invitee_email: sendInput.email, p_role: 'storyteller', p_source_id: sendInput.source_id, p_message: null },
    release: { p_invitation_id: releaseInput.invitation_id, p_reason: 'cancelled' }, lookup: { request_id: lookupInput.request_id },
  }[mode]]])
  for (const item of fixture.captured) {
    expect(item.headers.authorization === `Bearer ${fixtureBearer}`).toBe(true)
    expect(item.headers.apikey).toBe('synthetic-anon')
    expect(item.headers.cookie).toBeUndefined()
    expect(item.method).toBe(item.path === authPath ? 'GET' : 'POST')
    if (item.path !== authPath) expect(item.headers['content-profile']).toBe('invitation_candidate')
  }
  for (const [, init] of fetchSpy.mock.calls) expect(init).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store', signal: expect.any(AbortSignal) })
})
test('old incomplete send is unavailable; all other invalid commands stop before auth', async () => {
  for (const body of [{ email: 'a@b', role: 'storyteller' }, { ...sendInput, request_id: undefined }, { ...sendInput, source_id: undefined }]) await failure(await run('send', request('send', body)), 503, 'not_attempted')
  for (const mode of ['send', 'release', 'lookup'] as const) for (const body of [null, [], { ...inputs[mode], extra: true }]) await failure(await run(mode, request(mode, body)), 400, 'rejected')
  await failure(await run('release', request('release', { ...releaseInput, project_id: fixtureProject })), 400, 'rejected')
  for (const project of ['bad', '%32' + fixtureProject.slice(1), ' ' + fixtureProject, 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA']) await failure(await run('send', request('send'), project), 400, 'rejected')
  const req = request('send'); jest.spyOn(req, 'json').mockRejectedValue(new SyntaxError())
  await failure(await run('send', req), 400, 'rejected')
  expect(paths()).toEqual([])
})
test.each(['send', 'release', 'lookup'] as const)('%s never falls back from absent/invalid Bearer to cookie auth', async mode => {
  for (const bearer of [null, '', 'two words']) await failure(await run(mode, request(mode, inputs[mode], bearer)), 401, 'not_attempted')
  expect(paths()).toEqual([])
})
test.each(['send', 'release', 'lookup'] as const)('%s provider identity uses only confirmed top-level UUID and email', async mode => {
  for (const [status, body, expected, outcome] of [
    [401, { message: 'PRIVATE_UPSTREAM_ERROR' }, 401, 'not_attempted'], [503, { message: 'PRIVATE_UPSTREAM_ERROR' }, 503, 'not_attempted'],
    [200, { ...providerUser, id: 'bad' }, 503, 'not_attempted'], [200, { ...providerUser, id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }, 503, 'not_attempted'], [200, { ...providerUser, email_confirmed_at: null }, 403, 'rejected'],
    [200, { ...providerUser, email: null, user_metadata: { email: 'forged@example.invalid', email_confirmed_at: providerUser.email_confirmed_at } }, 403, 'rejected'],
    [200, { ...providerUser, email_confirmed_at: '2026-02-30T00:00:00Z' }, 403, 'rejected'],
  ] as const) {
    fixture.replies[authPath] = { status, body }
    await failure(await run(mode), expected, outcome)
  }
  expect(paths()).toEqual(Array(7).fill(authPath))
})
test('send confirms both roles and every reused terminal status without secondary IO', async () => {
  for (const role of ['facilitator', 'storyteller'] as const) for (const status of ['pending', 'accepted', 'declined', 'expired']) {
    const row = { ...sendRow, role, status, outcome: 'reused' }
    fixture.replies[pathsByMode.send] = { body: [{ ...row, private_extra: 'discard' }] }
    expect(await (await run('send', request('send', { ...sendInput, role, email: ' \tINVITEE@EXAMPLE.INVALID\r\n' }))).json()).toEqual({ success: true, ...row })
  }
  expect(paths()).toEqual(Array(8).fill([authPath, pathsByMode.send]).flat())
})
test('release directly confirms release/replay for either reason without lookup permission preconditions', async () => {
  for (const reason of ['cancelled', 'expired'] as const) for (const outcome of ['released', 'already_released']) {
    const row = { ...releaseRow, status: reason === 'expired' ? 'expired' : 'declined', outcome }
    fixture.replies[pathsByMode.lookup] = { status: 403, body: { code: '42501' } }
    fixture.replies[pathsByMode.release] = { body: [{ ...row, token: fixtureToken }] }
    expect(await (await run('release', request('release', { ...releaseInput, reason }))).json()).toEqual({ success: true, ...row })
  }
  expect(paths()).toEqual(Array(4).fill([authPath, pathsByMode.release]).flat())
})
test('lookup validates both roles/states including accepted recipient distinct from sender', async () => {
  for (const role of ['facilitator', 'storyteller'] as const) for (const status of ['pending', 'accepted', 'declined', 'expired']) {
    const row = { ...(status === 'accepted' ? { ...acceptedStatusRow, user_id: otherUser } : pendingRow), role, status, is_expired: status === 'expired' }
    fixture.replies[pathsByMode.lookup] = { body: [row] }
    expect(await (await run('lookup', request('lookup', { ...lookupInput, role }))).json()).toEqual({ success: true, outcome: 'confirmed', ...row })
  }
  expect(paths()).toEqual(Array(8).fill([authPath, pathsByMode.lookup]).flat())
})
test.each(['send', 'release', 'lookup'] as const)('%s maps known SQL refusals and treats unknown state as unknown without retry', async mode => {
  for (const [code, status] of [['42501', 403], ['22023', 400], ['23502', 409], ['23503', 409], ['23505', 409], ['23514', 409], ['XX000', 503]] as const) {
    fixture.replies[pathsByMode[mode]] = { status: 400, body: { code, message: 'PRIVATE_UPSTREAM_ERROR' } }
    await failure(await run(mode), status, status === 503 ? 'unknown' : 'rejected')
  }
  expect(paths()).toEqual(Array(7).fill([authPath, pathsByMode[mode]]).flat())
})
test.each(['send', 'release', 'lookup'] as const)('%s rejects malformed and inconsistent final rows without post-read', async mode => {
  const row = { send: sendRow, release: releaseRow, lookup: pendingRow }[mode]
  for (const body of [[], [row, row], row, [{}], [{ ...row, project_id: 'bad' }], [{ ...row, status: 'invalid' }]]) {
    fixture.replies[pathsByMode[mode]] = { body }
    await failure(await run(mode), 503, 'unknown')
  }
  expect(paths()).toEqual(Array(6).fill([authPath, pathsByMode[mode]]).flat())
})
test.each(['send', 'release'] as const)('lost %s response remains unknown; explicit lookup adds no writes', async mode => {
  fixture.replies[pathsByMode[mode]] = { action: 'drop' }
  await failure(await run(mode), 503, 'unknown')
  expect(await (await run('lookup')).json()).toEqual(lookupHttp)
  expect(paths()).toEqual([authPath, pathsByMode[mode], authPath, pathsByMode.lookup])
})
test.each(['send', 'release', 'lookup'] as const)('%s abort before/during auth cannot start an operation', async mode => {
  const before = new AbortController(); before.abort()
  await failure(await run(mode, request(mode, inputs[mode], fixtureBearer, before.signal)), 503, 'not_attempted')
  fixture.replies[authPath] = { action: 'headers-only' }
  const during = new AbortController()
  const pending = run(mode, request(mode, inputs[mode], fixtureBearer, during.signal))
  await fixture.waitFor(authPath); during.abort()
  await failure(await pending, 503, 'not_attempted')
  expect(paths()).toEqual([authPath])
})
test.each(['send', 'release', 'lookup'] as const)('%s abort bounds stalled result bodies after actual operation dispatch', async mode => {
  fixture.replies[pathsByMode[mode]] = { action: 'headers-only' }
  const caller = new AbortController()
  const pending = run(mode, request(mode, inputs[mode], fixtureBearer, caller.signal))
  await fixture.waitFor(pathsByMode[mode]); caller.abort()
  await failure(await pending, 503, 'unknown')
  expect(paths()).toEqual([authPath, pathsByMode[mode]])
})
test('auth and send body share one ten-second deadline, clearing timer on exit', async () => {
  fixture.replies[authPath] = { action: 'hold' }
  fixture.replies[pathsByMode.send] = { action: 'headers-only' }
  const timers = jest.spyOn(globalThis, 'setTimeout'), clears = jest.spyOn(globalThis, 'clearTimeout')
  const started = performance.now(), pending = run('send')
  await fixture.waitFor(authPath)
  await new Promise<void>(resolve => setTimeout(resolve, 5000))
  fixture.release(authPath, providerUser)
  await failure(await pending, 503, 'unknown')
  expect(performance.now() - started).toBeGreaterThanOrEqual(9500)
  expect(performance.now() - started).toBeLessThan(14500)
  const index = timers.mock.calls.findIndex(x => x[1] === 10000)
  expect(index).toBeGreaterThanOrEqual(0)
  expect(clears.mock.calls.map(x => x[0])).toContain(timers.mock.results[index].value)
  expect(paths()).toEqual([authPath, pathsByMode.send])
})
