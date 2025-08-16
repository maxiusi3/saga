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
          set({ isLoading: true })

          try {
            const supabase = getSupabase()
            const { data: { session } } = await supabase.auth.getSession()
            
            if (session?.user) {
              set({
                user: session.user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              })
            } else {
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
              })
            }

            // Listen for auth changes
            supabase.auth.onAuthStateChange((event, session) => {
              if (session?.user) {
                set({
                  user: session.user,
                  isAuthenticated: true,
                  error: null,
                })
              } else {
                set({
                  user: null,
                  isAuthenticated: false,
                  error: null,
                })
              }
            })
          } catch (error: any) {
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