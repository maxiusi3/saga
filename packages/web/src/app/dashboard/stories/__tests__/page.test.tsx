import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { toast } from 'react-hot-toast'
import AllStoriesPage from '../page'
import { useProjectStore } from '@/stores/project-store'
import { apiClient } from '@/lib/api'

// Mock dependencies
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/stores/project-store', () => ({
  useProjectStore: jest.fn(),
}))

jest.mock('@/lib/api', () => ({
  apiClient: {
    stories: {
      list: jest.fn(),
    },
  },
}))

const mockFetchProjects = jest.fn()

const mockProjects = [
  {
    id: '1',
    title: 'Family Stories',
    description: 'Our family memories',
  },
  {
    id: '2',
    title: 'Mom\'s Life',
    description: 'Mom\'s life stories',
  },
]

const mockStories = [
  {
    id: '1',
    projectId: '1',
    title: 'Childhood Memories',
    audioUrl: 'https://example.com/audio1.mp3',
    audioDuration: 300,
    transcript: 'This is a story about my childhood...',
    status: 'ready',
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date('2023-12-01'),
    _count: { interactions: 2 },
  },
  {
    id: '2',
    projectId: '2',
    title: 'Wedding Day',
    audioUrl: 'https://example.com/audio2.mp3',
    audioDuration: 600,
    transcript: 'Our wedding day was beautiful...',
    status: 'processing',
    createdAt: new Date('2023-11-15'),
    updatedAt: new Date('2023-11-15'),
    _count: { interactions: 0 },
  },
]

describe('AllStoriesPage', () => {
  beforeEach(() => {
    ;(useProjectStore as jest.Mock).mockReturnValue({
      projects: mockProjects,
      fetchProjects: mockFetchProjects,
    })

    ;(apiClient.stories.list as jest.Mock).mockImplementation((projectId) => {
      const projectStories = mockStories.filter(story => story.projectId === projectId)
      return Promise.resolve({
        data: {
          data: {
            stories: projectStories,
          },
        },
      })
    })

    jest.clearAllMocks()
  })

  it('renders all stories page with header', async () => {
    render(<AllStoriesPage />)

    expect(screen.getByText('All Stories')).toBeInTheDocument()
    expect(screen.getByText('Browse and listen to stories from all your family projects.')).toBeInTheDocument()
  })

  it('fetches projects and stories on mount', async () => {
    render(<AllStoriesPage />)

    expect(mockFetchProjects).toHaveBeenCalled()
    
    await waitFor(() => {
      expect(apiClient.stories.list).toHaveBeenCalledWith('1')
      expect(apiClient.stories.list).toHaveBeenCalledWith('2')
    })
  })

  it('displays stories from all projects', async () => {
    render(<AllStoriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Childhood Memories')).toBeInTheDocument()
      expect(screen.getByText('Wedding Day')).toBeInTheDocument()
    })

    expect(screen.getByText('Family Stories')).toBeInTheDocument()
    expect(screen.getByText('Mom\'s Life')).toBeInTheDocument()
  })

  it('filters stories by search query', async () => {
    render(<AllStoriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Childhood Memories')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search stories...')
    fireEvent.change(searchInput, { target: { value: 'childhood' } })

    expect(screen.getByText('Childhood Memories')).toBeInTheDocument()
    expect(screen.queryByText('Wedding Day')).not.toBeInTheDocument()
  })

  it('filters stories by project', async () => {
    render(<AllStoriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Childhood Memories')).toBeInTheDocument()
    })

    const projectSelect = screen.getByDisplayValue('All Projects')
    fireEvent.change(projectSelect, { target: { value: '1' } })

    expect(screen.getByText('Childhood Memories')).toBeInTheDocument()
    expect(screen.queryByText('Wedding Day')).not.toBeInTheDocument()
  })

  it('filters stories by status', async () => {
    render(<AllStoriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Childhood Memories')).toBeInTheDocument()
    })

    const statusSelect = screen.getByDisplayValue('All Status')
    fireEvent.change(statusSelect, { target: { value: 'ready' } })

    expect(screen.getByText('Childhood Memories')).toBeInTheDocument()
    expect(screen.queryByText('Wedding Day')).not.toBeInTheDocument()
  })

  it('shows results summary', async () => {
    render(<AllStoriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Showing 2 of 2 stories')).toBeInTheDocument()
    })
  })

  it('clears all filters', async () => {
    render(<AllStoriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Childhood Memories')).toBeInTheDocument()
    })

    // Apply filters
    const searchInput = screen.getByPlaceholderText('Search stories...')
    fireEvent.change(searchInput, { target: { value: 'childhood' } })

    const projectSelect = screen.getByDisplayValue('All Projects')
    fireEvent.change(projectSelect, { target: { value: '1' } })

    // Clear filters
    const clearButton = screen.getByText('Clear filters')
    fireEvent.click(clearButton)

    expect(searchInput).toHaveValue('')
    expect(projectSelect).toHaveValue('all')
  })

  it('shows empty state when no stories', async () => {
    ;(apiClient.stories.list as jest.Mock).mockResolvedValue({
      data: { data: { stories: [] } },
    })

    render(<AllStoriesPage />)

    await waitFor(() => {
      expect(screen.getByText('No stories yet')).toBeInTheDocument()
      expect(screen.getByText('Stories will appear here once family members start recording.')).toBeInTheDocument()
    })
  })

  it('shows empty state for filtered results', async () => {
    render(<AllStoriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Childhood Memories')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search stories...')
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

    expect(screen.getByText('No stories found')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your search terms or filters.')).toBeInTheDocument()
  })

  it('displays story metadata correctly', async () => {
    render(<AllStoriesPage />)

    await waitFor(() => {
      expect(screen.getByText('5 min')).toBeInTheDocument() // 300 seconds / 60
      expect(screen.getByText('10 min')).toBeInTheDocument() // 600 seconds / 60
      expect(screen.getByText('2 interactions')).toBeInTheDocument()
      expect(screen.getByText('0 interactions')).toBeInTheDocument()
    })
  })

  it('has correct navigation links', async () => {
    render(<AllStoriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Childhood Memories')).toBeInTheDocument()
    })

    const listenButtons = screen.getAllByText('Listen & Interact')
    expect(listenButtons[0]).toHaveAttribute('href', '/dashboard/stories/1')
    expect(listenButtons[1]).toHaveAttribute('href', '/dashboard/stories/2')

    const projectLinks = screen.getAllByText('Family Stories')
    expect(projectLinks[0]).toHaveAttribute('href', '/dashboard/projects/1')
  })

  it('shows loading state', () => {
    ;(useProjectStore as jest.Mock).mockReturnValue({
      projects: [],
      fetchProjects: mockFetchProjects,
    })

    render(<AllStoriesPage />)

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    ;(apiClient.stories.list as jest.Mock).mockRejectedValue(new Error('API Error'))

    render(<AllStoriesPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load stories')).toBeInTheDocument()
    })
  })
})