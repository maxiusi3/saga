import React, { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import SignInPage from '@/app/[locale]/auth/signin/page'
import { AuthProvider } from '../auth-provider'

const mockReplace = jest.fn()
const mockPush = jest.fn()
let mockSearch = new URLSearchParams()
let mockLocale = 'en'
const mockAuth = { setSession: jest.fn(), signInWithOAuth: jest.fn(), signInWithOtp: jest.fn() }
const mockInitializeAuth = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }), useSearchParams: () => mockSearch }))
jest.mock('next-intl', () => ({ useLocale: () => mockLocale, useTranslations: () => (key: string) => key }))
jest.mock('@/lib/supabase', () => ({ createClientSupabase: () => ({ auth: mockAuth }) }))
jest.mock('@/stores/auth-store', () => ({ initializeAuth: () => mockInitializeAuth() }))
const user = { id: '11111111-1111-4111-8111-111111111111' }
const session = { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 2_000_000_000, user }
const good = { data: { session, user }, error: null }
const sentinel = 'PRIVATE_AUTH_SENTINEL'
const token = 'v1_0123456789abcdef0123456789abcdef'
function url(query: string, hash = '') {
  window.history.replaceState(null, '', `/en/auth/signin${query ? `?${query}` : ''}${hash}`)
  mockSearch = new URLSearchParams(window.location.search)
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
let log: jest.SpyInstance
let error: jest.SpyInstance
beforeEach(() => {
  jest.clearAllMocks()
  mockLocale = 'en'
  mockAuth.setSession.mockResolvedValue(good)
  mockAuth.signInWithOAuth.mockResolvedValue({ error: null })
  mockAuth.signInWithOtp.mockResolvedValue({ error: null })
  localStorage.clear()
  url('')
  log = jest.spyOn(console, 'log').mockImplementation(() => {})
  error = jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { jest.restoreAllMocks() })

test('signin deletes the obsolete target without reading or writing it and never logs URL secrets', async () => {
  localStorage.setItem('auth_next', '/invite/stale')
  localStorage.setItem('session-key', 'keep')
  const read = jest.spyOn(Storage.prototype, 'getItem')
  const write = jest.spyOn(Storage.prototype, 'setItem')
  const remove = jest.spyOn(Storage.prototype, 'removeItem')
  url(`next=/dashboard&error=${sentinel}`)
  render(<SignInPage />)
  await waitFor(() => expect(remove).toHaveBeenCalledWith('auth_next'))
  expect(read).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled()
  expect(log).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  expect(screen.queryByText(new RegExp(sentinel))).not.toBeInTheDocument()
  expect(localStorage.getItem('session-key')).toBe('keep')
})

test('AuthProvider removes only auth_next before initializing auth', () => {
  localStorage.setItem('auth_next', '/stale')
  localStorage.setItem('session-key', 'keep')
  const read = jest.spyOn(Storage.prototype, 'getItem')
  const remove = jest.spyOn(Storage.prototype, 'removeItem')
  render(<AuthProvider><span>child</span></AuthProvider>)
  expect(remove).toHaveBeenCalledWith('auth_next')
  expect(read).not.toHaveBeenCalled()
  expect(mockInitializeAuth).toHaveBeenCalledTimes(1)
  expect(localStorage.getItem('session-key')).toBe('keep')
})

test('callback error text is fixed and the URL retains only safe next', async () => {
  url(`error=${sentinel}&error_description=${sentinel}&next=/dashboard/projects`)
  render(<SignInPage />)
  expect(await screen.findByText('Error: Authentication could not be confirmed. Please sign in again.')).toBeInTheDocument()
  expect(window.location.search).toBe('?next=%2Fen%2Fdashboard%2Fprojects')
  expect(mockAuth.setSession).not.toHaveBeenCalled()
})

test('verified session returns with replace to a safe current target and cleans credentials', async () => {
  url(`access_token=${sentinel}&refresh_token=synthetic-refresh&next=/invite/${token}`)
  render(<SignInPage />)
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/en/invite/${token}`))
  expect(mockPush).not.toHaveBeenCalled()
  expect(mockAuth.setSession).toHaveBeenCalledWith({ access_token: sentinel, refresh_token: 'synthetic-refresh' })
  expect(window.location.href).not.toContain(sentinel)
  expect(log).not.toHaveBeenCalled()
})

test.each([
  'access_token=a&access_token=b&refresh_token=r', 'access_token=%E0%A4%A&refresh_token=r',
  'access_token=&refresh_token=r', 'access_token=a', 'refresh_token=r',
  'access_token=a%0A&refresh_token=r', 'access_token=a&refresh_token=r&type=unknown',
  'access_token=a&refresh_token=r&code=other', 'error=&access_token=a&refresh_token=r',
  'access_token=a&refresh_token=r&token_type=bearer&token_type=bearer',
  `access_token=${'a'.repeat(4097)}&refresh_token=r`,
])('malformed session return never writes a session: %s', async query => {
  url(query)
  render(<SignInPage />)
  expect(await screen.findByText('Error: Authentication could not be confirmed. Please sign in again.')).toBeInTheDocument()
  expect(mockAuth.setSession).not.toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
  expect(window.location.search).toBe('?next=%2Fen%2Fdashboard')
  expect(error).not.toHaveBeenCalled()
})
test('duplicate credentials split across query and fragment fail safely', async () => {
  url('access_token=a&refresh_token=r', '#access_token=b')
  render(<SignInPage />)
  expect(await screen.findByText('Error: Authentication could not be confirmed. Please sign in again.')).toBeInTheDocument()
  expect(mockAuth.setSession).not.toHaveBeenCalled()
  expect(window.location.hash).toBe('')
})
test('fragment credentials are sent once to SDK without JWT decoding', async () => {
  url('next=/fr/dashboard', '#access_token=synthetic-opaque&refresh_token=r&token_type=bearer&type=magiclink')
  render(<SignInPage />)
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/fr/dashboard'))
  expect(mockAuth.setSession).toHaveBeenCalledTimes(1)
  expect(mockAuth.setSession).toHaveBeenCalledWith({ access_token: 'synthetic-opaque', refresh_token: 'r' })
})
test.each([
  { data: { session: null, user: null }, error: null }, { data: { session: {}, user }, error: null },
  { data: { session, user: { id: '22222222-2222-4222-8222-222222222222' } }, error: null },
  { data: { session, user }, error: { message: sentinel } },
])('does not treat bogus SDK result as success: %#', async result => {
  url('access_token=a&refresh_token=r')
  mockAuth.setSession.mockResolvedValue(result)
  render(<SignInPage />)
  expect(await screen.findByText('Error: Authentication could not be confirmed. Please sign in again.')).toBeInTheDocument()
  expect(mockReplace).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
})
test('rejected SDK promise maps to fixed failure', async () => {
  url('access_token=a&refresh_token=r')
  mockAuth.setSession.mockRejectedValue(new Error(sentinel))
  render(<SignInPage />)
  expect(await screen.findByText('Error: Authentication could not be confirmed. Please sign in again.')).toBeInTheDocument()
  expect(error).not.toHaveBeenCalled()
})
test.each(['getter', 'removal'])('storage %s exception does not block signin or AuthProvider', async kind => {
  if (kind === 'getter') jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error(sentinel) })
  else jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error(sentinel) })
  url('access_token=a&refresh_token=r')
  render(<AuthProvider><SignInPage /></AuthProvider>)
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/en/dashboard'))
  expect(mockInitializeAuth).toHaveBeenCalledTimes(1)
  expect(error).not.toHaveBeenCalled()
})
test('StrictMode repeated effects write the same explicit session once', async () => {
  url('access_token=a&refresh_token=r')
  const pending = deferred<typeof good>()
  mockAuth.setSession.mockReturnValue(pending.promise)
  const view = render(<StrictMode><SignInPage /></StrictMode>)
  await waitFor(() => expect(mockAuth.setSession).toHaveBeenCalledTimes(1))
  view.rerender(<StrictMode><SignInPage /></StrictMode>)
  await act(async () => pending.resolve(good))
  expect(mockReplace).toHaveBeenCalledTimes(1)
})
test('unmount ignores late session completion', async () => {
  url('access_token=a&refresh_token=r')
  const pending = deferred<typeof good>()
  mockAuth.setSession.mockReturnValue(pending.promise)
  const view = render(<SignInPage />)
  await waitFor(() => expect(mockAuth.setSession).toHaveBeenCalledTimes(1))
  view.unmount()
  await act(async () => pending.resolve(good))
  expect(mockReplace).not.toHaveBeenCalled()
})
test('changed explicit next invalidates old session and old provider UI results', async () => {
  url('access_token=a&refresh_token=r&next=/dashboard/old')
  const pending = deferred<typeof good>()
  mockAuth.setSession.mockReturnValue(pending.promise)
  const view = render(<SignInPage />)
  await waitFor(() => expect(mockAuth.setSession).toHaveBeenCalledTimes(1))
  url('next=/dashboard/new')
  view.rerender(<SignInPage />)
  await act(async () => pending.resolve(good))
  expect(mockReplace).not.toHaveBeenCalled()
  const emailPending = deferred<{ error: unknown }>()
  mockAuth.signInWithOtp.mockReturnValue(emailPending.promise)
  fireEvent.change(screen.getByLabelText('signin.emailLabel'), { target: { value: 'synthetic@example.invalid' } })
  fireEvent.submit(screen.getByLabelText('signin.emailLabel').closest('form')!)
  url('next=/dashboard/newer')
  view.rerender(<SignInPage />)
  await act(async () => emailPending.resolve({ error: new Error(sentinel) }))
  expect(screen.queryByText('Error sending login email')).not.toBeInTheDocument()
})
test.each(['google', 'email'])('%s sends only validated next to current-origin locale callback and never recovers stale cache', async method => {
  localStorage.setItem('auth_next', `/invite/${token}`)
  mockLocale = 'ja'
  url(`next=${encodeURIComponent('//outside.invalid/' + sentinel)}`)
  const view = render(<SignInPage />)
  const trigger = () => {
    if (method === 'google') fireEvent.click(screen.getByText('signin.googleButton'))
    else {
      fireEvent.change(screen.getByLabelText('signin.emailLabel'), { target: { value: 'synthetic@example.invalid' } })
      fireEvent.submit(screen.getByLabelText('signin.emailLabel').closest('form')!)
    }
  }
  trigger()
  const fn = method === 'google' ? mockAuth.signInWithOAuth : mockAuth.signInWithOtp
  await waitFor(() => expect(fn).toHaveBeenCalledTimes(1))
  const redirect = method === 'google' ? fn.mock.calls[0][0].options.redirectTo : fn.mock.calls[0][0].options.emailRedirectTo
  expect(redirect).toBe('http://localhost/ja/auth/callback?next=%2Fja%2Fdashboard')
  url(`next=${encodeURIComponent(`/fr/accept-invitation?token=${token}`)}`)
  view.rerender(<SignInPage />)
  trigger()
  await waitFor(() => expect(fn).toHaveBeenCalledTimes(2))
  expect(JSON.stringify(fn.mock.calls[1])).toContain(encodeURIComponent(`/fr/accept-invitation?token=${token}`))
  url('')
  view.rerender(<SignInPage />)
  trigger()
  await waitFor(() => expect(fn).toHaveBeenCalledTimes(3))
  expect(JSON.stringify(fn.mock.calls[2])).toContain('next=%2Fja%2Fdashboard')
  expect(log).not.toHaveBeenCalled()
})
test('replaceState failure does not interrupt session verification', async () => {
  url('access_token=a&refresh_token=r')
  jest.spyOn(window.history, 'replaceState').mockImplementation(() => { throw new Error(sentinel) })
  render(<SignInPage />)
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/en/dashboard'))
  expect(error).not.toHaveBeenCalled()
})

test.each(['google', 'email'])('%s maps thrown provider errors to fixed text and ignores completion after unmount', async method => {
  const fn = method === 'google' ? mockAuth.signInWithOAuth : mockAuth.signInWithOtp
  fn.mockRejectedValue(new Error(sentinel))
  const view = render(<SignInPage />)
  const trigger = () => {
    if (method === 'google') fireEvent.click(screen.getByText('signin.googleButton'))
    else {
      fireEvent.change(screen.getByLabelText('signin.emailLabel'), { target: { value: 'synthetic@example.invalid' } })
      fireEvent.submit(screen.getByLabelText('signin.emailLabel').closest('form')!)
    }
  }
  trigger()
  expect(await screen.findByText(method === 'google' ? 'Error signing in with Google' : 'Error sending login email')).toBeInTheDocument()
  expect(screen.queryByText(new RegExp(sentinel))).not.toBeInTheDocument()
  const pending = deferred<{ error: unknown }>()
  fn.mockReturnValue(pending.promise)
  trigger()
  view.unmount()
  await act(async () => pending.resolve({ error: new Error(sentinel) }))
  expect(error).not.toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
})
test('a locale change invalidates old session completion', async () => {
  url('access_token=a&refresh_token=r')
  const pending = deferred<typeof good>()
  mockAuth.setSession.mockReturnValue(pending.promise)
  const view = render(<SignInPage />)
  await waitFor(() => expect(mockAuth.setSession).toHaveBeenCalledTimes(1))
  mockLocale = 'fr'
  url('')
  view.rerender(<SignInPage />)
  await act(async () => pending.resolve(good))
  expect(mockReplace).not.toHaveBeenCalled()
})
test('cleanup search-params publication keeps the pending attempt and does not rewrite the session', async () => {
  url('access_token=a&refresh_token=r&next=/dashboard/x')
  const pending = deferred<typeof good>()
  mockAuth.setSession.mockReturnValue(pending.promise)
  const view = render(<SignInPage />)
  await waitFor(() => expect(mockAuth.setSession).toHaveBeenCalledTimes(1))
  mockSearch = new URLSearchParams(window.location.search)
  view.rerender(<SignInPage />)
  await act(async () => pending.resolve(good))
  expect(mockAuth.setSession).toHaveBeenCalledTimes(1)
  expect(mockReplace).toHaveBeenCalledTimes(1)
  expect(mockReplace).toHaveBeenCalledWith('/en/dashboard/x')
})

test('Google navigation belongs to the current page attempt after a validated SDK response', async () => {
  const saved = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://synthetic-auth.example.invalid'
  try {
    mockAuth.signInWithOAuth.mockImplementation(async ({ options }) => ({ error: null, data: { provider: 'google', url: `https://synthetic-auth.example.invalid/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(options.redirectTo)}` } }))
    render(<SignInPage />)
    fireEvent.click(screen.getByText('signin.googleButton'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1))
    expect(mockAuth.signInWithOAuth.mock.calls[0][0].options.skipBrowserRedirect).toBe(true)
    const destination = new URL(mockReplace.mock.calls[0][0])
    expect(destination.origin).toBe('https://synthetic-auth.example.invalid')
    expect(destination.pathname).toBe('/auth/v1/authorize')
    expect(destination.searchParams.get('redirect_to')).toBe('http://localhost/en/auth/callback?next=%2Fen%2Fdashboard')
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved
  }
})
test.each(['unmount', 'target', 'credentials'])('late Google response cannot navigate after %s', async change => {
  const pending = deferred<{ error: null; data: { url: string } }>()
  mockAuth.signInWithOAuth.mockReturnValue(pending.promise)
  const view = render(<SignInPage />)
  fireEvent.click(screen.getByText('signin.googleButton'))
  expect(mockAuth.signInWithOAuth.mock.calls[0][0].options.skipBrowserRedirect).toBe(true)
  if (change === 'unmount') view.unmount()
  else {
    url(change === 'target' ? 'next=/dashboard/other' : 'error=new-error&next=/dashboard')
    view.rerender(<SignInPage />)
  }
  await act(async () => pending.resolve({ error: null, data: { url: 'https://synthetic-auth.example.invalid/auth/v1/authorize' } }))
  expect(mockReplace).not.toHaveBeenCalled()
})
test('changed credentials at the same safe target invalidate the old session attempt', async () => {
  const old = deferred<typeof good>()
  const fresh = deferred<typeof good>()
  mockAuth.setSession.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise)
  url('access_token=old&refresh_token=r')
  const view = render(<SignInPage />)
  await waitFor(() => expect(mockAuth.setSession).toHaveBeenCalledTimes(1))
  url('access_token=new&refresh_token=r')
  view.rerender(<SignInPage />)
  await waitFor(() => expect(mockAuth.setSession).toHaveBeenCalledTimes(2))
  await act(async () => old.resolve(good))
  expect(mockReplace).not.toHaveBeenCalled()
  await act(async () => fresh.resolve(good))
  expect(mockReplace).toHaveBeenCalledTimes(1)
})
test('an untrusted OAuth result URL is not navigated or reflected', async () => {
  mockAuth.signInWithOAuth.mockResolvedValue({ error: null, data: { url: `https://outside.invalid/${sentinel}` } })
  render(<SignInPage />)
  fireEvent.click(screen.getByText('signin.googleButton'))
  expect(await screen.findByText('Error signing in with Google')).toBeInTheDocument()
  expect(mockReplace).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
})

