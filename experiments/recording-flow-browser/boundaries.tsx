/** Only auth/routing/Storage transport are synthetic; capture/save/UI modules are real. */
import { create } from 'zustand'
export const USER = '11111111-1111-4111-8111-111111111111'
export const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const useAuthStore = create(() => ({ user: { id: USER }, getAccessToken: async () => 'synthetic-flow-session' }))
export const useParams = () => ({ id: PROJECT })
export const useRouter = () => ({ push: (path: string) => { window.history.pushState({}, '', path) } })
export const createClientSupabase = () => ({ auth: {
  getUser: async () => ({ data: { user: useAuthStore.getState().user }, error: null }),
  getSession: async () => ({ data: { session: { access_token: 'synthetic-flow-session', user: useAuthStore.getState().user } }, error: null }),
}, storage: { from: (bucket: string) => ({
  upload: async (path: string, blob: Blob) => {
    const response = await fetch(`/fixture/storage/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`, { method: 'POST', body: blob })
    return response.ok ? { data: { path }, error: null } : { data: null, error: { message: 'Synthetic upload uncertainty' } }
  },
  download: async (path: string, _options?: unknown, fetchOptions?: RequestInit) => {
    const response = await fetch(`/fixture/storage/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`, fetchOptions)
    return response.ok ? { data: await response.blob(), error: null } : { data: null, error: { message: 'Synthetic download unavailable' } }
  },
}) } })
