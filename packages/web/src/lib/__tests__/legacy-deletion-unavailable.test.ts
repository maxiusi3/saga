import { StoryService } from '../stories'
import { StorageService, deleteFile } from '../storage'

let mockRows: Array<{ id: string; audio_url?: string }>
const mockQuery = jest.fn()
const mockBucket = jest.fn()
const mockRemove = jest.fn()

jest.mock('../supabase', () => ({
  createClientSupabase: () => ({
    from: (...args: unknown[]) => mockQuery(...args),
    storage: { from: (...args: unknown[]) => mockBucket(...args) },
  }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockRows = [{ id: 'story-a', audio_url: 'alice/projects/family-a/stories/story-a/audio.webm' }]
  mockBucket.mockReturnValue({ remove: mockRemove })
  // The old implementation ignored this failure and still removed the story row.
  mockRemove.mockResolvedValue({ data: null, error: { message: 'Storage deletion failed' } })
  mockQuery.mockImplementation(() => {
    let deleting = false
    let storyId = ''
    const query = {
      select: () => query,
      delete: () => { deleting = true; return query },
      eq: (_field: string, value: string) => {
        storyId = value
        if (deleting) {
          mockRows = mockRows.filter(row => row.id !== value)
          return Promise.resolve({ error: null })
        }
        return query
      },
      single: async () => ({ data: mockRows.find(row => row.id === storyId), error: null }),
    }
    return query
  })
})

it.each([true, false])('retains a story with audio=%s without any query or Storage request', async withAudio => {
  if (!withAudio) delete mockRows[0].audio_url
  const before = mockRows.map(row => ({ ...row }))

  const result = await new StoryService().deleteStory('story-a')

  expect(result).toBe(false)
  expect(mockRows).toEqual(before)
  expect(mockQuery).not.toHaveBeenCalled()
  expect(mockBucket).not.toHaveBeenCalled()
  expect(mockRemove).not.toHaveBeenCalled()
})

it.each([undefined, 'audio-recordings'])('refuses deletion from bucket %s without any Storage request', async bucket => {
  mockRemove.mockResolvedValue({ data: [], error: null })

  expect(await new StorageService().deleteFile('alice/projects/family-a/audio.webm', bucket)).toBe(false)

  expect(mockQuery).not.toHaveBeenCalled()
  expect(mockBucket).not.toHaveBeenCalled()
  expect(mockRemove).not.toHaveBeenCalled()
})

it('keeps the exported storage delete helper closed', async () => {
  mockRemove.mockResolvedValue({ data: [], error: null })
  expect(await deleteFile('alice/images/photo.png')).toBe(false)
  expect(mockBucket).not.toHaveBeenCalled()
  expect(mockRemove).not.toHaveBeenCalled()
})
