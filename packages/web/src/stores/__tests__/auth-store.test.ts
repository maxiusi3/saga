import { renderHook, act } from '@testing-library/react'

const mockSupabaseAuth = {
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(),
  signInWithPassword: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  signInWithOAuth: jest.fn(),
}

jest.mock('@/lib/supabase', () => ({
  createClientSupabase: jest.fn(() => ({
    auth: mockSupabaseAuth,
  })),
}))

const { useAuthStore } = require('../auth-store')

describe('AuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })

    jest.clearAllMocks()
  })

  describe('signin', () => {
    it('should sign in successfully', async () => {
      const mockUser = { id: '1', email: 'test@example.com' }

      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.signin('test@example.com', 'password')
      })

      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      })
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle signin error', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await expect(result.current.signin('test@example.com', 'wrong-password')).rejects.toEqual({
          message: 'Invalid credentials',
        })
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Invalid credentials')
    })
  })

  describe('signup', () => {
    it('should sign up successfully', async () => {
      const mockUser = { id: '1', email: 'test@example.com' }

      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: mockUser, session: { access_token: 'access-token' } },
        error: null,
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.signup({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        })
      })

      expect(mockSupabaseAuth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            name: 'Test User',
          },
        },
      })
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('signout', () => {
    it('should sign out successfully', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'test@example.com' },
        isAuthenticated: true,
      })

      mockSupabaseAuth.signOut.mockResolvedValue({ error: null })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.signout()
      })

      expect(mockSupabaseAuth.signOut).toHaveBeenCalled()
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('clearError', () => {
    it('should clear error', () => {
      useAuthStore.setState({ error: 'Some error' })

      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('googleSignIn', () => {
    it('should start Google OAuth successfully', async () => {
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({ error: null })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.googleSignIn()
      })

      expect(mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.stringContaining('/en/auth/callback'),
        },
      })
      expect(result.current.error).toBeNull()
    })

    it('should handle Google sign in error', async () => {
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        error: { message: 'Invalid Google token' },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await expect(result.current.googleSignIn()).rejects.toEqual({
          message: 'Invalid Google token',
        })
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Invalid Google token')
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.isLoading).toBe(true)

      act(() => {
        result.current.setLoading(false)
      })

      expect(result.current.isLoading).toBe(false)
    })
  })
})
