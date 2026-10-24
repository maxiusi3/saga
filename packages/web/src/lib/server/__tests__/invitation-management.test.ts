/** @jest-environment node */
import { POST as sources } from '@/app/api/invitations/sources/route'
import { POST as manage } from '@/app/api/invitations/manage/route'
import {
  startInvitationFixture,
  fixtureBearer,
  fixtureProject,
  fixtureInvitation,
  fixtureToken,
  providerUser,
} from '../test-support/invitation-fixture'

const savedEnv = { ...process.env }
const nativeFetch = global.fetch
const source = {
  source_id: '44444444-4444-4444-8444-444444444444',
  project_id: fixtureProject,
  role: 'storyteller',
  remaining: 2,
}
const entry = {
  invitation_id: fixtureInvitation,
  project_id: fixtureProject,
  invitee_email: 'invitee@example.invalid',
  role: 'storyteller',
  status: 'pending',
  expires_at: '2030-01-01T00:00:00Z',
  created_at: '2026-10-21T00:00:00Z',
  request_id: null,
}
const inputs = {
  sources: { project_id: fixtureProject, role: 'storyteller' },
  manage: { project_id: fixtureProject },
}
const handlers = { sources, manage }
const rpc = { sources: '/rest/v1/rpc/available_sources', manage: '/rest/v1/rpc/management_list' }
type Mode = keyof typeof handlers
let fixture: Awaited<ReturnType<typeof startInvitationFixture>>
let logs: jest.SpyInstance[]
beforeEach(async () => {
  fixture = await startInvitationFixture()
  fixture.replies[rpc.sources] = { body: [source] }
  fixture.replies[rpc.manage] = { body: [entry] }
  process.env.INVITATION_MANAGEMENT_ENABLED = 'true'
  process.env.INVITATION_TRANSACTIONS_ENABLED = 'true'
  process.env.NEXT_PUBLIC_SUPABASE_URL = fixture.url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-never-used'
  jest.spyOn(global, 'fetch').mockImplementation(nativeFetch)
  logs = ['log', 'warn', 'error'].map(method =>
    jest.spyOn(console, method as 'log').mockImplementation(() => {})
  )
})
afterEach(async () => {
  expect(await fixture.close()).toEqual({ listening: false, sockets: 0, held: 0 })
  const logged = logs.some(spy => spy.mock.calls.length)
  jest.restoreAllMocks()
  process.env = { ...savedEnv }
  expect(logged).toBe(false)
})
function request(
  mode: Mode,
  body: unknown = inputs[mode],
  bearer: string | null = fixtureBearer,
  signal?: AbortSignal
) {
  return new Request('http://localhost/api/invitations/' + mode, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Cookie: 'unrelated=wrong-account',
      ...(bearer === null ? {} : { Authorization: `Bearer ${bearer}` }),
    },
    signal,
  })
}
async function denied(response: Response, status: number) {
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('vary')).toBe('Authorization')
  const body = await response.json()
  expect(body.success).toBe(false)
  for (const secret of [
    fixtureBearer,
    fixtureToken,
    providerUser.email,
    'PRIVATE_UPSTREAM_ERROR',
    'service-never-used',
  ])
    expect(JSON.stringify(body)).not.toContain(secret)
}
test.each(['sources', 'manage'] as const)(
  '%s requires both exact flags before body or I/O',
  async mode => {
    for (const gate of ['INVITATION_MANAGEMENT_ENABLED', 'INVITATION_TRANSACTIONS_ENABLED']) {
      for (const value of [undefined, 'false', 'TRUE', '1', ' true']) {
        if (value === undefined) delete process.env[gate]
        else process.env[gate] = value
        const req = request(mode),
          json = jest.spyOn(req, 'json').mockRejectedValue(new Error('Must not read'))
        await denied(await handlers[mode](req), 503)
        expect(json).not.toHaveBeenCalled()
      }
      process.env[gate] = 'true'
    }
    expect(global.fetch).not.toHaveBeenCalled()
  }
)
test.each(['sources', 'manage'] as const)(
  '%s verifies provider bearer and calls only restricted RPC with anon key',
  async mode => {
    const row = mode === 'sources' ? source : entry
    fixture.replies[rpc[mode]] = {
      body: [{ ...row, token: fixtureToken, private_extra: 'discard' }],
    }
    const response = await handlers[mode](request(mode))
    expect(await response.json()).toEqual({ success: true, items: [row] })
    expect(fixture.captured.map(x => [x.path, x.body])).toEqual([
      ['/auth/v1/user', null],
      [
        rpc[mode],
        mode === 'sources'
          ? { p_project_id: fixtureProject, p_role: 'storyteller' }
          : { p_project_id: fixtureProject, p_after: null },
      ],
    ])
    for (const capture of fixture.captured) {
      expect(capture.headers.authorization).toBe(`Bearer ${fixtureBearer}`)
      expect(capture.headers.apikey).toBe('synthetic-anon')
      expect(capture.headers.cookie).toBeUndefined()
      if (capture.method === 'POST')
        expect(capture.headers['content-profile']).toBe('invitation_candidate')
    }
    for (const [, init] of (global.fetch as jest.Mock).mock.calls)
      expect(init).toMatchObject({
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      })
  }
)
test.each(['sources', 'manage'] as const)(
  '%s refuses malformed inputs and absent Bearer without provider IO',
  async mode => {
    for (const body of [
      null,
      [],
      {},
      { ...inputs[mode], extra: true },
      { ...inputs[mode], project_id: 'bad' },
    ])
      await denied(await handlers[mode](request(mode, body)), 400)
    for (const bearer of [null, '', 'two words'])
      await denied(await handlers[mode](request(mode, inputs[mode], bearer)), 401)
    expect(fixture.captured).toEqual([])
  }
)
test.each(['sources', 'manage'] as const)(
  '%s never trusts metadata or unconfirmed/provider failure',
  async mode => {
    for (const [status, body, expected] of [
      [401, { message: 'PRIVATE_UPSTREAM_ERROR' }, 401],
      [503, { message: 'PRIVATE_UPSTREAM_ERROR' }, 503],
      [200, { ...providerUser, id: 'bad' }, 503],
      [200, { ...providerUser, email_confirmed_at: null }, 403],
      [
        200,
        { ...providerUser, email: null, user_metadata: { email: 'forged@example.invalid' } },
        403,
      ],
    ] as const) {
      fixture.replies['/auth/v1/user'] = { status, body }
      await denied(await handlers[mode](request(mode)), expected)
    }
    expect(fixture.captured.map(x => x.path)).toEqual(Array(5).fill('/auth/v1/user'))
  }
)
test.each(['sources', 'manage'] as const)(
  '%s rejects duplicate, oversized, wrong-project and malformed rows',
  async mode => {
    const row = mode === 'sources' ? source : entry,
      limit = mode === 'sources' ? 100 : 50
    for (const body of [
      [row, row],
      Array(limit + 1).fill(row),
      {},
      [{}],
      [{ ...row, project_id: '55555555-5555-4555-8555-555555555555' }],
      [{ ...row, role: 'owner' }],
      [{ ...row, remaining: 0, status: 'broken' }],
    ]) {
      fixture.replies[rpc[mode]] = { body }
      await denied(await handlers[mode](request(mode)), 503)
    }
  }
)
test('management pagination is strictly greater than the submitted cursor', async () => {
  const response = await manage(
    request('manage', { project_id: fixtureProject, after: fixtureInvitation })
  )
  await denied(response, 503)
  expect(fixture.captured[1].body).toEqual({
    p_project_id: fixtureProject,
    p_after: fixtureInvitation,
  })
})
test('strict roles/cursors/JSON, missing config and pre-abort never reach provider', async () => {
  await denied(await sources(request('sources', { ...inputs.sources, role: 'owner' })), 400)
  for (const after of [null, 'bad', 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'])
    await denied(await manage(request('manage', { ...inputs.manage, after })), 400)
  const malformed = request('manage')
  jest.spyOn(malformed, 'json').mockRejectedValue(new SyntaxError())
  await denied(await manage(malformed), 400)
  const controller = new AbortController()
  controller.abort()
  await denied(
    await manage(request('manage', inputs.manage, fixtureBearer, controller.signal)),
    503
  )
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  await denied(await manage(request('manage')), 503)
  expect(fixture.captured).toEqual([])
})
test('both read shapes allow empty results and both roles without inventing history tokens', async () => {
  for (const mode of ['sources', 'manage'] as const) {
    fixture.replies[rpc[mode]] = { body: [] }
    expect(await (await handlers[mode](request(mode))).json()).toEqual({ success: true, items: [] })
    const row =
      mode === 'sources'
        ? { ...source, role: 'facilitator' }
        : { ...entry, role: 'facilitator', status: 'accepted' }
    fixture.replies[rpc[mode]] = { body: [row] }
    expect(
      await (
        await handlers[mode](
          request(
            mode,
            mode === 'sources' ? { ...inputs.sources, role: 'facilitator' } : inputs.manage
          )
        )
      ).json()
    ).toEqual({ success: true, items: [row] })
  }
})
test.each(['sources', 'manage'] as const)(
  '%s SQL refusals are safe and never retried',
  async mode => {
    for (const [code, status] of [
      ['42501', 403],
      ['22023', 400],
      ['23514', 409],
      ['XX000', 503],
    ] as const) {
      fixture.replies[rpc[mode]] = {
        status: 400,
        body: { code, message: 'PRIVATE_UPSTREAM_ERROR' },
      }
      await denied(await handlers[mode](request(mode)), status)
    }
    expect(fixture.captured).toHaveLength(8)
  }
)
test.each(['sources', 'manage'] as const)(
  '%s abort bounds provider and result bodies without retries',
  async mode => {
    for (const holdPath of ['/auth/v1/user', rpc[mode]]) {
      fixture.replies[holdPath] = { action: 'headers-only' }
      const controller = new AbortController(),
        req = request(mode, inputs[mode], fixtureBearer, controller.signal)
      const add = jest.spyOn(req.signal, 'addEventListener'),
        remove = jest.spyOn(req.signal, 'removeEventListener')
      const pending = handlers[mode](req)
      await fixture.waitFor(holdPath)
      controller.abort()
      await denied(await pending, 503)
      expect(remove.mock.calls.map(x => x[1])).toEqual(add.mock.calls.map(x => x[1]))
      fixture.replies['/auth/v1/user'] = { body: providerUser }
    }
  }
)
test('provider plus RPC body share one real ten-second deadline and clear its timer', async () => {
  jest.setTimeout(20000)
  fixture.replies['/auth/v1/user'] = { action: 'hold' }
  fixture.replies[rpc.manage] = { action: 'headers-only' }
  const timers = jest.spyOn(global, 'setTimeout'),
    clears = jest.spyOn(global, 'clearTimeout')
  const start = performance.now(),
    pending = manage(request('manage'))
  await fixture.waitFor('/auth/v1/user')
  await new Promise<void>(resolve => setTimeout(resolve, 150))
  fixture.release('/auth/v1/user', providerUser)
  await denied(await pending, 503)
  expect(performance.now() - start).toBeGreaterThanOrEqual(9500)
  expect(performance.now() - start).toBeLessThan(14500)
  const index = timers.mock.calls.findIndex(call => call[1] === 10000)
  expect(clears.mock.calls.map(call => call[0])).toContain(timers.mock.results[index].value)
  expect(fixture.captured.map(call => call.path)).toEqual(['/auth/v1/user', rpc.manage])
}, 20000)
