'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DiscoveryFilters } from '@saga/shared'
import { useStoryTimeline } from '@/hooks/use-story-discovery'
import { formatRelativeTime } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Timeline, TimelineItem, TimelineConnector, TimelineHeader, TimelineTitle, TimelineContent } from '@/components/ui/timeline'
import { Story } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
        <Skeleton className="h-8 w-1/3" />
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <Skeleton className="h-6 w-1/4 mb-4" />
              <div className="space-y-3">
                {[...Array(2)].map((_, j) => (
                  <Card key={j} className="p-4">
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-3/4" />
                  </Card>
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
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        <p>Error loading stories. Please try again later.</p>
      </div>
    )
  }

  if (!timeline || timeline.stories.length === 0) {
    return (
      <div className={`${className}`}>
        <h3 className="text-lg font-medium text-foreground mb-4">Story Timeline</h3>
        <div className="text-center py-8">
          <p className="mt-1 text-sm text-muted-foreground">
            No stories found. Stories will appear here as they are recorded.
          </p>
        </div>
      </div>
    )
  }

  const filteredStories = timeline.stories;

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-foreground">Story Timeline</h3>
        <div className="flex items-center space-x-2">
          {(filters.chapterId || filters.storytellerId || filters.dateFrom || filters.dateTo) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Date From
            </label>
            <Input
              type="date"
              value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
              onChange={(e) => updateFilters({
                dateFrom: e.target.value ? new Date(e.target.value) : undefined
              })}
              className="text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Date To
            </label>
            <Input
              type="date"
              value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''}
              onChange={(e) => updateFilters({
                dateTo: e.target.value ? new Date(e.target.value) : undefined
              })}
              className="text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Chapter
            </label>
            <Select
              value={filters.chapterId || ''}
              onValueChange={(value) => updateFilters({ chapterId: value || undefined })}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="All Chapters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Chapters</SelectItem>
                
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Storyteller
            </label>
            <Select
              value={filters.storytellerId || ''}
              onValueChange={(value) => updateFilters({ storytellerId: value || undefined })}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="All Storytellers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Storytellers</SelectItem>
                
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Timeline>
        {timeline.timeline.map((timelineEntry) => (
          <TimelineItem key={timelineEntry.date}>
            <TimelineConnector />
            <TimelineHeader>
              <TimelineTitle>{formatDate(timelineEntry.date)}</TimelineTitle>
              <p className="text-xs text-muted-foreground ml-2">
                {timelineEntry.stories.length} {timelineEntry.stories.length === 1 ? 'story' : 'stories'}
              </p>
            </TimelineHeader>
            <TimelineContent className="space-y-4">
              {timelineEntry.stories.map((story: Story) => (
                <Card key={story.id} className="p-4 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="font-medium text-foreground mb-2">
                        {story.title || 'Untitled Story'}
                      </h5>
                      {story.transcript && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {story.transcript}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        {story.audio_duration && (
                          <div className="flex items-center">
                            {Math.round(story.audio_duration / 60)} min
                          </div>
                        )}
                        <span>{formatRelativeTime(story.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {story.photo_url && (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                          <img
                            src={story.photo_url}
                            alt="Story photo"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <Link href={`/dashboard/stories/${story.id}`} passHref>
                        <Button asChild size="sm">
                          <a>Listen</a>
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>

      {filteredStories.length > 0 && (
        <Card className="mt-8 p-4">
          <h3 className="mb-2 text-lg font-semibold text-card-foreground">Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Stories</p>
              <p className="font-bold text-card-foreground">{filteredStories.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Core Stories</p>
              <p className="font-bold text-card-foreground">{filteredStories.filter(s => s.is_core).length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">User Stories</p>
              <p className="font-bold text-card-foreground">{filteredStories.filter(s => !s.is_core).length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Latest Story</p>
              <p className="font-bold text-card-foreground">{new Date(filteredStories[0].created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}