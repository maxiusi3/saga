import { render, screen } from '@testing-library/react'
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

describe('ProtectedRoute', () => {
  beforeEach(() => {
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })

    jest.clearAllMocks()
  })

  describe('when requireAuth is true (default)', () => {
    it('renders children when authenticated', () => {
      ;(useAuthStore as jest.Mock).mockReturnValue({
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
      ;(useAuthStore as jest.Mock).mockReturnValue({
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
      ;(useAuthStore as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(mockPush).toHaveBeenCalledWith('/auth/signin')
      expect(screen.getByText('Redirecting...')).toBeInTheDocument()
    })

    it('redirects to custom path when specified', () => {
      ;(useAuthStore as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      })

      render(
        <ProtectedRoute redirectTo="/custom-signin">
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(mockPush).toHaveBeenCalledWith('/custom-signin')
    })
  })

  describe('when requireAuth is false', () => {
    it('renders children when not authenticated', () => {
      ;(useAuthStore as jest.Mock).mockReturnValue({
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
      ;(useAuthStore as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', name: 'Test User' },
      })

      render(
        <ProtectedRoute requireAuth={false}>
          <div>Public Content</div>
        </ProtectedRoute>
      )

      expect(mockPush).toHaveBeenCalledWith('/dashboard')
      expect(screen.getByText('Redirecting...')).toBeInTheDocument()
    })
  })
})

describe('withAuth HOC', () => {
  const TestComponent = ({ message }: { message: string }) => <div>{message}</div>

  it('wraps component with ProtectedRoute', () => {
    ;(useAuthStore as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', name: 'Test User' },
    })

    const WrappedComponent = withAuth(TestComponent)

    render(<WrappedComponent message="Test Message" />)

    expect(screen.getByText('Test Message')).toBeInTheDocument()
  })

  it('passes options to ProtectedRoute', () => {
    ;(useAuthStore as jest.Mock).mockReturnValue({
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
    ;(useAuthStore as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    })

    const TestComponent = () => {
      const { isAuthenticated, isLoading } = useRequireAuth()
      return <div>{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
    }

    render(<TestComponent />)

    expect(mockPush).toHaveBeenCalledWith('/auth/signin')
  })

  it('does not redirect when authenticated', () => {
    ;(useAuthStore as jest.Mock).mockReturnValue({
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
    ;(useAuthStore as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    })

    const TestComponent = () => {
      const { isAuthenticated, isLoading } = useRequireAuth('/custom-login')
      return <div>{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
    }

    render(<TestComponent />)

    expect(mockPush).toHaveBeenCalledWith('/custom-login')
  })
})