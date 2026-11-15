import {create} from 'zustand'
const config=(window as any).g3Config
export const useAuthStore=create(()=>({user:{id:config.owner},getAccessToken:async()=>`synthetic-g3-${useAuthStore.getState().user.id}`}))
export const useParams=()=>({id:config.project,storyId:config.story})
export const useRouter=()=>({push:()=>{}})
export const usePathname=()=>location.pathname
export const createClientSupabase=()=>({})
