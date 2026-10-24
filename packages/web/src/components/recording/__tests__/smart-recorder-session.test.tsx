import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { SmartRecorder } from '../SmartRecorder'
import type { RecorderChunkRecord, RecorderSessionRecord } from '@/lib/recorder-db'

const mockSessions = new Map<string, RecorderSessionRecord>()
const mockChunks = new Map<string, RecorderChunkRecord>()
let mockUserId: string | null = 'user-1'
let mockSaveBarrier: Promise<void> | null = null
const mockUpload = jest.fn()
const mockSaveSession = jest.fn()
const mockSaveChunk = jest.fn()

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(
    (selector: (state: unknown) => unknown) => selector({ user: mockUserId ? { id: mockUserId } : null }),
    { getState: () => ({ user: mockUserId ? { id: mockUserId } : null }) },
  ),
}))
jest.mock('@/lib/storage', () => ({ storageService: { uploadFile: (...args: unknown[]) => mockUpload(...args) } }))
jest.mock('@/lib/recorder-db', () => ({ recorderDB: {
  saveSession: (...args: unknown[]) => mockSaveSession(...args),
  saveChunk: (...args: unknown[]) => mockSaveChunk(...args),
  getChunksBySession: async (id: string) => [...mockChunks.values()].filter(c => c.sessionId === id).sort((a, b) => a.index - b.index),
  markChunkUploaded: async (sessionId: string, index: number) => {
    const chunk = mockChunks.get(`${sessionId}-${index}`)
    if (!chunk) throw new Error('not persisted')
    const next = { ...chunk, uploadStatus: 'uploaded' as const }
    mockChunks.set(chunk.id, next)
    return next
  },
  updateSession: async (id: string, patch: Partial<RecorderSessionRecord>) => {
    const session = mockSessions.get(id)
    if (!session) throw new Error('missing session')
    const next = { ...session, ...patch }
    mockSessions.set(id, next)
    return next
  },
  deleteChunk: jest.fn(),
} }))
jest.mock('@/lib/agent-service', () => ({ agentService: { requestInterviewIntervention: jest.fn() } }))
jest.mock('@/hooks/use-silence-detection', () => ({ useSilenceDetection: () => ({ resetSilenceTimer: jest.fn() }) }))
jest.mock('@/components/audio/AudioPlayer', () => ({ AudioPlayer: () => <div>Playback</div> }))
jest.mock('react-hot-toast', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(r => { resolve = r })
  return { promise, resolve }
}
function blob(text = 'abc', type = 'audio/webm;codecs=opus'): Blob {
  return new NodeBlob([text], { type }) as unknown as Blob
}

class BrowserRecorder {
  static instances: BrowserRecorder[] = []
  static supports = (type: string) => type.startsWith('audio/webm')
  static actualType: string | null = null
  static isTypeSupported(type: string) { return this.supports(type) }
  state = 'inactive'
  mimeType: string
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  start = jest.fn(() => { this.state = 'recording' })
  stop = jest.fn(() => { this.state = 'inactive' })
  pause() { this.state = 'paused' }
  resume() { this.state = 'recording' }
  constructor(_stream: unknown, options: { mimeType: string }) {
    this.mimeType = BrowserRecorder.actualType ?? options.mimeType
    BrowserRecorder.instances.push(this)
  }
  emit(data: Blob) { this.ondataavailable?.({ data }) }
  finish() { this.state = 'inactive'; this.onstop?.() }
}

const originalRecorder = global.MediaRecorder
const originalBlob = global.Blob
const originalCrypto = global.crypto
const originalFetch = global.fetch
const originalCreateURL = URL.createObjectURL
const originalRevokeURL = URL.revokeObjectURL
const originalRecognition = window.SpeechRecognition
const originalWakeLock = Object.getOwnPropertyDescriptor(navigator, 'wakeLock')
const stopTrack = jest.fn()
const getUserMedia = jest.fn()

