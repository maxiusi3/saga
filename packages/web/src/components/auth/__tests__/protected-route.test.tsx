import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useRouter } from 'next/navigation'
import { ProtectedRoute, withAuth, useRequireAuth } from '../protected-route'
import { useAuthStore } from '@/stores/auth-store'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn(),
}))

const mockPush = jest.fn()

// Cast mocked functions safely to Jest.Mock to satisfy TypeScript
const mockedUseRouter = useRouter as unknown as jest.Mock
const mockedUseAuthStore = useAuthStore as unknown as jest.Mock

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockedUseRouter.mockReturnValue({
      push: mockPush,
    })

    jest.clearAllMocks()
  })

  describe('when requireAuth is true (default)', () => {
    it('renders children when authenticated', () => {
      mockedUseAuthStore.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', name: 'Test User' },
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })

    it('shows loading when checking authentication', () => {
      mockedUseAuthStore.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('redirects to sign in when not authenticated', () => {
      mockedUseAuthStore.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      // Default locale-aware redirect
      expect(mockPush).toHaveBeenCalledWith('/en/auth/signin')
      expect(screen.getByText('Redirecting...')).toBeInTheDocument()
    })

    it('redirects to custom path when specified', () => {
      mockedUseAuthStore.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      })

      render(
        <ProtectedRoute redirectTo="/custom-signin">
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      // Locale is prefixed based on pathname fallback ('en' in tests)
      expect(mockPush).toHaveBeenCalledWith('/en/custom-signin')
    })
  })

  describe('when requireAuth is false', () => {
    it('renders children when not authenticated', () => {
      mockedUseAuthStore.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      })

      render(
        <ProtectedRoute requireAuth={false}>
          <div>Public Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByText('Public Content')).toBeInTheDocument()
    })

    it('redirects to dashboard when authenticated', () => {
      mockedUseAuthStore.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', name: 'Test User' },
      })

      render(
        <ProtectedRoute requireAuth={false}>
          <div>Public Content</div>
        </ProtectedRoute>
      )

      expect(mockPush).toHaveBeenCalledWith('/en/dashboard')
      expect(screen.getByText('Redirecting...')).toBeInTheDocument()
    })
  })
})

describe('withAuth HOC', () => {
  const TestComponent = ({ message }: { message: string }) => <div>{message}</div>

  it('wraps component with ProtectedRoute', () => {
    mockedUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', name: 'Test User' },
    })

    const WrappedComponent = withAuth(TestComponent)

    render(<WrappedComponent message="Test Message" />)

    expect(screen.getByText('Test Message')).toBeInTheDocument()
  })

  it('passes options to ProtectedRoute', () => {
    mockedUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    })

    const WrappedComponent = withAuth(TestComponent, {
      requireAuth: false,
    })

    render(<WrappedComponent message="Test Message" />)

    expect(screen.getByText('Test Message')).toBeInTheDocument()
  })
})

describe('useRequireAuth hook', () => {
  it('redirects when not authenticated', () => {
    mockedUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    })

    const TestComponent = () => {
      const { isAuthenticated, isLoading } = useRequireAuth()
      return <div>{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
    }

    render(<TestComponent />)

    expect(mockPush).toHaveBeenCalledWith('/en/auth/signin')
  })

  it('does not redirect when authenticated', () => {
    mockedUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    })

    const TestComponent = () => {
      const { isAuthenticated, isLoading } = useRequireAuth()
      return <div>{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
    }

    render(<TestComponent />)

    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByText('Authenticated')).toBeInTheDocument()
  })

  it('uses custom redirect path', () => {
    mockedUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    })

    const TestComponent = () => {
      const { isAuthenticated, isLoading } = useRequireAuth('/custom-login')
      return <div>{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
    }

    render(<TestComponent />)

    expect(mockPush).toHaveBeenCalledWith('/en/custom-login')
  })
})