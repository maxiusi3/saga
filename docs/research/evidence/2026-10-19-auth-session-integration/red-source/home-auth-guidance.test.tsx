import { render } from '@testing-library/react'
import HomePage from '@/app/[locale]/page'
const mockReplace = jest.fn(), mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }))
jest.mock('@/components/i18n/LocaleSwitcher', () => () => null)
beforeEach(() => { jest.clearAllMocks(); window.history.replaceState(null, '', '/en') })
test('home removes misplaced credentials and requests reauthentication without forwarding secrets', () => {
  window.history.replaceState(null, '', '/en#access_token=SYNTHETIC_SECRET&refresh_token=SYNTHETIC_REFRESH&type=magiclink')
  render(<HomePage />)
  expect(window.location.hash).toBe('')
  expect(mockReplace).toHaveBeenCalledWith('/en/auth/signin?error=auth_failed')
  expect(mockPush).not.toHaveBeenCalled()
})
test('ordinary home fragment navigation remains unchanged', () => {
  window.history.replaceState(null, '', '/en#features'); render(<HomePage />)
  expect(window.location.hash).toBe('#features'); expect(mockReplace).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled()
})
test('bare invite type preserves original-link guidance without treating it as authentication', () => {
  window.history.replaceState(null, '', '/en?type=invite')
  render(<HomePage />)
  expect(mockPush).toHaveBeenCalledWith('/en/accept-invitation')
  expect(mockReplace).not.toHaveBeenCalled()
})
test.each(['?type=invite&type=invite', '?type=invite&error=synthetic', '?type=invite&access_token=synthetic', '?type=invite&next=/dashboard', '?type=invite#access_token=synthetic', '#type=invite'])('mixed or ambiguous invite landing cleans URL and reauthenticates: %s', suffix => {
  window.history.replaceState(null, '', `/en${suffix}`)
  render(<HomePage />)
  expect(mockPush).not.toHaveBeenCalled()
  expect(mockReplace).toHaveBeenCalledWith('/en/auth/signin?error=auth_failed')
  expect(window.location.search + window.location.hash).toBe('')
})
