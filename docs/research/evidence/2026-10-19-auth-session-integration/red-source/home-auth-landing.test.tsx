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
