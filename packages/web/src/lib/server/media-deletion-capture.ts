import type { getSupabaseAdmin } from '@/lib/supabase'

export type MediaDeletionInput = { actorId: string; projectId: string; subjectId: string; subjectType: 'media_asset' | 'story'; requestId: string }
export type MediaDeletionReceipt = { id: string; projectId: string; subjectId: string; subjectType: 'media_asset' | 'story'; state: 'requested'; tombstoneAt: string; targetCount: number; physicalDeletionComplete: false }
type Options = { admin: ReturnType<typeof getSupabaseAdmin>; signal?: AbortSignal; timeoutMs?: number }
export class MediaDeletionCaptureError extends Error {
  constructor(public readonly status: number) { super('Media deletion request is unavailable') }
}
function unavailable(status = 503): never { throw new MediaDeletionCaptureError(status) }
export function isDeletionUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
}
function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/.test(value)) return false
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,19) === value.slice(0,19)
}
export async function submitMediaDeletionRequest(input: MediaDeletionInput, options: Options): Promise<MediaDeletionReceipt> {
  return submitDeletion(input, options, false)
}
export async function submitStoryDeletionRequest(input: Omit<MediaDeletionInput, 'subjectType'>, options: Options): Promise<MediaDeletionReceipt> {
  return submitDeletion({ ...input, subjectType: 'story' }, options, true)
}
async function submitDeletion(input: MediaDeletionInput, options: Options, purgeContent: boolean): Promise<MediaDeletionReceipt> {
  if (!input || !['actorId','projectId','subjectId','requestId'].every(key => isDeletionUuid(input[key as keyof MediaDeletionInput])) ||
    !['media_asset','story'].includes(input.subjectType)) unavailable(400)
  const pinned = Object.freeze({ ...input })
  const { admin, signal, timeoutMs = 5000 } = options
  if (typeof window !== 'undefined' || signal?.aborted || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) unavailable()
  const controller = new AbortController(), abort = () => controller.abort()
  let rejectAbort = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new MediaDeletionCaptureError(503))
    controller.signal.addEventListener('abort', rejectAbort, { once: true })
  })
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, timeoutMs)
  try {
    const result = await Promise.race([admin.rpc(purgeContent ? 'request_story_deletion' : 'request_media_deletion', {
      p_actor_id: pinned.actorId, p_project_id: pinned.projectId, p_request_id: pinned.requestId,
      ...(purgeContent ? { p_story_id: pinned.subjectId } : { p_subject_id: pinned.subjectId, p_subject_type: pinned.subjectType }),
    }).abortSignal(controller.signal).retry(false), interrupted])
    if (controller.signal.aborted || signal?.aborted || !result) unavailable()
    if (result.error) unavailable(result.error.code === '42501' ? 403 : ['23505','23514'].includes(result.error.code) ? 409 : ['22023','22P02'].includes(result.error.code) ? 400 : 503)
    const value = result.data
    const keys = ['id','projectId','subjectId','subjectType','state','tombstoneAt','targetCount','physicalDeletionComplete']
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length ||
      !keys.every(key=>Object.prototype.hasOwnProperty.call(value,key)) || !isDeletionUuid(value.id) ||
      value.projectId !== pinned.projectId || value.subjectId !== pinned.subjectId || value.subjectType !== pinned.subjectType ||
      value.state !== 'requested' || value.physicalDeletionComplete !== false || !validTimestamp(value.tombstoneAt) ||
      !Number.isSafeInteger(value.targetCount) || value.targetCount < 1) unavailable()
    // A subject replay returns its original capture ID, including when this
    // caller generated a new request ID after losing the previous response.
    return { id: value.id, projectId: value.projectId, subjectId: value.subjectId, subjectType: value.subjectType,
      state: 'requested', tombstoneAt: value.tombstoneAt, targetCount: value.targetCount, physicalDeletionComplete: false }
  } catch (error) {
    if (error instanceof MediaDeletionCaptureError) throw error
    return unavailable()
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort',abort)
    controller.signal.removeEventListener('abort',rejectAbort); abort()
  }
}
