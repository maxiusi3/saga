'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DiscoveryFilters } from '@saga/shared'
import { useStoryTimeline } from '@/hooks/use-story-discovery'
import { formatRelativeTime } from '@/lib/utils'

interface StoryTimelineProps {
  projectId: string
  className?: string
}

export function StoryTimeline({ projectId, className = '' }: StoryTimelineProps) {
  const [filters, setFilters] = useState<DiscoveryFilters>({})
  const { timeline, isLoading, error, refetch } = useStoryTimeline(projectId, filters)

  const updateFilters = (newFilters: Partial<DiscoveryFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  const clearFilters = () => {
    setFilters({})
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Story Timeline</h3>
        </div>
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-3">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="bg-white rounded-lg shadow p-4">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  </div>
                ))}
              </div>
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
          <h3 className="text-lg font-medium text-gray-900">Story Timeline</h3>
          <button
            onClick={refetch}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Try again
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  if (!timeline || timeline.stories.length === 0) {
    return (
      <div className={`${className}`}>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Story Timeline</h3>
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No stories found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Stories will appear here as they are recorded.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Story Timeline</h3>
        <div className="flex items-center space-x-2">
          {(filters.chapterId || filters.storytellerId || filters.dateFrom || filters.dateTo) && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-700"
            >
              Clear filters
            </button>
          )}
          <button
            onClick={refetch}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date From
            </label>
            <input
              type="date"
              value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
              onChange={(e) => updateFilters({ 
                dateFrom: e.target.value ? new Date(e.target.value) : undefined 
              })}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date To
            </label>
            <input
              type="date"
              value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''}
              onChange={(e) => updateFilters({ 
                dateTo: e.target.value ? new Date(e.target.value) : undefined 
              })}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chapter
            </label>
            <select
              value={filters.chapterId || ''}
              onChange={(e) => updateFilters({ chapterId: e.target.value || undefined })}
              className="input text-sm"
            >
              <option value="">All Chapters</option>
              {/* TODO: Add chapter options */}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Storyteller
            </label>
            <select
              value={filters.storytellerId || ''}
              onChange={(e) => updateFilters({ storytellerId: e.target.value || undefined })}
              className="input text-sm"
            >
              <option value="">All Storytellers</option>
              {/* TODO: Add storyteller options */}
            </select>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-8">
        {timeline.timeline.map((timelineEntry, index) => (
          <div key={timelineEntry.date} className="relative">
            {/* Date header */}
            <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-4 py-2 rounded-t-lg">
              <h4 className="text-sm font-medium text-gray-900">
                {formatDate(timelineEntry.date)}
              </h4>
              <p className="text-xs text-gray-500">
                {timelineEntry.stories.length} {timelineEntry.stories.length === 1 ? 'story' : 'stories'}
              </p>
            </div>

            {/* Stories for this date */}
            <div className="bg-white border-l-4 border-primary-200 pl-4 space-y-4 py-4">
              {timelineEntry.stories.map((story, storyIndex) => (
                <div
                  key={story.id}
                  className="relative bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200"
                >
                  {/* Timeline connector */}
                  <div className="absolute -left-6 top-6 w-3 h-3 bg-primary-500 rounded-full border-2 border-white shadow"></div>
                  
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900 mb-2">
                        {story.title || 'Untitled Story'}
                      </h5>
                      
                      {story.transcript && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {story.transcript}
                        </p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        {story.audioDuration && (
                          <div className="flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {Math.round(story.audioDuration / 60)} min
                          </div>
                        )}
                        <span>{formatRelativeTime(story.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {story.photoUrl && (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                          <img
                            src={story.photoUrl}
                            alt="Story photo"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <Link
                        href={`/dashboard/stories/${story.id}`}
                        className="btn-primary text-xs"
                      >
                        Listen
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-8 bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {timeline.stories.length}
            </div>
            <div className="text-sm text-gray-600">Total Stories</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {timeline.timeline.length}
            </div>
            <div className="text-sm text-gray-600">Recording Days</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(
                timeline.stories.reduce((sum, story) => sum + (story.audioDuration || 0), 0) / 60
              )}
            </div>
            <div className="text-sm text-gray-600">Total Minutes</div>
          </div>
        </div>
      </div>
    </div>
  )
}