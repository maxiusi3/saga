import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import InvitationLandingPage from '@/app/[locale]/invite/[token]/page'
import AcceptInvitationPage from '@/app/[locale]/accept-invitation/page'
import HomePage from '@/app/[locale]/page'
import {
  fixtureToken, fixtureBearer, fixtureUser, fixtureProject, otherUser,
  pendingHttp, acceptedHttp, acceptedStatusRow,
} from '@/lib/server/test-support/invitation-fixture'

const router = { push: jest.fn(), replace: jest.fn() }
let params: { token: string | string[]; locale: string }
let query: URLSearchParams
let locale: string
jest.mock('next/navigation', () => ({
  useRouter: () => router,
  useParams: () => params,
  useSearchParams: () => query,
  usePathname: () => '/en',
}))
jest.mock('next-intl', () => ({ useLocale: () => locale, useTranslations: () => (key: string) => key }))
jest.mock('@/components/i18n/LocaleSwitcher', () => ({ __esModule: true, default: () => null }))

type Session = { access_token: string; user: { id: string } }
const session: Session = { access_token: fixtureBearer, user: { id: fixtureUser } }
let onAuthChange: (event: string, value: Session | null) => void
const getSession = jest.fn()
const unsubscribe = jest.fn()
const forbiddenAuth = jest.fn()
jest.mock('@/lib/supabase', () => ({
  createClientSupabase: () => ({ auth: {
    getSession,
    onAuthStateChange: (callback: typeof onAuthChange) => {
      onAuthChange = callback
      return { data: { subscription: { unsubscribe } } }
    },
    getUser: forbiddenAuth, signUp: forbiddenAuth,
  } }),
}))
jest.mock('@/stores/auth-store', () => ({ useAuthStore: () => ({ user: null }) }))
const acceptedStatus = { ...acceptedStatusRow, success: true, outcome: 'confirmed' }
const secondToken = 'v1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
let fetchMock: jest.Mock
let consoleSpies: jest.SpyInstance[]
let storageSpy: jest.SpyInstance
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function calls(path: string) { return fetchMock.mock.calls.filter(call => call[0] === `/api/invitations/${path}`) }
async function ready() { return screen.findByRole('button', { name: 'Accept invitation' }) }
async function flush() { await act(async () => { await Promise.resolve() }) }

beforeEach(() => {
  params = { token: fixtureToken, locale: 'en' }
  query = new URLSearchParams({ token: fixtureToken })
  locale = 'en'
  getSession.mockResolvedValue({ data: { session }, error: null })
  fetchMock = jest.fn(async (path: string) => response(path.endsWith('/status') ? pendingHttp : path.endsWith('/accept') ? acceptedHttp : {
    id: pendingHttp.invitation_id, project_id: fixtureProject, project_name: 'Synthetic project',
    inviter_name: 'Synthetic inviter', role: 'storyteller', status: 'pending', expires_at: pendingHttp.expires_at,
  }))
  globalThis.fetch = fetchMock
  consoleSpies = ['log', 'error', 'warn'].map(method => jest.spyOn(console, method as 'log').mockImplementation(() => {}))
  storageSpy = jest.spyOn(Storage.prototype, 'setItem')
})
afterEach(() => {
  cleanup()
  const logged = consoleSpies.some(spy => spy.mock.calls.length > 0)
  expect(storageSpy).not.toHaveBeenCalled()
  expect(forbiddenAuth).not.toHaveBeenCalled()
  jest.restoreAllMocks()
  jest.clearAllMocks()
  window.history.replaceState({}, '', '/')
  expect(logged).toBe(false)
})

