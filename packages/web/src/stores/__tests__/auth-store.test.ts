import { renderHook, act } from '@testing-library/react'
import { useAuthStore } from '../auth-store'
import { apiClient } from '@/lib/api'
import { it } from 'zod/v4/locales'
import { describe } from 'node:test'
import { it } from 'zod/v4/locales'
import { it } from 'zod/v4/locales'
import { describe } from 'node:test'
import { it } from 'zod/v4/locales'
import { it } from 'zod/v4/locales'
import { describe } from 'node:test'
import { it } from 'zod/v4/locales'
import { describe } from 'node:test'
import { it } from 'zod/v4/locales'
import { describe } from 'node:test'
import { it } from 'zod/v4/locales'
import { describe } from 'node:test'
import { it } from 'zod/v4/locales'
import { describe } from 'node:test'
import { it } from 'zod/v4/locales'
import { it } from 'zod/v4/locales'
import { describe } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    auth: {
      signin: jest.fn(),
      signup: jest.fn(),
      signout: jest.fn(),
      profile: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      googleOAuth: jest.fn(),
      appleOAuth: jest.fn(),
    },
  },
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset the store state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
    
    // Clear all mocks
    jest.clearAllMocks()
  })

  describe('signin', () => {
    it('should sign in successfully', async () => {
      const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' }
      const mockResponse = {
        data: {
          data: {
            user: mockUser,
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        },
      }

      ;(apiClient.auth.signin as jest.Mock).mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.signin('test@example.com', 'password')
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'access-token')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token')
    })

    it('should handle signin error', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: 'Invalid credentials',
            },
          },
        },
      }

      ;(apiClient.auth.signin as jest.Mock).mockRejectedValue(mockError)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.signin('test@example.com', 'wrong-password')
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Invalid credentials')
    })
  })

  describe('signup', () => {
    it('should sign up successfully', async () => {
      const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' }
      const mockResponse = {
        data: {
          data: {
            user: mockUser,
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        },
      }

      ;(apiClient.auth.signup as jest.Mock).mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.signup({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        })
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('signout', () => {
    it('should sign out successfully', async () => {
      // Set initial authenticated state
      useAuthStore.setState({
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
        isAuthenticated: true,
      })

      ;(apiClient.auth.signout as jest.Mock).mockResolvedValue({})

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.signout()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken')
    })
  })

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const initialUser = { id: '1', name: 'Test User', email: 'test@example.com' }
      const updatedUser = { id: '1', name: 'Updated User', email: 'test@example.com' }
      
      useAuthStore.setState({
        user: initialUser,
        isAuthenticated: true,
      })

      const mockResponse = {
        data: {
          data: updatedUser,
        },
      }

      ;(apiClient.auth.updateProfile as jest.Mock).mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.updateProfile({ name: 'Updated User' })
      })

      expect(result.current.user).toEqual(updatedUser)
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
    it('should sign in with Google successfully', async () => {
      const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' }
      const mockResponse = {
        data: {
          data: {
            user: mockUser,
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        },
      }

      ;(apiClient.auth.googleOAuth as jest.Mock).mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.googleSignIn('google-access-token')
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'access-token')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token')
    })

    it('should handle Google sign in error', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: 'Invalid Google token',
            },
          },
        },
      }

      ;(apiClient.auth.googleOAuth as jest.Mock).mockRejectedValue(mockError)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.googleSignIn('invalid-token')
        } catch (error) {
          // Expected to throw
        }
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