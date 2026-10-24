import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StoryInteractions } from '../story-interactions'

const mockUpload = jest.fn()
const mockToastError = jest.fn()
const mockCreateInteraction = jest.fn()
jest.mock('@/lib/storage', () => ({ StorageService: jest.fn(() => ({ uploadImageWithThumb: mockUpload })) }))
jest.mock('@/lib/interactions', () => ({
  interactionService: {
    getStoryInteractions: async () => [],
    createInteraction: (...args: unknown[]) => mockCreateInteraction(...args),
  },
}))
jest.mock('@/stores/auth-store', () => ({ useAuthStore: () => ({ user: { id: 'alice' } }) }))
jest.mock('react-hot-toast', () => ({ toast: { error: (...args: unknown[]) => mockToastError(...args), success: jest.fn() } }))

const uploaded = {
  url: 'https://media.example/photo.png', thumbUrl: 'https://media.example/photo-thumb.png',
  path: 'alice/images/interactions/story-a/photo.png', thumbPath: 'alice/images/interactions/story-a/photo-thumb.png',
}
const persistenceKey = 'commentUploads:story-a'
const originalFetch = global.fetch
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  global.fetch = jest.fn().mockRejectedValue(new Error('Deletion unavailable'))
  URL.createObjectURL = jest.fn(file => `blob:${file.name}`)
  URL.revokeObjectURL = jest.fn()
  mockUpload.mockResolvedValue({ success: true, ...uploaded })
  mockCreateInteraction.mockResolvedValue(null)
})
afterEach(() => {
  cleanup()
  global.fetch = originalFetch
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
})

async function renderComposer() {
  const view = render(<StoryInteractions storyId="story-a" projectId="family-a" userRole="facilitator" isProjectOwner />)
  await screen.findByPlaceholderText('Share your thoughts or encouragement...')
  return view.container.querySelector('input[type="file"]') as HTMLInputElement
}

it.each(['Remove', 'Clear images'])('keeps fresh uploaded references and local previews when using %s', async action => {
  const input = await renderComposer()
  const file = new File(['photo'], 'photo.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(screen.getByAltText('thumb')).toHaveAttribute('src', uploaded.thumbUrl))
  const before = localStorage.getItem(persistenceKey)
  expect(JSON.parse(before!)).toEqual([uploaded])

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: action })) })

  expect(screen.getByAltText('thumb')).toHaveAttribute('src', uploaded.thumbUrl)
  expect(localStorage.getItem(persistenceKey)).toBe(before)
  expect(input.files?.[0]).toBe(file)
  expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  expect(global.fetch).not.toHaveBeenCalled()
  expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/temporarily unavailable.*kept/i))
})

it.each(['Remove', 'Clear images'])('keeps restored uploaded references without object paths when using %s', async action => {
  const restored = [
    { url: uploaded.url, thumbUrl: uploaded.thumbUrl },
    { url: 'https://media.example/other.png', thumbUrl: 'https://media.example/other-thumb.png' },
  ]
  localStorage.setItem(persistenceKey, JSON.stringify(restored))
  await renderComposer()

  await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: action })[0]) })

  expect(screen.getAllByAltText('thumb').map(img => img.getAttribute('src'))).toEqual(restored.map(img => img.thumbUrl))
  expect(JSON.parse(localStorage.getItem(persistenceKey)!)).toEqual(restored)
  expect(global.fetch).not.toHaveBeenCalled()
  expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/temporarily unavailable.*kept/i))
})

it('still removes one purely local preview and its queued file', async () => {
  mockUpload.mockResolvedValue({ success: false, error: 'Upload unavailable' })
  const input = await renderComposer()
  const files = ['first.png', 'second.png'].map(name => new File(['photo'], name, { type: 'image/png' }))
  fireEvent.change(input, { target: { files } })
  await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(2))

  fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])

  expect(screen.getAllByAltText('thumb')).toHaveLength(1)
  expect(screen.getByAltText('thumb')).toHaveAttribute('src', 'blob:second.png')
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first.png')
  expect(mockToastError).not.toHaveBeenCalled()
  expect(global.fetch).not.toHaveBeenCalled()
  mockUpload.mockClear()
  const textarea = screen.getByPlaceholderText('Share your thoughts or encouragement...')
  fireEvent.change(textarea, { target: { value: 'A memory' } })
  await act(async () => { fireEvent.click(textarea.parentElement!.querySelector('button')!) })
  expect(mockUpload).toHaveBeenCalledTimes(1)
  expect(mockUpload).toHaveBeenCalledWith(files[1], 'images/interactions/story-a')
})

it('still clears purely local previews and their queued files', async () => {
  mockUpload.mockResolvedValue({ success: false, error: 'Upload unavailable' })
  const input = await renderComposer()
  fireEvent.change(input, { target: { files: [new File(['photo'], 'local.png', { type: 'image/png' })] } })
  await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Clear images' })) })

  expect(screen.queryByAltText('thumb')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Clear images' })).not.toBeInTheDocument()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local.png')
  expect(JSON.parse(localStorage.getItem(persistenceKey)!)).toEqual([])
  expect(mockToastError).not.toHaveBeenCalled()
  expect(global.fetch).not.toHaveBeenCalled()
  mockUpload.mockClear()
  const textarea = screen.getByPlaceholderText('Share your thoughts or encouragement...')
  fireEvent.change(textarea, { target: { value: 'A memory' } })
  await act(async () => { fireEvent.click(textarea.parentElement!.querySelector('button')!) })
  expect(mockUpload).not.toHaveBeenCalled()
})