beforeEach(() => {
  mockSessions.clear(); mockChunks.clear(); mockUserId = 'user-1'; mockSaveBarrier = null
  BrowserRecorder.instances = []; BrowserRecorder.actualType = null
  BrowserRecorder.supports = type => type.startsWith('audio/webm')
  Object.defineProperty(global, 'MediaRecorder', { configurable: true, writable: true, value: BrowserRecorder })
  Object.defineProperty(global, 'Blob', { configurable: true, writable: true, value: NodeBlob })
  Object.defineProperty(global, 'crypto', { configurable: true, value: webcrypto })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] })
  stopTrack.mockClear()
  mockSaveSession.mockReset().mockImplementation(async (session: RecorderSessionRecord) => {
    mockSessions.set(session.id, { ...session }); return session
  })
  mockSaveChunk.mockReset().mockImplementation(async (sessionId: string, index: number, data: Blob, metadata: Partial<RecorderChunkRecord>) => {
    if (mockSaveBarrier) await mockSaveBarrier
    const record: RecorderChunkRecord = { id: `${sessionId}-${index}`, sessionId, index, blob: data,
      byteSize: data.size, sha256: null, persistedAt: new Date().toISOString(), uploadStatus: 'pending', timestamp: Date.now(), ...metadata }
    mockChunks.set(record.id, record)
    const session = mockSessions.get(sessionId)
    if (session) session.lastPersistedIndex = index
    return record
  })
  mockUpload.mockReset().mockResolvedValue({ success: true, path: 'user-1/temp/chunk' })
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
  URL.createObjectURL = jest.fn(() => 'blob:preview')
  URL.revokeObjectURL = jest.fn()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
  cleanup()
  await act(async () => { await Promise.resolve() })
  jest.restoreAllMocks()
  jest.useRealTimers()
  if (originalWakeLock) Object.defineProperty(navigator, 'wakeLock', originalWakeLock)
  else Reflect.deleteProperty(navigator, 'wakeLock')
  global.MediaRecorder = originalRecorder
  global.Blob = originalBlob
  Object.defineProperty(global, 'crypto', { configurable: true, value: originalCrypto })
  global.fetch = originalFetch
  URL.createObjectURL = originalCreateURL
  URL.revokeObjectURL = originalRevokeURL
  window.SpeechRecognition = originalRecognition
})

async function start() {
  fireEvent.click(screen.getByRole('button', { name: 'actions.start' }))
  await screen.findByRole('button', { name: 'actions.stop' })
  return BrowserRecorder.instances.at(-1)!
}

it('saves the login-bound session before capture, with the actual MP4 MIME', async () => {
  BrowserRecorder.supports = type => type === 'audio/mp4'
  BrowserRecorder.actualType = 'audio/mp4;codecs=mp4a.40.2'
  render(<SmartRecorder projectId="project-1" storytellerId="someone-else" onRecordingComplete={jest.fn()} />)
  const recorder = await start()
  const session = [...mockSessions.values()][0]
  expect(session).toMatchObject({ projectId: 'project-1', userId: 'user-1', mimeType: 'audio/mp4;codecs=mp4a.40.2', state: 'recording', cloudConfirmedAssetId: null })
  expect(mockSaveSession.mock.invocationCallOrder[0]).toBeLessThan(recorder.start.mock.invocationCallOrder[0])
  await act(async () => { recorder.emit(blob('abc', recorder.mimeType)) })
  await waitFor(() => expect([...mockChunks.values()][0]?.uploadStatus).toBe('uploaded'))
  expect(mockUpload).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ fileName: '0.m4a', allowedTypes: ['audio/mp4'] }))
})

it.each(['missing-user', 'unsupported'] as const)('refuses capture when %s', async reason => {
  if (reason === 'missing-user') mockUserId = null
  else BrowserRecorder.supports = () => false
  const onError = jest.fn()
  render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} onError={onError} />)
  fireEvent.click(screen.getByRole('button', { name: 'actions.start' }))
  await waitFor(() => expect(onError).toHaveBeenCalled())
  expect(getUserMedia).not.toHaveBeenCalled()
  expect(mockSessions.size).toBe(0)
})

