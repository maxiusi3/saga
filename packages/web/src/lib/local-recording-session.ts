import { recorderDB } from './recorder-db'
import { createRecordingSession, type CreateRecordingSessionInput } from './recording-session'
import { storageService } from './storage'
import { useAuthStore } from '@/stores/auth-store'

/** One capture's queues; network latency never holds up the next local write. */
export async function createLocalRecordingSession(input: CreateRecordingSessionInput) {
  const { chunks: _chunks, persistedOrder: _order, ...record } = createRecordingSession(input)
  await recorderDB.saveSession(record)
  let writes: Promise<unknown> = Promise.resolve()
  let syncing: Promise<void> | null = null
  let syncRequested = false
  let nextIndex = 0
  let persistenceError: unknown = null

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = writes.then(operation)
    // Keep the queue usable so an interruption can be saved even after a failed chunk.
    writes = result.catch(() => {})
    return result
  }

  function canUpload() {
    return navigator.onLine && useAuthStore.getState().user?.id === record.userId && !persistenceError
  }

  function sync(): Promise<void> {
    syncRequested = true
    if (syncing) return syncing
    syncing = (async () => {
      try {
        do {
          syncRequested = false
          await writes
          if (!canUpload()) return
          const chunks = await recorderDB.getChunksBySession(record.id)
          const baseType = record.mimeType.split(';')[0]
          const extension = baseType === 'audio/mp4' ? 'm4a' : baseType === 'audio/ogg' ? 'ogg' : 'webm'
          for (const chunk of chunks) {
            if (chunk.uploadStatus === 'uploaded') continue
            if (!canUpload()) return
            const result = await storageService.uploadFile(chunk.blob, {
              bucket: 'audio-recordings',
              folder: `temp/${record.id}`,
              fileName: `${chunk.index}.${extension}`,
              allowedTypes: [baseType],
              expectedUserId: record.userId,
            })
            // A timeout/duplicate response is not confirmation. Retain the pending copy.
            if (!result.success) return
            await recorderDB.markChunkUploaded(record.id, chunk.index)
          }
        } while (syncRequested)
      } catch {
        // Upload failure leaves durable chunks pending for the next explicit sync.
      } finally {
        syncing = null
      }
    })()
    return syncing
  }

  return {
    id: record.id,
    persist(blob: Blob): Promise<void> {
      const index = nextIndex++
      return enqueue(async () => {
        try {
          if (!blob.size) throw new Error('Cannot persist an empty recording chunk')
          const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
          const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
          await recorderDB.saveChunk(record.id, index, blob, {
            byteSize: blob.size, sha256, persistedAt: new Date().toISOString(), uploadStatus: 'pending',
          })
        } catch (error) {
          persistenceError = error
          throw error
        }
      }).then(() => { void sync() })
    },
    sync,
    async interrupt(): Promise<void> {
      await enqueue(async () => {
        const session = await recorderDB.updateSession(record.id, { state: 'interrupted' })
        if (!session) throw new Error('Recording session is missing from local storage')
      })
      if (persistenceError) throw persistenceError
    },
  }
}

export type LocalRecordingSession = Awaited<ReturnType<typeof createLocalRecordingSession>>
