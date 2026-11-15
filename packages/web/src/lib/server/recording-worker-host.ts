import { finalizeLeasedRecordingJob } from './recording-terminal-worker'
import { recoverRecordingJob } from './recording-job-lease'

type Options = Parameters<typeof finalizeLeasedRecordingJob>[1] & {
  /** Continue after the last inspected UUID. Empty scans reset the cursor. */
  cursor?: string | null
  selectionTimeoutMs?: number
}
type Base = { nextCursor: string | null; canClearLocalDrafts: false }
export type RecordingWorkerIteration = Base & (
  | { status: 'idle' | 'stopped' }
  | { status: 'unavailable'; jobId: string }
  | { status: 'processed'; jobId: string; outcome: 'succeeded' | 'failed' }
  | { status: 'recovered'; jobId: string; recoveryState: 'retry_wait' | 'failed' | 'outcome_unknown' | 'cancelled' }
)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const unavailable = () => new Error('recording_worker_host_unavailable')
const invalid = () => new Error('recording_worker_host_configuration')
function validateSelectionOptions(options: Options) {
  const cursor = options.cursor ?? null
  const timeoutMs = options.selectionTimeoutMs ?? 5000
  if ((cursor !== null && (typeof cursor !== 'string' || !UUID.test(cursor))) ||
    !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw invalid()
}
function due(value: unknown, now: number) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/.test(value) &&
    Number.isFinite(Date.parse(value)) && Date.parse(value) <= now
}

/** One bounded selection and at most one mutation pipeline. The lease RPC is
 * the concurrency/eligibility authority; this query grants no capability.
 * A rejected attempt is never replayed here. Only a future database-authorized
 * claim can dispatch; expired running attempts recover to outcome_unknown.
 */
export async function runRecordingWorkerOnce(options: Options): Promise<RecordingWorkerIteration> {
  const snapshot = { ...options, ffmpeg: { ...options.ffmpeg } }
  const cursor = snapshot.cursor ?? null
  const timeoutMs = snapshot.selectionTimeoutMs ?? 5000
  validateSelectionOptions(snapshot)
  const stopped = (): RecordingWorkerIteration => ({ status: 'stopped', nextCursor: cursor, canClearLocalDrafts: false })
  if (snapshot.signal?.aborted) return stopped()
  const controller = new AbortController()
  const abort = () => controller.abort()
  snapshot.signal?.addEventListener('abort', abort, { once: true })
  let rejectAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(unavailable())
    controller.signal.addEventListener('abort', rejectAbort, { once: true })
  })
  const timer = setTimeout(abort, timeoutMs)
  let selected: Record<string, unknown> | undefined
  try {
    const now = new Date().toISOString()
    let query = snapshot.admin.from('processing_jobs').select('id,state,not_before,lease_expires_at')
      .eq('job_type', 'recording_merge')
      .or(`and(state.in.(queued,retry_wait),or(not_before.is.null,not_before.lte.${now})),and(state.in.(leased,running),lease_expires_at.lte.${now})`)
      .order('id', { ascending: true }).limit(1)
    if (cursor !== null) query = query.gt('id', cursor)
    const result = await Promise.race([query.abortSignal(controller.signal).retry(false), interrupted])
    if (controller.signal.aborted || !result || result.error || !Array.isArray(result.data) || result.data.length > 1) throw unavailable()
    if (result.data.length === 0) return { status: 'idle', nextCursor: null, canClearLocalDrafts: false }
    selected = result.data[0]
    if (!selected || typeof selected.id !== 'string' || !UUID.test(selected.id) || (cursor !== null && selected.id <= cursor)) throw unavailable()
  } catch {
    if (snapshot.signal?.aborted) return stopped()
    throw unavailable()
  } finally {
    clearTimeout(timer)
    snapshot.signal?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', rejectAbort)
    controller.abort()
  }
  // Keep the original caller signal: the selection timeout scope is now closed.
  const jobId = selected.id as string
  const base = { jobId, nextCursor: jobId, canClearLocalDrafts: false as const }
  if (snapshot.signal?.aborted) return { status: 'stopped', nextCursor: cursor, canClearLocalDrafts: false }
  try {
    const now = Date.now()
    if (selected.state === 'queued' || selected.state === 'retry_wait') {
      if (selected.lease_expires_at !== null || (selected.not_before !== null && !due(selected.not_before, now))) throw unavailable()
      const receipt = await finalizeLeasedRecordingJob(jobId, snapshot)
      return { ...base, status: 'processed', outcome: receipt.state }
    }
    if ((selected.state === 'leased' || selected.state === 'running') && due(selected.lease_expires_at, now) && selected.not_before === null) {
      const receipt = await recoverRecordingJob(jobId, { admin: snapshot.admin, signal: snapshot.signal, timeoutMs: snapshot.rpcTimeoutMs })
      if (receipt.state === 'leased' || receipt.state === 'running') throw unavailable()
      return { ...base, status: 'recovered', recoveryState: receipt.state }
    }
    throw unavailable()
  } catch {
    // Do not infer whether claim, dispatch or terminal commit happened. Moving
    // the cursor prevents an old invalid row from hiding every later job.
    return { ...base, status: 'unavailable' }
  }
}

/** Poll serially. Cancellation interrupts transport/FFmpeg and awaits owned
 * cleanup; no Promise.race abandons the terminal pipeline on shutdown.
 */
export async function runRecordingWorker(options: Options & {
  pollMs?: number
  onIteration?: (result: RecordingWorkerIteration | { status: 'selection_unavailable' }) => void
}): Promise<void> {
  const snapshot = { ...options, ffmpeg: { ...options.ffmpeg } }
  const pollMs = snapshot.pollMs ?? 2000
  if (!Number.isInteger(pollMs) || pollMs < 250 || pollMs > 60000) throw invalid()
  validateSelectionOptions(snapshot)
  let cursor = snapshot.cursor ?? null
  while (!snapshot.signal?.aborted) {
    try {
      const result = await runRecordingWorkerOnce({ ...snapshot, cursor })
      cursor = result.nextCursor
      snapshot.onIteration?.(result)
    } catch {
      if (!snapshot.signal?.aborted) snapshot.onIteration?.({ status: 'selection_unavailable' })
    }
    if (snapshot.signal?.aborted) break
    await new Promise<void>(resolve => {
      const done = () => { clearTimeout(timer); snapshot.signal?.removeEventListener('abort', done); resolve() }
      const timer = setTimeout(done, pollMs)
      snapshot.signal?.addEventListener('abort', done, { once: true })
      if (snapshot.signal?.aborted) done()
    })
  }
}