it('waits for durable bytes before upload and retains the SHA-256 recovery copy after success', async () => {
  const saved = deferred(); mockSaveBarrier = saved.promise
  render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  const recorder = await start()
  await act(async () => { recorder.emit(blob()) })
  await waitFor(() => expect(mockSaveChunk).toHaveBeenCalled())
  expect(mockUpload).not.toHaveBeenCalled()
  await act(async () => { saved.resolve() })
  await waitFor(() => expect([...mockChunks.values()][0]?.uploadStatus).toBe('uploaded'))
  expect([...mockChunks.values()][0]).toMatchObject({ byteSize: 3, sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', index: 0 })
  expect(await [...mockChunks.values()][0].blob.text()).toBe('abc')
  expect([...mockSessions.values()][0].cloudConfirmedAssetId).toBeNull()
})

it('persists later chunks and finalizes locally while the network upload is stalled', async () => {
  const upload = deferred()
  mockUpload.mockImplementation(async () => { await upload.promise; return { success: true } })
  render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  const recorder = await start()
  await act(async () => { recorder.emit(blob('first')) })
  await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))
  await act(async () => { recorder.emit(blob('second')) })
  await waitFor(() => expect(mockChunks.size).toBe(2))
  fireEvent.click(screen.getByRole('button', { name: 'actions.stop' }))
  const saved = deferred(); mockSaveBarrier = saved.promise
  await act(async () => { recorder.emit(blob('last')); recorder.finish() })
  expect(screen.queryByRole('button', { name: 'actions.complete' })).not.toBeInTheDocument()
  await act(async () => { saved.resolve() })
  await screen.findByRole('button', { name: 'actions.complete' })
  expect(mockChunks.size).toBe(3)
  expect([...mockSessions.values()][0].state).toBe('interrupted')
  await act(async () => { upload.resolve() })
})

it('serializes reconnect uploads, skips uploaded chunks and keeps offline copies', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  const recorder = await start()
  await act(async () => { recorder.emit(blob()) })
  await waitFor(() => expect(mockChunks.size).toBe(1))
  expect(mockUpload).not.toHaveBeenCalled()
  const upload = deferred()
  mockUpload.mockImplementation(async () => { await upload.promise; return { success: true } })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  act(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('online')) })
  await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))
  await act(async () => { upload.resolve() })
  await waitFor(() => expect([...mockChunks.values()][0]?.uploadStatus).toBe('uploaded'))
  await act(async () => { window.dispatchEvent(new Event('online')) })
  expect(mockUpload).toHaveBeenCalledTimes(1)
  expect(mockChunks.size).toBe(1)
})

it('keeps failed uploads pending and retries on reconnect', async () => {
  mockUpload.mockResolvedValueOnce({ success: false, error: 'offline' })
  render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  const recorder = await start()
  await act(async () => { recorder.emit(blob()) })
  await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))
  expect([...mockChunks.values()][0]?.uploadStatus).toBe('pending')
  await act(async () => { window.dispatchEvent(new Event('online')) })
  await waitFor(() => expect([...mockChunks.values()][0]?.uploadStatus).toBe('uploaded'))
})

it('stops the microphone and preserves the final chunk when unmounted', async () => {
  const complete = jest.fn()
  const view = render(<SmartRecorder projectId="project-1" onRecordingComplete={complete} />)
  const recorder = await start()
  view.unmount()
  expect(recorder.stop).toHaveBeenCalledTimes(1)
  expect(stopTrack).toHaveBeenCalled()
  await act(async () => { recorder.emit(blob()); recorder.finish() })
  await waitFor(() => expect(mockChunks.size).toBe(1))
  await waitFor(() => expect([...mockSessions.values()][0].state).toBe('interrupted'))
  expect(complete).not.toHaveBeenCalled()
})

it('cancels an in-flight microphone request after unmount', async () => {
  const permission = deferred()
  getUserMedia.mockImplementation(async () => { await permission.promise; return { getTracks: () => [{ stop: stopTrack }] } })
  const view = render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'actions.start' }))
  await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
  view.unmount()
  await act(async () => { permission.resolve() })
  expect(stopTrack).toHaveBeenCalled()
  expect(BrowserRecorder.instances).toHaveLength(0)
})

it('releases an open microphone immediately when unmounted during session persistence', async () => {
  const save = deferred()
  mockSaveSession.mockImplementation(async (session: RecorderSessionRecord) => {
    await save.promise
    mockSessions.set(session.id, session)
    return session
  })
  const view = render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'actions.start' }))
  await waitFor(() => expect(mockSaveSession).toHaveBeenCalled())
  view.unmount()
  const stoppedBeforeSave = stopTrack.mock.calls.length
  await act(async () => { save.resolve() })
  expect(stoppedBeforeSave).toBeGreaterThan(0)
  expect(BrowserRecorder.instances[0].start).not.toHaveBeenCalled()
  expect([...mockSessions.values()][0].state).toBe('interrupted')
})

