import {create} from 'zustand'
const config=(window as any).semanticConfig
export const useAuthStore=create(()=>({user:{id:config.owner},getAccessToken:async()=>`synthetic-semantic-${useAuthStore.getState().user.id}`}))
export const useParams=()=>({id:config.project})
export const useRouter=()=>({push:()=>{}})
export const usePathname=()=>location.pathname
export const createClientSupabase=()=>({})
