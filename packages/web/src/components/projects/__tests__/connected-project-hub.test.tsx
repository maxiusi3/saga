import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConnectedProjectHub } from '../ConnectedProjectHub'
import { searchProjectArchive, getCitationAudioUrl, downloadProjectArchive, importProjectAudio } from '@/lib/project-hub-client'

jest.mock('@/lib/project-hub-client', () => ({
  searchProjectArchive: jest.fn(), getCitationAudioUrl: jest.fn(),
  downloadProjectArchive: jest.fn(), importProjectAudio: jest.fn(),
}))

const props = { projectId: 'project-123', projectName: 'Family', userId: 'user-123', locale: 'zh-TW', canUpload: true, canRecord: true, canInvite: true }
const source = { entryId: 'entry-1', storyId: 'story-1', storyTitle: 'Boat', transcriptVersionId: 'tv-1', mediaAssetId: 'asset-123', segmentId: 'segment-1', startMs: 2000, endMs: 4500, quotedText: 'A boat', matchedPeople: [], matchedDates: [], matchedPlaces: [], score: 1 }
let play: jest.SpyInstance
let pause: jest.SpyInstance

beforeEach(() => {
  jest.resetAllMocks()
  play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  URL.createObjectURL = jest.fn(() => 'blob:synthetic-download')
  URL.revokeObjectURL = jest.fn()
})
afterEach(() => { jest.restoreAllMocks() })

it('offers existing locale-aware record and invite pages with role gates', () => {
  const { rerender } = render(<ConnectedProjectHub {...props} />)
  fireEvent.click(screen.getByTestId('entry-record-or-invite-btn'))
  expect(screen.getByRole('link', { name: 'Record a new story' })).toHaveAttribute('href', '/zh-TW/dashboard/projects/project-123/record')
  expect(screen.getByRole('link', { name: 'Manage family invitations' })).toHaveAttribute('href', '/zh-TW/dashboard/projects/project-123/invitations')
  rerender(<ConnectedProjectHub {...props} canInvite={false} />)
  expect(screen.queryByRole('link', { name: 'Manage family invitations' })).not.toBeInTheDocument()
})

