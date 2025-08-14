'use client'

import React, { useState } from 'react'
import { Search, TrendingUp, Clock, BarChart3, RefreshCw } from 'lucide-react'
import { useSearchAnalytics } from '../../hooks/use-search'

interface SearchAnalyticsProps {
  projectId: string
  className?: string
}

export function SearchAnalytics({ projectId, className = '' }: SearchAnalyticsProps) {
  const { analytics, loading, error, fetchAnalytics, reindexProject } = useSearchAnalytics(projectId)
  const [reindexing, setReindexing] = useState(false)
  const [reindexResult, setReindexResult] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{
    dateFrom?: Date
    dateTo?: Date
  }>({})

  const handleReindex = async () => {
    setReindexing(true)
    setReindexResult(null)
    
    try {
      const count = await reindexProject()
      setReindexResult(`Successfully reindexed ${count} stories`)
    } catch (err: any) {
      setReindexResult(`Error: ${err.message}`)
    } finally {
      setReindexing(false)
    }
  }

  const handleDateRangeChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    const newDateRange = {
      ...dateRange,
      [field]: value ? new Date(value) : undefined
    }
    setDateRange(newDateRange)
    fetchAnalytics(newDateRange)
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  if (loading && !analytics) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading analytics...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error Loading Analytics</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={() => fetchAnalytics()}
            className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BarChart3 className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Search Analytics</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleReindex}
              disabled={reindexing}
              className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${reindexing ? 'animate-spin' : ''}`} />
              {reindexing ? 'Reindexing...' : 'Reindex Stories'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Date Range Filter */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Filter by Date Range</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="analyticsDateFrom" className="text-sm text-gray-600">
                From:
              </label>
              <input
                id="analyticsDateFrom"
                type="date"
                value={dateRange.dateFrom?.toISOString().split('T')[0] || ''}
                onChange={(e) => handleDateRangeChange('dateFrom', e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label htmlFor="analyticsDateTo" className="text-sm text-gray-600">
                To:
              </label>
              <input
                id="analyticsDateTo"
                type="date"
                value={dateRange.dateTo?.toISOString().split('T')[0] || ''}
                onChange={(e) => handleDateRangeChange('dateTo', e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(dateRange.dateFrom || dateRange.dateTo) && (
              <button
                onClick={() => {
                  setDateRange({})
                  fetchAnalytics()
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Reindex Result */}
        {reindexResult && (
          <div className={`mb-6 p-3 rounded-lg text-sm ${
            reindexResult.startsWith('Error') 
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {reindexResult}
          </div>
        )}

        {analytics && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center">
                  <Search className="w-8 h-8 text-blue-600 mr-3" />
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Total Searches</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {analytics.totalSearches.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center">
                  <TrendingUp className="w-8 h-8 text-green-600 mr-3" />
                  <div>
                    <p className="text-sm text-green-600 font-medium">Avg Results</p>
                    <p className="text-2xl font-bold text-green-900">
                      {analytics.averageResultCount.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center">
                  <Clock className="w-8 h-8 text-purple-600 mr-3" />
                  <div>
                    <p className="text-sm text-purple-600 font-medium">Avg Search Time</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {formatDuration(analytics.averageSearchTime)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Queries */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Search Queries</h3>
              
              {analytics.topQueries.length > 0 ? (
                <div className="space-y-3">
                  {analytics.topQueries.map((queryData, index) => (
                    <div
                      key={queryData.query}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 text-sm font-medium rounded-full mr-3">
                          {index + 1}
                        </span>
                        <span className="font-medium text-gray-900">
                          "{queryData.query}"
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm text-gray-600 mr-2">
                          {queryData.count} search{queryData.count !== 1 ? 'es' : ''}
                        </span>
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(queryData.count / Math.max(...analytics.topQueries.map(q => q.count))) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p>No search queries yet</p>
                  <p className="text-sm">Analytics will appear as users search for stories</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}