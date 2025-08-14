import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import SignInPage from '../page'
import { useAuthStore } from '@/stores/auth-store'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn(),
}))

jest.mock('@/lib/oauth', () => ({
  OAuthUtils: {
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
  },
  OAUTH_CONFIG: {
    google: {
      clientId: 'test-google-client-id',
    },
    apple: {
      clientId: 'test-apple-client-id',
      redirectURI: 'http://localhost:3000/auth/apple/callback',
    },
  },
}))

const mockPush = jest.fn()
const mockSignin = jest.fn()
const mockGoogleSignIn = jest.fn()
const mockAppleSignIn = jest.fn()
const mockClearError = jest.fn()

describe('SignInPage', () => {
  beforeEach(() => {
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })

    ;(useAuthStore as jest.Mock).mockReturnValue({
      signin: mockSignin,
      googleSignIn: mockGoogleSignIn,
      appleSignIn: mockAppleSignIn,
      isLoading: false,
      error: null,
      clearError: mockClearError,
    })

    jest.clearAllMocks()
  })

  it('renders sign in form', () => {
    render(<SignInPage />)

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('renders OAuth buttons', () => {
    render(<SignInPage />)

    expect(screen.getByRole('button', { name: /Google/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Apple/ })).toBeInTheDocument()
  })

  it('validates form inputs', async () => {
    render(<SignInPage />)

    const submitButton = screen.getByRole('button', { name: 'Sign in' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
  })

  it('submits form with valid data', async () => {
    mockSignin.mockResolvedValue(undefined)

    render(<SignInPage />)

    const emailInput = screen.getByLabelText('Email address')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Sign in' })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockClearError).toHaveBeenCalled()
      expect(mockSignin).toHaveBeenCalledWith('test@example.com', 'password123')
      expect(toast.success).toHaveBeenCalledWith('Welcome back!')
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('handles sign in error', async () => {
    const error = new Error('Invalid credentials')
    mockSignin.mockRejectedValue(error)

    render(<SignInPage />)

    const emailInput = screen.getByLabelText('Email address')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Sign in' })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid credentials')
    })
  })

  it('toggles password visibility', () => {
    render(<SignInPage />)

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
    const toggleButton = screen.getByRole('button', { name: '' }) // Eye icon button

    expect(passwordInput.type).toBe('password')

    fireEvent.click(toggleButton)
    expect(passwordInput.type).toBe('text')

    fireEvent.click(toggleButton)
    expect(passwordInput.type).toBe('password')
  })

  it('displays error message', () => {
    ;(useAuthStore as jest.Mock).mockReturnValue({
      signin: mockSignin,
      googleSignIn: mockGoogleSignIn,
      appleSignIn: mockAppleSignIn,
      isLoading: false,
      error: 'Authentication failed',
      clearError: mockClearError,
    })

    render(<SignInPage />)

    expect(screen.getByText('Authentication failed')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    ;(useAuthStore as jest.Mock).mockReturnValue({
      signin: mockSignin,
      googleSignIn: mockGoogleSignIn,
      appleSignIn: mockAppleSignIn,
      isLoading: true,
      error: null,
      clearError: mockClearError,
    })

    render(<SignInPage />)

    const submitButton = screen.getByRole('button', { name: 'Sign in' })
    expect(submitButton).toBeDisabled()
  })

  it('has link to sign up page', () => {
    render(<SignInPage />)

    const signUpLink = screen.getByRole('link', { name: 'create a new account' })
    expect(signUpLink).toHaveAttribute('href', '/auth/signup')
  })

  it('has forgot password link', () => {
    render(<SignInPage />)

    const forgotPasswordLink = screen.getByRole('link', { name: 'Forgot your password?' })
    expect(forgotPasswordLink).toHaveAttribute('href', '/auth/forgot-password')
  })
})