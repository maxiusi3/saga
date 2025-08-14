import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../lib/api'

export interface SearchResult {
  story: {
    id: string
    projectId: string
    storytellerId: string
    title?: string
    audioUrl: string
    audioDuration?: number
    transcript?: string
    photoUrl?: string
    chapterId?: string
    status: string
    createdAt: string
    updatedAt: string
  }
  rank: number
  headline?: string
}

export interface SearchOptions {
  page?: number
  limit?: number
  chapterIds?: string[]
  facilitatorIds?: string[]
  dateFrom?: Date
  dateTo?: Date
  sortBy?: 'relevance' | 'date'
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  page: number
  limit: number
  hasMore: boolean
  searchTime: number
}

export interface SearchSuggestion {
  suggestions: string[]
}

export interface SearchAnalytics {
  topQueries: Array<{ query: string; count: number }>
  totalSearches: number
  averageResultCount: number
  averageSearchTime: number
}

export function useSearch(projectId: string) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [searchTime, setSearchTime] = useState(0)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  const searchStories = useCallback(async (
    searchQuery: string,
    options: SearchOptions = {},
    append = false
  ) => {
    if (!searchQuery.trim()) {
      setResults([])
      setTotal(0)
      setHasMore(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        page: (options.page || 1).toString(),
        limit: (options.limit || 20).toString(),
        ...(options.sortBy && { sortBy: options.sortBy }),
        ...(options.dateFrom && { dateFrom: options.dateFrom.toISOString() }),
        ...(options.dateTo && { dateTo: options.dateTo.toISOString() })
      })

      if (options.chapterIds?.length) {
        options.chapterIds.forEach(id => params.append('chapters', id))
      }

      if (options.facilitatorIds?.length) {
        options.facilitatorIds.forEach(id => params.append('facilitators', id))
      }

      const response = await api.get(`/projects/${projectId}/search?${params}`)
      const data: SearchResponse = response.data.data

      if (append) {
        setResults(prev => [...prev, ...data.results])
      } else {
        setResults(data.results)
      }

      setTotal(data.total)
      setPage(data.page)
      setHasMore(data.hasMore)
      setSearchTime(data.searchTime)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Search failed')
      if (!append) {
        setResults([])
        setTotal(0)
        setHasMore(false)
      }
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const getSuggestions = useCallback(async (partialQuery: string) => {
    if (!partialQuery.trim() || partialQuery.length < 2) {
      setSuggestions([])
      return
    }

    setLoadingSuggestions(true)

    try {
      const response = await api.get(`/projects/${projectId}/search/suggestions`, {
        params: { q: partialQuery, limit: 5 }
      })
      const data: SearchSuggestion = response.data.data
      setSuggestions(data.suggestions)
    } catch (err) {
      setSuggestions([])
    } finally {
      setLoadingSuggestions(false)
    }
  }, [projectId])

  const loadMore = useCallback(() => {
    if (hasMore && !loading && query) {
      searchStories(query, { page: page + 1 }, true)
    }
  }, [hasMore, loading, query, page, searchStories])

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
    setTotal(0)
    setPage(1)
    setHasMore(false)
    setError(null)
    setSuggestions([])
  }, [])

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query) {
        searchStories(query, { page: 1 })
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, searchStories])

  // Debounced suggestions
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      getSuggestions(query)
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [query, getSuggestions])

  const searchWithOptions = useCallback((
    searchQuery: string,
    options: SearchOptions = {}
  ) => {
    setQuery(searchQuery)
    setPage(1)
    searchStories(searchQuery, { ...options, page: 1 })
  }, [searchStories])

  return {
    // State
    results,
    loading,
    error,
    query,
    total,
    page,
    hasMore,
    searchTime,
    suggestions,
    loadingSuggestions,

    // Actions
    setQuery,
    searchStories: searchWithOptions,
    loadMore,
    clearSearch,
    getSuggestions
  }
}

export function useSearchAnalytics(projectId: string) {
  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async (options: {
    dateFrom?: Date
    dateTo?: Date
    limit?: number
  } = {}) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        ...(options.limit && { limit: options.limit.toString() }),
        ...(options.dateFrom && { dateFrom: options.dateFrom.toISOString() }),
        ...(options.dateTo && { dateTo: options.dateTo.toISOString() })
      })

      const response = await api.get(`/projects/${projectId}/search/analytics?${params}`)
      setAnalytics(response.data.data)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch analytics')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const reindexProject = useCallback(async () => {
    try {
      const response = await api.post(`/projects/${projectId}/search/reindex`)
      return response.data.data.reindexedCount
    } catch (err: any) {
      throw new Error(err.response?.data?.error?.message || 'Failed to reindex project')
    }
  }, [projectId])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  return {
    analytics,
    loading,
    error,
    fetchAnalytics,
    reindexProject
  }
}