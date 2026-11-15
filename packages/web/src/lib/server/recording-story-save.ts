import type { getSupabaseAdmin } from '@/lib/supabase'
import { validateRecordingSaveIdentity, validateRecordingSaveMetadata, validateRecordingSaveLookup, validateRecordingSaveReceipt,
  type RecordingSaveIdentity, type RecordingSaveMetadata, type RecordingSaveLookup, type RecordingSaveReceipt } from '@/lib/recording-save-contract'
import { validateRecordingSessionSnapshot } from './recording-status-validation'

type Options = { admin: ReturnType<typeof getSupabaseAdmin>; signal?: AbortSignal; timeoutMs?: number }
export class RecordingStorySaveError extends Error {
  constructor(public readonly status: number) { super('Recording save is unavailable') }
}
function unavailable(status = 503): never { throw new RecordingStorySaveError(status) }
async function operation(identity: RecordingSaveIdentity, action: 'lookup' | 'reserve' | 'confirm',
  metadata: RecordingSaveMetadata | null, hash: string | null, options: Options) {
  try {
    validateRecordingSaveIdentity(identity)
    if (action === 'reserve') validateRecordingSaveMetadata(metadata)
    if (action === 'confirm' && (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) unavailable(400)
  } catch { return unavailable(400) }
  const pinned = Object.freeze({ ...identity }), pinnedMetadata = metadata && Object.freeze({ ...metadata })
  const { admin, signal, timeoutMs = 5000 } = options
  if (typeof window !== 'undefined' || signal?.aborted || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) unavailable()
  const controller = new AbortController(), abort = () => controller.abort()
  let rejectAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new RecordingStorySaveError(503))
    controller.signal.addEventListener('abort', rejectAbort, { once: true })
  })
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, timeoutMs)
  try {
    const result = await Promise.race([admin.rpc('recording_story_save', { p_actor_id: pinned.actorId,
      p_project_id: pinned.projectId, p_session_id: pinned.sessionId, p_action: action,
      p_metadata: pinnedMetadata, p_manifest_sha256: hash }).abortSignal(controller.signal).retry(false), interrupted])
    if (controller.signal.aborted || signal?.aborted || !result) unavailable()
    if (result.error) unavailable(result.error.code === '42501' ? 403 : ['23505', '23514'].includes(result.error.code) ? 409 :
      ['22023', '22P02'].includes(result.error.code) ? 400 : 503)
    const raw = result.data
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length !== 2 ||
      !Object.prototype.hasOwnProperty.call(raw, 'lookup') || !Object.prototype.hasOwnProperty.call(raw, 'snapshot')) unavailable()
    const lookup = validateRecordingSaveLookup(raw.lookup, pinned), intent = lookup.intent
    if (action === 'reserve' && (!intent || Object.keys(pinnedMetadata!).some(key =>
      intent.metadata[key as keyof RecordingSaveMetadata] !== pinnedMetadata![key as keyof RecordingSaveMetadata]))) unavailable()
    let status = null
    if (intent?.manifestSha256) {
      status = validateRecordingSessionSnapshot(raw.snapshot, { ...pinned, manifestSha256: intent.manifestSha256 })
      if (status.assetId !== intent.assetId || raw.snapshot.session.story_id !== intent.storyId ||
        (intent.confirmed && status.state !== 'succeeded')) unavailable()
    } else if (raw.snapshot !== null) unavailable()
    if (action !== 'confirm') return { lookup, receipt: null }
    if (!intent?.confirmed || !intent.assetId || !intent.manifestSha256 || intent.manifestSha256 !== hash || status?.state !== 'succeeded') unavailable()
    const receiptIdentity = { ...pinned, storyId: intent.storyId, assetId: intent.assetId, manifestSha256: intent.manifestSha256 }
    const receipt = validateRecordingSaveReceipt({ schemaVersion: 1, ...receiptIdentity,
      playbackUrl: `/api/media/assets/${intent.assetId}/play`, canClearLocalDrafts: true }, receiptIdentity)
    return { lookup, receipt }
  } catch (error) {
    if (error instanceof RecordingStorySaveError) throw error
    return unavailable()
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', rejectAbort); abort()
  }
}
export async function lookupRecordingStorySave(identity: RecordingSaveIdentity, options: Options): Promise<RecordingSaveLookup> {
  return (await operation(identity, 'lookup', null, null, options)).lookup
}
export async function reserveRecordingStorySave(identity: RecordingSaveIdentity, metadata: RecordingSaveMetadata, options: Options): Promise<RecordingSaveLookup> {
  return (await operation(identity, 'reserve', metadata, null, options)).lookup
}
export async function confirmRecordingStorySave(input: RecordingSaveIdentity & { manifestSha256: string }, options: Options): Promise<RecordingSaveReceipt> {
  const { manifestSha256, ...identity } = input
  return (await operation(identity, 'confirm', null, manifestSha256, options)).receipt ?? unavailable()
}
