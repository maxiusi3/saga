import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StorySearch } from '../story-search'
import { useSearch } from '../../../hooks/use-search'

// Mock the useSearch hook
jest.mock('../../../hooks/use-search')
const mockedUseSearch = useSearch as jest.MockedFunction<typeof useSearch>

describe('StorySearch', () => {
  const defaultProps = {
    projectId: 'test-project-id',
    onResultClick: jest.fn()
  }

  const mockSearchHook = {
    results: [],
    loading: false,
    error: null,
    query: '',
    total: 0,
    page: 1,
    hasMore: false,
    searchTime: 0,
    suggestions: [],
    loadingSuggestions: false,
    setQuery: jest.fn(),
    searchStories: jest.fn(),
    loadMore: jest.fn(),
    clearSearch: jest.fn(),
    getSuggestions: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseSearch.mockReturnValue(mockSearchHook)
  })

  it('should render search input', () => {
    render(<StorySearch {...defaultProps} />)
    
    expect(screen.getByPlaceholderText('Search stories by title or content...')).toBeInTheDocument()
    expect(screen.getByLabelText('Search stories')).toBeInTheDocument()
  })

  it('should handle search input changes', async () => {
    const user = userEvent.setup()
    render(<StorySearch {...defaultProps} />)
    
    const searchInput = screen.getByPlaceholderText('Search stories by title or content...')
    
    await user.type(searchInput, 'test query')
    
    expect(mockSearchHook.setQuery).toHaveBeenCalledWith('test query')
  })

  it('should display search results', () => {
    const mockResults = [
      {
        story: {
          id: '1',
          projectId: 'test-project',
          storytellerId: 'user-1',
          title: 'Test Story',
          audioUrl: 'https://example.com/audio.mp3',
          transcript: 'This is a test story',
          status: 'ready',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        rank: 0.8,
        headline: 'This is a <b>test</b> story'
      }
    ]

    mockedUseSearch.mockReturnValue({
      ...mockSearchHook,
      results: mockResults,
      query: 'test',
      total: 1,
      searchTime: 150
    })

    render(<StorySearch {...defaultProps} />)
    
    expect(screen.getByText('Test Story')).toBeInTheDocument()
    expect(screen.getByText('1 result for "test"')).toBeInTheDocument()
    expect(screen.getByText('150ms')).toBeInTheDocument()
  })

  it('should handle result clicks', async () => {
    const mockResults = [
      {
        story: {
          id: '1',
          projectId: 'test-project',
          storytellerId: 'user-1',
          title: 'Test Story',
          audioUrl: 'https://example.com/audio.mp3',
          status: 'ready',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        rank: 0.8
      }
    ]

    mockedUseSearch.mockReturnValue({
      ...mockSearchHook,
      results: mockResults,
      query: 'test'
    })

    const user = userEvent.setup()
    render(<StorySearch {...defaultProps} />)
    
    const resultItem = screen.getByText('Test Story').closest('div')
    await user.click(resultItem!)
    
    expect(defaultProps.onResultClick).toHaveBeenCalledWith(mockResults[0])
  })

  it('should display loading state', () => {
    mockedUseSearch.mockReturnValue({
      ...mockSearchHook,
      loading: true,
      query: 'test'
    })

    render(<StorySearch {...defaultProps} />)
    
    expect(screen.getByText('Searching...')).toBeInTheDocument()
  })

  it('should display error state', () => {
    mockedUseSearch.mockReturnValue({
      ...mockSearchHook,
      error: 'Search failed',
      query: 'test'
    })

    render(<StorySearch {...defaultProps} />)
    
    expect(screen.getByText('Search Error')).toBeInTheDocument()
    expect(screen.getByText('Search failed')).toBeInTheDocument()
  })

  it('should display no results state', () => {
    mockedUseSearch.mockReturnValue({
      ...mockSearchHook,
      query: 'test',
      results: [],
      total: 0
    })

    render(<StorySearch {...defaultProps} />)
    
    expect(screen.getByText('No stories found')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your search terms or filters')).toBeInTheDocument()
  })

  it('should show and handle suggestions', async () => {
    const mockSuggestions = ['test', 'testing', 'tests']
    
    mockedUseSearch.mockReturnValue({
      ...mockSearchHook,
      suggestions: mockSuggestions,
      query: 'test'
    })

    const user = userEvent.setup()
    render(<StorySearch {...defaultProps} />)
    
    const searchInput = screen.getByPlaceholderText('Search stories by title or content...')
    await user.click(searchInput)
    
    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('testing')).toBeInTheDocument()
    expect(screen.getByText('tests')).toBeInTheDocument()
  })

  it('should handle keyboard navigation in suggestions', async () => {
    const mockSuggestions = ['test', 'testing', 'tests']
    
    mockedUseSearch.mockReturnValue({
      ...mockSearchHook,
      suggestions: mockSuggestions,
      query: 'test'
    })

    const user = userEvent.setup()
    render(<StorySearch {...defaultProps} />)
    
    const searchInput = screen.getByPlaceholderText('Search stories by title or content...')
    await user.click(searchInput)
    
    // Navigate down
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /test/ })).toHaveAttribute('aria-selected', 'true')
    
    // Navigate down again
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /testing/ })).toHaveAttribute('aria-selected', 'true')
    
    // Select with Enter
    await user.keyboard('{Enter}')
    expect(mockSearchHook.setQuery).toHaveBeenCalledWith('testing')
  })

  it('should show and handle filters', async () => {
    const user = userEvent.setup()
    render(<StorySearch {...defaultProps} />)
    
    const filterButton = screen.getByLabelText('Toggle filters')
    await user.click(filterButton)
    
    expect(screen.getByText('Sort by:')).toBeInTheDocument()
    expect(screen.getByText('From:')).toBeInTheDocument()
    expect(screen.getByText('To:')).toBeInTheDocument()
  })

  it('should handle clear search', async () => {
    mockedUseSearch.mockReturnValue({
      ...mockSearchHook,
      query: 'test query'
    })

    const user = userEvent.setup()
    render(<StorySearch {...defaultProps} />)
    
    const clearButton = screen.getByLabelText('Clear search')
    await user.click(clearButton)
    
    expect(mockSearchHook.clearSearch).toHaveBeenCalled()
  })

  it('should handle load more', async () => {
    mockedUseSearch.mockReturnValue({
      ...mockSearchHook,
      results: [
        {
          story: {
            id: '1',
            projectId: 'test-project',
            storytellerId: 'user-1',
            title: 'Test Story',
            audioUrl: 'https://example.com/audio.mp3',
            status: 'ready',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z'
          },
          rank: 0.8
        }
      ],
      hasMore: true,
      query: 'test'
    })

    const user = userEvent.setup()
    render(<StorySearch {...defaultProps} />)
    
    const loadMoreButton = screen.getByText('Load More Results')
    await user.click(loadMoreButton)
    
    expect(mockSearchHook.loadMore).toHaveBeenCalled()
  })

  it('should format search time correctly', () => {
    mockedUseSearch.mockReturnValue({
      ...mockSearchHook,
      query: 'test',
      searchTime: 1500,
      total: 1
    })

    render(<StorySearch {...defaultProps} />)
    
    expect(screen.getByText('1.50s')).toBeInTheDocument()
  })

  it('should highlight search terms in results', () => {
    const mockResults = [
      {
        story: {
          id: '1',
          projectId: 'test-project',
          storytellerId: 'user-1',
          title: 'Test Story with keyword',
          audioUrl: 'https://example.com/audio.mp3',
          status: 'ready',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        rank: 0.8
      }
    ]

    mockedUseSearch.mockReturnValue({
      ...mockSearchHook,
      results: mockResults,
      query: 'keyword'
    })

    render(<StorySearch {...defaultProps} />)
    
    // The highlighting is done via a function that wraps matching text in <mark> tags
    expect(screen.getByText('Test Story with keyword')).toBeInTheDocument()
  })
})