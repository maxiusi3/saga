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
