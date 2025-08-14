import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useParams, useRouter } from 'next/navigation'
import StoryDetailPage from '../page'
import { apiClient } from '@/lib/api'
import { useProjectWebSocket } from '@/hooks/use-websocket'
import { toast } from 'react-hot-toast'

// Mock dependencies
jest.mock('next/navigation')
jest.mock('@/lib/api')
jest.mock('@/hooks/use-websocket')
jest.mock('react-hot-toast')

const mockUseParams = useParams as jest.MockedFunction<typeof useParams>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>
const mockUseProjectWebSocket = useProjectWebSocket as jest.MockedFunction<typeof useProjectWebSocket>
const mockToast = toast as jest.Mocked<typeof toast>

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
}

const mockWebSocket = {
  isConnected: true,
  onInteractionAdded: jest.fn(() => jest.fn()),
  onTranscriptUpdated: jest.fn(() => jest.fn()),
  on: jest.fn(() => jest.fn()),
  emit: jest.fn(),
}

const mockStoryData = {
  id: 'story-1',
  projectId: 'project-1',
  title: 'Test Story',
  audioUrl: 'https://example.com/audio.mp3',
  audioDuration: 120,
  transcript: 'This is the original transcript.',
  originalTranscript: 'This is the original transcript.',
  photoUrl: null,
  aiPrompt: 'Tell me about your childhood.',
  status: 'ready' as const,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  interactions: [],
}

describe('Transcript Editing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockUseParams.mockReturnValue({ id: 'story-1' })
    mockUseRouter.mockReturnValue(mockRouter as any)
    mockUseProjectWebSocket.mockReturnValue(mockWebSocket as any)
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key) => {
          if (key === 'userId') return 'user-1'
          if (key === 'userName') return 'John Doe'
          return null
        }),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    })
    
    // Mock API responses
    mockApiClient.stories.get.mockResolvedValue({
      data: { data: mockStoryData },
    } as any)
  })

  it('should display edit transcript button for facilitators', async () => {
    render(<StoryDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Edit Transcript')).toBeInTheDocument()
    })
  })

  it('should show transcript editing interface when edit button is clicked', async () => {
    render(<StoryDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Edit Transcript')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Edit Transcript'))
    
    expect(screen.getByDisplayValue('This is the original transcript.')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('should save transcript changes when save button is clicked', async () => {
    const updatedTranscript = 'This is the updated transcript.'
    
    mockApiClient.stories.update.mockResolvedValue({
      data: { ...mockStoryData, transcript: updatedTranscript },
    } as any)
    
    render(<StoryDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Edit Transcript')).toBeInTheDocument()
    })
    
    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Transcript'))
    
    // Edit transcript
    const textarea = screen.getByDisplayValue('This is the original transcript.')
    fireEvent.change(textarea, { target: { value: updatedTranscript } })
    
    // Save changes
    fireEvent.click(screen.getByText('Save Changes'))
    
    await waitFor(() => {
      expect(mockApiClient.stories.update).toHaveBeenCalledWith('story-1', {
        transcript: updatedTranscript,
      })
    })
    
    expect(mockToast.success).toHaveBeenCalledWith('Transcript updated successfully')
  })

  it('should implement auto-save functionality', async () => {
    jest.useFakeTimers()
    
    const updatedTranscript = 'This is the auto-saved transcript.'
    
    mockApiClient.stories.update.mockResolvedValue({
      data: { ...mockStoryData, transcript: updatedTranscript },
    } as any)
    
    render(<StoryDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Edit Transcript')).toBeInTheDocument()
    })
    
    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Transcript'))
    
    // Edit transcript
    const textarea = screen.getByDisplayValue('This is the original transcript.')
    fireEvent.change(textarea, { target: { value: updatedTranscript } })
    
    // Fast-forward time to trigger auto-save
    jest.advanceTimersByTime(2000)
    
    await waitFor(() => {
      expect(mockApiClient.stories.update).toHaveBeenCalledWith('story-1', {
        transcript: updatedTranscript,
      })
    })
    
    jest.useRealTimers()
  })

  it('should display edited indicator when transcript is manually edited', async () => {
    const storyWithEditedTranscript = {
      ...mockStoryData,
      transcript: 'This is the edited transcript.',
      transcriptEditedBy: 'Jane Smith',
      transcriptEditedAt: '2024-01-02T00:00:00Z',
    }
    
    mockApiClient.stories.get.mockResolvedValue({
      data: { data: storyWithEditedTranscript },
    } as any)
    
    render(<StoryDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Edited by Jane Smith')).toBeInTheDocument()
    })
  })

  it('should handle transcript update via WebSocket', async () => {
    let transcriptUpdateHandler: (data: any) => void
    
    mockUseProjectWebSocket.mockReturnValue({
      ...mockWebSocket,
      onTranscriptUpdated: jest.fn((handler) => {
        transcriptUpdateHandler = handler
        return jest.fn()
      }),
    } as any)
    
    render(<StoryDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('This is the original transcript.')).toBeInTheDocument()
    })
    
    // Simulate WebSocket transcript update
    transcriptUpdateHandler!({
      storyId: 'story-1',
      transcript: 'This transcript was updated by another facilitator.',
    })
    
    await waitFor(() => {
      expect(screen.getByText('This transcript was updated by another facilitator.')).toBeInTheDocument()
    })
    
    expect(mockToast.success).toHaveBeenCalledWith('Transcript updated by another facilitator')
  })

  it('should cancel editing and revert changes', async () => {
    render(<StoryDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Edit Transcript')).toBeInTheDocument()
    })
    
    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Transcript'))
    
    // Edit transcript
    const textarea = screen.getByDisplayValue('This is the original transcript.')
    fireEvent.change(textarea, { target: { value: 'Modified transcript' } })
    
    // Cancel editing
    fireEvent.click(screen.getByText('Cancel'))
    
    // Should exit edit mode and revert changes
    expect(screen.getByText('Edit Transcript')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Modified transcript')).not.toBeInTheDocument()
  })

  it('should handle transcript update errors gracefully', async () => {
    const errorMessage = 'Failed to update transcript'
    
    mockApiClient.stories.update.mockRejectedValue(new Error(errorMessage))
    
    render(<StoryDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Edit Transcript')).toBeInTheDocument()
    })
    
    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Transcript'))
    
    // Edit transcript
    const textarea = screen.getByDisplayValue('This is the original transcript.')
    fireEvent.change(textarea, { target: { value: 'Updated transcript' } })
    
    // Save changes
    fireEvent.click(screen.getByText('Save Changes'))
    
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to update transcript')
    })
  })

  it('should show character count for transcript editing', async () => {
    render(<StoryDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Edit Transcript')).toBeInTheDocument()
    })
    
    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Transcript'))
    
    // Should show character count
    expect(screen.getByText(/\/5000 characters/)).toBeInTheDocument()
  })

  it('should prevent saving empty transcript', async () => {
    render(<StoryDetailPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Edit Transcript')).toBeInTheDocument()
    })
    
    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Transcript'))
    
    // Clear transcript
    const textarea = screen.getByDisplayValue('This is the original transcript.')
    fireEvent.change(textarea, { target: { value: '   ' } })
    
    // Try to save
    fireEvent.click(screen.getByText('Save Changes'))
    
    // Should not call API with empty transcript
    expect(mockApiClient.stories.update).not.toHaveBeenCalled()
  })
})