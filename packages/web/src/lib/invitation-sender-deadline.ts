/** A single budget bounds headers and body reads, with deterministic caller cleanup. */
export function senderDeadline(caller?: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  caller?.addEventListener('abort', abort, { once: true })
  if (caller?.aborted) abort()
  const timer = setTimeout(abort, 10_000)
  return {
    signal: controller.signal,
    async run<T>(work: PromiseLike<T>): Promise<T> {
      let onAbort: () => void = () => {}
      const cancelled = new Promise<never>((_, reject) => {
        onAbort = () => reject(new Error('Invitation operation interrupted.'))
        controller.signal.addEventListener('abort', onAbort, { once: true })
        if (controller.signal.aborted) onAbort()
      })
      try { return await Promise.race([work, cancelled]) }
      finally { controller.signal.removeEventListener('abort', onAbort) }
    },
    close() { clearTimeout(timer); caller?.removeEventListener('abort', abort); controller.abort() },
  }
}