test.each([InvitationLandingPage, AcceptInvitationPage])('signed-out recipient uses local signin/account-creation next and does not fetch data', async Page => {
  getSession.mockResolvedValue({ data: { session: null }, error: null })
  locale = 'zh-TW'
  params.locale = locale
  render(<Page />)
  const login = await screen.findByRole('link', { name: /Sign in or create an account/i })
  const destination = new URL(login.getAttribute('href')!, 'https://example.invalid')
  expect(destination.pathname).toBe('/zh-TW/auth/signin')
  expect(destination.searchParams.get('next')).toBe(Page === InvitationLandingPage
    ? `/zh-TW/invite/${fixtureToken}` : `/zh-TW/accept-invitation?token=${fixtureToken}`)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
})
test.each([InvitationLandingPage, AcceptInvitationPage])('both pages read status using only session Bearer and canonical token before an explicit accept', async Page => {
  render(<Page />)
  await ready()
  expect(calls('status').length).toBe(1)
  const [, init] = calls('status')[0]
  expect(init.method).toBe('POST')
  expect(init.headers.Authorization === `Bearer ${fixtureBearer}`).toBe(true)
  expect(JSON.parse(init.body)).toEqual({ token: fixtureToken })
  expect(init.credentials).toBe('omit')
  expect(calls('accept').length).toBe(0)
  fireEvent.click(await ready())
  await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/en/dashboard/projects/${fixtureProject}`))
  expect(calls('accept').length).toBe(1)
})
test.each(['', 'legacy', '%76' + fixtureToken.slice(1), '%2576' + fixtureToken.slice(1), ' ' + fixtureToken])('invalid path token case %# has original-link guidance and no requests', async token => {
  params.token = token
  render(<InvitationLandingPage />)
  expect(await screen.findByText(/Reopen the original invitation link/i)).toBeInTheDocument()
  await flush()
  expect(fetchMock).not.toHaveBeenCalled()
})
test.each(['', `?token=${fixtureToken}&token=${fixtureToken}`, `?token=%2576${fixtureToken.slice(1)}`, '?type=invite'])('missing/duplicate/encoded query case %# never discovers invitations', async value => {
  query = new URLSearchParams(value)
  render(<AcceptInvitationPage />)
  expect(await screen.findByText(/Reopen the original invitation link/i)).toBeInTheDocument()
  await flush()
  expect(fetchMock).not.toHaveBeenCalled()
})
test('query accepts one URL-decoded canonical token without requiring type=invite', async () => {
  query = new URLSearchParams(`token=%76${fixtureToken.slice(1)}&type=untrusted`)
  render(<AcceptInvitationPage />)
  await ready()
  expect(calls('status').length).toBe(1)
})
test.each([
  [{ ...pendingHttp, expires_at: '2000-01-01T00:00:00Z' }, true, 'This invitation is pending.'],
  [{ ...pendingHttp, is_expired: true }, false, 'This invitation has expired.'],
  [{ ...pendingHttp, status: 'expired', is_expired: true }, false, 'This invitation has expired.'],
  [{ ...pendingHttp, status: 'declined' }, false, 'This invitation was declined.'],
  [acceptedStatus, false, 'This invitation is already accepted.'],
] as const)('renders server state case %# without browser expiry decisions or automatic writes', async (body, canAccept, text) => {
  fetchMock.mockResolvedValue(response(body))
  render(<InvitationLandingPage />)
  expect(await screen.findByText(text)).toBeInTheDocument()
  expect(Boolean(screen.queryByRole('button', { name: 'Accept invitation' }))).toBe(canAccept)
  expect(calls('accept').length).toBe(0)
  expect(router.push).not.toHaveBeenCalled()
  if (body.status === 'accepted') expect(screen.getByRole('button', { name: 'Enter project' })).toBeInTheDocument()
})
test.each([[503, 'not_attempted'], [403, 'rejected']] as const)('status failure %s is explicit and safe, without exposing untrusted data', async (status, outcome) => {
  fetchMock.mockResolvedValue(response({ success: false, outcome, error: 'PRIVATE_UPSTREAM_ERROR' }, status))
  render(<InvitationLandingPage />)
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(outcome === 'rejected' ? /confirm your email.*invited account/i : /unavailable/i)
  expect(document.body).not.toHaveTextContent('PRIVATE_UPSTREAM_ERROR')
  expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument()
})
test('status and accept extra fields never reach the page', async () => {
  fetchMock.mockResolvedValue(response({ ...pendingHttp, token: fixtureToken, invitee_email: 'private@example.invalid', project_name: 'PRIVATE_NAME', error: 'PRIVATE_UPSTREAM_ERROR' }))
  render(<InvitationLandingPage />)
  await ready()
  for (const value of [fixtureToken, fixtureBearer, 'private@example.invalid', 'PRIVATE_NAME', 'PRIVATE_UPSTREAM_ERROR']) expect(document.body.textContent?.includes(value)).toBe(false)
})
test('consecutive clicks produce one acceptance; network loss locks writes until explicit read and continuation', async () => {
  const accept = deferred<Response>()
  fetchMock.mockImplementation((path: string) => path.endsWith('/accept') ? accept.promise : Promise.resolve(response(pendingHttp)))
  render(<InvitationLandingPage />)
  const button = await ready()
  act(() => { button.click(); button.click() })
  expect(calls('accept').length).toBe(1)
  await act(async () => { accept.reject(new Error('PRIVATE_UPSTREAM_ERROR')) })
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not confirm/i)
  expect(screen.getByRole('button', { name: 'Accept invitation' })).toBeDisabled()
  expect(calls('status').length).toBe(1)
  expect(router.push).not.toHaveBeenCalled()
  fetchMock.mockResolvedValue(response(acceptedStatus))
  fireEvent.click(screen.getByRole('button', { name: 'Query status' }))
  const enter = await screen.findByRole('button', { name: 'Enter project' })
  expect(calls('status').length).toBe(2)
  expect(calls('accept').length).toBe(1)
  expect(router.push).not.toHaveBeenCalled()
  fireEvent.click(enter)
  expect(router.push).toHaveBeenCalledWith(`/en/dashboard/projects/${fixtureProject}`)
})
test.each([
  { success: true, project_id: fixtureProject },
  { ...acceptedHttp, invitation_id: otherUser },
  { ...acceptedHttp, project_id: otherUser },
  { ...acceptedHttp, role: 'facilitator' },
  { ...acceptedHttp, user_id: otherUser },
])('malformed or inconsistent success case %# becomes unknown without navigating or retrying', async body => {
  fetchMock.mockImplementation(async (path: string) => response(path.endsWith('/status') ? pendingHttp : body))
  render(<InvitationLandingPage />)
  fireEvent.click(await ready())
  await screen.findByRole('button', { name: 'Query status' })
  expect(screen.getByRole('button', { name: 'Accept invitation' })).toBeDisabled()
  expect(router.push).not.toHaveBeenCalled()
  expect(calls('accept').length).toBe(1)
})
test('unknown remains locked after pending status, repeated reads, and same-user session refresh', async () => {
  fetchMock.mockImplementation(async (path: string) => path.endsWith('/status') ? response(pendingHttp) : response({}, 200))
  render(<InvitationLandingPage />)
  fireEvent.click(await ready())
  fireEvent.click(await screen.findByRole('button', { name: 'Query status' }))
  await waitFor(() => expect(calls('status').length).toBe(2))
  await act(async () => onAuthChange('TOKEN_REFRESHED', { ...session, access_token: 'refreshed.synthetic.session' }))
  expect(screen.getByRole('button', { name: 'Accept invitation' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Query status' }))
  await waitFor(() => expect(calls('status').length).toBe(3))
  expect(calls('status')[2][1].headers.Authorization === 'Bearer refreshed.synthetic.session').toBe(true)
  expect(calls('accept').length).toBe(1)
})
test('accepted status for a different user cannot offer project continuation', async () => {
  fetchMock.mockResolvedValue(response({ ...acceptedStatus, user_id: otherUser }))
  render(<InvitationLandingPage />)
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: 'Enter project' })).not.toBeInTheDocument()
  expect(router.push).not.toHaveBeenCalled()
})
test('token change ignores a stale status response', async () => {
  const old = deferred<Response>()
  fetchMock.mockReturnValueOnce(old.promise).mockResolvedValue(response({ ...pendingHttp, status: 'declined' }))
  const view = render(<InvitationLandingPage />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  params = { ...params, token: secondToken }
  view.rerender(<InvitationLandingPage />)
  await screen.findByText('This invitation was declined.')
  await act(async () => old.resolve(response(pendingHttp)))
  expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument()
})
test.each(['token', 'account', 'unmount'] as const)('%s change while accepting ignores stale success and cleans subscriptions', async change => {
  const old = deferred<Response>()
  fetchMock.mockImplementation((path: string) => path.endsWith('/accept') ? old.promise : Promise.resolve(response(pendingHttp)))
  const view = render(<InvitationLandingPage />)
  fireEvent.click(await ready())
  if (change === 'token') {
    params = { ...params, token: secondToken }
    view.rerender(<InvitationLandingPage />)
  } else if (change === 'account') {
    await act(async () => onAuthChange('SIGNED_IN', { ...session, user: { id: otherUser } }))
  } else view.unmount()
  await act(async () => old.resolve(response(acceptedHttp)))
  expect(router.push).not.toHaveBeenCalled()
  view.unmount()
  expect(unsubscribe).toHaveBeenCalled()
})
test('late initial session load cannot overwrite a newer auth event', async () => {
  const initial = deferred<{ data: { session: Session }; error: null }>()
  getSession.mockReturnValue(initial.promise)
  render(<InvitationLandingPage />)
  await act(async () => onAuthChange('SIGNED_OUT', null))
  await screen.findByRole('link', { name: /Sign in or create an account/i })
  await act(async () => initial.resolve({ data: { session }, error: null }))
  expect(fetchMock).not.toHaveBeenCalled()
})
test('home invite callback goes straight to original-link guidance without discovery or timers', async () => {
  locale = 'zh-TW'
  window.history.replaceState({}, '', '/zh-TW?type=invite')
  render(<HomePage />)
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/zh-TW/accept-invitation'))
  expect(fetchMock).not.toHaveBeenCalled()
  expect(getSession).not.toHaveBeenCalled()
})

test('returning to an account with an unresolved acceptance requires explicit status recovery', async () => {
  const old = deferred<Response>()
  fetchMock.mockImplementation((path: string) => path.endsWith('/accept') ? old.promise : Promise.resolve(response(pendingHttp)))
  render(<InvitationLandingPage />)
  fireEvent.click(await ready())
  await act(async () => onAuthChange('SIGNED_OUT', null))
  await screen.findByRole('link', { name: /Sign in or create an account/i })
  await act(async () => onAuthChange('SIGNED_IN', session))
  await screen.findByRole('button', { name: 'Query status' })
  expect(calls('status').length).toBe(1)
  await act(async () => old.resolve(response(acceptedHttp)))
  expect(router.push).not.toHaveBeenCalled()
  fetchMock.mockResolvedValue(response(acceptedStatus))
  fireEvent.click(screen.getByRole('button', { name: 'Query status' }))
  await screen.findByRole('button', { name: 'Enter project' })
  expect(calls('accept').length).toBe(1)
})
test('unmount before initial session resolution cleans auth subscription and cannot fetch invitation data', async () => {
  const initial = deferred<{ data: { session: Session }; error: null }>()
  getSession.mockReturnValue(initial.promise)
  const view = render(<InvitationLandingPage />)
  view.unmount()
  await act(async () => initial.resolve({ data: { session }, error: null }))
  expect(unsubscribe).toHaveBeenCalledTimes(1)
  expect(fetchMock).not.toHaveBeenCalled()
})

test('batched sign-out and same-account sign-in invalidate old acceptance without retry or navigation', async () => {
  const old = deferred<Response>()
  fetchMock.mockImplementation((path: string) => path.endsWith('/accept') ? old.promise : Promise.resolve(response(pendingHttp)))
  render(<InvitationLandingPage />)
  fireEvent.click(await ready())
  await act(async () => {
    onAuthChange('SIGNED_OUT', null)
    onAuthChange('SIGNED_IN', session)
    old.resolve(response(acceptedHttp))
  })
  expect(calls('accept').length).toBe(1)
  expect(router.push.mock.calls.length).toBe(0)
  expect(calls('status').length).toBe(1)
  expect(await screen.findByRole('button', { name: 'Query status' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Enter project' })).not.toBeInTheDocument()
  fetchMock.mockResolvedValue(response(acceptedStatus))
  fireEvent.click(screen.getByRole('button', { name: 'Query status' }))
  expect(await screen.findByRole('button', { name: 'Enter project' })).toBeEnabled()
  expect(router.push.mock.calls.length).toBe(0)
})
test('batched account departure and return invalidate a stale read before it can enable continuation', async () => {
  const old = deferred<Response>()
  const current = deferred<Response>()
  fetchMock.mockReturnValueOnce(old.promise).mockReturnValue(current.promise)
  render(<InvitationLandingPage />)
  await waitFor(() => expect(calls('status').length).toBe(1))
  await act(async () => {
    onAuthChange('SIGNED_OUT', null)
    onAuthChange('SIGNED_IN', session)
    old.resolve(response(acceptedStatus))
  })
  expect(screen.queryByRole('button', { name: 'Enter project' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument()
  await waitFor(() => expect(calls('status').length).toBe(2))
  await act(async () => current.resolve(response({ ...pendingHttp, status: 'declined' })))
  expect(await screen.findByText('This invitation was declined.')).toBeInTheDocument()
  expect(router.push.mock.calls.length).toBe(0)
})
test('same-account token refresh keeps an in-flight request and does not start another status read', async () => {
  const pending = deferred<Response>()
  fetchMock.mockReturnValue(pending.promise)
  render(<InvitationLandingPage />)
  await waitFor(() => expect(calls('status').length).toBe(1))
  await act(async () => {
    onAuthChange('TOKEN_REFRESHED', { ...session, access_token: 'refreshed.synthetic.session' })
    pending.resolve(response(pendingHttp))
  })
  expect(await ready()).toBeEnabled()
  expect(calls('status').length).toBe(1)
  expect(calls('accept').length).toBe(0)
})
