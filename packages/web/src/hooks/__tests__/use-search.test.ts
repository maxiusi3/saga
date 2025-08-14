import { renderHook, act, waitFor } from '@testing-library/react'
import { useSearch, useSearchAnalytics } from '../use-search'
import { api } from '../../lib/api'

// Mock the API
jest.mock('../../lib/api')
const mockedApi = api as jest.Mocked<typeof api>

describe('useSearch', () => {
  const projectId = 'test-project-id'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSearch(projectId))

    expect(result.current.results).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.query).toBe('')
    expect(result.current.total).toBe(0)
    expect(result.current.page).toBe(1)
    expect(result.current.hasMore).toBe(false)
    expect(result.current.suggestions).toEqual([])
  })

  it('should search stories successfully', async () => {
    const mockResponse = {
      data: {
        data: {
          results: [
            {
              story: {
                id: '1',
                title: 'Test Story',
                transcript: 'Test content',
                createdAt: '2023-01-01T00:00:00Z'
              },
              rank: 0.8,
              headline: 'Test <b>content</b>'
            }
          ],
          total: 1,
          page: 1,
          limit: 20,
          hasMore: false,
          searchTime: 150
        }
      }
    }

    mockedApi.get.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useSearch(projectId))

    await act(async () => {
      result.current.searchStories('test query')
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.results).toHaveLength(1)
    expect(result.current.results[0].story.title).toBe('Test Story')
    expect(result.current.total).toBe(1)
    expect(result.current.searchTime).toBe(150)
    expect(result.current.error).toBe(null)
  })

  it('should handle search errors', async () => {
    const mockError = {
      response: {
        data: {
          error: {
            message: 'Search failed'
          }
        }
      }
    }

    mockedApi.get.mockRejectedValueOnce(mockError)

    const { result } = renderHook(() => useSearch(projectId))

    await act(async () => {
      result.current.searchStories('test query')
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Search failed')
    expect(result.current.results).toEqual([])
    expect(result.current.total).toBe(0)
  })

  it('should get search suggestions', async () => {
    const mockResponse = {
      data: {
        data: {
          suggestions: ['test', 'testing', 'tests']
        }
      }
    }

    mockedApi.get.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useSearch(projectId))

    await act(async () => {
      result.current.getSuggestions('test')
    })

    await waitFor(() => {
      expect(result.current.loadingSuggestions).toBe(false)
    })

    expect(result.current.suggestions).toEqual(['test', 'testing', 'tests'])
  })

  it('should clear search results', () => {
    const { result } = renderHook(() => useSearch(projectId))

    // Set some initial state
    act(() => {
      result.current.setQuery('test')
    })

    // Clear search
    act(() => {
      result.current.clearSearch()
    })

    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual([])
    expect(result.current.total).toBe(0)
    expect(result.current.error).toBe(null)
    expect(result.current.suggestions).toEqual([])
  })

  it('should handle load more functionality', async () => {
    const mockResponse1 = {
      data: {
        data: {
          results: [{ story: { id: '1', title: 'Story 1' }, rank: 0.8 }],
          total: 2,
          page: 1,
          limit: 1,
          hasMore: true,
          searchTime: 100
        }
      }
    }

    const mockResponse2 = {
      data: {
        data: {
          results: [{ story: { id: '2', title: 'Story 2' }, rank: 0.7 }],
          total: 2,
          page: 2,
          limit: 1,
          hasMore: false,
          searchTime: 120
        }
      }
    }

    mockedApi.get
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2)

    const { result } = renderHook(() => useSearch(projectId))

    // Initial search
    await act(async () => {
      result.current.searchStories('test')
    })

    await waitFor(() => {
      expect(result.current.results).toHaveLength(1)
      expect(result.current.hasMore).toBe(true)
    })

    // Load more
    await act(async () => {
      result.current.loadMore()
    })

    await waitFor(() => {
      expect(result.current.results).toHaveLength(2)
      expect(result.current.hasMore).toBe(false)
    })

    expect(result.current.results[0].story.id).toBe('1')
    expect(result.current.results[1].story.id).toBe('2')
  })

  it('should debounce search queries', async () => {
    jest.useFakeTimers()

    const mockResponse = {
      data: {
        data: {
          results: [],
          total: 0,
          page: 1,
          limit: 20,
          hasMore: false,
          searchTime: 50
        }
      }
    }

    mockedApi.get.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useSearch(projectId))

    // Set query multiple times quickly
    act(() => {
      result.current.setQuery('t')
    })
    act(() => {
      result.current.setQuery('te')
    })
    act(() => {
      result.current.setQuery('test')
    })

    // Fast-forward time to trigger debounced search
    act(() => {
      jest.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledTimes(1)
    })

    jest.useRealTimers()
  })
})

describe('useSearchAnalytics', () => {
  const projectId = 'test-project-id'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should fetch analytics on mount', async () => {
    const mockResponse = {
      data: {
        data: {
          topQueries: [{ query: 'test', count: 5 }],
          totalSearches: 10,
          averageResultCount: 3.5,
          averageSearchTime: 200
        }
      }
    }

    mockedApi.get.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useSearchAnalytics(projectId))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.analytics).toEqual(mockResponse.data.data)
    expect(result.current.error).toBe(null)
  })

  it('should handle analytics fetch errors', async () => {
    const mockError = {
      response: {
        data: {
          error: {
            message: 'Analytics failed'
          }
        }
      }
    }

    mockedApi.get.mockRejectedValueOnce(mockError)

    const { result } = renderHook(() => useSearchAnalytics(projectId))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Analytics failed')
    expect(result.current.analytics).toBe(null)
  })

  it('should reindex project successfully', async () => {
    const mockResponse = {
      data: {
        data: {
          reindexedCount: 25
        }
      }
    }

    mockedApi.post.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useSearchAnalytics(projectId))

    let reindexedCount: number | undefined

    await act(async () => {
      reindexedCount = await result.current.reindexProject()
    })

    expect(reindexedCount).toBe(25)
    expect(mockedApi.post).toHaveBeenCalledWith(`/projects/${projectId}/search/reindex`)
  })

  it('should handle reindex errors', async () => {
    const mockError = {
      response: {
        data: {
          error: {
            message: 'Reindex failed'
          }
        }
      }
    }

    mockedApi.post.mockRejectedValueOnce(mockError)

    const { result } = renderHook(() => useSearchAnalytics(projectId))

    await expect(result.current.reindexProject()).rejects.toThrow('Reindex failed')
  })
})