'use client'

// Fixed StoryCard component for CI build compatibility

import * as React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageCircle, HelpCircle, Heart, Clock, Sparkles, Volume2, Edit, Trash2, MoreHorizontal } from 'lucide-react'
import { AIGeneratedContent } from '../../../shared/src/lib/ai-services'
import { ActionPermissionGate, usePermissionContext } from '@/components/permissions/PermissionGate'
import { UserRole } from '@saga/shared'

interface Story {
  id: string
  title: string
  storyteller_name: string
  storyteller_avatar?: string
  duration: number
  created_at: string
  audio_url: string
  category: string
  prompt: string
  ai_content?: AIGeneratedContent
  interaction_summary?: {
    comments: number
    followups: number
    appreciations: number
  }
  has_new_interactions: boolean
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
    minute: '2-digit'
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
  isProjectOwner = false
}: StoryCardProps) {
  const getTotalInteractions = () => {
    if (!story.interaction_summary) return 0
    return (story.interaction_summary.comments || 0) +
           (story.interaction_summary.followups || 0) +
           (story.interaction_summary.appreciations || 0)
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
                {showAIContent && story.ai_content?.title ? story.ai_content.title : story.title}
              </h3>
              {showAIContent && story.ai_content?.title && (
                <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
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
            <ActionPermissionGate action="canEditStoryTitles" userRole={userRole} isProjectOwner={isProjectOwner}>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit?.(story.id)
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </ActionPermissionGate>

            <ActionPermissionGate action="canDeleteStories" userRole={userRole} isProjectOwner={isProjectOwner}>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
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

        {/* Storyteller */}
        <div className="flex items-center space-x-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={story.storyteller_avatar} />
            <AvatarFallback className="bg-furbridge-teal text-white text-sm">
              {story.storyteller_name ? story.storyteller_name.split(' ').map(n => n[0]).join('') : 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-gray-900 text-sm">
              {story.storyteller_name}
            </div>
          </div>
        </div>

        {/* AI Transcript Snippet */}
        {showAIContent && story.ai_content?.transcript && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <Volume2 className="h-4 w-4 text-furbridge-teal mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700 line-clamp-3">
                {story.ai_content.summary || story.ai_content.transcript.substring(0, 150) + '...'}
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
            <div className="flex items-center space-x-1">
              <MessageCircle className="h-4 w-4" />
              <span>{story.interaction_summary?.comments || 0}</span>
            </div>
            <div className="flex items-center space-x-1">
              <HelpCircle className="h-4 w-4" />
              <span>{story.interaction_summary?.followups || 0}</span>
            </div>
          </div>
          <div>
            {formatDateTime(story.created_at)}
          </div>
        </div>

        {/* Interaction Summary */}
        {getTotalInteractions() > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              {story.interaction_summary?.comments && story.interaction_summary.comments > 0 && (
                <div className="flex items-center space-x-1">
                  <MessageCircle className="h-3 w-3" />
                  <span>{story.interaction_summary.comments} comment{story.interaction_summary.comments !== 1 ? 's' : ''}</span>
                </div>
              )}
              {story.interaction_summary?.followups && story.interaction_summary.followups > 0 && (
                <div className="flex items-center space-x-1">
                  <HelpCircle className="h-3 w-3" />
                  <span>{story.interaction_summary.followups} follow-up{story.interaction_summary.followups !== 1 ? 's' : ''}</span>
                </div>
              )}
              {story.interaction_summary?.appreciations && story.interaction_summary.appreciations > 0 && (
                <div className="flex items-center space-x-1">
                  <Heart className="h-3 w-3" />
                  <span>{story.interaction_summary.appreciations}</span>
                </div>
              )}
            </div>
          </div>
        )}


      </div>
    </Card>
  )
}

export default StoryCard
