'use client'

import { useStoryInsights } from '@/hooks/use-story-discovery'

interface StoryInsightsProps {
  projectId: string
  className?: string
}

export function StoryInsights({ projectId, className = '' }: StoryInsightsProps) {
  const { insights, isLoading, error, refetch } = useStoryInsights(projectId)

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground">Story Insights</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg shadow p-6 animate-pulse">
              <div className="h-8 bg-muted rounded mb-2"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-foreground">Story Insights</h3>
          <button
            onClick={refetch}
            className="text-sm text-primary hover:text-primary/90"
          >
            Try again
          </button>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  if (!insights) {
    return null
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const getEngagementColor = (score: number) => {
    if (score >= 80) return 'text-success-foreground bg-success/10'
    if (score >= 60) return 'text-warning-foreground bg-warning/10'
    if (score >= 40) return 'text-warning-foreground bg-warning/20'
    return 'text-destructive-foreground bg-destructive/10'
  }

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'text-success-foreground bg-success/10'
    if (rate >= 60) return 'text-info-foreground bg-info/10'
    if (rate >= 40) return 'text-warning-foreground bg-warning/10'
    return 'text-muted-foreground bg-muted'
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-foreground">Story Insights</h3>
        <button
          onClick={refetch}
          className="text-sm text-primary hover:text-primary/90"
        >
          Refresh
        </button>
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-info-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-muted-foreground truncate">
                  Total Stories
                </dt>
                <dd className="text-2xl font-bold text-foreground">
                  {insights.totalStories}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-success-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-muted-foreground truncate">
                  Total Duration
                </dt>
                <dd className="text-2xl font-bold text-foreground">
                  {formatDuration(insights.totalDuration)}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-muted-foreground truncate">
                  Chapters Completed
                </dt>
                <dd className="text-2xl font-bold text-foreground">
                  {insights.chaptersCompleted}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-warning-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-muted-foreground truncate">
                  Avg Duration
                </dt>
                <dd className="text-2xl font-bold text-foreground">
                  {formatDuration(insights.averageDuration)}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Engagement and completion metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-card rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-foreground mb-4">Engagement Score</h4>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Overall engagement</span>
            <span className={`px-2 py-1 rounded-full text-sm font-medium ${getEngagementColor(insights.engagementScore)}`}>
              {Math.round(insights.engagementScore)}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary-foreground h-2 rounded-full transition-all duration-300" 
              style={{ width: `${insights.engagementScore}%` }}
            ></div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Based on interactions and feedback received
          </p>
        </div>

        <div className="bg-card rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-foreground mb-4">Completion Rate</h4>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Stories with interactions</span>
            <span className={`px-2 py-1 rounded-full text-sm font-medium ${getCompletionColor(insights.completionRate)}`}>
              {Math.round(insights.completionRate)}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-info-foreground h-2 rounded-full transition-all duration-300" 
              style={{ width: `${insights.completionRate}%` }}
            ></div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Percentage of stories that received family feedback
          </p>
        </div>
      </div>

      {/* Most active chapter */}
      <div className="bg-card rounded-lg shadow p-6">
        <h4 className="text-lg font-medium text-foreground mb-4">Most Active Chapter</h4>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-semibold text-foreground">
              {insights.mostActiveChapter}
            </p>
            <p className="text-sm text-muted-foreground">
              This chapter has the most stories and engagement
            </p>
          </div>
          <div className="flex-shrink-0">
            <svg className="h-12 w-12 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}