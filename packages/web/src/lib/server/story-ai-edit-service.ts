import type { getSupabaseAdmin } from '@/lib/supabase'
import { isReviewUuid, type ReviewState } from '@/lib/story-review-contract'
import { type StoryAiEditRequest, type StoryAiEditStatus, StoryAiEditError } from '@/lib/story-ai-edit-contract'
import { readStoryReview } from './story-review-service'
import { callStoryAiModels, getStoryAiEditConfiguration, validateAiSource } from './story-ai-edit'
type Options={admin:ReturnType<typeof getSupabaseAdmin>;env?:Record<string,string|undefined>;now?:Date;signal?:AbortSignal;fetch?:typeof fetch;timeoutMs?:number}
export async function storyAiRpc(actorId:string,storyId:string,operation:string,requestId:string|null,payload:Record<string,unknown>,options:Options):Promise<Record<string,unknown>>{
  if(!isReviewUuid(actorId)||!isReviewUuid(storyId)||(requestId!==null&&!isReviewUuid(requestId)))throw new StoryAiEditError(400,'invalid_request')
  const controller=new AbortController(),abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort()
  const timer=setTimeout(abort,10000);let rejectAbort=()=>{}
  const interrupted=new Promise<never>((_,reject)=>{rejectAbort=()=>reject(new StoryAiEditError(503,'outcome_unknown'));controller.signal.addEventListener('abort',rejectAbort,{once:true});if(controller.signal.aborted)rejectAbort()})
  try{
    const result=await Promise.race([options.admin.rpc('story_ai_edit',{p_actor_id:actorId,p_story_id:storyId,p_operation:operation,p_request_id:requestId,p_payload:payload}).abortSignal(controller.signal).retry(false),interrupted])
    if(result.error){const c=result.error.code;throw new StoryAiEditError(c==='42501'?403:['23514','23505'].includes(c)?409:c==='P0002'?404:503,c==='42501'?'access_denied':['23514','23505'].includes(c)?'source_changed':'unavailable')}
    if(!result.data||typeof result.data!=='object'||Array.isArray(result.data))throw new StoryAiEditError(503,'outcome_unknown')
    return result.data as Record<string,unknown>
  }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',rejectAbort);abort()}
}
export async function readStoryAiEditStatus(actorId:string,storyId:string,options:Options){
  const result=await storyAiRpc(actorId,storyId,'status',null,{},options)
  if(![null,'prepared','editing','reviewing','completed','rejected','invalidated'].includes(result.status as null)||!(result.pendingRequestId===null||isReviewUuid(result.pendingRequestId)))throw new StoryAiEditError(503,'unavailable')
  return {status:result.status,pendingRequestId:result.pendingRequestId,code:result.code} as StoryAiEditStatus
}
export async function editStoryWithAi(actorId:string,storyId:string,input:StoryAiEditRequest,options:Options):Promise<ReviewState>{
  if(input.consent!==true)throw new StoryAiEditError(403,'consent_required')
  const config=getStoryAiEditConfiguration(options)
  if(!config.ready)throw new StoryAiEditError(503,'unavailable')
  if(input.policyVersion!==config.policyVersion)throw new StoryAiEditError(409,'policy_changed')
  const review=await readStoryReview(actorId,storyId,options)
  if(!review.revision||!review.transcript||review.sourceChanged)throw new StoryAiEditError(409,'source_changed')
  validateAiSource(review.transcript.segments)
  const payload={consent:true,configuration:{editor:config.editor,reviewer:config.reviewer},policy_version:config.policyVersion,revision_id:input.revisionId,expected_version:input.expectedVersion,transcript_id:review.transcript.id,source_hash:review.revision.source_hash,source_fingerprint:review.revision.provenance_snapshot.source_fingerprint}
  const reserved=await storyAiRpc(actorId,storyId,'reserve',input.requestId,payload,options)
  if(reserved.status==='completed')return reserved.review as ReviewState
  if(reserved.status==='rejected')throw new StoryAiEditError(422,'review_rejected')
  if(reserved.status!=='reserved'||!isReviewUuid(reserved.leaseToken))throw new StoryAiEditError(409,'outcome_unknown')
  const lease={lease_token:reserved.leaseToken,policy_version:config.policyVersion}
  try{
    const result=await callStoryAiModels(review.transcript.segments,{...options,beforeSend:async stage=>{
      if(getStoryAiEditConfiguration({...options,now:options.now??new Date()}).policyVersion!==config.policyVersion)throw new StoryAiEditError(409,'policy_changed')
      const allowed=await storyAiRpc(actorId,storyId,stage,input.requestId,lease,options)
      if(allowed.status!=='dispatch_allowed')throw new StoryAiEditError(409,'outcome_unknown')
    }})
    if(getStoryAiEditConfiguration({...options,now:options.now??new Date()}).policyVersion!==config.policyVersion)throw new StoryAiEditError(409,'policy_changed')
    const completed=await storyAiRpc(actorId,storyId,'complete',input.requestId,{...lease,result},options)
    if(completed.status!=='completed'||!completed.review)throw new StoryAiEditError(503,'outcome_unknown')
    return completed.review as ReviewState
  }catch(error){
    if(error instanceof StoryAiEditError&&['source_evidence_invalid','provider_invalid_response','review_invalid','review_rejected'].includes(error.code)){
      try{await storyAiRpc(actorId,storyId,'reject',input.requestId,{...lease,code:error.code},{...options,signal:undefined})}catch{/* Unknown DB outcome is never represented as completed. */}
      throw error
    }
    if(error instanceof StoryAiEditError)throw error
    throw new StoryAiEditError(503,'outcome_unknown')
  }
}
