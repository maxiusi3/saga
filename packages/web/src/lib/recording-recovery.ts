import { acquireRecordingSessionLock } from './recording-session-lock'
import { recorderDB, type RecorderSessionRecord } from './recorder-db'

export type RecordingRecoveryErrorCode = 'unavailable' | 'empty' | 'damaged' | 'changed'

export class RecordingRecoveryError extends Error {
  constructor(public readonly code: RecordingRecoveryErrorCode) {
    super(`Local recording recovery: ${code}`)
    this.name = 'RecordingRecoveryError'
  }
}

function isRecoverable(session: RecorderSessionRecord, projectId: string, userId: string) {
  return session.projectId === projectId && session.userId === userId &&
    (session.state === 'recording' || session.state === 'interrupted' || !!session.saveIntent) &&
    (session.cloudConfirmedAssetId === null || !!session.saveIntent)
}

async function assertSessionUnchanged(session: RecorderSessionRecord, projectId: string, userId: string) {
  const current = await recorderDB.getSession(session.id)
  if (!current || !isRecoverable(current, projectId, userId) || current.id !== session.id ||
    current.lastPersistedIndex !== session.lastPersistedIndex || current.mimeType !== session.mimeType ||
    current.startedAt !== session.startedAt || current.state !== session.state || current.updatedAt !== session.updatedAt) {
    throw new RecordingRecoveryError('changed')
  }
}

export async function listLocalRecordings(projectId: string, userId: string): Promise<RecorderSessionRecord[]> {
  if (!projectId || !userId) return []
  return (await recorderDB.getRecoverableSessions(projectId, userId))
    .filter(session => isRecoverable(session, projectId, userId))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Verifies persisted bytes only; a missing final MediaRecorder event cannot be detected here. */
export async function loadLocalRecording(sessionId: string, projectId: string, userId: string): Promise<{
  session: RecorderSessionRecord; blob: Blob; chunkCount: number
}> {
  let release: (() => void) | undefined
  try {
    release = await acquireRecordingSessionLock(sessionId,false)
    return await loadSnapshot(sessionId,projectId,userId)
  } catch (error) {
    if (error instanceof Error && error.message === 'recording_busy') throw new RecordingRecoveryError('changed')
    throw error
  } finally { release?.() }
}

async function loadSnapshot(sessionId: string, projectId: string, userId: string) {
  if (!sessionId || !projectId || !userId) throw new RecordingRecoveryError('unavailable')
  const session = await recorderDB.getSession(sessionId)
  if (!session || session.id !== sessionId || !isRecoverable(session, projectId, userId) ||
    !/^audio\/(webm|mp4|ogg)(;.*)?$/.test(session.mimeType)) {
    throw new RecordingRecoveryError('unavailable')
  }
  if (session.saveIntent) {
    try {
      const verified = await recorderDB.readSave({sessionId,projectId,actorId:userId},() => true)
      return {session:verified.session,blob:new Blob(verified.chunks.map(chunk => chunk.blob),{type:verified.session.mimeType}),chunkCount:verified.chunks.length}
    } catch { throw new RecordingRecoveryError('damaged') }
  }
  const chunks = [...await recorderDB.getChunksBySession(sessionId)].sort((a, b) => a.index - b.index)
  // Separate reads can straddle an append or cleanup; do not mislabel that as corruption.
  await assertSessionUnchanged(session, projectId, userId)
  if (!chunks.length && session.lastPersistedIndex === -1) throw new RecordingRecoveryError('empty')
  if (!Number.isSafeInteger(session.lastPersistedIndex) || session.lastPersistedIndex < 0 ||
    chunks.length !== session.lastPersistedIndex + 1) throw new RecordingRecoveryError('damaged')

  for (const [index, chunk] of chunks.entries()) {
    if (chunk.sessionId !== sessionId || chunk.index !== index ||
      !Number.isSafeInteger(chunk.byteSize) || chunk.byteSize <= 0 || chunk.byteSize !== chunk.blob?.size ||
      typeof chunk.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(chunk.sha256)) {
      throw new RecordingRecoveryError('damaged')
    }
    const digest = await crypto.subtle.digest('SHA-256', await chunk.blob.arrayBuffer())
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    if (sha256 !== chunk.sha256) throw new RecordingRecoveryError('damaged')
  }

  // Another tab may still be persisting this capture. Ask for a fresh selection instead of
  // presenting a snapshot whose session metadata no longer describes its bytes.
  await assertSessionUnchanged(session, projectId, userId)
  return { session, blob: new Blob(chunks.map(chunk => chunk.blob), { type: session.mimeType }), chunkCount: chunks.length }
}
