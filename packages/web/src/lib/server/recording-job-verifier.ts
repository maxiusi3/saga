import { loadRecordingJobInput } from './recording-job-input'
import { createFfmpegRecordingDecoder } from './recording-audio-decoder'
import { withVerifiedRecordingMerge, type VerifiedRecordingArtifact } from './recording-merge-executor'
import { DEFAULT_MAX_RECORDING_INPUT_BYTES } from './recording-session-service'
import { isRecordingProcessingError } from './recording-processing-error'
import type { RecordingMergeCompletionEvidence } from './recording-merge'
import type { RecordingJobLease } from './recording-job-lease'

interface VerificationOptions {
  admin: Parameters<typeof loadRecordingJobInput>[1]['admin']
  storageUrl: string
  serviceRoleKey: string
  ffmpeg: { executable: string; timeoutMs: number; maxDurationMs: number }
  tempRoot?: string
  fetch?: typeof fetch
  ioTimeoutMs?: number
  signal?: AbortSignal
  lease?: RecordingJobLease
}

function unavailable() { return new Error('recording_input_unavailable') }

function ioScope(caller: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const abort = () => controller.abort(unavailable())
  caller?.addEventListener('abort', abort, { once: true })
  if (caller?.aborted) abort()
  const timer = setTimeout(abort, timeoutMs)
  return {
    signal: controller.signal,
    abort,
    async wait<T>(pending: Promise<T>): Promise<T> {
      let rejectAbort: () => void = () => {}
      const interrupted = new Promise<never>((_, reject) => {
        rejectAbort = () => reject(unavailable())
        controller.signal.addEventListener('abort', rejectAbort, { once: true })
        if (controller.signal.aborted) rejectAbort()
      })
      try { return await Promise.race([pending, interrupted]) }
      finally { controller.signal.removeEventListener('abort', rejectAbort) }
    },
    close() { clearTimeout(timer); caller?.removeEventListener('abort', abort); abort() },
  }
}

async function closeBody(response?: Response, reader?: ReadableStreamDefaultReader<Uint8Array>) {
  if (!reader && !response?.body) return
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      reader ? reader.cancel() : response!.body!.cancel(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), 1000) }),
    ])
  } finally {
    clearTimeout(timer)
    reader?.releaseLock()
  }
}

/** Read-only compatibility entry; evidence never authorizes local draft cleanup. */
export async function verifyRecordingJobInput(jobId: string, options: VerificationOptions): Promise<{
  status: 'input_verified'
  jobId: string
  completion: RecordingMergeCompletionEvidence
  canClearLocalDrafts: false
}> {
  const completion = await withVerifiedRecordingJobInput(jobId, options, async artifact => artifact.completion)
  return { status: 'input_verified', jobId, completion, canClearLocalDrafts: false }
}

/** The artifact belongs to this scope and is removed after consume settles.
 * Rechecks are optimistic, not an atomic revocation/deletion publication barrier.
 */
export async function withVerifiedRecordingJobInput<T>(jobId: string, options: VerificationOptions,
  consume: (artifact: VerifiedRecordingArtifact, context: { revalidate: (signal?: AbortSignal) => Promise<void> }) => Promise<T>): Promise<T> {
  const base = new URL(options.storageUrl)
  const timeoutMs = options.ioTimeoutMs ?? 30000
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
    !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000 ||
    typeof options.serviceRoleKey !== 'string' || !options.serviceRoleKey || /\s/.test(options.serviceRoleKey)) {
    throw new Error('Invalid recording verifier configuration')
  }
  const decode = createFfmpegRecordingDecoder(options.ffmpeg)
  const fetcher = options.fetch ?? fetch
  try {
    options.signal?.throwIfAborted()
    const input = await loadRecordingJobInput(jobId, { admin: options.admin, signal: options.signal, lease: options.lease })
    const revalidate = async (signal?: AbortSignal) => {
      options.signal?.throwIfAborted()
      signal?.throwIfAborted()
      await input.revalidate(signal)
      options.signal?.throwIfAborted()
      signal?.throwIfAborted()
    }
    const result = await withVerifiedRecordingMerge(input.task, {
      signal: options.signal,
      tempRoot: options.tempRoot,
      maxInputBytes: DEFAULT_MAX_RECORDING_INPUT_BYTES,
      readChunk: async chunk => (async function* () {
        await revalidate()
        const scope = ioScope(options.signal, timeoutMs)
        let response: Response | undefined
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
        try {
          const key = input.storageObjectKeys[chunk.index]
          // Only the closed, owner-bound ledger namespace supplies this path.
          const url = `${base.origin}/storage/v1/object/audio-recordings/${key.split('/').map(encodeURIComponent).join('/')}`
          const pending = fetcher(url, { method: 'GET', redirect: 'error', cache: 'no-store',
            headers: { Authorization: `Bearer ${options.serviceRoleKey}`, apikey: options.serviceRoleKey }, signal: scope.signal })
          // A non-cooperative transport may return after timeout; it still owns a body to close.
          void pending.then(late => { if (scope.signal.aborted) void late.body?.cancel().catch(() => {}) }, () => {})
          response = await scope.wait(pending)
          scope.signal.throwIfAborted()
          const length = response.headers.get('content-length')
          const encoding = response.headers.get('content-encoding')
          if (response.status !== 200 || !response.body || response.redirected ||
            (length !== null && (!/^(0|[1-9][0-9]*)$/.test(length) || Number(length) !== chunk.byteSize)) ||
            (encoding !== null && encoding !== 'identity')) throw unavailable()
          await scope.wait(revalidate(scope.signal))
          reader = response.body.getReader()
          while (true) {
            const frame = await scope.wait(reader.read())
            scope.signal.throwIfAborted()
            if (frame.done) break
            yield frame.value
          }
          await scope.wait(revalidate(scope.signal))
        } finally {
          scope.close()
          await closeBody(response, reader)
        }
      })(),
      decodeAudio: async (path, mime, signal) => {
        await revalidate()
        return await decode(path, mime, signal)
      },
    }, async artifact => {
      await revalidate()
      const consumed = await consume(artifact, { revalidate })
      await revalidate()
      return consumed
    })
    // The executor removes temporary files after its callback, which is another await.
    await revalidate()
    return result
  } catch (error) {
    if (isRecordingProcessingError(error)) throw error
    // No provider body, private object path, credentials or decoder diagnostics escape.
    throw unavailable()
  }
}