test.each([
  '/en/auth/signin?next=/dashboard/other',
  '/en/auth/signin?access_token=new&refresh_token=r',
  '/en/auth/signin?next=%2Fen%2Fdashboard#access_token=new&refresh_token=r',
  '/fr/auth/signin?next=%2Fen%2Fdashboard',
])('actual URL context change without rerender invalidates pending session: %s', async location => {
  url('access_token=old&refresh_token=r')
  const pending = deferred<typeof good>()
  mockAuth.setSession.mockReturnValue(pending.promise)
  render(<SignInPage />)
  await waitFor(() => expect(mockAuth.setSession).toHaveBeenCalledTimes(1))
  // Deliberately do not change mockSearch or rerender: native history/hash may
  // change before React publishes updated navigation context.
  window.history.replaceState(null, '', location)
  await act(async () => pending.resolve(good))
  expect(mockReplace).not.toHaveBeenCalled()
})
test('actual URL context change without rerender invalidates pending provider navigation', async () => {
  const saved = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://synthetic-auth.example.invalid'
  try {
    const pending = deferred<{ error: null; data: { url: string } }>()
    mockAuth.signInWithOAuth.mockReturnValue(pending.promise)
    render(<SignInPage />)
    fireEvent.click(screen.getByText('signin.googleButton'))
    const callback = mockAuth.signInWithOAuth.mock.calls[0][0].options.redirectTo
    window.history.replaceState(null, '', '/en/auth/signin?next=/dashboard/new-native-context')
    await act(async () => pending.resolve({ error: null, data: { url: `https://synthetic-auth.example.invalid/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(callback)}` } }))
    expect(mockReplace).not.toHaveBeenCalled()
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved
  }
})
