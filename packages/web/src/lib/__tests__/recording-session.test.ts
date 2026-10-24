import {
  addRecordingChunk,
  confirmRecordingSession,
  createRecordingSession,
  markChunkUploaded,
  markRecordingInterrupted,
  selectRecordingMimeType,
  resumeRecordingSession,
} from '@/lib/recording-session'

const startedAt = '2026-10-14T13:00:00.000Z'

function session() {
  return createRecordingSession({
    id: 'session-1', projectId: 'project-1', userId: 'user-1', mimeType: 'audio/webm;codecs=opus', startedAt,
  })
}

describe('recording session contract', () => {
  it('selects the first supported preferred MIME type and fails closed when none is supported', () => {
    const original = global.MediaRecorder
    Object.defineProperty(global, 'MediaRecorder', { configurable: true, writable: true, value: {
      isTypeSupported: (mime: string) => ['audio/mp4', 'audio/webm;codecs=opus'].includes(mime),
    } })
    try {
      expect(selectRecordingMimeType(['audio/mp4', 'audio/webm;codecs=opus'])).toBe('audio/webm;codecs=opus')
      expect(selectRecordingMimeType(['audio/ogg'])).toBeNull()
    } finally { global.MediaRecorder = original }
  })

  it('does not invent supported formats when MediaRecorder is unavailable', () => {
    expect(selectRecordingMimeType(['audio/webm', 'audio/mp4'])).toBeNull()
  })

  it('creates a project and user bound session with an empty recovery list', () => {
    expect(session()).toMatchObject({
      id: 'session-1', projectId: 'project-1', userId: 'user-1', mimeType: 'audio/webm;codecs=opus',
      state: 'recording', lastPersistedIndex: -1, cloudConfirmedAssetId: null,
    })
  })

  it('persists chunks before upload and keeps numeric ordering', () => {
    const first = addRecordingChunk(session(), {
      sessionId: 'session-1', index: 1, byteSize: 20, sha256: 'b'.repeat(64), persistedAt: startedAt,
    })
    const second = addRecordingChunk(first.session, {
      sessionId: 'session-1', index: 0, byteSize: 10, sha256: 'a'.repeat(64), persistedAt: startedAt,
    })
    expect(second.session.lastPersistedIndex).toBe(1)
    expect(second.chunks.map(chunk => chunk.index)).toEqual([0, 1])
    expect(second.chunks.every(chunk => chunk.uploadStatus === 'pending')).toBe(true)
    expect(() => markChunkUploaded(second, 0)).toThrow('persisted')
  })

  it('rejects duplicate, cross-session, empty, or invalid chunks', () => {
    const first = addRecordingChunk(session(), {
      sessionId: 'session-1', index: 0, byteSize: 10, sha256: 'a'.repeat(64), persistedAt: startedAt,
    })
    expect(() => addRecordingChunk(first.session, { ...first.chunks[0] })).toThrow('duplicate')
    expect(() => addRecordingChunk(first.session, { ...first.chunks[0], sessionId: 'session-2', index: 1 })).toThrow('session')
    expect(() => addRecordingChunk(first.session, { ...first.chunks[0], index: -1 })).toThrow('index')
    expect(() => addRecordingChunk(first.session, { ...first.chunks[0], byteSize: 0 })).toThrow('byte')
    expect(() => addRecordingChunk(first.session, { ...first.chunks[0], sha256: 'bad' })).toThrow('sha256')
  })

  it('marks only persisted chunks uploaded and keeps the original input immutable', () => {
    const added = addRecordingChunk(session(), {
      sessionId: 'session-1', index: 0, byteSize: 10, sha256: 'a'.repeat(64), persistedAt: startedAt,
    })
    const before = JSON.parse(JSON.stringify(added))
    const uploaded = markChunkUploaded(added, 0)
    expect(uploaded.chunks[0].uploadStatus).toBe('uploaded')
    expect(added).toEqual(before)
    expect(() => markChunkUploaded(uploaded, 1)).toThrow('chunk')
  })

  it('allows interruption and exact-project/user resume without losing chunks', () => {
    const added = addRecordingChunk(session(), {
      sessionId: 'session-1', index: 0, byteSize: 10, sha256: 'a'.repeat(64), persistedAt: startedAt,
    })
    const interrupted = markRecordingInterrupted(added.session)
    expect(interrupted.state).toBe('interrupted')
    expect(resumeRecordingSession({ session: interrupted, chunks: added.chunks }, 'project-1', 'user-1').state).toBe('recording')
    expect(() => resumeRecordingSession({ session: interrupted, chunks: added.chunks }, 'project-2', 'user-1')).toThrow('project')
    expect(() => resumeRecordingSession({ session: interrupted, chunks: added.chunks }, 'project-1', 'user-2')).toThrow('user')
  })

  it('confirms only contiguous complete uploaded chunks and preserves the recovery copy', () => {
    let current = addRecordingChunk(session(), { sessionId: 'session-1', index: 0, byteSize: 10, sha256: 'a'.repeat(64), persistedAt: startedAt })
    current = addRecordingChunk(current.session, { sessionId: 'session-1', index: 1, byteSize: 20, sha256: 'b'.repeat(64), persistedAt: startedAt })
    expect(() => confirmRecordingSession(current, 'asset-1')).toThrow('uploaded')
    current = markChunkUploaded(current, 0)
    current = markChunkUploaded(current, 1)
    const confirmed = confirmRecordingSession(current, 'asset-1')
    expect(confirmed.session).toMatchObject({ state: 'confirmed', cloudConfirmedAssetId: 'asset-1' })
    expect(confirmed.chunks).toHaveLength(2)
    const gap = { ...current, chunks: [current.chunks[1]] }
    expect(() => confirmRecordingSession(gap, 'asset-2')).toThrow('contiguous')
  })
})
