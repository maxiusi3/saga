import { createHash } from 'crypto'

export type MediaVerificationFailure = 'mime_mismatch' | 'too_large' | 'integrity_mismatch' | 'stream_error'

export type MediaVerificationResult =
  | { ok: true; byteSize: number; sha256: string }
  | { ok: false; reason: MediaVerificationFailure; byteSize: number; sha256?: string }

export async function verifyMediaObjectStream(
  stream: ReadableStream<Uint8Array>,
  options: {
    expectedBytes?: number
    expectedSha256?: string
    contentType?: string | null
    expectedMimeType?: string | null
    maxBytes: number
  },
): Promise<MediaVerificationResult> {
  const contentType = (options.contentType || '').split(';')[0]
  const expectedMimeType = (options.expectedMimeType || '').split(';')[0]
  if (expectedMimeType && contentType && expectedMimeType !== contentType) {
    await stream.cancel().catch(() => {})
    return { ok: false, reason: 'mime_mismatch', byteSize: 0 }
  }

  const reader = stream.getReader()
  const hash = createHash('sha256')
  let byteSize = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteSize += value.byteLength
      if (byteSize > options.maxBytes) {
        await reader.cancel().catch(() => {})
        return { ok: false, reason: 'too_large', byteSize }
      }
      hash.update(value)
    }
  } catch {
    await reader.cancel().catch(() => {})
    return { ok: false, reason: 'stream_error', byteSize }
  } finally {
    reader.releaseLock()
  }

  const sha256 = hash.digest('hex')
  if ((options.expectedBytes !== undefined && options.expectedBytes !== byteSize) ||
      (options.expectedSha256 !== undefined && options.expectedSha256 !== sha256)) {
    return { ok: false, reason: 'integrity_mismatch', byteSize, sha256 }
  }
  return { ok: true, byteSize, sha256 }
}
