import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import VerifyPage from '@/app/[locale]/auth/verify/page'
const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockQuery = new URLSearchParams()
let mockLocale = 'en'
const mockAuth = { verifyOtp: jest.fn(), signInWithOtp: jest.fn() }
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }), useSearchParams: () => mockQuery }))
jest.mock('next-intl', () => ({ useLocale: () => mockLocale }))
jest.mock('@/lib/supabase', () => ({ createClientSupabase: () => ({ auth: mockAuth }) }))
const user = { id: '11111111-1111-4111-8111-111111111111' }
const good = () => ({ data: { user, session: { user, access_token: 'synthetic', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Date.now() / 1000 + 3600 } }, error: null })
function submit() { screen.getAllByRole('textbox').forEach((input, i) => fireEvent.change(input, { target: { value: String(i + 1) } })); fireEvent.submit(screen.getAllByRole('textbox')[0].closest('form')!) }
beforeEach(() => { jest.clearAllMocks(); mockLocale = 'en'; mockQuery = new URLSearchParams('email=synthetic%40example.invalid&next=/fr/dashboard'); window.history.replaceState(null, '', `/en/auth/verify?${mockQuery}`); mockAuth.verifyOtp.mockResolvedValue(good()); mockAuth.signInWithOtp.mockResolvedValue({ error: null }) })
test('error-null without a complete session cannot navigate', async () => {
  mockAuth.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: null })
  render(<VerifyPage />); submit()
  expect(await screen.findByText('Invalid verification code. Please try again.')).toBeInTheDocument()
  expect(mockPush).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled()
})
test('complete numeric OTP returns to explicit safe next', async () => {
  render(<VerifyPage />); submit()
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/fr/dashboard'))
})
test.each(['unmount', 'location', 'context'])('late OTP result cannot navigate after %s', async change => {
  let resolve!: (v: any) => void; mockAuth.verifyOtp.mockReturnValue(new Promise(r => { resolve = r }))
  const view = render(<VerifyPage />); submit()
  if (change === 'unmount') view.unmount()
  if (change === 'location') window.history.replaceState(null, '', '/en/auth/verify?email=other')
  if (change === 'context') { mockQuery = new URLSearchParams('email=other'); view.rerender(<VerifyPage />) }
  await act(async () => resolve(good()))
  expect(mockPush).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled()
})
test('duplicate submissions perform one numeric OTP attempt', async () => {
  let resolve!: (v: any) => void; mockAuth.verifyOtp.mockReturnValue(new Promise(r => { resolve = r }))
  render(<VerifyPage />); submit(); submit()
  expect(mockAuth.verifyOtp).toHaveBeenCalledTimes(1)
  await act(async () => resolve(good()))
  expect(mockReplace).toHaveBeenCalledTimes(1)
})
test('non-numeric OTP input cannot start verification', () => {
  render(<VerifyPage />)
  screen.getAllByRole('textbox').forEach(input => fireEvent.change(input, { target: { value: 'a' } }))
  fireEvent.submit(screen.getAllByRole('textbox')[0].closest('form')!)
  expect(mockAuth.verifyOtp).not.toHaveBeenCalled()
})
test.each(['next=https://outside.invalid', 'next=/dashboard&next=/fr/dashboard', ''])('invalid or missing next uses current locale dashboard: %s', async next => {
  mockLocale = 'ko'; mockQuery = new URLSearchParams(`email=synthetic%40example.invalid&${next}`)
  window.history.replaceState(null, '', `/ko/auth/verify?${mockQuery}`)
  render(<VerifyPage />); submit()
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/ko/dashboard'))
})
test('resend keeps safe next and cannot publish late results after context changes', async () => {
  jest.useFakeTimers()
  try {
    const view = render(<VerifyPage />)
    for (let i = 0; i < 60; i++) await act(async () => jest.advanceTimersByTime(1000))
    let resolve!: (v: any) => void; mockAuth.signInWithOtp.mockReturnValue(new Promise(r => { resolve = r }))
    fireEvent.click(screen.getByText('Resend Code'))
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({ email: 'synthetic@example.invalid', options: { emailRedirectTo: 'http://localhost/en/auth/callback?next=%2Ffr%2Fdashboard' } })
    mockQuery = new URLSearchParams('email=other'); view.rerender(<VerifyPage />)
    await act(async () => resolve({ error: null }))
    expect(screen.queryByText('New verification code sent!')).not.toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  } finally { jest.useRealTimers() }
})
