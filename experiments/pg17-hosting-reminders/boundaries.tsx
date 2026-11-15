import { create } from 'zustand'
const config = (window as any).reminderConfig
export const useAuthStore = create(() => ({ user: { id: config.user } }))
export const useRouter = () => ({ push: () => {} })
export const usePathname = () => location.pathname
export const createClientSupabase = () => ({
  auth: { getSession: async () => ({ data: { session: { access_token: config.user } } }) },
  channel: () => { const channel = { on: () => channel, subscribe: () => channel, unsubscribe: () => {} }; return channel },
})
