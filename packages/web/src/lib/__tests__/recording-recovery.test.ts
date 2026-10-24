/** @jest-environment node */
import { webcrypto } from 'node:crypto'
import { listLocalRecordings, loadLocalRecording } from '../recording-recovery'
import { recorderDB, type RecorderSessionRecord, type RecorderChunkRecord } from '../recorder-db'

jest.mock('../recorder-db', () => ({ recorderDB: {
  getRecoverableSessions: jest.fn(), getSession: jest.fn(), getChunksBySession: jest.fn(),
} }))

const session: RecorderSessionRecord = {
  id: 'draft', projectId: 'project', userId: 'user', mimeType: 'audio/webm;codecs=opus',
  startedAt: '2026-10-14T00:00:00.000Z', state: 'interrupted', lastPersistedIndex: 1,
  cloudConfirmedAssetId: null, updatedAt: 1,
}
let chunks: RecorderChunkRecord[]
beforeEach(async () => {
  jest.resetAllMocks()
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto })
  chunks = await Promise.all(['first', 'last'].map(async (text, index) => {
    const blob = new Blob([text], { type: session.mimeType })
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    return { id: `draft-${index}`, sessionId: 'draft', index, blob, byteSize: blob.size,
      sha256: Buffer.from(digest).toString('hex'), persistedAt: session.startedAt,
      uploadStatus: index ? 'pending' : 'uploaded', timestamp: 1 } as RecorderChunkRecord
  }))
  jest.mocked(recorderDB.getSession).mockResolvedValue({ ...session })
  jest.mocked(recorderDB.getChunksBySession).mockImplementation(async () => chunks)
})

it('recovers ordered bytes including uploaded and pending copies without writing or confirming', async () => {
  chunks.reverse()
  const before = chunks.slice()
  const result = await loadLocalRecording('draft', 'project', 'user')
  expect(await result.blob.text()).toBe('firstlast')
  expect(result.blob.type).toBe(session.mimeType)
  expect(result.chunkCount).toBe(2)
  expect(chunks).toEqual(before)
  expect(result.session.state).toBe('interrupted')
})

it('does not read local data without both project and user identity', async () => {
  expect(await listLocalRecordings('project', '')).toEqual([])
  await expect(loadLocalRecording('draft', '', 'user')).rejects.toMatchObject({ code: 'unavailable' })
  expect(recorderDB.getSession).not.toHaveBeenCalled()
  expect(recorderDB.getRecoverableSessions).not.toHaveBeenCalled()
})

it('filters unexpected list rows and sorts the remaining scoped unconfirmed sessions', async () => {
  jest.mocked(recorderDB.getRecoverableSessions).mockResolvedValue([
    { ...session, id: 'older', updatedAt: 1 }, { ...session, id: 'newer', state: 'recording', updatedAt: 2 },
    { ...session, userId: 'someone-else' }, { ...session, projectId: 'elsewhere' },
    { ...session, state: 'confirmed' }, { ...session, cloudConfirmedAssetId: 'asset' },
  ])
  expect((await listLocalRecordings('project', 'user')).map(row => row.id)).toEqual(['newer', 'older'])
})

it.each([
  { userId: 'other' }, { projectId: 'other' }, { id: 'other' }, { state: 'confirmed' },
  { cloudConfirmedAssetId: 'asset' }, { mimeType: 'text/html' }, { state: 'unknown' },
])('rejects unavailable or invalid session metadata %j before reading chunks', async patch => {
  jest.mocked(recorderDB.getSession).mockResolvedValue({ ...session, ...patch } as RecorderSessionRecord)
  await expect(loadLocalRecording('draft', 'project', 'user')).rejects.toMatchObject({ code: 'unavailable' })
  expect(recorderDB.getChunksBySession).not.toHaveBeenCalled()
})

it('rejects a missing session', async () => {
  jest.mocked(recorderDB.getSession).mockResolvedValue(undefined)
  await expect(loadLocalRecording('draft', 'project', 'user')).rejects.toMatchObject({ code: 'unavailable' })
})

it('reports an empty draft without pretending it contains audio', async () => {
  chunks = []
  jest.mocked(recorderDB.getSession).mockResolvedValue({ ...session, lastPersistedIndex: -1 })
  await expect(loadLocalRecording('draft', 'project', 'user')).rejects.toMatchObject({ code: 'empty' })
})

it.each(['missing-first', 'missing-last', 'duplicate', 'cross-session', 'bad-size', 'empty-blob', 'bad-hash', 'missing-hash', 'changed-bytes'])('rejects %s while retaining all stored chunks', async scenario => {
  if (scenario === 'missing-first') chunks.shift()
  if (scenario === 'missing-last') chunks.pop()
  if (scenario === 'duplicate') chunks[1] = { ...chunks[0] }
  if (scenario === 'cross-session') chunks[0].sessionId = 'other'
  if (scenario === 'bad-size') chunks[0].byteSize += 1
  if (scenario === 'empty-blob') { chunks[0].blob = new Blob([]); chunks[0].byteSize = 0 }
  if (scenario === 'bad-hash') chunks[0].sha256 = '0'.repeat(64)
  if (scenario === 'missing-hash') chunks[0].sha256 = null
  if (scenario === 'changed-bytes') chunks[0].blob = new Blob(['other'])
  const before = chunks.slice()
  await expect(loadLocalRecording('draft', 'project', 'user')).rejects.toMatchObject({ code: 'damaged' })
  expect(chunks).toEqual(before)
})

it('refuses a draft changed by another tab during verification', async () => {
  jest.mocked(recorderDB.getSession).mockResolvedValueOnce({ ...session }).mockResolvedValue({ ...session, lastPersistedIndex: 2 })
  await expect(loadLocalRecording('draft', 'project', 'user')).rejects.toMatchObject({ code: 'changed' })
})

it('refuses a same-length chunk overwrite signaled by the session timestamp', async () => {
  jest.mocked(recorderDB.getSession)
    .mockResolvedValueOnce({ ...session, updatedAt: 10 })
    .mockResolvedValue({ ...session, updatedAt: 11 })
  await expect(loadLocalRecording('draft', 'project', 'user')).rejects.toMatchObject({ code: 'changed' })
})
