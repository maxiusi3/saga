import {useAuthStore} from '@/stores/auth-store'
import type {ReviewState} from './story-review-contract'
import {StoryAiEditError,type StoryAiEditConfiguration,type StoryAiEditRequest,type StoryAiEditStatus} from './story-ai-edit-contract'
export type AiEditReadiness=StoryAiEditConfiguration&StoryAiEditStatus
async function invoke(storyId:string,body?:StoryAiEditRequest){
 const actor=useAuthStore.getState().user?.id,token=await useAuthStore.getState().getAccessToken()
 if(!actor||!token||useAuthStore.getState().user?.id!==actor)throw new StoryAiEditError(401,'session_changed')
 const r=await fetch(`/api/stories/${encodeURIComponent(storyId)}/ai-edit`,{method:body?'POST':'GET',cache:'no-store',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const v=await r.json();if(useAuthStore.getState().user?.id!==actor)throw new StoryAiEditError(401,'session_changed')
 if(!r.ok)throw new StoryAiEditError(r.status,typeof v.code==='string'?v.code:'unavailable')
 return v
}
export async function readAiEditReadiness(storyId:string):Promise<AiEditReadiness>{const v=await invoke(storyId);if(typeof v.aiEdit?.ready!=='boolean'||v.aiEdit?.requiresConsent!==true)throw new StoryAiEditError(503,'unavailable');return v.aiEdit}
export async function requestAiEdit(storyId:string,body:StoryAiEditRequest):Promise<ReviewState>{const v=await invoke(storyId,body);if(!Array.isArray(v.review?.assertions)||!v.review?.revision)throw new StoryAiEditError(503,'outcome_unknown');return v.review}