it('reports persistence failure without uploading or offering successful completion', async () => {
  mockSaveChunk.mockRejectedValue(new Error('quota exceeded'))
  const onError = jest.fn()
  render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} onError={onError} />)
  const recorder = await start()
  await act(async () => { recorder.emit(blob()) })
  await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringMatching(/quota/i)))
  await act(async () => { recorder.finish() })
  expect(mockUpload).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'actions.complete' })).not.toBeInTheDocument()
})

it('releases the device when initial session persistence fails', async () => {
  mockSaveSession.mockRejectedValue(new Error('IndexedDB unavailable'))
  const onError = jest.fn()
  render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} onError={onError} />)
  fireEvent.click(screen.getByRole('button', { name: 'actions.start' }))
  await waitFor(() => expect(onError).toHaveBeenCalledWith('IndexedDB unavailable'))
  expect(stopTrack).toHaveBeenCalled()
  expect(BrowserRecorder.instances[0].start).not.toHaveBeenCalled()
})

it('isolates late final events from a previous recording after re-record', async () => {
  const complete = jest.fn()
  render(<SmartRecorder projectId="project-1" onRecordingComplete={complete} />)
  const first = await start()
  await act(async () => { first.emit(blob('old audio')); first.finish() })
  fireEvent.click(await screen.findByRole('button', { name: 'actions.reRecord' }))
  const second = await start()
  await act(async () => { first.emit(blob('late old audio')); first.finish(); second.emit(blob('new')); second.finish() })
  fireEvent.click(await screen.findByRole('button', { name: 'actions.complete' }))
  expect(complete).toHaveBeenCalledWith(expect.objectContaining({ audioBlob: expect.objectContaining({ size: 3 }) }))
  expect(await complete.mock.calls[0][0].audioBlob.text()).toBe('new')
  expect(new Set([...mockChunks.values()].map(chunk => chunk.sessionId)).size).toBe(2)
})

it('interrupts on page exit and keeps browser errors from reporting success', async () => {
  const onError = jest.fn()
  render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} onError={onError} />)
  const recorder = await start()
  await act(async () => { recorder.emit(blob()); recorder.onerror?.() })
  await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringMatching(/interrupted/i)))
  await act(async () => { recorder.finish(); window.dispatchEvent(new Event('pagehide')) })
  await waitFor(() => expect([...mockSessions.values()][0].state).toBe('interrupted'))
  expect(screen.queryByRole('button', { name: 'actions.complete' })).not.toBeInTheDocument()
})

it('blocks old-session uploads after the login identity changes', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  const view = render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  const recorder = await start()
  await act(async () => { recorder.emit(blob()) })
  await waitFor(() => expect(mockChunks.size).toBe(1))
  mockUserId = 'user-2'
  view.rerender(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  await act(async () => { recorder.finish(); window.dispatchEvent(new Event('online')) })
  expect(mockUpload).not.toHaveBeenCalled()
  expect([...mockChunks.values()][0].uploadStatus).toBe('pending')
  expect(recorder.stop).toHaveBeenCalledTimes(1)
})

it('persists the last data event after pagehide without offering a completed recording', async () => {
  render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  const recorder = await start()
  act(() => { window.dispatchEvent(new Event('pagehide')) })
  await act(async () => { recorder.emit(blob('tail')); recorder.finish() })
  await waitFor(() => expect(mockChunks.size).toBe(1))
  await waitFor(() => expect([...mockSessions.values()][0].state).toBe('interrupted'))
  expect(recorder.stop).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'actions.complete' })).not.toBeInTheDocument()
})

it('keeps audio capture running when live transcription loses its network', async () => {
  let recognition!: { onerror?: (event: { error: string }) => void }
  Object.defineProperty(window, 'SpeechRecognition', { configurable: true, writable: true, value: class {
    start() {}
    stop() {}
    constructor() { recognition = this }
  } })
  render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  const recorder = await start()
  act(() => { recognition.onerror?.({ error: 'network' }) })
  expect(recorder.stop).not.toHaveBeenCalled()
  expect(BrowserRecorder.instances).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'actions.stop' })).toBeInTheDocument()
})

