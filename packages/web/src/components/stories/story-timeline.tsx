'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { DiscoveryFilters } from '@saga/shared'
import { useStoryTimeline } from '@/hooks/use-story-discovery'
import { formatRelativeTime } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Timeline, TimelineItem, TimelineConnector, TimelineHeader, TimelineTitle, TimelineContent } from '@/components/ui/timeline'
import { Story } from '@/lib/stories'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Mic, MessageCircle, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StoryTimelineProps {
  projectId: string
  className?: string
}

export function StoryTimeline({ projectId, className = '' }: StoryTimelineProps) {
  const [filters, setFilters] = useState<DiscoveryFilters>({})
  const { timeline, isLoading, error, refetch } = useStoryTimeline(projectId, filters)
  const params = useParams()
  const locale = (params?.locale as string) || ''

  const withLocale = (path: string) => {
    const sanitized = path.startsWith('/') ? path : `/${path}`
    const hasLocale = /^\/(en|zh|zh-CN|zh-TW|fr|es)(\/|$)/.test(sanitized)
    if (!locale || hasLocale) return sanitized
    return `/${locale}${sanitized}`
  }

  const updateFilters = (newFilters: Partial<DiscoveryFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  const clearFilters = () => {
    setFilters({})
  }

  if (isLoading) {
    return <div className="p-8 text-center">Loading timeline...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">Error loading timeline</div>
  }

  if (!timeline || timeline.stories.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500">No stories yet. Start recording to build your timeline.</p>
      </div>
    )
  }

  // Group stories by Decade based on happened_at
  const groupedStories = timeline.stories.reduce((acc, story) => {
    const date = story.happened_at ? new Date(story.happened_at) : new Date(story.created_at)
    const year = date.getFullYear()
    const decade = Math.floor(year / 10) * 10
    const key = `${decade}s`

    if (!acc[key]) acc[key] = []
    acc[key].push(story)
    return acc
  }, {} as Record<string, Story[]>)

  // Sort decades descending
  const sortedDecades = Object.keys(groupedStories).sort((a, b) => parseInt(b) - parseInt(a))

  return (
    <div className={`space-y-8 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-serif font-medium text-stone-800 dark:text-stone-100">
          Your Timeline
        </h3>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div className="relative border-l-2 border-stone-200 dark:border-stone-800 ml-4 space-y-12">
        {sortedDecades.map(decade => (
          <div key={decade} className="relative pl-8">
            {/* Decade Marker */}
            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-stone-900 dark:bg-stone-100 border-4 border-white dark:border-stone-950" />

            <h4 className="text-2xl font-serif font-bold text-stone-300 dark:text-stone-700 mb-6 -mt-2">
              {decade}
            </h4>

            <div className="space-y-6">
              {groupedStories[decade].map(story => (
                <Card key={story.id} className="p-4 hover:shadow-lg transition-all duration-300 border-stone-200 dark:border-stone-800">
                  <div className="flex gap-4">
                    <div className="shrink-0 mt-1">
                      {story.recording_mode === 'chat' ? (
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full">
                          <MessageCircle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full">
                          <Mic className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="font-medium text-stone-900 dark:text-stone-100 truncate pr-4">
                          {story.title || 'Untitled Memory'}
                        </h5>
                        <span className="text-xs text-stone-400 whitespace-nowrap flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {story.happened_at ? new Date(story.happened_at).getFullYear() : new Date(story.created_at).getFullYear()}
                        </span>
                      </div>

                      <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2 mb-3">
                        {story.content || story.transcript || 'No description available.'}
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-stone-400">
                          {story.audio_duration ? `${Math.floor(story.audio_duration / 60)}:${(story.audio_duration % 60).toString().padStart(2, '0')}` : '0:00'}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-stone-100 dark:bg-stone-800">
                            <div className={cn("w-1.5 h-1.5 rounded-full", story.is_public ? "bg-green-500" : "bg-stone-400")} />
                            <span className="text-[10px] uppercase tracking-wider font-medium text-stone-500">
                              {story.is_public ? 'Public' : 'Private'}
                            </span>
                          </div>
                          <Link href={withLocale(`/dashboard/projects/${projectId}/stories/${story.id}`)}>
                            <Button size="sm" variant="outline" className="h-8 text-xs">
                              Listen
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}