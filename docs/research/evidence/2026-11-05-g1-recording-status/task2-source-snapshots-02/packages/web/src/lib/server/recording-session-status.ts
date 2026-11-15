import type { getSupabaseAdmin } from '@/lib/supabase'
import { validateRecordingSessionSnapshot, validateRecordingSessionStatusInput,
  type RecordingSessionStatusInput, type RecordingSessionStatus } from './recording-status-validation'

export type { RecordingSessionStatusInput, RecordingSessionStatus } from './recording-status-validation'
type Options = { admin: ReturnType<typeof getSupabaseAdmin>; signal?: AbortSignal; timeoutMs?: number }
function unavailable(): never { throw new Error('recording_status_unavailable') }

/** One bounded snapshot read. A rejection never authorizes replay, recovery or cleanup. */
export async function readRecordingSessionStatus(input: RecordingSessionStatusInput, options: Options): Promise<RecordingSessionStatus> {
  let pinned: RecordingSessionStatusInput, admin: Options['admin'], signal: AbortSignal | undefined, timeoutMs: number
  try {
    validateRecordingSessionStatusInput(input)
    pinned = Object.freeze({ ...input })
    ;({ admin, signal } = options)
    timeoutMs = options.timeoutMs ?? 5000
    if (typeof window !== 'undefined' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 || signal?.aborted) unavailable()
  } catch { return unavailable() }
  const controller = new AbortController()
  const abort = () => controller.abort()
  let rejectAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new Error('recording_status_unavailable'))
    controller.signal.addEventListener('abort', rejectAbort, { once: true })
  })
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, timeoutMs)
  try {
    const result = await Promise.race([admin.rpc('read_recording_session_snapshot', {
      p_actor_id: pinned.actorId, p_project_id: pinned.projectId, p_session_id: pinned.sessionId, p_manifest_sha256: pinned.manifestSha256,
    }).abortSignal(controller.signal).retry(false), interrupted])
    if (controller.signal.aborted || signal?.aborted || !result || result.error) unavailable()
    return validateRecordingSessionSnapshot(result.data, pinned)
  } catch { return unavailable() }
  finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', rejectAbort)
    abort()
  }
}
