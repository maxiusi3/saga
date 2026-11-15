import { isDeepStrictEqual } from 'node:util'
import type { getSupabaseAdmin } from '@/lib/supabase'
import { recordingChunkLocation } from '@/lib/recording-chunk-location'
import type { SealedRecordingSessionBundle } from './recording-session-service'
import { RecordingSealRegistrationError } from './recording-seal-registration'

function unavailable(): never {
  throw new RecordingSealRegistrationError(503, 'Recording manifest persistence is unavailable')
}

/** Pin declared input durably; this does not certify Storage bytes or authorize cleanup. */
export async function persistRecordingManifest(
  admin: ReturnType<typeof getSupabaseAdmin>,
  sealed: SealedRecordingSessionBundle,
  caller?: AbortSignal,
): Promise<string> {
  if (caller?.aborted) unavailable()
  const task = sealed.task
  const userId = sealed.assetRecord.created_by
  const manifest = {
    schemaVersion: 1, projectId: task.projectId, sessionId: task.sessionId, userId,
    storyId: sealed.assetRecord.story_id, assetId: task.assetId, mimeType: task.mimeType,
    chunks: task.chunks.map(chunk => {
      const location = recordingChunkLocation({ userId, projectId: task.projectId, sessionId: task.sessionId, index: chunk.index })
      if (chunk.objectKey !== location.objectKey) {
        throw new RecordingSealRegistrationError(400, 'Recording chunk location is invalid')
      }
      return { ...chunk, storageObjectKey: location.storageObjectKey }
    }),
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  caller?.addEventListener('abort', abort, { once: true })
  let onAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error('Recording manifest persistence interrupted'))
    controller.signal.addEventListener('abort', onAbort, { once: true })
  })
  const timer = setTimeout(abort, 5000)
  try {
    const query = admin.rpc('seal_recording_manifest', { p_manifest: manifest })
    const result = await Promise.race([query.abortSignal(controller.signal).retry(false), interrupted])
    if (controller.signal.aborted || !result) unavailable()
    if (result.error) {
      const code = result.error.code
      const status = ['22023', '22P02'].includes(code) ? 400 :
        ['23514', '23505'].includes(code) ? 409 : code === '42501' ? 403 : 503
      throw new RecordingSealRegistrationError(status, 'Recording manifest was not accepted')
    }
    const value: unknown = result.data
    if (!value || typeof value !== 'object' || Array.isArray(value)) unavailable()
    const receipt = value as Record<string, unknown>
    const keys = ['schemaVersion', 'sessionId', 'state', 'manifestSha256', 'manifest', 'canClearLocalDrafts']
    if (Object.keys(receipt).length !== keys.length || !keys.every(key => Object.prototype.hasOwnProperty.call(receipt, key)) ||
      receipt.schemaVersion !== 1 || receipt.sessionId !== task.sessionId || receipt.state !== 'sealing' ||
      receipt.canClearLocalDrafts !== false || typeof receipt.manifestSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(receipt.manifestSha256) || !isDeepStrictEqual(receipt.manifest, manifest)) unavailable()
    return receipt.manifestSha256
  } catch (error) {
    if (error instanceof RecordingSealRegistrationError) throw error
    return unavailable()
  } finally {
    clearTimeout(timer)
    caller?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', onAbort)
    controller.abort()
  }
}
