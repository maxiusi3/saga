import { recordingChunkLocation } from '../recording-chunk-location'
import { StorageService } from '../storage'

const mockUpload = jest.fn().mockResolvedValue({ data: { path: 'user-1/projects/project-1/sessions/session-1/0' }, error: null })
jest.mock('../supabase', () => ({ createClientSupabase: () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
  storage: { from: () => ({ upload: (...args: unknown[]) => mockUpload(...args) }) },
}) }))

const input = { userId: 'user-1', projectId: 'project-1', sessionId: 'session-1', index: 0 }

it('maps the existing logical merge key to the exact owner-prefixed Storage upload key', () => {
  expect(recordingChunkLocation(input)).toEqual({
    folder: 'projects/project-1/sessions/session-1', fileName: '0',
    objectKey: 'projects/project-1/sessions/session-1/0',
    storageObjectKey: 'user-1/projects/project-1/sessions/session-1/0',
  })
})

it.each(['userId', 'projectId', 'sessionId'] as const)('rejects unsafe or unbounded %s', key => {
  for (const value of ['', '../other', 'a/b', '%2f', ' a', 'a?b', 'a#b', 'a'.repeat(129)]) {
    expect(() => recordingChunkLocation({ ...input, [key]: value })).toThrow()
  }
})

it.each([-1, 0.1, NaN, Infinity, 2000])('rejects invalid chunk index %s', index => {
  expect(() => recordingChunkLocation({ ...input, index })).toThrow()
})

it('has an explicit one-to-one owner, project, capture and index binding', () => {
  const locations = [input, { ...input, userId: 'other' }, { ...input, projectId: 'other' },
    { ...input, sessionId: 'other' }, { ...input, index: 1 }].map(value => recordingChunkLocation(value).storageObjectKey)
  expect(new Set(locations).size).toBe(5)
})

it('matches the actual StorageService non-overwriting upload path, not only helper strings', async () => {
  const location = recordingChunkLocation(input)
  const blob = new Blob(['synthetic'], { type: 'audio/webm' })
  const result = await new StorageService().uploadFile(blob, { bucket: 'audio-recordings',
    expectedUserId: input.userId, folder: location.folder, fileName: location.fileName })
  expect(mockUpload).toHaveBeenCalledWith(location.storageObjectKey, blob, { cacheControl: '3600', upsert: false })
  expect(result).toMatchObject({ success: true, path: location.storageObjectKey })
})
