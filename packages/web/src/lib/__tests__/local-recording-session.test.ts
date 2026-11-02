/** @jest-environment node */
import { webcrypto } from 'node:crypto'
import { createLocalRecordingSession } from '../local-recording-session'

const mockSave = jest.fn()
const mockChunks = jest.fn()
const mockMark = jest.fn()
const mockUpload = jest.fn()
jest.mock('../recorder-db', () => ({ recorderDB: {
  saveSession: (...args: unknown[]) => mockSave(...args),
  getChunksBySession: (...args: unknown[]) => mockChunks(...args),
  markChunkUploaded: (...args: unknown[]) => mockMark(...args),
} }))
jest.mock('../storage', () => ({ storageService: { uploadFile: (...args: unknown[]) => mockUpload(...args) } }))
jest.mock('@/stores/auth-store', () => ({ useAuthStore: { getState: () => ({ user: { id: 'user-1' } }) } }))

const input = { id: 'session-1', userId: 'user-1', projectId: 'project-1', mimeType: 'audio/webm;codecs=opus', startedAt: '2026-11-02T00:00:00Z' }
const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto })
  mockUpload.mockResolvedValue({ success: true })
})
afterAll(() => {
  if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor)
  else Reflect.deleteProperty(globalThis, 'navigator')
  if (cryptoDescriptor) Object.defineProperty(globalThis, 'crypto', cryptoDescriptor)
  else Reflect.deleteProperty(globalThis, 'crypto')
})

it.each(['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'])('uploads %s without a temp directory or container suffix', async mimeType => {
  const blob = new Blob(['synthetic'], { type: mimeType })
  mockChunks.mockResolvedValue([{ index: 0, blob, uploadStatus: 'pending' }])
  const session = await createLocalRecordingSession({ ...input, mimeType })
  await session.sync()
  expect(mockUpload).toHaveBeenCalledWith(blob, {
    bucket: 'audio-recordings', folder: 'projects/project-1/sessions/session-1', fileName: '0',
    allowedTypes: [mimeType.split(';')[0]], expectedUserId: 'user-1',
  })
  expect(mockMark).toHaveBeenCalledWith('session-1', 0)
})

it('retains historical uploaded flags without silently moving or reuploading old objects', async () => {
  mockChunks.mockResolvedValue([{ index: 0, blob: new Blob(['old']), uploadStatus: 'uploaded' }])
  await (await createLocalRecordingSession(input)).sync()
  expect(mockUpload).not.toHaveBeenCalled()
  expect(mockMark).not.toHaveBeenCalled()
})

it('leaves a failed canonical upload pending', async () => {
  mockChunks.mockResolvedValue([{ index: 0, blob: new Blob(['new']), uploadStatus: 'pending' }])
  mockUpload.mockResolvedValue({ success: false })
  await (await createLocalRecordingSession(input)).sync()
  expect(mockMark).not.toHaveBeenCalled()
})
