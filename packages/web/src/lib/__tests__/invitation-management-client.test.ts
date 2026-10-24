import {
  loadInvitationSources,
  loadManagedInvitations,
  InvitationManagementError,
} from '../invitation-management-client'
import { parseSourcesRows, parseManagementRows } from '../invitation-management-protocol'

const project = '22222222-2222-4222-8222-222222222222',
  sourceId = '44444444-4444-4444-8444-444444444444'
const invitation = '33333333-3333-4333-8333-333333333333',
  other = '66666666-6666-4666-8666-666666666666'
const sourceInput = { project_id: project, role: 'storyteller' as const },
  managementInput = { project_id: project }
const source = { ...sourceInput, source_id: sourceId, remaining: 2 }
const entry = {
  invitation_id: invitation,
  project_id: project,
  invitee_email: 'invitee@example.invalid',
  role: 'storyteller',
  status: 'pending',
  expires_at: '2030-01-01T00:00:00Z',
  created_at: '2026-10-21T00:00:00Z',
  request_id: null,
}
const bearer = 'synthetic-session.opaque.signature',
  originalFetch = global.fetch
let boundary: jest.Mock
function reply(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}
beforeEach(() => {
  boundary = jest.fn()
  global.fetch = boundary
})
afterEach(() => {
  global.fetch = originalFetch
  jest.useRealTimers()
  jest.restoreAllMocks()
})
test.each(['sources', 'manage'] as const)(
  '%s validates before IO and uses only Bearer POST without cookies',
  async mode => {
    const call = mode === 'sources' ? loadInvitationSources : loadManagedInvitations
    const input = mode === 'sources' ? sourceInput : managementInput,
      row = mode === 'sources' ? source : entry
    for (const value of [null, {}, { ...input, extra: true }, { ...input, project_id: 'bad' }])
      await expect(call(value, bearer)).rejects.toBeInstanceOf(InvitationManagementError)
    for (const credential of ['', 'two words'])
      await expect(call(input, credential)).rejects.toBeInstanceOf(InvitationManagementError)
    const aborted = new AbortController()
    aborted.abort()
    await expect(call(input, bearer, aborted.signal)).rejects.toBeInstanceOf(
      InvitationManagementError
    )
    expect(boundary).not.toHaveBeenCalled()
    boundary.mockResolvedValue(
      reply({ success: true, items: [{ ...row, token: 'discard', message: 'discard' }] })
    )
    expect(await call(input, bearer)).toEqual([row])
    expect(boundary).toHaveBeenCalledTimes(1)
    expect(boundary.mock.calls[0][0]).toBe(`/api/invitations/${mode}`)
    expect(JSON.parse(boundary.mock.calls[0][1].body)).toEqual(input)
    expect(boundary.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      headers: { Authorization: `Bearer ${bearer}` },
      signal: expect.any(AbortSignal),
    })
  }
)
test.each(['sources', 'manage'] as const)(
  '%s rejects HTTP/JSON/transport/malformed results without retries or prior-write claims',
  async mode => {
    const call = mode === 'sources' ? loadInvitationSources : loadManagedInvitations
    const input = mode === 'sources' ? sourceInput : managementInput
    for (const result of [
      reply({ success: true, items: [{}] }),
      reply({ success: false, outcome: 'not_attempted' }, false, 503),
      reply([]),
      {
        ok: true,
        json: async () => {
          throw new Error('PRIVATE_UPSTREAM')
        },
      },
    ]) {
      boundary.mockResolvedValueOnce(result)
      await expect(call(input, bearer)).rejects.toMatchObject({
        message: 'Invitation management could not be loaded.',
      })
    }
    boundary.mockRejectedValueOnce(new Error('PRIVATE_UPSTREAM'))
    await expect(call(input, bearer)).rejects.toBeInstanceOf(InvitationManagementError)
    expect(boundary).toHaveBeenCalledTimes(5)
  }
)
test('source parsing bounds safe integers, roles, canonical UUID, unique order and capacity', () => {
  for (const value of [[], [{ ...source, remaining: 2147483647 }]])
    expect(parseSourcesRows(value, sourceInput)).toEqual(value)
  for (const value of [
    [{ ...source, remaining: 0 }],
    [{ ...source, remaining: 1.5 }],
    [{ ...source, remaining: '2' }],
    [{ ...source, remaining: 2147483648 }],
    [{ ...source, project_id: other }],
    [{ ...source, role: 'facilitator' }],
    [{ ...source, source_id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }],
    [source, source],
    [{ ...source, source_id: other }, source],
    Array(101).fill(source),
  ])
    expect(parseSourcesRows(value, sourceInput)).toBeNull()
})
test('history validates canonical bounded order, timestamps, email, status and request binding', () => {
  expect(parseManagementRows([], managementInput)).toEqual([])
  for (const status of ['pending', 'accepted', 'declined', 'expired'])
    expect(parseManagementRows([{ ...entry, status }], managementInput)).toEqual([
      { ...entry, status },
    ])
  for (const value of [
    [{ ...entry, status: ['pending'] }],
    [{ ...entry, invitee_email: 'INVALID' }],
    [{ ...entry, invitee_email: 'UPPER@example.invalid' }],
    [{ ...entry, expires_at: '2026-02-30T00:00:00Z' }],
    [{ ...entry, expires_at: entry.created_at }],
    [{ ...entry, request_id: 'bad' }],
    [{ ...entry, project_id: other }],
    [entry, entry],
    [{ ...entry, invitation_id: other }, entry],
    Array(51).fill(entry),
  ])
    expect(parseManagementRows(value, managementInput)).toBeNull()
  expect(parseManagementRows([entry], { ...managementInput, after: invitation })).toBeNull()
})
test('client deadline bounds stalled JSON and cleans caller abort listeners', async () => {
  jest.useFakeTimers()
  const controller = new AbortController()
  const add = jest.spyOn(controller.signal, 'addEventListener'),
    remove = jest.spyOn(controller.signal, 'removeEventListener')
  boundary.mockResolvedValue({ ok: true, json: () => new Promise(() => {}) })
  const pending = loadManagedInvitations(managementInput, bearer, controller.signal)
  const rejected = expect(pending).rejects.toBeInstanceOf(InvitationManagementError)
  await jest.advanceTimersByTimeAsync(10000)
  await rejected
  expect(boundary).toHaveBeenCalledTimes(1)
  expect(boundary.mock.calls[0][1].signal.aborted).toBe(true)
  expect(remove.mock.calls.map(x => x[1])).toEqual(add.mock.calls.map(x => x[1]))
  expect(jest.getTimerCount()).toBe(0)
})
