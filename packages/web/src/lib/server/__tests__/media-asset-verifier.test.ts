import { ReadableStream } from 'node:stream/web'
import { verifyMediaObjectStream } from '@/lib/server/media-asset-verifier'

function streamOf(...chunks: string[]) {
  const encoded = chunks.map(chunk => Uint8Array.from(Buffer.from(chunk)))
  let index = 0
  const cancel = jest.fn()
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= encoded.length) {
        controller.close()
        return
      }
      controller.enqueue(encoded[index++])
    },
    cancel,
  })
  return { stream, cancel }
}

describe('media asset object verification', () => {
  it('returns byte count and sha256 for an exact object', async () => {
    const { stream } = streamOf('hello', ' world')
    await expect(verifyMediaObjectStream(stream, {
      expectedBytes: 11,
      expectedSha256: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      contentType: 'audio/webm',
      expectedMimeType: 'audio/webm',
      maxBytes: 100,
    })).resolves.toEqual({ ok: true, byteSize: 11, sha256: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9' })
  })

  it('fails closed when bytes or hash do not match', async () => {
    const { stream } = streamOf('hello')
    await expect(verifyMediaObjectStream(stream, {
      expectedBytes: 99,
      expectedSha256: 'a'.repeat(64),
      contentType: 'image/png',
      expectedMimeType: 'image/png',
      maxBytes: 100,
    })).resolves.toMatchObject({ ok: false, reason: 'integrity_mismatch' })
  })

  it('cancels an over-limit stream even when metadata under-reports size', async () => {
    const cancel = jest.fn()
    const stream = {
      getReader: () => {
        let index = 0
        return {
          read: async () => ({ done: false, value: Uint8Array.from(Buffer.from(index++ === 0 ? '1234' : '5678')) }),
          cancel: async () => { cancel() },
          releaseLock: jest.fn(),
        }
      },
    } as unknown as ReadableStream<Uint8Array>
    await expect(verifyMediaObjectStream(stream, {
      expectedBytes: undefined,
      expectedSha256: undefined,
      contentType: 'audio/webm',
      expectedMimeType: 'audio/webm',
      maxBytes: 5,
    })).resolves.toMatchObject({ ok: false, reason: 'too_large', byteSize: 8 })
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('rejects a content type mismatch before consuming the stream', async () => {
    const { stream, cancel } = streamOf('should not read')
    await expect(verifyMediaObjectStream(stream, {
      expectedBytes: undefined,
      expectedSha256: undefined,
      contentType: 'application/octet-stream',
      expectedMimeType: 'audio/webm',
      maxBytes: 100,
    })).resolves.toMatchObject({ ok: false, reason: 'mime_mismatch', byteSize: 0 })
    expect(cancel).toHaveBeenCalledTimes(1)
  })
})
