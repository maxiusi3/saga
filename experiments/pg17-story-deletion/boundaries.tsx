/** Synthetic auth/routing and unused chapter transport; story services/UI are real. */
import { create } from 'zustand'
const config = (window as any).g1StoryConfig
export const useAuthStore = create(() => ({ user: { id: config.owner }, getAccessToken: async () => 'synthetic-story-owner' }))
export const useParams = () => ({ id: config.project })
export const useRouter = () => ({ push: (path: string) => { window.history.pushState({}, '', path) } })
export const usePathname = () => location.pathname
export const createClientSupabase = () => ({ auth: {
  getSession: async () => ({ data: { session: { access_token: 'synthetic-story-owner', user: useAuthStore.getState().user } }, error: null }),
  getUser: async () => ({ data: { user: useAuthStore.getState().user }, error: null }),
}, rpc: async () => ({ data: [], error: null }), from: () => {
  const q: any = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: async () => ({data:null,error:null}),
    then: (resolve: any) => Promise.resolve({data:[],error:null}).then(resolve) }
  return q
} })
