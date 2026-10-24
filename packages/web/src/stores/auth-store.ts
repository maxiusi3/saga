import { create } from 'zustand'
import { createClientSupabase } from '@/lib/supabase'
import { AUTH_RETURN_ERROR, authLocale, authReturnTarget, hasVerifiedSession } from '@/lib/auth-return'
import type { User, Session } from '@supabase/supabase-js'

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
  getAccessToken: () => Promise<string | null>
}
type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()((set, get) => {
  let client: ReturnType<typeof createClientSupabase> | undefined
  const auth = () => (client ??= createClientSupabase()).auth
  let generation = 0
  let identityGeneration = 0
  let intent = 0
  let initialized: Promise<void> | undefined
  let listening = false
  let token: string | null = null
  let eventsBlocked = false
  let mutations = Promise.resolve()
  let eventWork = Promise.resolve()
  const clear = (loading = false, error: string | null = null) => {
    identityGeneration++
    token = null
    set({ user: null, isAuthenticated: false, isLoading: loading, error })
  }
  const fail = (version: number) => { if (version === generation) { generation++; clear(false, AUTH_RETURN_ERROR) } }
  const verify = async (session: Session | null, version: number) => {
    if (version !== generation) return false
    if (!session) { clear(); return false }
    if (!hasVerifiedSession({ session, user: session.user })) { fail(version); return false }
    try {
      const result = await auth().getUser(session.access_token)
      if (version !== generation) return false
      if (result.error || !result.data?.user || result.data.user.id !== session.user.id) { fail(version); return false }
      token = session.access_token
      set({ user: result.data.user, isAuthenticated: true, isLoading: false, error: null })
      return true
    } catch { fail(version); return false }
  }
  const listen = () => {
    if (listening) return
    listening = true
    auth().onAuthStateChange((_event: string, session: Session | null) => {
      if (eventsBlocked) return
      const version = ++generation
      const sameUser = get().isAuthenticated && session?.user?.id === get().user?.id
      // A routine visibility recovery/refresh must not tear down active work.
      // Keep only the already-confirmed identity; new identities still start blank.
      if (!sameUser) clear(!!session)
      // Auth callbacks run under the SDK lock. Do not re-enter auth from it.
      eventWork = new Promise<void>(resolve => {
        setTimeout(() => { void verify(session, version).then(() => resolve()) }, 0)
      })
    })
  }
  const begin = () => { intent++; const version = ++generation; clear(true); return version }
  // Serializing explicit SDK writes prevents an old password response from
  // restoring cookies after a newer signout. UI invalidation remains immediate.
  const enqueue = (work: () => Promise<void>) => {
    const pending = mutations.then(work)
    mutations = pending.catch(() => {})
    return pending
  }
  const credentials = (perform: () => Promise<any>, allowConfirmation: boolean) => {
    const version = begin()
    const expectedIntent = intent
    return enqueue(async () => {
      if (version !== generation) return
      eventsBlocked = false
      try {
        const result = await perform()
        if (expectedIntent !== intent) return
        if (result.error) throw new Error(AUTH_RETURN_ERROR)
        if (allowConfirmation && result.data?.user && !result.data.session) { if (version === generation) clear(); return }
        if (version !== generation) {
          await eventWork
          if (expectedIntent !== intent) return
          if (!hasVerifiedSession(result.data) || !get().isAuthenticated || token !== result.data.session.access_token) throw new Error(AUTH_RETURN_ERROR)
          return
        }
        if (!hasVerifiedSession(result.data) || !await verify(result.data.session, version)) throw new Error(AUTH_RETURN_ERROR)
      } catch { fail(version); throw new Error(AUTH_RETURN_ERROR) }
    })
  }

  return {
    user: null, isAuthenticated: false, isLoading: true, error: null,
    initialize: () => {
      if (initialized) return initialized
      const version = ++generation
      set({ isLoading: true })
      initialized = (async () => {
        try {
          listen()
          const result = await auth().getSession()
          if (version !== generation) { await eventWork; return }
          if (result.error) fail(version)
          else await verify(result.data?.session, version)
        } catch { fail(version) }
      })()
      return initialized
    },
    signin: (email, password) => credentials(() => auth().signInWithPassword({ email, password }), false),
    signup: data => credentials(() => auth().signUp({ email: data.email, password: data.password, options: { data: { name: data.name } } }), true),
    signout: () => {
      intent++
      const version = ++generation
      eventsBlocked = true
      clear(true)
      return enqueue(async () => {
        try {
          const result = await auth().signOut()
          if (version === generation) clear(false, result.error ? AUTH_RETURN_ERROR : null)
        } catch { fail(version) }
        finally { eventsBlocked = false }
      })
    },
    googleSignIn: async () => {
      const version = begin()
      try {
        const locale = authLocale(window.location.pathname.split('/')[1])
        const target = authReturnTarget(new URLSearchParams(window.location.search), locale)
        const { error } = await auth().signInWithOAuth({ provider: 'google', options: {
          redirectTo: `${window.location.origin}/${locale}/auth/callback?${new URLSearchParams({ next: target })}`,
        } })
        if (error) throw new Error(AUTH_RETURN_ERROR)
      } catch { fail(version); throw new Error(AUTH_RETURN_ERROR) }
    },
    clearError: () => set({ error: null }),
    setLoading: isLoading => set({ isLoading }),
    getAccessToken: async () => {
      if (!get().isAuthenticated || !token) return null
      let version = generation
      const identity = identityGeneration
      const userId = get().user?.id
      const sameIdentity = () => identity === identityGeneration && get().isAuthenticated && get().user?.id === userId
      const refreshedToken = async () => {
        while (sameIdentity()) {
          const observed = generation
          await eventWork
          if (!sameIdentity()) return null
          if (observed === generation) return token
        }
        return null
      }
      try {
        const result = await auth().getSession()
        if (!sameIdentity()) return null
        if (result.error || !result.data?.session || result.data.session.user?.id !== userId) {
          generation++
          clear(false, result.error ? AUTH_RETURN_ERROR : null)
          return null
        }
        // getSession can emit TOKEN_REFRESHED before resolving. Wait for the
        // current same-identity verification rather than losing a valid token.
        if (version !== generation) return refreshedToken()
        if (result.data.session.access_token !== token) version = ++generation
        const checking = verify(result.data.session, version)
        eventWork = checking.then(() => {})
        const valid = await checking
        if (!sameIdentity()) return null
        if (version !== generation) return refreshedToken()
        return valid ? token : null
      } catch { fail(version); return null }
    },
  }
})

export const initializeAuth = async () => { await useAuthStore.getState().initialize() }
