import type { RecorderSaveSnapshot } from '../recorder-db'
import type { RecordingSaveMetadata } from '../recording-save-contract'
export const identity={actorId:'11111111-1111-4111-8111-111111111111',projectId:'22222222-2222-4222-8222-222222222222',sessionId:'33333333-3333-4333-8333-333333333333'}
export const storyId='44444444-4444-4444-8444-444444444444',assetId='55555555-5555-4555-8555-555555555555',jobId='66666666-6666-4666-8666-666666666666',hash='a'.repeat(64)
export const metadata:RecordingSaveMetadata={title:'A story',content:'',transcript:'',happenedAt:'2026-11-06T00:00:00.000Z',recordingMode:'chat',isPublic:false}
export function lookup(reserved=false,sealed=false) {return {schemaVersion:1,...identity,intent:reserved?{storyId,metadata,manifestSha256:sealed?hash:null,assetId:sealed?assetId:null,confirmed:false}:null,canClearLocalDrafts:false}}
export function status(state='succeeded',job:string|null=jobId) {return {schemaVersion:1,projectId:identity.projectId,sessionId:identity.sessionId,assetId,jobId:job,manifestSha256:hash,observedAt:'2026-11-06T00:00:02.000Z',state,content:state==='succeeded'?{byteSize:9,sha256:hash,mimeType:'audio/webm',durationMs:1000}:null,errorCode:state==='failed'?'recording_source_hash_mismatch':null,finishedAt:state==='unresolved'?null:'2026-11-06T00:00:01.000Z',canClearLocalDrafts:false}}
export function receipt() {return {schemaVersion:1 as const,...identity,storyId,assetId,manifestSha256:hash,playbackUrl:`/api/media/assets/${assetId}/play`,canClearLocalDrafts:true as const}}
export async function makeSnapshot():Promise<RecorderSaveSnapshot> {
  const blob=new Blob(['synthetic'],{type:'audio/webm'})
  const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())
  const sha256=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')
  const chunk={id:`${identity.sessionId}-0`,sessionId:identity.sessionId,index:0,blob,byteSize:9,sha256,persistedAt:metadata.happenedAt,uploadStatus:'pending' as const,timestamp:1}
  return {session:{id:identity.sessionId,userId:identity.actorId,projectId:identity.projectId,mimeType:'audio/webm',startedAt:metadata.happenedAt,state:'interrupted',lastPersistedIndex:0,cloudConfirmedAssetId:null,updatedAt:1,saveIntent:{metadata,chunkIdentity:'fixture',remote:null,confirmation:null}},chunks:[chunk]}
}

export function seal() {return {asset:{id:assetId,project_id:identity.projectId,story_id:storyId,created_by:identity.actorId},job:{id:jobId,project_id:identity.projectId,asset_id:assetId,created_by:identity.actorId},idempotentReplay:false,canClearLocalDrafts:false,manifestSha256:hash}}
