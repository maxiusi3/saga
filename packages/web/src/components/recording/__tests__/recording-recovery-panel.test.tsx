import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RecordingRecoveryPanel } from '../RecordingRecoveryPanel'
import { listLocalRecordings, loadLocalRecording, RecordingRecoveryError } from '@/lib/recording-recovery'
import type { RecorderSessionRecord } from '@/lib/recorder-db'

jest.mock('@/lib/recording-recovery', () => ({
  ...jest.requireActual('@/lib/recording-recovery'), listLocalRecordings: jest.fn(), loadLocalRecording: jest.fn(),
}))
const draft: RecorderSessionRecord = { id: 'draft-1', projectId: 'project', userId: 'user',
  mimeType: 'audio/webm', startedAt: '2026-10-14T00:00:00.000Z', state: 'interrupted',
  lastPersistedIndex: 0, cloudConfirmedAssetId: null, updatedAt: 1 }
const recovered = { session: draft, blob: new Blob(['audio'], { type: draft.mimeType }), chunkCount: 1 }
const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL
beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(listLocalRecordings).mockResolvedValue([draft])
  jest.mocked(loadLocalRecording).mockResolvedValue(recovered)
  URL.createObjectURL = jest.fn(() => 'blob:local-draft')
  URL.revokeObjectURL = jest.fn()
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})
afterEach(() => { cleanup(); jest.restoreAllMocks(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke })
const mount = () => render(<RecordingRecoveryPanel projectId="project" userId="user" />)
async function openDraft() { fireEvent.click(await screen.findByRole('button', { name: /open/ })) }

it('loads only for a signed-in user and the current project', async () => {
  const view = render(<RecordingRecoveryPanel projectId="project" />)
  expect(listLocalRecordings).not.toHaveBeenCalled()
  view.rerender(<RecordingRecoveryPanel projectId="project" userId="user" />)
  await screen.findByRole('button', { name: /open/ })
  expect(listLocalRecordings).toHaveBeenCalledWith('project', 'user')
})

it('opens a local audio preview and download without handing off to cloud save', async () => {
  const view = mount()
  await openDraft()
  const link = await screen.findByRole('link', { name: 'download' })
  expect(loadLocalRecording).toHaveBeenCalledWith('draft-1', 'project', 'user')
  expect(link).toHaveAttribute('href', 'blob:local-draft')
  expect(link).toHaveAttribute('download', 'saga-local-recording.webm')
  expect(view.container.querySelector('audio')).toHaveAttribute('controls')
  expect(view.container.querySelector('audio')).not.toHaveAttribute('autoplay')
  expect(screen.getByText('notice')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'close' }))
  expect(view.container.querySelector('audio')).toBeNull()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-draft')
})

it('keeps download available after native playback failure', async () => {
  const view = mount()
  await openDraft()
  await screen.findByRole('link', { name: 'download' })
  fireEvent.error(view.container.querySelector('audio')!)
  expect(screen.getByRole('alert')).toHaveTextContent('playbackError')
  expect(screen.getByRole('link', { name: 'download' })).toHaveAttribute('href', 'blob:local-draft')
})

it('reports local read failure and supports retry', async () => {
  jest.mocked(listLocalRecordings).mockRejectedValueOnce(new Error('storage unavailable'))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('listError')
  fireEvent.click(screen.getByRole('button', { name: 'retry' }))
  await screen.findByRole('button', { name: /open/ })
  expect(listLocalRecordings).toHaveBeenCalledTimes(2)
})

it.each(['empty', 'damaged', 'changed', 'unavailable'] as const)('keeps the %s draft listed and explains failed recovery', async code => {
  jest.mocked(loadLocalRecording).mockRejectedValue(new RecordingRecoveryError(code))
  mount()
  await openDraft()
  expect(await screen.findByRole('alert')).toHaveTextContent(`errors.${code}`)
  expect(screen.queryByRole('link', { name: 'download' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /open/ })).toBeEnabled()
})

it('ignores a selected draft resolving after project or account switch', async () => {
  let resolve!: (value: typeof recovered) => void
  jest.mocked(loadLocalRecording).mockReturnValue(new Promise(r => { resolve = r }))
  const view = mount()
  await openDraft()
  jest.mocked(listLocalRecordings).mockResolvedValue([])
  view.rerender(<RecordingRecoveryPanel projectId="other-project" userId="other-user" />)
  await act(async () => { resolve(recovered) })
  expect(URL.createObjectURL).not.toHaveBeenCalled()
  expect(view.container.querySelector('audio')).toBeNull()
})

it('removes the preview and revokes its URL immediately on sign out', async () => {
  const view = mount()
  await openDraft()
  await screen.findByRole('link', { name: 'download' })
  view.rerender(<RecordingRecoveryPanel projectId="project" />)
  expect(view.container.querySelector('audio')).toBeNull()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-draft')
})

it('ignores old list results after switching scope', async () => {
  let resolve!: (value: RecorderSessionRecord[]) => void
  jest.mocked(listLocalRecordings).mockReturnValueOnce(new Promise(r => { resolve = r })).mockResolvedValue([])
  const view = mount()
  view.rerender(<RecordingRecoveryPanel projectId="other" userId="user" />)
  await act(async () => { resolve([draft]) })
  expect(screen.queryByRole('button', { name: /open/ })).not.toBeInTheDocument()
})

it('releases the preview on unmount', async () => {
  const view = mount()
  await openDraft()
  await screen.findByRole('link', { name: 'download' })
  view.unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-draft')
})

it('uses only the latest selection when reads finish out of order', async () => {
  let resolve!: (value: typeof recovered) => void
  jest.mocked(listLocalRecordings).mockResolvedValue([draft, { ...draft, id: 'draft-2' }])
  jest.mocked(loadLocalRecording).mockReturnValueOnce(new Promise(r => { resolve = r })).mockResolvedValue({ ...recovered, session: { ...draft, id: 'draft-2' } })
  mount()
  const buttons = await screen.findAllByRole('button', { name: /open/ })
  fireEvent.click(buttons[0]); fireEvent.click(buttons[1])
  await screen.findByRole('link', { name: 'download' })
  await act(async () => { resolve(recovered) })
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1))
})
