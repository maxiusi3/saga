import { createHash } from 'node:crypto'
import type { getSupabaseAdmin } from '@/lib/supabase'
import { isReviewUuid, type ReviewRequest, type ReviewState } from '@/lib/story-review-contract'
export class StoryReviewError extends Error {
  constructor(public readonly status: number) { super(status === 409 ? 'Review changed or decisions incomplete. Reload before continuing.' : status === 403 ? 'Review access denied.' : status === 400 ? 'Invalid review request.' : status === 404 ? 'Review unavailable.' : 'Review service unavailable.') }
}
export function hashReviewSource(transcript: string | null | undefined): string { return createHash('sha256').update(transcript ?? '', 'utf8').digest('hex') }
type Options = { admin: ReturnType<typeof getSupabaseAdmin>; signal?: AbortSignal; timeoutMs?: number }
export type TranscriptIngestPayload = {
  revision_id?: string; source_hash: string; provider: string; model: string; language: string; asset_id: string
  region: string; policy_version: string; local_worker?: boolean
  segments: Array<{text: string; start_ms: number | null; end_ms: number | null; confidence: number | null; speaker_label: string}>
}
function isState(value: unknown): value is ReviewState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const state = value as ReviewState
  return typeof state.sourceChanged === 'boolean' && typeof state.canApprove === 'boolean' && Array.isArray(state.assertions) && Array.isArray(state.approvedRevisions) &&
    (state.revision === null || (!!state.revision && isReviewUuid(state.revision.id) && Number.isInteger(state.revision.edit_version))) &&
    (state.transcript === null || (!!state.transcript && isReviewUuid(state.transcript.id) && Array.isArray(state.transcript.segments)))
}
async function callReviewRpc(name: string, args: Record<string, unknown>, options: Options): Promise<unknown> {
  if (typeof window !== 'undefined') throw new StoryReviewError(503)
  const timeoutMs = options.timeoutMs ?? 10000
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 || options.signal?.aborted) throw new StoryReviewError(503)
  const controller = new AbortController(), abort = () => controller.abort()
  let rejectAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => { rejectAbort = () => reject(new StoryReviewError(503)); controller.signal.addEventListener('abort', rejectAbort, { once: true }) })
  options.signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, timeoutMs)
  try {
    const result = await Promise.race([options.admin.rpc(name, args).abortSignal(controller.signal).retry(false), interrupted])
    if (controller.signal.aborted || options.signal?.aborted) throw new StoryReviewError(503)
    if (result.error) throw new StoryReviewError(result.error.code === '42501' ? 403 : result.error.code === 'P0002' ? 404 : ['23505','23514'].includes(result.error.code) ? 409 : ['22023','22P02','22003'].includes(result.error.code) ? 400 : 503)
    return result.data
  } catch (error) { if (error instanceof StoryReviewError) throw error; throw new StoryReviewError(503) }
  finally { clearTimeout(timer); options.signal?.removeEventListener('abort',abort); controller.signal.removeEventListener('abort',rejectAbort); abort() }
}
export async function runStoryReview(input: {actorId: string; storyId: string; operation: ReviewRequest['operation'] | 'read' | 'ingest_transcript'; requestId?: string | null; expectedVersion?: number | null; payload?: Record<string, unknown>}, options: Options): Promise<ReviewState> {
  if (!isReviewUuid(input.actorId) || !isReviewUuid(input.storyId)) throw new StoryReviewError(400)
  const result = await callReviewRpc('story_review', {p_actor_id:input.actorId,p_story_id:input.storyId,p_operation:input.operation,p_request_id:input.requestId??null,p_expected_version:input.expectedVersion??null,p_payload:input.payload??{}},options)
  if (!isState(result)) throw new StoryReviewError(503)
  return result
}
export async function readStoryReview(actorId: string, storyId: string, options: Options) { return runStoryReview({actorId,storyId,operation:'read'},options) }
export async function mutateStoryReview(actorId: string, storyId: string, request: ReviewRequest, options: Options) {
  const payload: Record<string, unknown> = {}
  if (request.revisionId !== undefined) payload.revision_id = request.revisionId
  if (request.assertionId !== undefined) payload.assertion_id = request.assertionId
  if (request.action !== undefined) payload.action = request.action
  if (request.text !== undefined) payload.text = request.text
  return runStoryReview({actorId,storyId,operation:request.operation,requestId:request.requestId,expectedVersion:request.expectedVersion,payload},options)
}

