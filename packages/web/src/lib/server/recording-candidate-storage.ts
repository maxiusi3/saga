import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'
import type { VerifiedRecordingArtifact } from './recording-merge-executor'
import { validateRecordingOutputCandidate, type RecordingOutputCandidate } from './recording-output-candidate'

type Options = { storageUrl: string; serviceRoleKey: string; signal?: AbortSignal; ioTimeoutMs?: number;
  fetch?: typeof fetch; revalidate: (signal?: AbortSignal) => Promise<void> }

function unavailable(): never { throw new Error('recording_candidate_storage_unavailable') }

function scope(caller: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  caller?.addEventListener('abort', abort, { once: true })
  if (caller?.aborted) abort()
  const timer = setTimeout(abort, timeoutMs)
  return {
    signal: controller.signal,
    async wait<T>(promise: PromiseLike<T>): Promise<T> {
      let rejectAbort: () => void = () => {}
      const interrupted = new Promise<never>((_, reject) => {
        rejectAbort = () => reject(new Error('recording_candidate_storage_unavailable'))
        controller.signal.addEventListener('abort', rejectAbort, { once: true })
        if (controller.signal.aborted) rejectAbort()
      })
      try { return await Promise.race([promise, interrupted]) }
      finally { controller.signal.removeEventListener('abort', rejectAbort) }
    },
    close() { clearTimeout(timer); caller?.removeEventListener('abort', abort); abort() },
  }
}

async function cancelBody(response?: Response, reader?: ReadableStreamDefaultReader<Uint8Array>) {
  if (!reader && !response?.body) return
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([reader ? reader.cancel() : response!.body!.cancel(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('recording_candidate_storage_unavailable')), 1000)
    })])
  } finally { clearTimeout(timer); reader?.releaseLock() }
}

/** No publication or deletion: an uncertain upload is retained at its reserved address. */
export async function uploadAndVerifyRecordingCandidate(artifact: VerifiedRecordingArtifact, candidate: RecordingOutputCandidate, options: Options): Promise<void> {
  try {
    validateRecordingOutputCandidate(candidate)
    const evidence = artifact.completion
    const base = new URL(options.storageUrl)
    const timeoutMs = options.ioTimeoutMs ?? 30000
    if (typeof window !== 'undefined' || candidate.state !== 'reserved' || !evidence.decoded ||
      candidate.projectId !== evidence.projectId || candidate.assetId !== evidence.assetId || candidate.sessionId !== evidence.sessionId ||
      candidate.byteSize !== evidence.outputByteSize || candidate.sha256 !== evidence.outputSha256 ||
      candidate.durationMs !== evidence.durationMs || candidate.mimeType !== artifact.mimeType ||
      base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000 ||
      typeof options.serviceRoleKey !== 'string' || !options.serviceRoleKey || /\s/.test(options.serviceRoleKey)) unavailable()
    const fetcher = options.fetch ?? fetch
    const url = `${base.origin}/storage/v1/object/${candidate.bucket}/${candidate.objectKey}`
    const headers = { Authorization: `Bearer ${options.serviceRoleKey}`, apikey: options.serviceRoleKey }
    const revalidate = async (signal: AbortSignal) => {
      signal.throwIfAborted(); options.signal?.throwIfAborted()
      await options.revalidate(signal)
      signal.throwIfAborted(); options.signal?.throwIfAborted()
    }
    const fetchOwned = (init: RequestInit, owned: ReturnType<typeof scope>) => {
      const pending = fetcher(url, { redirect: 'error', cache: 'no-store', ...init, signal: owned.signal })
      void pending.then(late => { if (owned.signal.aborted) void late.body?.cancel().catch(() => {}) }, () => {})
      return owned.wait(pending)
    }

    const upload = scope(options.signal, timeoutMs)
    let source: ReturnType<typeof createReadStream> | undefined
    let body: Readable | undefined
    let sourceClosed: Promise<unknown> | undefined
    let bodyClosed: Promise<unknown> | undefined
    let response: Response | undefined
    try {
      await upload.wait(revalidate(upload.signal))
      source = createReadStream(artifact.filePath, { highWaterMark: 65536, signal: upload.signal })
      sourceClosed = finished(source, { cleanup: true }).catch(() => {})
      let resolveConsumed: () => void = () => {}
      let rejectConsumed: (error: unknown) => void = () => {}
      const consumed = new Promise<void>((resolve, reject) => { resolveConsumed = resolve; rejectConsumed = reject })
      void consumed.catch(() => {})
      const local = source
      body = Readable.from((async function* () {
        const hash = createHash('sha256'); let size = 0
        try {
          for await (const bytes of local) {
            upload.signal.throwIfAborted()
            size += bytes.length
            if (size > candidate.byteSize) unavailable()
            hash.update(bytes)
            yield bytes
          }
          if (size !== candidate.byteSize || hash.digest('hex') !== candidate.sha256) unavailable()
          resolveConsumed()
        } catch (error) { rejectConsumed(error); throw error }
      })(), { objectMode: false })
      bodyClosed = finished(body, { cleanup: true }).catch(() => {})
      const init: RequestInit & { duplex: 'half' } = { method: 'POST', duplex: 'half', body: body as unknown as BodyInit,
        headers: { ...headers, 'x-upsert': 'false', 'content-type': candidate.mimeType, 'content-length': String(candidate.byteSize) } }
      response = await fetchOwned(init, upload)
      upload.signal.throwIfAborted()
      if (![200, 201].includes(response.status) || response.redirected) unavailable()
      await upload.wait(consumed)
      await upload.wait(revalidate(upload.signal))
    } finally {
      try {
        // Native fetch errors an unread response body when its signal aborts.
        // Close the acknowledgement before our own successful-scope abort.
        await cancelBody(response)
      } finally {
        upload.close()
        source?.destroy(); body?.destroy()
        await Promise.all([sourceClosed, bodyClosed])
      }
    }

    const readback = scope(options.signal, timeoutMs)
    response = undefined
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      await readback.wait(revalidate(readback.signal))
      response = await fetchOwned({ method: 'GET', headers }, readback)
      readback.signal.throwIfAborted()
      const length = response.headers.get('content-length'), encoding = response.headers.get('content-encoding')
      if (response.status !== 200 || response.redirected || !response.body ||
        (length !== null && (!/^[1-9][0-9]*$/.test(length) || Number(length) !== candidate.byteSize)) ||
        (encoding !== null && encoding !== 'identity')) unavailable()
      reader = response.body.getReader()
      const hash = createHash('sha256'); let size = 0
      while (true) {
        const frame = await readback.wait(reader.read())
        readback.signal.throwIfAborted()
        if (frame.done) break
        if (!(frame.value instanceof Uint8Array) || frame.value.byteLength > candidate.byteSize - size) unavailable()
        size += frame.value.byteLength
        hash.update(frame.value)
      }
      if (size !== candidate.byteSize || hash.digest('hex') !== candidate.sha256) unavailable()
      await readback.wait(revalidate(readback.signal))
    } finally {
      readback.close()
      await cancelBody(response, reader)
    }
    options.signal?.throwIfAborted()
  } catch { unavailable() }
}
