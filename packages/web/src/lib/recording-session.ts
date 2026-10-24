export type RecordingSessionState = 'recording' | 'interrupted' | 'confirmed'
export type RecordingChunkUploadStatus = 'pending' | 'uploaded'

export interface RecordingChunk {
  sessionId: string
  index: number
  byteSize: number
  sha256: string
  persistedAt: string
  uploadStatus: RecordingChunkUploadStatus
}

export interface RecordingSession {
  id: string
  projectId: string
  userId: string
  mimeType: string
  startedAt: string
  state: RecordingSessionState
  lastPersistedIndex: number
  cloudConfirmedAssetId: string | null
  /** The local recovery manifest travels with the immutable session snapshot. */
  chunks: RecordingChunk[]
  /** Internal ordering guard: a chunk must be uploaded only after earlier persistence writes. */
  persistedOrder: number[]
}

export interface RecordingSessionSnapshot {
  session: RecordingSession
  chunks: RecordingChunk[]
}

export interface CreateRecordingSessionInput {
  id: string
  projectId: string
  userId: string
  mimeType: string
  startedAt: string
}

export interface RecordingChunkInput {
  sessionId: string
  index: number
  byteSize: number
  sha256: string
  persistedAt: string
  uploadStatus?: RecordingChunkUploadStatus
}

function nonEmpty(value: string, label: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`)
  }
  return value
}

function validTimestamp(value: string, label: string) {
  nonEmpty(value, label)
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a valid timestamp`)
  }
  return value
}

function cloneChunk(chunk: RecordingChunk): RecordingChunk {
  return { ...chunk }
}

function cloneSession(session: RecordingSession, chunks = session.chunks ?? []): RecordingSession {
  return { ...session, chunks: chunks.map(cloneChunk), persistedOrder: [...(session.persistedOrder ?? chunks.map(chunk => chunk.index))] }
}

function snapshotChunks(snapshot: RecordingSessionSnapshot): RecordingChunk[] {
  const chunks = snapshot.chunks ?? snapshot.session.chunks ?? []
  return chunks.map(cloneChunk).sort((a, b) => a.index - b.index)
}

function assertSessionUsable(session: RecordingSession) {
  nonEmpty(session.id, 'session id')
  nonEmpty(session.projectId, 'project')
  nonEmpty(session.userId, 'user')
  nonEmpty(session.mimeType, 'mime type')
  validTimestamp(session.startedAt, 'startedAt')
  if (session.state === 'confirmed') {
    throw new Error('confirmed session cannot be changed')
  }
}

function assertChunkInput(chunk: RecordingChunkInput) {
  nonEmpty(chunk.sessionId, 'chunk session')
  if (!Number.isSafeInteger(chunk.index) || chunk.index < 0) {
    throw new Error('chunk index must be a non-negative integer')
  }
  if (!Number.isSafeInteger(chunk.byteSize) || chunk.byteSize <= 0) {
    throw new Error('chunk byte size must be positive')
  }
  if (!/^[a-f0-9]{64}$/i.test(chunk.sha256)) {
    throw new Error('chunk sha256 must be a 64-character hex digest')
  }
  validTimestamp(chunk.persistedAt, 'persistedAt')
}

function supportedByBrowser(mimeType: string) {
  const recorder = (globalThis as { MediaRecorder?: { isTypeSupported?: (type: string) => boolean } }).MediaRecorder
  if (typeof recorder?.isTypeSupported === 'function') {
    return recorder.isTypeSupported(mimeType)
  }
  return false
}

/** Choose a browser-supported container, keeping WebM/Opus ahead of less portable candidates. */
export function selectRecordingMimeType(candidates: readonly string[]): string | null {
  const unique = [...new Set(candidates.filter(candidate => typeof candidate === 'string' && candidate.trim()))]
  const preference = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  const ordered = [
    ...preference.filter(mime => unique.includes(mime)),
    ...unique.filter(mime => !preference.includes(mime)),
  ]
  return ordered.find(supportedByBrowser) ?? null
}

export function createRecordingSession(input: CreateRecordingSessionInput): RecordingSession {
  const session: RecordingSession = {
    id: nonEmpty(input.id, 'session id'),
    projectId: nonEmpty(input.projectId, 'project'),
    userId: nonEmpty(input.userId, 'user'),
    mimeType: nonEmpty(input.mimeType, 'mime type'),
    startedAt: validTimestamp(input.startedAt, 'startedAt'),
    state: 'recording',
    lastPersistedIndex: -1,
    cloudConfirmedAssetId: null,
    chunks: [],
    persistedOrder: [],
  }
  return cloneSession(session)
}

