import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import InvitationsPage from '@/app/[locale]/dashboard/projects/[id]/invitations/page'
import { InvitationManager } from '../invitation-manager'
import { InvitationManagement } from '../invitation-management'
import { invitationRecoveryKey } from '@/lib/invitation-recovery'
import { toast } from 'sonner'

const project = '22222222-2222-4222-8222-222222222222'
const actor = '11111111-1111-4111-8111-111111111111'
const invitation = '33333333-3333-4333-8333-333333333333'
const source = '44444444-4444-4444-8444-444444444444'
const requestId = '55555555-5555-4555-8555-555555555555'
const other = '66666666-6666-4666-8666-666666666666'
const bearer = 'synthetic-session.opaque.signature'
const token = 'v1_0123456789abcdef0123456789abcdef'
const getAccessToken = jest.fn(async (): Promise<string | null> => bearer)
let authUser = { id: actor }
const authListeners = new Set<(state: unknown) => void>()
function changeAccount(id: string | null) {
  authUser = id ? { id } : (null as unknown as { id: string })
  for (const listener of authListeners) listener({ user: authUser, getAccessToken })
}
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '22222222-2222-4222-8222-222222222222', locale: 'en' }),
}))
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(() => ({ user: authUser, getAccessToken }), {
    getState: () => ({ user: authUser, getAccessToken }),
    subscribe: (listener: (state: unknown) => void) => {
      authListeners.add(listener)
      return () => authListeners.delete(listener)
    },
  }),
}))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
const row = {
  invitation_id: invitation,
  project_id: project,
  invitee_email: 'invitee@example.invalid',
  role: 'storyteller',
  status: 'pending',
  created_at: '2026-10-21T00:00:00Z',
  expires_at: '2030-01-01T00:00:00Z',
  request_id: requestId,
}
const confirmation = {
  success: true,
  invitation_id: invitation,
  project_id: project,
  status: 'declined',
  outcome: 'released',
}
const sendResult = {
  success: true,
  invitation_id: invitation,
  project_id: project,
  role: 'storyteller',
  status: 'pending',
  expires_at: row.expires_at,
  token,
  outcome: 'created',
}
const lookupResult = {
  ...sendResult,
  outcome: 'confirmed',
  is_expired: false,
  user_id: null,
  member_id: null,
  joined_at: null,
}
const recovery = {
  version: 1,
  actor_id: actor,
  project_id: project,
  request_id: requestId,
  role: 'storyteller',
}
const unknown = { success: false, outcome: 'unknown', error: 'safe', can_query_status: true }
const originalFetch = global.fetch
let fetchBoundary: jest.Mock
function reply(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}
function defaultReply(url: string) {
  if (url.endsWith('/sources'))
    return reply({
      success: true,
      items: [{ source_id: source, project_id: project, role: 'storyteller', remaining: 2 }],
    })
  if (url.endsWith('/manage')) return reply({ success: true, items: [row] })
  if (url.endsWith('/release')) return reply(confirmation)
  if (url.endsWith('/lookup')) return reply(lookupResult)
  return reply(sendResult)
}
function writes() {
  return fetchBoundary.mock.calls.filter(
    ([url]) => !url.endsWith('/manage') && !url.endsWith('/sources')
  )
}
beforeEach(() => {
  sessionStorage.clear()
  authUser = { id: actor }
  getAccessToken.mockReset().mockResolvedValue(bearer)
  jest.spyOn(crypto, 'randomUUID').mockReturnValue(requestId)
  fetchBoundary = jest.fn(async url => defaultReply(url))
  global.fetch = fetchBoundary
})
afterEach(() => {
  cleanup()
  global.fetch = originalFetch
  jest.restoreAllMocks()
  jest.clearAllMocks()
})
async function fill() {
  await screen.findByRole('option', { name: /2 seats available/ })
  fireEvent.change(screen.getByLabelText('Email Address'), {
    target: { value: 'NEW@example.invalid' },
  })
  fireEvent.change(screen.getByLabelText('Seat source'), { target: { value: source } })
}
async function cancel() {
  render(<InvitationsPage />)
  await screen.findByText('invitee@example.invalid')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel invitation' }))
}
test('actual page cancellation uses global release with Bearer and no project/request ID in body', async () => {
  await cancel()
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Invitation cancelled'))
  expect(writes()).toHaveLength(1)
  expect(writes()[0][0]).toBe('/api/invitations/release')
  expect(JSON.parse(writes()[0][1].body)).toEqual({
    invitation_id: invitation,
    reason: 'cancelled',
  })
  expect(writes()[0][1]).toMatchObject({
    method: 'POST',
    credentials: 'omit',
    redirect: 'error',
    headers: { Authorization: `Bearer ${bearer}` },
  })
})
test.each([
  {},
  { ...confirmation, project_id: other },
  { ...confirmation, invitation_id: other },
  unknown,
])('actual page rejects malformed/mismatched/unknown release %#', async body => {
  fetchBoundary.mockImplementation(async url =>
    url.endsWith('/release')
      ? reply(body, body !== unknown, body === unknown ? 503 : 200)
      : defaultReply(url)
  )
  await cancel()
  await waitFor(() => expect(toast.error).toHaveBeenCalled())
  expect(toast.success).not.toHaveBeenCalled()
  expect(writes()).toHaveLength(1)
})
test.each(['page', 'embedded'])(
  '%s source-selected send uses one request ID and stores only minimal recovery before dispatch',
  async view => {
    let ticketAtDispatch: unknown
    fetchBoundary.mockImplementation(async url => {
      if (url.includes('/projects/'))
        ticketAtDispatch = JSON.parse(
          sessionStorage.getItem(invitationRecoveryKey(actor, project))!
        )
      return defaultReply(url)
    })
    render(view === 'page' ? <InvitationsPage /> : <InvitationManager projectId={project} />)
    await fill()
    fireEvent.change(screen.getByLabelText('Message (optional)'), {
      target: { value: 'Personal message' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(writes()).toHaveLength(1)
    expect(ticketAtDispatch).toEqual(recovery)
    expect(JSON.parse(writes()[0][1].body)).toEqual({
      request_id: requestId,
      source_id: source,
      email: 'new@example.invalid',
      role: 'storyteller',
      message: 'Personal message',
    })
    expect(screen.getByLabelText('Invitation link')).toHaveValue(
      `http://localhost/en/invite/${token}`
    )
    expect(sessionStorage.getItem(invitationRecoveryKey(actor, project))).toBeNull()
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('email delivery is not confirmed')
    )
  }
)
test('unselected and forged source IDs cannot dispatch; member emails are never invented', async () => {
  render(
    <InvitationManager
      projectId={project}
      currentUserId={actor}
      currentMembers={[{ id: invitation, user_id: actor, status: 'active', role: 'facilitator' }]}
    />
  )
  await screen.findByRole('option', { name: /2 seats available/ })
  fireEvent.change(screen.getByLabelText('Email Address'), {
    target: { value: 'new@example.invalid' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
  fireEvent.change(screen.getByLabelText('Seat source'), { target: { value: other } })
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
  expect(writes()).toHaveLength(0)
  expect(screen.queryByText('current@example.com')).not.toBeInTheDocument()
  expect(screen.getByText('You')).toBeInTheDocument()
})
test('lost send survives unmount, performs no auto lookup/write, and explicit recovery clears it', async () => {
  fetchBoundary.mockImplementation(async url =>
    url.includes('/projects/') ? reply(unknown, false, 503) : defaultReply(url)
  )
  const view = render(<InvitationsPage />)
  await fill()
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
  await screen.findByText(/Invitation result is unknown/)
  expect(JSON.parse(sessionStorage.getItem(invitationRecoveryKey(actor, project))!)).toEqual(
    recovery
  )
  view.unmount()
  jest.clearAllMocks()
  render(<InvitationsPage />)
  const query = await screen.findByRole('button', { name: 'Query last invitation' })
  await screen.findByText('invitee@example.invalid')
  expect(writes()).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Send Invitation' })).toBeDisabled()
  fireEvent.click(query)
  await screen.findByLabelText('Invitation link')
  expect(writes().map(([url]) => url)).toEqual(['/api/invitations/lookup'])
  expect(sessionStorage.getItem(invitationRecoveryKey(actor, project))).toBeNull()
})
test.each([
  reply(unknown, false, 503),
  reply(
    { success: false, outcome: 'rejected', error: 'safe', can_query_status: false },
    false,
    403
  ),
])('unknown/refused lookup retains recovery and never retries', async result => {
  sessionStorage.setItem(invitationRecoveryKey(actor, project), JSON.stringify(recovery))
  fetchBoundary.mockImplementation(async url =>
    url.endsWith('/lookup') ? result : defaultReply(url)
  )
  render(<InvitationsPage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Query last invitation' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalled())
  expect(sessionStorage.getItem(invitationRecoveryKey(actor, project))).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Send Invitation' })).toBeDisabled()
  expect(writes()).toHaveLength(1)
})
test('failure to save recovery blocks the send; known refusal clears it', async () => {
  const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  const view = render(<InvitationsPage />)
  await fill()
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
  await screen.findByText('Recovery storage is unavailable. Invitation was not sent.')
  expect(writes()).toHaveLength(0)
  storage.mockRestore()
  view.unmount()
  fetchBoundary.mockImplementation(async url =>
    url.includes('/projects/')
      ? reply(
          { success: false, outcome: 'rejected', error: 'safe', can_query_status: false },
          false,
          409
        )
      : defaultReply(url)
  )
  render(<InvitationsPage />)
  await fill()
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
  await screen.findByText('Invitation was not sent. Check the form and availability.')
  expect(sessionStorage.getItem(invitationRecoveryKey(actor, project))).toBeNull()
})
test('failed removal after confirmed send keeps the recovery button and blocks new sends', async () => {
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  render(<InvitationsPage />)
  await fill()
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
  await screen.findByLabelText('Invitation link')
  expect(screen.getByRole('button', { name: 'Query last invitation' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send Invitation' })).toBeDisabled()
  expect(writes()).toHaveLength(1)
})
test('account switch aborts pending send and suppresses its late token or success in the new account', async () => {
  let resolveSend!: (value: unknown) => void
  fetchBoundary.mockImplementation(async url =>
    url.includes('/projects/')
      ? new Promise(resolve => {
          resolveSend = resolve
        })
      : defaultReply(url)
  )
  const view = render(<InvitationManagement projectId={project} />)
  await fill()
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  const signal = writes()[0][1].signal
  act(() => changeAccount(other))
  view.rerender(<InvitationManagement projectId={project} />)
  expect(signal.aborted).toBe(true)
  await act(async () => resolveSend(reply(sendResult)))
  expect(screen.queryByLabelText('Invitation link')).not.toBeInTheDocument()
  expect(toast.success).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Query last invitation' })).not.toBeInTheDocument()
  act(() => changeAccount(actor))
  view.rerender(<InvitationManagement projectId={project} />)
  expect(await screen.findByRole('button', { name: 'Query last invitation' })).toBeInTheDocument()
})
test('same-batch departure and return invalidates an earlier sender generation', async () => {
  let resolveSend!: (value: unknown) => void
  fetchBoundary.mockImplementation(async url =>
    url.includes('/projects/')
      ? new Promise(resolve => {
          resolveSend = resolve
        })
      : defaultReply(url)
  )
  render(<InvitationManagement projectId={project} />)
  await fill()
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  await act(async () => {
    changeAccount(null)
    changeAccount(actor)
    resolveSend(reply(sendResult))
    await Promise.resolve()
  })
  expect(screen.queryByLabelText('Invitation link')).not.toBeInTheDocument()
  expect(toast.success).not.toHaveBeenCalled()
  expect(await screen.findByRole('button', { name: 'Query last invitation' })).toBeInTheDocument()
  expect(writes()).toHaveLength(1)
})
test('project switch while awaiting token prevents dispatch and cannot expose an old link', async () => {
  const view = render(<InvitationManagement projectId={project} />)
  await fill()
  let resolveToken!: (value: string) => void
  getAccessToken.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveToken = resolve
      })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
  view.rerender(<InvitationManagement projectId={other} />)
  await act(async () => resolveToken(bearer))
  expect(writes()).toHaveLength(0)
  expect(screen.queryByLabelText('Invitation link')).not.toBeInTheDocument()
  view.rerender(<InvitationManagement projectId={project} />)
  await fill()
  expect(screen.queryByRole('button', { name: 'Query last invitation' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send Invitation' })).toBeEnabled()
})
test('departing before token resolves clears its undispatched recovery immediately', async () => {
  const view = render(<InvitationManagement projectId={project} />)
  await fill()
  getAccessToken.mockImplementationOnce(() => new Promise(() => {}))
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
  expect(sessionStorage.getItem(invitationRecoveryKey(actor, project))).not.toBeNull()
  view.rerender(<InvitationManagement projectId={other} />)
  view.rerender(<InvitationManagement projectId={project} />)
  await fill()
  expect(sessionStorage.getItem(invitationRecoveryKey(actor, project))).toBeNull()
  expect(screen.queryByRole('button', { name: 'Query last invitation' })).not.toBeInTheDocument()
  expect(writes()).toHaveLength(0)
})
test('changing role clears the prior confirmed invitation link', async () => {
  render(<InvitationsPage />)
  await fill()
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }))
  await screen.findByLabelText('Invitation link')
  fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'facilitator' } })
  expect(screen.queryByLabelText('Invitation link')).not.toBeInTheDocument()
})
test('mapped history explicitly recovers its link; mismatched invitation is rejected', async () => {
  fetchBoundary.mockImplementation(async url =>
    url.endsWith('/lookup') ? reply({ ...lookupResult, invitation_id: other }) : defaultReply(url)
  )
  render(<InvitationsPage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Recover invitation link' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalled())
  expect(screen.queryByLabelText('Invitation link')).not.toBeInTheDocument()
  expect(writes().map(([url]) => url)).toEqual(['/api/invitations/lookup'])
})
test('expired pending release uses expired reason and requires no lookup or original request', async () => {
  fetchBoundary.mockImplementation(async url =>
    url.endsWith('/manage')
      ? reply({
          success: true,
          items: [
            {
              ...row,
              created_at: '2020-01-01T00:00:00Z',
              expires_at: '2021-01-01T00:00:00Z',
              request_id: null,
            },
          ],
        })
      : url.endsWith('/release')
        ? reply({ ...confirmation, status: 'expired' })
        : defaultReply(url)
  )
  render(<InvitationsPage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Release expired invitation' }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Expired invitation released'))
  expect(writes()).toHaveLength(1)
  expect(JSON.parse(writes()[0][1].body)).toEqual({ invitation_id: invitation, reason: 'expired' })
})
test('full history page advances with a UUID keyset cursor and keeps next-page access', async () => {
  const rows = Array.from({ length: 50 }, (_, index) => ({
    ...row,
    invitation_id: `33333333-3333-4333-8333-${String(index + 1).padStart(12, '0')}`,
    request_id: null,
  }))
  fetchBoundary.mockImplementation(async (url, init) =>
    url.endsWith('/manage')
      ? reply({ success: true, items: JSON.parse(init.body).after ? [] : rows })
      : defaultReply(url)
  )
  render(<InvitationsPage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Next page' }))
  await screen.findByText('No invitations on this page.')
  const calls = fetchBoundary.mock.calls.filter(([url]) => url.endsWith('/manage'))
  expect(JSON.parse(calls[1][1].body)).toEqual({
    project_id: project,
    after: rows[49].invitation_id,
  })
  expect(screen.getByRole('button', { name: 'First page' })).toBeInTheDocument()
  expect(writes()).toHaveLength(0)
})
