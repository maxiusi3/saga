import { PaymentError } from './payment-orders'
/** Read bytes incrementally. The limit applies to the actual stream, not its header. */
export async function readPaymentBody(request: Request, limit: number): Promise<string> {
  const length = request.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > limit) throw new PaymentError(413, 'Payment request is too large.')
  const reader = request.body?.getReader()
  if (!reader) throw new PaymentError(400, 'Invalid payment request.')
  const chunks: Uint8Array[] = []; let size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      if (!(chunk.value instanceof Uint8Array) || chunk.value.byteLength > limit - size) {
        void reader.cancel().catch(() => undefined)
        throw new PaymentError(413, 'Payment request is too large.')
      }
      size += chunk.value.byteLength; chunks.push(chunk.value)
    }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)) }
    catch { throw new PaymentError(400, 'Invalid payment request encoding.') }
  } finally { reader.releaseLock() }
}
