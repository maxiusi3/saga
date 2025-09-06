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
      <div className={`bg-background rounded-lg border border-border p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Loading analytics...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-background rounded-lg border border-border p-6 ${className}`}>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive-foreground">
          <p className="font-medium">Error Loading Analytics</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={() => fetchAnalytics()}
            className="mt-2 text-sm text-destructive hover:text-destructive/80 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-background rounded-lg border border-border ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BarChart3 className="w-5 h-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-foreground">Search Analytics</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleReindex}
              disabled={reindexing}
              className="flex items-center px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${reindexing ? 'animate-spin' : ''}`} />
              {reindexing ? 'Reindexing...' : 'Reindex Stories'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Date Range Filter */}
        <div className="mb-6 p-4 bg-muted rounded-lg">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Filter by Date Range</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="analyticsDateFrom" className="text-sm text-muted-foreground">
                From:
              </label>
              <input
                id="analyticsDateFrom"
                type="date"
                value={dateRange.dateFrom?.toISOString().split('T')[0] || ''}
                onChange={(e) => handleDateRangeChange('dateFrom', e.target.value)}
                className="px-3 py-1 border border-input rounded text-sm focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label htmlFor="analyticsDateTo" className="text-sm text-muted-foreground">
                To:
              </label>
              <input
                id="analyticsDateTo"
                type="date"
                value={dateRange.dateTo?.toISOString().split('T')[0] || ''}
                onChange={(e) => handleDateRangeChange('dateTo', e.target.value)}
                className="px-3 py-1 border border-input rounded text-sm focus:ring-2 focus:ring-ring"
              />
            </div>
            {(dateRange.dateFrom || dateRange.dateTo) && (
              <button
                onClick={() => {
                  setDateRange({})
                  fetchAnalytics()
                }}
                className="text-sm text-primary hover:text-primary/90"
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
              ? 'bg-destructive/10 text-destructive-foreground border border-destructive/20'
              : 'bg-success/10 text-success-foreground border border-success/20'
          }`}>
            {reindexResult}
          </div>
        )}

        {analytics && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-primary/10 rounded-lg p-4">
                <div className="flex items-center">
                  <Search className="w-8 h-8 text-primary mr-3" />
                  <div>
                    <p className="text-sm text-primary font-medium">Total Searches</p>
                    <p className="text-2xl font-bold text-primary-foreground">
                      {analytics.totalSearches.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-success/10 rounded-lg p-4">
                <div className="flex items-center">
                  <TrendingUp className="w-8 h-8 text-success mr-3" />
                  <div>
                    <p className="text-sm text-success font-medium">Avg Results</p>
                    <p className="text-2xl font-bold text-success-foreground">
                      {analytics.averageResultCount.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-secondary/10 rounded-lg p-4">
                <div className="flex items-center">
                  <Clock className="w-8 h-8 text-secondary mr-3" />
                  <div>
                    <p className="text-sm text-secondary font-medium">Avg Search Time</p>
                    <p className="text-2xl font-bold text-secondary-foreground">
                      {formatDuration(analytics.averageSearchTime)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Queries */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Top Search Queries</h3>
              
              {analytics.topQueries.length > 0 ? (
                <div className="space-y-3">
                  {analytics.topQueries.map((queryData, index) => (
                    <div
                      key={queryData.query}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center">
                        <span className="flex items-center justify-center w-6 h-6 bg-primary/20 text-primary text-sm font-medium rounded-full mr-3">
                          {index + 1}
                        </span>
                        <span className="font-medium text-foreground">
                          "{queryData.query}"
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm text-muted-foreground mr-2">
                          {queryData.count} search{queryData.count !== 1 ? 'es' : ''}
                        </span>
                        <div className="w-20 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
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
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="w-12 h-12 text-muted-foreground/80 mx-auto mb-4" />
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