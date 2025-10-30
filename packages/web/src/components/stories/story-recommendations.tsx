'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { StoryRecommendation } from '@saga/shared'
import { useStoryRecommendations } from '@/hooks/use-story-discovery'
import { formatRelativeTime } from '@/lib/utils'

interface StoryRecommendationsProps {
  projectId: string
  limit?: number
  className?: string
}

export function StoryRecommendations({ 
  projectId, 
  limit = 6,
  className = '' 
}: StoryRecommendationsProps) {
  const locale = useLocale()
  const withLocale = (path: string) => {
    if (!path || typeof path !== 'string') return path as any
    if (!path.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }
  const { recommendations, isLoading, error, refetch } = useStoryRecommendations(projectId, limit)
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set())

  const toggleReason = (storyId: string) => {
    const newExpanded = new Set(expandedReasons)
    if (newExpanded.has(storyId)) {
      newExpanded.delete(storyId)
    } else {
      newExpanded.add(storyId)
    }
    setExpandedReasons(newExpanded)
  }

  const getRecommendationIcon = (type: StoryRecommendation['type']) => {
    switch (type) {
      case 'chapter_related':
        return (
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        )
      case 'similar_content':
        return (
          <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'popular':
        return (
          <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground">Recommended Stories</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg shadow p-4 animate-pulse">
              <div className="h-4 bg-muted rounded mb-2"></div>
              <div className="h-3 bg-muted rounded mb-4"></div>
              <div className="h-3 bg-muted rounded w-3/4"></div>
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
          <h3 className="text-lg font-medium text-foreground">Recommended Stories</h3>
          <button
            onClick={refetch}
            className="text-sm text-primary hover:text-primary/90"
          >
            Try again
          </button>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-sm text-destructive-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className={`${className}`}>
        <h3 className="text-lg font-medium text-foreground mb-4">Recommended Stories</h3>
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-foreground">No recommendations yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Start listening to stories to get personalized recommendations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-foreground">Recommended Stories</h3>
        <button
          onClick={refetch}
          className="text-sm text-primary hover:text-primary/90"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map((recommendation) => (
          <div
            key={recommendation.story.id}
            className="bg-card rounded-lg shadow hover:shadow-md transition-shadow duration-200 overflow-hidden"
          >
            <div className="p-4">
              {/* Recommendation type and score */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getRecommendationIcon(recommendation.type)}
                  <span className="text-xs font-medium text-muted-foreground capitalize">
                    {recommendation.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-12 bg-muted rounded-full h-1.5">
                    <div 
                      className="bg-primary h-1.5 rounded-full" 
                      style={{ width: `${recommendation.score * 100}%` }}
                    ></div>
                  </div>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {Math.round(recommendation.score * 100)}%
                  </span>
                </div>
              </div>

              {/* Story title */}
              <h4 className="font-medium text-foreground mb-2 line-clamp-2">
                {recommendation.story.title || 'Untitled Story'}
              </h4>

              {/* Story excerpt */}
              {recommendation.story.transcript && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                  {recommendation.story.transcript}
                </p>
              )}

              {/* Story metadata */}
              <div className="flex items-center space-x-4 text-xs text-muted-foreground mb-3">
                {recommendation.story.audio_duration && (
                  <div className="flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {Math.round(recommendation.story.audio_duration / 60)} min
                  </div>
                )}
                <span>{formatRelativeTime(recommendation.story.created_at)}</span>
              </div>

              {/* Recommendation reason */}
              <div className="mb-4">
                <button
                  onClick={() => toggleReason(recommendation.story.id)}
                  className="text-xs text-primary hover:text-primary/90 flex items-center"
                >
                  Why recommended?
                  <svg 
                    className={`w-3 h-3 ml-1 transform transition-transform ${
                      expandedReasons.has(recommendation.story.id) ? 'rotate-180' : ''
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedReasons.has(recommendation.story.id) && (
                  <p className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded">
                    {recommendation.reason}
                  </p>
                )}
              </div>

              {/* Action button */}
              <Link
                href={withLocale(`/dashboard/stories/${recommendation.story.id}`)}
                className="block w-full text-center bg-primary text-primary-foreground text-sm font-medium py-2 px-4 rounded hover:bg-primary/90 transition-colors"
              >
                Listen & Interact
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}