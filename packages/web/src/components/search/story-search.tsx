'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Search, X, Filter, Clock, TrendingUp } from 'lucide-react'
import { useSearch } from '../../hooks/use-search'
import { SearchResult } from '../../hooks/use-search'

interface StorySearchProps {
  projectId: string
  onResultClick?: (result: SearchResult) => void
  className?: string
}

interface SearchFilters {
  sortBy: 'relevance' | 'date'
  dateFrom?: Date
  dateTo?: Date
  chapterIds?: string[]
}

export function StorySearch({ projectId, onResultClick, className = '' }: StorySearchProps) {
  const {
    results,
    loading,
    error,
    query,
    total,
    hasMore,
    searchTime,
    suggestions,
    loadingSuggestions,
    setQuery,
    searchStories,
    loadMore,
    clearSearch
  } = useSearch(projectId)

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: 'relevance'
  })
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Handle keyboard navigation for suggestions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestion(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedSuggestion >= 0) {
          handleSuggestionClick(suggestions[selectedSuggestion])
        } else if (query.trim()) {
          handleSearch()
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedSuggestion(-1)
        break
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    setShowSuggestions(false)
    setSelectedSuggestion(-1)
    searchStories(suggestion, filters)
  }

  const handleSearch = () => {
    if (query.trim()) {
      searchStories(query, filters)
      setShowSuggestions(false)
    }
  }

  const handleFilterChange = (newFilters: Partial<SearchFilters>) => {
    const updatedFilters = { ...filters, ...newFilters }
    setFilters(updatedFilters)
    if (query.trim()) {
      searchStories(query, updatedFilters)
    }
  }

  const handleClear = () => {
    clearSearch()
    setShowSuggestions(false)
    setSelectedSuggestion(-1)
    searchInputRef.current?.focus()
  }

  const formatSearchTime = (time: number) => {
    return time < 1000 ? `${time}ms` : `${(time / 1000).toFixed(2)}s`
  }

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text
    
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 px-1 rounded">
          {part}
        </mark>
      ) : part
    )
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !searchInputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
        setSelectedSuggestion(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowSuggestions(true)
              setSelectedSuggestion(-1)
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search stories by title or content..."
            className="w-full pl-10 pr-20 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            aria-label="Search stories"
            aria-expanded={showSuggestions}
            aria-haspopup="listbox"
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Toggle filters"
            >
              <Filter className="w-5 h-5" />
            </button>
            {query && (
              <button
                onClick={handleClear}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
            role="listbox"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                  index === selectedSuggestion ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
                role="option"
                aria-selected={index === selectedSuggestion}
              >
                <Search className="inline w-4 h-4 mr-2 text-gray-400" />
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="sortBy" className="text-sm font-medium text-gray-700">
                Sort by:
              </label>
              <select
                id="sortBy"
                value={filters.sortBy}
                onChange={(e) => handleFilterChange({ sortBy: e.target.value as 'relevance' | 'date' })}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="relevance">Relevance</option>
                <option value="date">Date</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label htmlFor="dateFrom" className="text-sm font-medium text-gray-700">
                From:
              </label>
              <input
                id="dateFrom"
                type="date"
                value={filters.dateFrom?.toISOString().split('T')[0] || ''}
                onChange={(e) => handleFilterChange({ 
                  dateFrom: e.target.value ? new Date(e.target.value) : undefined 
                })}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <label htmlFor="dateTo" className="text-sm font-medium text-gray-700">
                To:
              </label>
              <input
                id="dateTo"
                type="date"
                value={filters.dateTo?.toISOString().split('T')[0] || ''}
                onChange={(e) => handleFilterChange({ 
                  dateTo: e.target.value ? new Date(e.target.value) : undefined 
                })}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {query && (
        <div className="mt-6">
          {/* Results Header */}
          {!loading && (
            <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <span>
                  {total > 0 ? `${total} result${total !== 1 ? 's' : ''}` : 'No results'}
                  {query && ` for "${query}"`}
                </span>
                {searchTime > 0 && (
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatSearchTime(searchTime)}
                  </span>
                )}
              </div>
              {filters.sortBy === 'relevance' && total > 0 && (
                <span className="flex items-center text-blue-600">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Sorted by relevance
                </span>
              )}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Searching...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <p className="font-medium">Search Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Results List */}
          {!loading && !error && results.length > 0 && (
            <div className="space-y-4">
              {results.map((result) => (
                <div
                  key={result.story.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onResultClick?.(result)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-2">
                        {result.story.title ? 
                          highlightText(result.story.title, query) : 
                          'Untitled Story'
                        }
                      </h3>
                      
                      {result.headline && (
                        <div 
                          className="text-gray-600 text-sm mb-2 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: result.headline }}
                        />
                      )}
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>
                          {new Date(result.story.createdAt).toLocaleDateString()}
                        </span>
                        {result.story.audioDuration && (
                          <span>
                            {Math.floor(result.story.audioDuration / 60)}:
                            {(result.story.audioDuration % 60).toString().padStart(2, '0')}
                          </span>
                        )}
                        {filters.sortBy === 'relevance' && (
                          <span className="flex items-center">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            {(result.rank * 100).toFixed(1)}% match
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {result.story.photoUrl && (
                      <img
                        src={result.story.photoUrl}
                        alt="Story photo"
                        className="w-16 h-16 object-cover rounded-lg ml-4 flex-shrink-0"
                      />
                    )}
                  </div>
                </div>
              ))}

              {/* Load More Button */}
              {hasMore && (
                <div className="text-center pt-4">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Loading...' : 'Load More Results'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* No Results */}
          {!loading && !error && query && results.length === 0 && (
            <div className="text-center py-8">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No stories found</h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your search terms or filters
              </p>
              <button
                onClick={handleClear}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}