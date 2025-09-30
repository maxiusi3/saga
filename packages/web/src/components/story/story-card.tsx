'use client'

// Fixed StoryCard component for CI build compatibility

import * as React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Heart,
  Clock,
  Sparkles,
  Volume2,
  Edit,
  Trash2,
  MoreHorizontal,
} from 'lucide-react'
import { AIGeneratedContent } from '@saga/shared/lib/ai-services'
import {
  ActionPermissionGate,
  usePermissionContext,
} from '@/components/permissions/PermissionGate'
import { UserRole } from '@saga/shared'
import { formatDistanceToNow } from 'date-fns'

interface Story {
  id: string
  title: string
  content: string
  duration: number
  created_at: string
  audio_url: string
  category: string
  prompt: string
  ai_content?: AIGeneratedContent
  has_new_interactions: boolean
  comments_count: number
  follow_ups_count: number
  latest_interaction_time: string | null
}

interface StoryCardProps {
  story: Story
  onPlay?: (storyId: string) => void
  onViewDetails?: (storyId: string) => void
  onEdit?: (storyId: string) => void
  onDelete?: (storyId: string) => void
  showAIContent?: boolean
  userRole?: UserRole
  isProjectOwner?: boolean
}

// Helper functions for formatting story data
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function StoryCard({
  story,
  onPlay,
  onViewDetails,
  onEdit,
  onDelete,
  showAIContent = true,
  userRole,
  isProjectOwner = false,
}: StoryCardProps) {
  const getTotalInteractions = () => {
    return (story.comments_count || 0) + (story.follow_ups_count || 0)
  }

  return (
    <Card
      className="group p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer border-border/50 hover:border-primary/20"
      onClick={() => onViewDetails?.(story.id)}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            {/* AI-Generated Title */}
            <div className="flex items-start space-x-2">
              <h3 className="text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                {showAIContent && story.ai_content?.title
                  ? story.ai_content.title
                  : story.title}
              </h3>
              {showAIContent && story.ai_content?.title && (
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-primary text-xs"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              )}
            </div>

            {/* Category & Prompt */}
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="text-xs">
                {story.category}
              </Badge>
              <span>•</span>
              <span className="line-clamp-1">{story.prompt}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 ml-4">
            {/* Interaction Indicator */}
            {story.has_new_interactions && (
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}

            {/* Permission-based Actions */}
            <ActionPermissionGate
              action="canEditStoryTitles"
              userRole={userRole}
              isProjectOwner={isProjectOwner}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={e => {
                  e.stopPropagation()
                  onEdit?.(story.id)
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </ActionPermissionGate>

            <ActionPermissionGate
              action="canDeleteStories"
              userRole={userRole}
              isProjectOwner={isProjectOwner}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={e => {
                  e.stopPropagation()
                  onDelete?.(story.id)
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </ActionPermissionGate>
          </div>
        </div>

        {/* Story Content */}
        {story.content && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {story.content}
          </p>
        )}

        {/* AI Transcript Snippet */}
        {showAIContent && story.ai_content?.transcript && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <Volume2 className="h-4 w-4 text-furbridge-teal mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700 line-clamp-3">
                {story.ai_content.summary ||
                  story.ai_content.transcript.substring(0, 150) + '...'}
              </p>
            </div>
          </div>
        )}

        {/* Story Metadata */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>{formatDuration(story.duration)}</span>
            </div>
            
            {/* Interaction counts */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <Heart className="h-3 w-3" />
                <span>{story.comments_count || 0}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Sparkles className="h-3 w-3" />
                <span>{story.follow_ups_count || 0}</span>
              </div>
            </div>
          </div>
          
          <div>
            {story.latest_interaction_time
              ? formatDistanceToNow(new Date(story.latest_interaction_time), {
                  addSuffix: true,
                })
              : formatDateTime(story.created_at)}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default StoryCard
