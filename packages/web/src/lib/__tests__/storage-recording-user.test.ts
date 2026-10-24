import { StorageService } from '../storage'

const mockGetUser = jest.fn()
const mockUpload = jest.fn()
jest.mock('../supabase', () => ({ createClientSupabase: () => ({
  auth: { getUser: () => mockGetUser() },
  storage: { from: () => ({ upload: (...args: unknown[]) => mockUpload(...args) }) },
}) }))

beforeEach(() => {
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: 'current-user' } }, error: null })
  mockUpload.mockReset().mockResolvedValue({ data: { path: 'current-user/temp/session/0.webm' }, error: null })
})

it('refuses a recording upload when authoritative auth has changed since capture', async () => {
  const result = await new StorageService().uploadFile(new Blob(['abc'], { type: 'audio/webm' }), {
    expectedUserId: 'previous-user', folder: 'temp/session', fileName: '0.webm',
  })
  expect(result.success).toBe(false)
  expect(mockUpload).not.toHaveBeenCalled()
})

it('uploads the matching user recording with its explicit temporary object key', async () => {
  const result = await new StorageService().uploadFile(new Blob(['abc'], { type: 'audio/webm' }), {
    expectedUserId: 'current-user', bucket: 'audio-recordings', folder: 'temp/session', fileName: '0.webm',
  })
  expect(result).toMatchObject({ success: true, path: 'current-user/temp/session/0.webm' })
  expect(mockUpload).toHaveBeenCalledWith('current-user/temp/session/0.webm', expect.any(Blob), expect.objectContaining({ upsert: false }))
})