it('shows verifying rather than saved after an audio upload, and retains the selected file', async () => {
  jest.mocked(importProjectAudio).mockResolvedValue({ id: 'asset-123', state: 'verifying' })
  render(<ConnectedProjectHub {...props} />)
  const file = new File(['audio'], 'family.webm', { type: 'audio/webm' })
  fireEvent.change(screen.getByLabelText('Select existing audio'), { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: 'Upload selected audio' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Uploaded; audio verification is still pending. Keep your original file.'))
  expect(importProjectAudio).toHaveBeenCalledWith('project-123', file, expect.any(String), expect.any(AbortSignal))
  expect(screen.getByText('family.webm')).toBeInTheDocument()
})

it('reuses the selected-file idempotency key on an explicit retry', async () => {
  jest.mocked(importProjectAudio).mockRejectedValueOnce(new Error('private details')).mockResolvedValueOnce({ id: 'asset-123', state: 'verifying' })
  render(<ConnectedProjectHub {...props} />)
  fireEvent.change(screen.getByLabelText('Select existing audio'), { target: { files: [new File(['audio'], 'family.webm', { type: 'audio/webm' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Upload selected audio' }))
  await screen.findByText('Upload was not confirmed. Your file is kept; you can retry.')
  fireEvent.click(screen.getByRole('button', { name: 'Upload selected audio' }))
  await waitFor(() => expect(importProjectAudio).toHaveBeenCalledTimes(2))
  expect(jest.mocked(importProjectAudio).mock.calls[0][2]).toBe(jest.mocked(importProjectAudio).mock.calls[1][2])
  expect(screen.queryByText('private details')).not.toBeInTheDocument()
})

it('exchanges the cited asset ID for audio, seeks after metadata and stops at the range end', async () => {
  jest.mocked(searchProjectArchive).mockResolvedValue({ status: 'grounded_answer', answerText: 'One source', citations: [source] })
  jest.mocked(getCitationAudioUrl).mockResolvedValue('https://storage.example/signed')
  render(<ConnectedProjectHub {...props} />)
  fireEvent.click(screen.getByTestId('provenance-search-submit-btn'))
  fireEvent.click(await screen.findByTestId('seek-citation-segment-1'))
  const audio = await screen.findByLabelText('Cited original audio') as HTMLAudioElement
  Object.defineProperty(audio, 'duration', { configurable: true, value: 10 })
  fireEvent.loadedMetadata(audio)
  expect(getCitationAudioUrl).toHaveBeenCalledWith('asset-123', expect.any(AbortSignal))
  expect(audio.currentTime).toBe(2)
  expect(play).toHaveBeenCalled()
  audio.currentTime = 4.6
  fireEvent.timeUpdate(audio)
  expect(pause).toHaveBeenCalled()
})

it('drops pending search results when project or signed-in user changes', async () => {
  let resolve!: (value: { status: 'grounded_answer'; answerText: string; citations: typeof source[] }) => void
  jest.mocked(searchProjectArchive).mockReturnValue(new Promise(done => { resolve = done }))
  const { rerender } = render(<ConnectedProjectHub {...props} />)
  fireEvent.click(screen.getByTestId('provenance-search-submit-btn'))
  const signal = jest.mocked(searchProjectArchive).mock.calls[0][2]!
  rerender(<ConnectedProjectHub {...props} projectId="project-other" />)
  expect(signal.aborted).toBe(true)
  await act(async () => resolve({ status: 'grounded_answer', answerText: 'Old private answer', citations: [source] }))
  expect(screen.queryByText('Old private answer')).not.toBeInTheDocument()
})

it.each(['empty', 'failed'])('clears playing audio when a replacement search is %s', async outcome => {
  jest.mocked(searchProjectArchive).mockResolvedValueOnce({ status: 'grounded_answer', answerText: 'One source', citations: [source] })
  jest.mocked(getCitationAudioUrl).mockResolvedValue('https://storage.example/signed')
  render(<ConnectedProjectHub {...props} />)
  fireEvent.click(screen.getByTestId('provenance-search-submit-btn'))
  fireEvent.click(await screen.findByTestId('seek-citation-segment-1'))
  await screen.findByLabelText('Cited original audio')
  if (outcome === 'empty') jest.mocked(searchProjectArchive).mockResolvedValueOnce({ status: 'no_matching_sources', answerText: 'No sources', citations: [] })
  else jest.mocked(searchProjectArchive).mockRejectedValueOnce(new Error('unavailable'))
  fireEvent.click(screen.getByTestId('provenance-search-submit-btn'))
  await screen.findByText(outcome === 'empty' ? 'No sources' : 'Search is unavailable. Please try again.')
  expect(screen.queryByLabelText('Cited original audio')).not.toBeInTheDocument()
})

it('does not load a pending old audio URL after a new search starts', async () => {
  let resolve!: (url: string) => void
  jest.mocked(searchProjectArchive).mockResolvedValueOnce({ status: 'grounded_answer', answerText: 'One source', citations: [source] })
    .mockResolvedValueOnce({ status: 'no_matching_sources', answerText: 'No sources', citations: [] })
  jest.mocked(getCitationAudioUrl).mockReturnValueOnce(new Promise(done => { resolve = done }))
  render(<ConnectedProjectHub {...props} />)
  fireEvent.click(screen.getByTestId('provenance-search-submit-btn'))
  fireEvent.click(await screen.findByTestId('seek-citation-segment-1'))
  fireEvent.click(screen.getByTestId('provenance-search-submit-btn'))
  await screen.findByText('No sources')
  await act(async () => resolve('https://storage.example/old-audio'))
  expect(screen.queryByLabelText('Cited original audio')).not.toBeInTheDocument()
})

it('downloads a verified Blob and releases its browser URL on unmount', async () => {
  jest.mocked(downloadProjectArchive).mockResolvedValue(new Blob(['zip'], { type: 'application/zip' }))
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const { unmount } = render(<ConnectedProjectHub {...props} />)
  fireEvent.click(screen.getByTestId('export-complete-archive-btn'))
  await waitFor(() => expect(click).toHaveBeenCalled())
  expect(downloadProjectArchive).toHaveBeenCalledWith('project-123', expect.any(AbortSignal))
  unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-download')
})
