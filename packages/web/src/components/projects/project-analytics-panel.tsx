'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { formatRelativeTime } from '@/lib/utils'
import { apiClient } from '@/lib/api'

interface ProjectAnalytics {
  totalStories: number
  totalDuration: number
  totalInteractions: number
  completedChapters: number
  totalChapters: number
  averageStoryLength: number
  storiesThisWeek: number
  storiesThisMonth: number
  facilitatorStats: Array<{
    facilitatorId: string
    facilitatorName: string
    interactionCount: number
    lastActive: string
  }>
  storytellerStats: Array<{
    storytellerId: string
    storytellerName: string
    storyCount: number
    totalDuration: number
    lastStory: string
  }>
  weeklyActivity: Array<{
    date: string
    stories: number
    interactions: number
  }>
  chapterProgress: Array<{
    chapterId: string
    chapterName: string
    storyCount: number
    isCompleted: boolean
  }>
}

interface ProjectAnalyticsPanelProps {
  projectId: string
}

export function ProjectAnalyticsPanel({ projectId }: ProjectAnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('month')

  useEffect(() => {
    fetchProjectAnalytics()
  }, [projectId, timeRange])

  const fetchProjectAnalytics = async () => {
    try {
      setIsLoading(true)
      const response = await apiClient.get(`/api/projects/${projectId}/analytics`, {
        params: { timeRange }
      })
      setAnalytics(response.data.data)
    } catch (error) {
      console.error('Failed to fetch project analytics:', error)
      toast.error('Failed to load project analytics')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const getProgressPercentage = (completed: number, total: number) => {
    if (total === 0) return 0
    return Math.round((completed / total) * 100)
  }

  if (isLoading) {
    return (
      <div className="bg-background rounded-lg shadow">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-medium text-foreground">Project Analytics</h2>
        </div>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="text-center">
                  <div className="h-8 bg-muted rounded w-12 mx-auto mb-2"></div>
                  <div className="h-4 bg-muted rounded w-16 mx-auto"></div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="h-4 bg-muted rounded w-1/3"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="bg-background rounded-lg shadow">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-medium text-foreground">Project Analytics</h2>
        </div>
        <div className="p-6">
          <div className="text-center py-6">
            <svg className="mx-auto h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="mt-2 text-sm text-muted-foreground">No analytics data available</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background rounded-lg shadow">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">Project Analytics</h2>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="text-sm border-border rounded-md"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>
      
      <div className="p-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {analytics.totalStories}
            </div>
            <div className="text-sm text-muted-foreground">Total Stories</div>
            {timeRange !== 'all' && (
              <div className="text-xs text-muted-foreground/80 mt-1">
                +{timeRange === 'week' ? analytics.storiesThisWeek : analytics.storiesThisMonth} this {timeRange}
              </div>
            )}
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary">
              {formatDuration(analytics.totalDuration)}
            </div>
            <div className="text-sm text-muted-foreground">Total Duration</div>
            <div className="text-xs text-muted-foreground/80 mt-1">
              Avg: {formatDuration(analytics.averageStoryLength)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {analytics.totalInteractions}
            </div>
            <div className="text-sm text-muted-foreground">Interactions</div>
            <div className="text-xs text-muted-foreground/80 mt-1">
              Comments & Questions
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {getProgressPercentage(analytics.completedChapters, analytics.totalChapters)}%
            </div>
            <div className="text-sm text-muted-foreground">Progress</div>
            <div className="text-xs text-muted-foreground/80 mt-1">
              {analytics.completedChapters}/{analytics.totalChapters} chapters
            </div>
          </div>
        </div>

        {/* Chapter Progress */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-foreground mb-4">Chapter Progress</h3>
          <div className="space-y-3">
            {analytics.chapterProgress.map((chapter) => (
              <div key={chapter.chapterId} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {chapter.chapterName}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {chapter.storyCount} stories
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        chapter.isCompleted ? 'bg-green-500' : 'bg-primary'
                      }`}
                      style={{
                        width: chapter.isCompleted ? '100%' : `${Math.min(chapter.storyCount * 20, 80)}%`
                      }}
                    ></div>
                  </div>
                </div>
                {chapter.isCompleted && (
                  <div className="ml-3">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Facilitator Activity */}
        {analytics.facilitatorStats.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-foreground mb-4">Facilitator Activity</h3>
            <div className="space-y-3">
              {analytics.facilitatorStats.map((facilitator) => (
                <div
                  key={facilitator.facilitatorId}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {facilitator.facilitatorName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {facilitator.interactionCount} interactions • Active {formatRelativeTime(facilitator.lastActive)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">
                      {facilitator.interactionCount}
                    </div>
                    <div className="text-xs text-muted-foreground">interactions</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Storyteller Activity */}
        {analytics.storytellerStats.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">Storyteller Activity</h3>
            <div className="space-y-3">
              {analytics.storytellerStats.map((storyteller) => (
                <div
                  key={storyteller.storytellerId}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {storyteller.storytellerName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {storyteller.storyCount} stories • {formatDuration(storyteller.totalDuration)} • Last story {formatRelativeTime(storyteller.lastStory)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">
                      {storyteller.storyCount}
                    </div>
                    <div className="text-xs text-muted-foreground">stories</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}