it('clears the prior transcript when the project binding changes', async () => {
  let recognition!: { onresult?: (event: unknown) => void }
  Object.defineProperty(window, 'SpeechRecognition', { configurable: true, writable: true, value: class {
    start() {}
    stop() {}
    constructor() { recognition = this }
  } })
  const view = render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  await start()
  act(() => { recognition.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'Private words' }], { isFinal: true })] }) })
  expect(screen.getByText('Private words')).toBeInTheDocument()
  view.rerender(<SmartRecorder projectId="project-2" onRecordingComplete={jest.fn()} />)
  expect(screen.queryByText('Private words')).not.toBeInTheDocument()
})

it('counts active time across pauses and stops at the total recording limit', async () => {
  jest.useFakeTimers()
  render(<SmartRecorder projectId="project-1" maxDuration={5} onRecordingComplete={jest.fn()} />)
  const recorder = await start()
  act(() => { jest.advanceTimersByTime(2000) })
  fireEvent.click(screen.getByRole('button', { name: 'actions.pause' }))
  act(() => { jest.advanceTimersByTime(10000) })
  expect(recorder.stop).not.toHaveBeenCalled()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'actions.continue' })) })
  act(() => { jest.advanceTimersByTime(3000) })
  expect(recorder.stop).toHaveBeenCalledTimes(1)
  expect(screen.getByText('00:05')).toBeInTheDocument()
})

it('does not revive a cancelled capture when a delayed resume resolves after project change', async () => {
  const resumeLock = deferred()
  const lock = { release: jest.fn(async () => {}), addEventListener: jest.fn() }
  const request = jest.fn().mockResolvedValueOnce(lock).mockImplementation(async () => {
    await resumeLock.promise
    return lock
  })
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
  const view = render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  const recorder = await start()
  fireEvent.click(screen.getByRole('button', { name: 'actions.pause' }))
  fireEvent.click(screen.getByRole('button', { name: 'actions.continue' }))
  expect(request).toHaveBeenCalledTimes(2)
  view.rerender(<SmartRecorder projectId="project-2" onRecordingComplete={jest.fn()} />)
  await act(async () => { resumeLock.resolve() })
  expect(recorder.state).toBe('inactive')
  expect(screen.getByRole('button', { name: 'actions.start' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'actions.stop' })).not.toBeInTheDocument()
})

it('releases the current wake lock even when the previous release finishes after resuming', async () => {
  const oldRelease = deferred()
  const firstLock = { release: jest.fn(() => oldRelease.promise), addEventListener: jest.fn() }
  const nextLock = { release: jest.fn(async () => {}), addEventListener: jest.fn() }
  const request = jest.fn().mockResolvedValueOnce(firstLock).mockResolvedValueOnce(nextLock)
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
  const view = render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  await start()
  fireEvent.click(screen.getByRole('button', { name: 'actions.pause' }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'actions.continue' })) })
  await act(async () => { oldRelease.resolve() })
  view.unmount()
  expect(nextLock.release).toHaveBeenCalledTimes(1)
})

it('does not request or strand duplicate wake locks on repeated visibility changes', async () => {
  const lock = { release: jest.fn(async () => {}), addEventListener: jest.fn() }
  const request = jest.fn().mockResolvedValue(lock)
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
  const view = render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  await start()
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
  view.unmount()
  expect(lock.release).toHaveBeenCalledTimes(1)
})

it('releases a wake lock that resolves after initial capture cancellation', async () => {
  const requestLock = deferred()
  const lock = { release: jest.fn(async () => {}), addEventListener: jest.fn() }
  const request = jest.fn(async () => { await requestLock.promise; return lock })
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
  const view = render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'actions.start' }))
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
  view.unmount()
  await act(async () => { requestLock.resolve() })
  expect(lock.release).toHaveBeenCalledTimes(1)
  expect(BrowserRecorder.instances).toHaveLength(0)
})

it('reacquires after the browser releases the active wake lock', async () => {
  let releaseListener!: () => void
  const firstLock = { release: jest.fn(async () => {}), addEventListener: jest.fn((_name: string, listener: () => void) => { releaseListener = listener }) }
  const nextLock = { release: jest.fn(async () => {}), addEventListener: jest.fn() }
  const request = jest.fn().mockResolvedValueOnce(firstLock).mockResolvedValueOnce(nextLock)
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
  const view = render(<SmartRecorder projectId="project-1" onRecordingComplete={jest.fn()} />)
  await start()
  act(() => { releaseListener() })
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  view.unmount()
  expect(nextLock.release).toHaveBeenCalledTimes(1)
})
