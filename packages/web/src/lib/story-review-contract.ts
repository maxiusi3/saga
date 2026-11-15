/** Durable family review wire format. Audio evidence and family attribution stay distinct. */
export type ReviewAction = 'accept' | 'modify' | 'dispute' | 'skip' | 'reject'
export type ReviewOperation = 'prepare' | 'decide_assertion' | 'correct_transcript' | 'approve_revision'
export type ReviewRequest = { operation: ReviewOperation; requestId: string; expectedVersion?: number; revisionId?: string; assertionId?: string; action?: ReviewAction; text?: string }
export interface ReviewRevision {
  id: string; story_id: string; status: 'draft' | 'approved' | 'superseded' | 'invalidated'
  title: string; body: string; summary: string; revision_number: number; edit_version: number
  approved_at: string | null; approved_by: string | null; source_transcript_id: string
  source_hash: string; provenance_snapshot: Record<string, unknown>; content_sha256: string
}
export interface ReviewAlternative { text: string; actor_id: string; created_at: string }
export interface ReviewAssertion {
  ai_review?: {supported:boolean;severity:string;risks:string[]}|null
  id: string; revision_id: string; claim_text: string; assertion_type: string
  review_decision: ReviewAction | null; review_status: string; source_transcript_id: string
  source_segment_ids: string[]; evidence_refs: Array<{ segment_id: string; start_ms: number | null; end_ms: number | null }>
  alternatives: ReviewAlternative[]; confidence_score: number | null; ordinal: number
  memory_attribution: string; source_quote: string | null; reviewed_by: string | null; supplemented_by?: string | null
  start_ms: number | null; end_ms: number | null
}
export interface ReviewTranscript {
  id: string; provider: string; model: string; alignment_status: 'aligned' | 'legacy_unaligned' | 'human_corrected'; asset_id: string | null
  segments: Array<{ id: string; text: string; start_ms: number | null; end_ms: number | null; confidence: number | null; speaker_label: string }>
}
export interface ReviewState {
  revision: ReviewRevision | null; assertions: ReviewAssertion[]; transcript: ReviewTranscript | null
  approvedRevisions: ReviewRevision[]; sourceChanged: boolean; canApprove: boolean
}
export const REVIEW_TEXT_LIMIT = 100_000
export const REVIEW_SEGMENT_LIMIT = 2_000
export function isReviewUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
export function parseReviewRequest(raw: unknown): ReviewRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid review request')
  const body = raw as Record<string, unknown>
  if (Object.keys(body).some(k => !['operation','requestId','expectedVersion','revisionId','assertionId','action','text'].includes(k)) ||
    !['prepare','decide_assertion','correct_transcript','approve_revision'].includes(String(body.operation)) || !isReviewUuid(body.requestId)) throw new Error('Invalid review request')
  for (const key of ['revisionId','assertionId']) if (body[key] !== undefined && !isReviewUuid(body[key])) throw new Error('Invalid review identity')
  if (body.expectedVersion !== undefined && (!Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 0 || Number(body.expectedVersion) > 2_147_483_646)) throw new Error('Invalid review version')
  if (body.text !== undefined && (typeof body.text !== 'string' || body.text.length > REVIEW_TEXT_LIMIT || body.text.includes('\0'))) throw new Error('Invalid review text')
  if (body.action !== undefined && !['accept','modify','dispute','skip','reject'].includes(String(body.action))) throw new Error('Invalid review action')
  if (body.operation !== 'prepare' && (!isReviewUuid(body.revisionId) || !Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 0 || Number(body.expectedVersion) > 2_147_483_646)) throw new Error('Invalid review version')
  if (body.operation === 'decide_assertion' && (!isReviewUuid(body.assertionId) || !['accept','modify','dispute','skip','reject'].includes(String(body.action)))) throw new Error('Invalid review decision')
  const needsText = body.operation === 'correct_transcript' || body.action === 'modify' || body.action === 'dispute'
  if (needsText && (typeof body.text !== 'string' || !body.text.trim() || body.text.length > REVIEW_TEXT_LIMIT || body.text.includes('\0'))) throw new Error('Invalid review text')
  return body as ReviewRequest
}