export function addRecordingChunk(session: RecordingSession, input: RecordingChunkInput): RecordingSessionSnapshot {
  assertSessionUsable(session)
  assertChunkInput(input)
  if (input.sessionId !== session.id) {
    throw new Error('chunk session does not match session')
  }

  const existing = (session.chunks ?? []).map(cloneChunk)
  if (existing.some(chunk => chunk.index === input.index)) {
    throw new Error('duplicate chunk index')
  }
  const chunk: RecordingChunk = {
    sessionId: input.sessionId,
    index: input.index,
    byteSize: input.byteSize,
    sha256: input.sha256.toLowerCase(),
    persistedAt: input.persistedAt,
    uploadStatus: input.uploadStatus ?? 'pending',
  }
  const chunks = [...existing, chunk].sort((a, b) => a.index - b.index)
  const nextSession = cloneSession({
    ...session,
    lastPersistedIndex: Math.max(session.lastPersistedIndex, input.index),
    chunks,
    persistedOrder: [...(session.persistedOrder ?? []), input.index],
  }, chunks)
  return { session: nextSession, chunks: chunks.map(cloneChunk) }
}

export function markChunkUploaded(snapshot: RecordingSessionSnapshot, index: number): RecordingSessionSnapshot {
  const chunks = snapshotChunks(snapshot)
  const chunk = chunks.find(candidate => candidate.index === index)
  if (!chunk) {
    throw new Error('chunk must be persisted before upload')
  }
  const persistedOrder = snapshot.session.persistedOrder?.length
    ? snapshot.session.persistedOrder
    : chunks.map(candidate => candidate.index)
  const nextPendingIndex = persistedOrder.find(candidateIndex => {
    const candidate = chunks.find(item => item.index === candidateIndex)
    return candidate && candidate.uploadStatus === 'pending'
  })
  if (nextPendingIndex !== index) {
    throw new Error('chunk must be uploaded after earlier persisted chunks')
  }
  if (chunk.uploadStatus === 'uploaded') {
    return {
      session: cloneSession(snapshot.session, chunks),
      chunks,
    }
  }
  const nextChunks = chunks.map(candidate => candidate.index === index
    ? { ...candidate, uploadStatus: 'uploaded' as const }
    : candidate)
  const nextSession = cloneSession({ ...snapshot.session, chunks: nextChunks }, nextChunks)
  return { session: nextSession, chunks: nextChunks.map(cloneChunk) }
}

export function markRecordingInterrupted(session: RecordingSession): RecordingSession {
  assertSessionUsable(session)
  return cloneSession({ ...session, state: 'interrupted' })
}

export function resumeRecordingSession(
  snapshot: RecordingSessionSnapshot,
  projectId: string,
  userId: string,
): RecordingSession {
  if (snapshot.session.projectId !== projectId) {
    throw new Error('project does not match recording session')
  }
  if (snapshot.session.userId !== userId) {
    throw new Error('user does not match recording session')
  }
  if (snapshot.session.state === 'confirmed') {
    throw new Error('confirmed session cannot be resumed')
  }
  const chunks = snapshotChunks(snapshot)
  return cloneSession({ ...snapshot.session, state: 'recording', chunks }, chunks)
}

export function confirmRecordingSession(snapshot: RecordingSessionSnapshot, assetId: string): RecordingSessionSnapshot {
  assertSessionUsable(snapshot.session)
  nonEmpty(assetId, 'asset id')
  const chunks = snapshotChunks(snapshot)
  if (chunks.length === 0) {
    throw new Error('recording must contain uploaded chunks')
  }
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index]
    if (chunk.index !== index) {
      throw new Error('recording chunks must be contiguous')
    }
    if (chunk.byteSize <= 0 || chunk.uploadStatus !== 'uploaded') {
      throw new Error('all recording chunks must be uploaded')
    }
  }
  const nextSession = cloneSession({
    ...snapshot.session,
    state: 'confirmed',
    cloudConfirmedAssetId: assetId,
    chunks,
  }, chunks)
  return { session: nextSession, chunks: chunks.map(cloneChunk) }
}
