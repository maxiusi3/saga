import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PublicationDeliveryPanel } from '../PublicationDeliveryPanel'
import { requestPublication, readPublication, retryPublication } from '@/lib/publication-client'

jest.mock('@/lib/publication-client', () => ({ requestPublication: jest.fn(), readPublication: jest.fn(), retryPublication: jest.fn() }))
const props = { projectId: 'project', actorId: 'actor' }
const receipt = { jobId: 'job', snapshotId: 'job', snapshotVersion: 2, status: 'queued' as const, attempt: 0, errorCode: null, statusUrl: '/status', downloadUrl: '/download' }
beforeEach(() => jest.resetAllMocks())

it('shows queued status, refreshes explicitly, and streams through a normal download link', async () => {
  jest.mocked(requestPublication).mockResolvedValue(receipt)
  jest.mocked(readPublication).mockResolvedValue({ ...receipt, status: 'ready', attempt: 1 })
  render(<PublicationDeliveryPanel {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Prepare offline archive' }))
  await screen.findByText(/Archive queued/)
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Check archive status' }))
  expect(await screen.findByRole('link', { name: 'Download archive ZIP' })).toHaveAttribute('href', '/download')
  expect(readPublication).toHaveBeenCalledWith('project', 'job', expect.any(AbortSignal))
  expect(screen.getByRole('status')).toHaveTextContent('Archive version 2 is ready.')
})
it('retries the same failed job without exposing server diagnostics', async () => {
  jest.mocked(requestPublication).mockResolvedValue({ ...receipt, status: 'failed', errorCode: 'private diagnostic' })
  jest.mocked(retryPublication).mockResolvedValue(receipt)
  render(<PublicationDeliveryPanel {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Prepare offline archive' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Retry archive preparation' }))
  await screen.findByText(/Archive queued/)
  expect(retryPublication).toHaveBeenCalledWith('project', 'job', expect.any(AbortSignal))
  expect(screen.queryByText('private diagnostic')).not.toBeInTheDocument()
})
it('explains unsupported PDF text without offering a futile retry of the same source', async () => {
  jest.mocked(requestPublication).mockResolvedValue({ ...receipt, status: 'failed', errorCode: 'unsupported_text' })
  render(<PublicationDeliveryPanel {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Prepare offline archive' }))
  await screen.findByText(/PDF cannot render one or more characters/)
  expect(screen.queryByRole('button', { name: 'Retry archive preparation' })).not.toBeInTheDocument()
})
it('retains the recoverable job on a failed status request and removes an obsolete ready link', async () => {
  jest.mocked(requestPublication).mockResolvedValue({ ...receipt, status: 'ready' })
  jest.mocked(readPublication).mockRejectedValueOnce(new Error('private secret')).mockResolvedValueOnce({ ...receipt, status: 'revoked' })
  render(<PublicationDeliveryPanel {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Prepare offline archive' }))
  await screen.findByRole('link', { name: 'Download archive ZIP' })
  fireEvent.click(screen.getByRole('button', { name: 'Check archive status' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('link', { name: 'Download archive ZIP' })).not.toBeInTheDocument()
  expect(screen.queryByText('private secret')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Check archive status' }))
  await screen.findByText(/archive is unavailable/)
  expect(readPublication).toHaveBeenCalledTimes(2)
})
it('ignores repeat clicks during a pending request and late completion after unmount', async () => {
  let done!: (result: typeof receipt) => void
  jest.mocked(requestPublication).mockReturnValue(new Promise(resolve => { done = resolve }))
  const { unmount } = render(<PublicationDeliveryPanel {...props} />)
  const button = screen.getByRole('button', { name: 'Prepare offline archive' })
  fireEvent.click(button); fireEvent.click(button)
  await waitFor(() => expect(requestPublication).toHaveBeenCalledTimes(1))
  const signal = jest.mocked(requestPublication).mock.calls[0][1]!
  unmount(); expect(signal.aborted).toBe(true)
  await act(async () => done(receipt))
})