export interface TranscriptionReservationInput {
  requestId: string; revisionId?: string; expectedVersion: number; consent: boolean; sourceHash: string; assetId: string
  provider: string; model: string; region: string; policyVersion: string; assetVersion: number; assetSha256: string; assetBucket: string; assetObjectKey: string
}
export interface TranscriptionReservation { status: 'reserved' | 'pending' | 'completed'; leaseToken?: string; review: ReviewState }
export interface TranscriptionStatus { pendingRequestId: string | null; retryableRequestId?: string | null; status: 'pending' | 'completed' | null; review: ReviewState }
export async function reserveStoryTranscription(actorId: string, storyId: string, input: TranscriptionReservationInput, options: Options): Promise<TranscriptionReservation> {
  if (!isReviewUuid(actorId) || !isReviewUuid(storyId) || !isReviewUuid(input.requestId) || !isReviewUuid(input.assetId) ||
    (input.revisionId !== undefined && !isReviewUuid(input.revisionId)) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0 || input.expectedVersion > 2_147_483_646 ||
    typeof input.consent !== 'boolean' || !/^[a-f0-9]{64}$/.test(input.sourceHash) || !/^[a-f0-9]{64}$/.test(input.assetSha256) || !Number.isInteger(input.assetVersion) || input.assetVersion < 1 ||
    [input.provider,input.model,input.region,input.policyVersion,input.assetBucket,input.assetObjectKey].some(v=>typeof v!=='string'||!v||v.length>1024||v.includes('\0'))) throw new StoryReviewError(400)
  const payload: Record<string,unknown> = {consent:input.consent,source_hash:input.sourceHash,asset_id:input.assetId,provider:input.provider,model:input.model,region:input.region,policy_version:input.policyVersion,asset_version:input.assetVersion,asset_sha256:input.assetSha256,asset_bucket:input.assetBucket,asset_object_key:input.assetObjectKey}
  if(input.revisionId!==undefined)payload.revision_id=input.revisionId
  const raw = await callReviewRpc('reserve_story_transcription',{p_actor_id:actorId,p_story_id:storyId,p_request_id:input.requestId,p_expected_version:input.expectedVersion,p_payload:payload},options) as TranscriptionReservation
  if(!raw || !['reserved','pending','completed'].includes(raw.status) || !isState(raw.review)||(raw.status==='reserved'&&!isReviewUuid(raw.leaseToken)))throw new StoryReviewError(503)
  return raw
}
export async function readStoryTranscriptionStatus(actorId: string, storyId: string, options: Options, requestId?: string): Promise<TranscriptionStatus> {
  if(!isReviewUuid(actorId)||!isReviewUuid(storyId)||(requestId!==undefined&&!isReviewUuid(requestId)))throw new StoryReviewError(400)
  const raw=await callReviewRpc('read_story_transcription_status',{p_actor_id:actorId,p_story_id:storyId,p_request_id:requestId??null},options) as TranscriptionStatus
  if(!raw||!['pending','completed',null].includes(raw.status)||(raw.pendingRequestId!==null&&!isReviewUuid(raw.pendingRequestId))||(raw.retryableRequestId!=null&&(!isReviewUuid(raw.retryableRequestId)||raw.retryableRequestId!==raw.pendingRequestId))||!isState(raw.review))throw new StoryReviewError(503)
  return raw
}

/** Only the winning durable preparation lease can receive one outbound permit. */
export async function beginStoryTranscription(actorId:string,storyId:string,requestId:string,leaseToken:string,options:Options):Promise<boolean> {
  if(![actorId,storyId,requestId,leaseToken].every(isReviewUuid))throw new StoryReviewError(400)
  const raw=await callReviewRpc('begin_story_transcription',{p_actor_id:actorId,p_story_id:storyId,p_request_id:requestId,p_lease_token:leaseToken},options) as {started:boolean}
  if(!raw||typeof raw.started!=='boolean')throw new StoryReviewError(503)
  return raw.started
}
/** The SQL phase check makes this safe even if begin-send committed but lost its reply. */
export async function releaseStoryTranscription(actorId:string,storyId:string,requestId:string,leaseToken:string,options:Options):Promise<boolean> {
  if(![actorId,storyId,requestId,leaseToken].every(isReviewUuid))throw new StoryReviewError(400)
  const raw=await callReviewRpc('release_story_transcription',{p_actor_id:actorId,p_story_id:storyId,p_request_id:requestId,p_lease_token:leaseToken},options) as {released:boolean}
  if(!raw||typeof raw.released!=='boolean')throw new StoryReviewError(503)
  return raw.released
}
