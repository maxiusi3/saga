import { RecordingProcessingError, isRecordingProcessingError } from './recording-processing-error'
import { createHash } from 'node:crypto'
import { mkdtemp, open, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildRecordingMergeTaskInput,
  verifyRecordingMergeCompletion,
  type RecordingMergeChunk,
  type RecordingMergeCompletionEvidence,
  type RecordingMergeTaskInput,
} from './recording-merge'

interface MergeDependencies {
  // The caller must supply an authorized, version-pinned reader with its own I/O timeout.
  // Cancellation is checked between awaits; an uncooperative Promise is not interruptible here.
  readChunk: (chunk: RecordingMergeChunk, signal?: AbortSignal) => Promise<AsyncIterable<Uint8Array>>
  decodeAudio: (filePath: string, mimeType: string, signal?: AbortSignal) => Promise<{ durationMs: number }>
  maxInputBytes: number
  tempRoot?: string
  signal?: AbortSignal
}

interface VerifiedRecordingArtifact {
  filePath: string
  mimeType: string
  completion: RecordingMergeCompletionEvidence
}

/** Local processing only: evidence is not a cloud confirmation or permission to delete sources.
 * The artifact exists only during consume. A future adapter must recheck authorization,
 * tombstones, lease and the sealed manifest before atomically publishing a result.
 */
export async function withVerifiedRecordingMerge<T>(
  input: RecordingMergeTaskInput,
  dependencies: MergeDependencies,
  consume: (artifact: VerifiedRecordingArtifact) => Promise<T>,
): Promise<T> {
  const { signal } = dependencies
  signal?.throwIfAborted()
  const task = buildRecordingMergeTaskInput(input)
  if (input.jobType !== 'recording_merge' || input.totalInputBytes !== task.totalInputBytes || input.idempotencyKey !== task.idempotencyKey) {
    throw new Error('Recording merge task does not match its manifest')
  }
  if (!Number.isSafeInteger(dependencies.maxInputBytes) || dependencies.maxInputBytes <= 0) {
    throw new Error('Recording input byte limit must be a positive safe integer')
  }
  if (!Number.isSafeInteger(task.totalInputBytes) || task.totalInputBytes > dependencies.maxInputBytes) {
    throw new Error('Recording input exceeds the byte limit')
  }
  const directory = await mkdtemp(join(dependencies.tempRoot ?? tmpdir(), 'saga-recording-merge-'))
  try {
    signal?.throwIfAborted()
    const filePath = join(directory, 'original.audio')
    const output = await open(filePath, 'wx', 0o600)
    const outputHash = createHash('sha256')
    let outputByteSize = 0
    try {
      signal?.throwIfAborted()
      for (const chunk of task.chunks) {
        signal?.throwIfAborted()
        const chunkHash = createHash('sha256')
        let chunkBytes = 0
        const source = await dependencies.readChunk({ ...chunk }, signal)
        // Acquire ownership before checking cancellation so a newly opened source is closed.
        const iterator = source[Symbol.asyncIterator]()
        try {
          while (true) {
            signal?.throwIfAborted()
            const frame = await iterator.next()
            signal?.throwIfAborted()
            if (frame.done) break
            const part = frame.value
            if (!(part instanceof Uint8Array)) throw new Error('Recording source must yield bytes')
            if (part.byteLength > chunk.byteSize - chunkBytes) throw new RecordingProcessingError('recording_source_size_mismatch', 'Recording chunk byte size exceeds its manifest')
            // Own the frame across asynchronous writes; readers may reuse their buffers.
            const bytes = Buffer.from(part)
            for (let offset = 0; offset < bytes.length;) {
              const { bytesWritten } = await output.write(bytes, offset, bytes.length - offset)
              signal?.throwIfAborted()
              if (bytesWritten === 0) throw new Error('Recording output write made no progress')
              offset += bytesWritten
            }
            chunkBytes += bytes.length
            outputByteSize += bytes.length
            chunkHash.update(bytes)
            outputHash.update(bytes)
          }
        } catch (error) {
          // for-await does not close a generic iterator when next() rejects.
          // A known failure is retryable only after all owned resources are closed.
          try { await iterator.return?.() } catch {
            if (isRecordingProcessingError(error)) throw new Error('Recording source cleanup failed')
          }
          signal?.throwIfAborted()
          throw error
        }
        if (chunkBytes !== chunk.byteSize) throw new RecordingProcessingError('recording_source_size_mismatch', 'Recording chunk byte size does not match its manifest')
        if (chunkHash.digest('hex') !== chunk.sha256) throw new RecordingProcessingError('recording_source_hash_mismatch', 'Recording chunk SHA256 does not match its manifest')
      }
    } finally {
      await output.close()
    }
    signal?.throwIfAborted()
    const { durationMs } = await dependencies.decodeAudio(filePath, task.mimeType, signal)
    signal?.throwIfAborted()
    const completion: RecordingMergeCompletionEvidence = {
      projectId: task.projectId, sessionId: task.sessionId, assetId: task.assetId,
      decoded: true, durationMs, outputByteSize, outputSha256: outputHash.digest('hex'),
      chunks: task.chunks.map(chunk => ({ ...chunk })),
    }
    verifyRecordingMergeCompletion(task, completion)
    signal?.throwIfAborted()
    const result = await consume({ filePath, mimeType: task.mimeType, completion })
    signal?.throwIfAborted()
    return result
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
