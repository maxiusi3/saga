import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from '@/lib/api'
import type { User } from '@saga/shared/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  signin: (email: string, password: string) => Promise<void>
  signup: (data: { name: string; email: string; password: string }) => Promise<void>
  signout: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (data: { name?: string; email?: string }) => Promise<void>
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>
  googleSignIn: (accessToken: string) => Promise<void>
  appleSignIn: (idToken: string, user?: any) => Promise<void>
  clearError: () => void
  setLoading: (loading: boolean) => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      signin: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await apiClient.auth.signin(email, password)
          const { user, accessToken, refreshToken } = response.data.data

          // Store tokens
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', refreshToken)

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error?.message || 'Sign in failed',
          })
          throw error
        }
      },

      signup: async (data: { name: string; email: string; password: string }) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await apiClient.auth.signup(data)
          const { user, accessToken, refreshToken } = response.data.data

          // Store tokens
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', refreshToken)

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error?.message || 'Sign up failed',
          })
          throw error
        }
      },

      signout: async () => {
        set({ isLoading: true })
        
        try {
          await apiClient.auth.signout()
        } catch (error) {
          // Continue with signout even if API call fails
          console.error('Signout API call failed:', error)
        } finally {
          // Clear tokens and state
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          })
        }
      },

      refreshProfile: async () => {
        if (!get().isAuthenticated) return

        set({ isLoading: true, error: null })
        
        try {
          const response = await apiClient.auth.profile()
          const user = response.data.data

          set({
            user,
            isLoading: false,
            error: null,
          })
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error?.message || 'Failed to refresh profile',
          })
          
          // If unauthorized, sign out
          if (error.response?.status === 401) {
            get().signout()
          }
        }
      },

      updateProfile: async (data: { name?: string; email?: string }) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await apiClient.auth.updateProfile(data)
          const updatedUser = response.data.data

          set({
            user: updatedUser,
            isLoading: false,
            error: null,
          })
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error?.message || 'Failed to update profile',
          })
          throw error
        }
      },

      changePassword: async (data: { currentPassword: string; newPassword: string }) => {
        set({ isLoading: true, error: null })
        
        try {
          await apiClient.auth.changePassword(data)
          
          set({
            isLoading: false,
            error: null,
          })
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error?.message || 'Failed to change password',
          })
          throw error
        }
      },

      googleSignIn: async (accessToken: string) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await apiClient.auth.googleOAuth(accessToken)
          const { user, accessToken: authToken, refreshToken } = response.data.data

          // Store tokens
          localStorage.setItem('accessToken', authToken)
          localStorage.setItem('refreshToken', refreshToken)

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error?.message || 'Google sign in failed',
          })
          throw error
        }
      },

      appleSignIn: async (idToken: string, user?: any) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await apiClient.auth.appleOAuth(idToken, user)
          const { user: authUser, accessToken, refreshToken } = response.data.data

          // Store tokens
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', refreshToken)

          set({
            user: authUser,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error?.message || 'Apple sign in failed',
          })
          throw error
        }
      },

      clearError: () => {
        set({ error: null })
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// Initialize auth state on app load
export const initializeAuth = async () => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    try {
      useAuthStore.setState({ isLoading: true })
      const response = await apiClient.auth.profile()
      const user = response.data.data
      
      useAuthStore.setState({
        user,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      // Token is invalid, clear it
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  } else {
    useAuthStore.setState({ isLoading: false })
  }
}