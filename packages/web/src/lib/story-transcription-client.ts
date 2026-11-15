import { useAuthStore } from '@/stores/auth-store'
import type { ReviewState } from './story-review-contract'
import { ReviewHttpError } from './story-review-client'

export interface TranscriptionReadiness { ready:boolean; provider:string; model:string; region:string; policyVersion:string|null; requiresConsent:boolean; pendingRequestId:string|null; retryableRequestId?:string|null }
export interface TranscriptionRequest { requestId:string; revisionId?:string; expectedVersion?:number; consent:boolean; policyVersion:string }
async function invoke(storyId:string,body?:TranscriptionRequest) {
  const actorId=useAuthStore.getState().user?.id
  const token=await useAuthStore.getState().getAccessToken()
  if(!token||!actorId||useAuthStore.getState().user?.id!==actorId)throw new ReviewHttpError(401,'transcription_session_changed')
  const response=await fetch(`/api/stories/${encodeURIComponent(storyId)}/transcribe`,{method:body?'POST':'GET',cache:'no-store',headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
  const value=await response.json()
  if(!response.ok)throw new ReviewHttpError(response.status,typeof value.code==='string'?value.code:'transcription_unavailable')
  return value
}
export async function readTranscriptionReadiness(storyId:string):Promise<TranscriptionReadiness>{const value=await invoke(storyId);if(typeof value?.transcription?.ready!=='boolean')throw new Error('Invalid transcription readiness');return value.transcription}
export async function transcribeStory(storyId:string,body:TranscriptionRequest):Promise<ReviewState>{const value=await invoke(storyId,body);if(!Array.isArray(value?.review?.assertions))throw new Error('Invalid transcription result');return value.review}
