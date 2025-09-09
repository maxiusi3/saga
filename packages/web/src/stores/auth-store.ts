import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createClientSupabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  initialize: () => Promise<void>
  signin: (email: string, password: string) => Promise<void>
  signup: (data: { name: string; email: string; password: string }) => Promise<void>
  signout: () => Promise<void>
  googleSignIn: () => Promise<void>
  clearError: () => void
  setLoading: (loading: boolean) => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => {
      // Lazy initialization of Supabase client
      let _supabase: ReturnType<typeof createClientSupabase> | null = null
      const getSupabase = () => {
        if (!_supabase) {
          _supabase = createClientSupabase()
        }
        return _supabase
      }

      return {
        // Initial state
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // Actions
        initialize: async () => {
          console.log('Auth Store: Initialize called')
          set({ isLoading: true })

          try {
            const supabase = getSupabase()
            console.log('Auth Store: Getting session...')
            const { data: { session } } = await supabase.auth.getSession()
            console.log('Auth Store: Session result:', session ? 'exists' : 'null')

            if (session?.user) {
              console.log('Auth Store: Setting authenticated user:', session.user.id)
              set({
                user: session.user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              })
            } else {
              console.log('Auth Store: No session, setting unauthenticated')
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
              })
            }

            // Listen for auth changes
            console.log('Auth Store: Setting up auth state listener')
            supabase.auth.onAuthStateChange((event, session) => {
              console.log('Auth Store: Auth state changed:', event, session ? 'session exists' : 'no session')
              if (session?.user) {
                console.log('Auth Store: Auth change - setting authenticated')
                set({
                  user: session.user,
                  isAuthenticated: true,
                  error: null,
                })
              } else {
                console.log('Auth Store: Auth change - setting unauthenticated')
                set({
                  user: null,
                  isAuthenticated: false,
                  error: null,
                })
              }
            })
          } catch (error: any) {
            console.error('Auth Store: Initialize error:', error)
            set({
              isLoading: false,
              error: error.message || 'Failed to initialize auth',
            })
          }
        },

        signin: async (email: string, password: string) => {
          set({ isLoading: true, error: null })

          try {
            const supabase = getSupabase()
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            })

            if (error) {
              set({
                isLoading: false,
                error: error.message,
              })
              throw error
            }

            set({
              user: data.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            })
          } catch (error: any) {
            set({
              isLoading: false,
              error: error.message || 'Sign in failed',
            })
            throw error
          }
        },

        signup: async (data: { name: string; email: string; password: string }) => {
          set({ isLoading: true, error: null })

          try {
            const supabase = getSupabase()
            const { data: authData, error } = await supabase.auth.signUp({
              email: data.email,
              password: data.password,
              options: {
                data: {
                  name: data.name,
                }
              }
            })

            if (error) {
              set({
                isLoading: false,
                error: error.message,
              })
              throw error
            }

            // Note: User might need to verify email before being fully authenticated
            set({
              user: authData.user,
              isAuthenticated: !!authData.session,
              isLoading: false,
              error: null,
            })
          } catch (error: any) {
            set({
              isLoading: false,
              error: error.message || 'Sign up failed',
            })
            throw error
          }
        },

        signout: async () => {
          set({ isLoading: true })

          try {
            const supabase = getSupabase()
            await supabase.auth.signOut()
            
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            })
          } catch (error: any) {
            set({
              isLoading: false,
              error: error.message || 'Sign out failed',
            })
          }
        },

        googleSignIn: async () => {
          set({ isLoading: true, error: null })

          try {
            const supabase = getSupabase()
            const { error } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                // 动态使用当前域名，兼容预览和生产
                redirectTo: `${window.location.origin}/auth/callback`
              }
            })

            if (error) {
              set({
                isLoading: false,
                error: error.message,
              })
              throw error
            }
            
            // OAuth redirect will handle the rest
          } catch (error: any) {
            set({
              isLoading: false,
              error: error.message || 'Google sign in failed',
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
      }
    },
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
  const authStore = useAuthStore.getState()
  await authStore.initialize()
}