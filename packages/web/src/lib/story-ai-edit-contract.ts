import { isReviewUuid } from './story-review-contract'
export type StoryAiEditRequest = { requestId:string; revisionId:string; expectedVersion:number; consent:true; policyVersion:string }
export type AiModelTarget = { provider:'anthropic'|'openai'; model:string; region:string }
export type StoryAiEditConfiguration = { ready:boolean; requiresConsent:true; policyVersion:string|null; editor:AiModelTarget; reviewer:AiModelTarget }
export type StoryAiEditStatus = { status:'prepared'|'editing'|'reviewing'|'completed'|'rejected'|'invalidated'|null; pendingRequestId:string|null; code?:string|null }
export class StoryAiEditError extends Error {
  constructor(public readonly status:number,public readonly code:string) { super(code) }
}
export function parseStoryAiEditRequest(raw:unknown):StoryAiEditRequest {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new StoryAiEditError(400,'invalid_request')
  const r=raw as Record<string,unknown>
  if(Object.keys(r).some(k=>!['requestId','revisionId','expectedVersion','consent','policyVersion'].includes(k))||!isReviewUuid(r.requestId)||!isReviewUuid(r.revisionId)||
    !Number.isInteger(r.expectedVersion)||Number(r.expectedVersion)<0||Number(r.expectedVersion)>2147483646||r.consent!==true||typeof r.policyVersion!=='string'||!r.policyVersion||r.policyVersion.length>100)throw new StoryAiEditError(400,'invalid_request')
  return r as StoryAiEditRequest
}
