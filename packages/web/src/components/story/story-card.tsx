'use client'

import { useState, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Play, Pause, MessageCircle, HelpCircle, Heart, Clock, Sparkles, Volume2, Edit, Trash2, MoreHorizontal } from 'lucide-react'
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
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handlePlayPause = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
      onPlay?.(story.id)
    }
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return 'Today'
    } else if (diffInHours < 48) {
      return 'Yesterday'
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const getTotalInteractions = () => {
    if (!story.interaction_summary) return 0
    return (story.interaction_summary.comments || 0) +
           (story.interaction_summary.followups || 0) +
           (story.interaction_summary.appreciations || 0)
  }

  return (
    <Card className="group p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer border-border/50 hover:border-primary/20" onClick={() => onViewDetails?.(story.id)}>
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

            {/* Category and Date */}
            <div className="flex items-center space-x-3 text-sm text-muted-foreground">
              <Badge variant="outline" className="text-xs border-muted-foreground/30">{story.category}</Badge>
              <span className="text-muted-foreground/60">•</span>
              <span>{formatDate(story.created_at)}</span>
              <span className="text-muted-foreground/60">•</span>
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{formatTime(story.duration)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {story.has_new_interactions && (
              <Badge className="bg-orange-500 text-white animate-pulse">New</Badge>
            )}

            {/* Edit and Delete Actions - Only for facilitators */}
            <ActionPermissionGate
              action="canEditStoryTitles"
              userRole={userRole}
              isProjectOwner={isProjectOwner}
            >
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit?.(story.id)
                  }}
                  className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                  title="编辑故事"
                >
                  <Edit className="h-3 w-3" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete?.(story.id)
                  }}
                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                  title="删除故事"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
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

        {/* Audio Player */}
        <div className="space-y-3">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handlePlayPause()
              }}
              className="w-10 h-10 rounded-full p-0 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
              title={isPlaying ? "暂停播放" : "播放故事"}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </Button>
            
            <div className="flex-1">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentTime / story.duration) * 100}%` }}
                ></div>
              </div>
            </div>
            
            <span className="text-xs text-gray-500 min-w-12">
              {formatTime(currentTime)} / {formatTime(story.duration)}
            </span>
          </div>
        </div>

        {/* Interaction Summary */}
        {getTotalInteractions() > 0 && (
          <div className="flex items-center space-x-4 pt-3 border-t border-border/50">
            {story.interaction_summary?.comments && story.interaction_summary.comments > 0 && (
              <div className="flex items-center space-x-1 text-muted-foreground hover:text-blue-600 transition-colors">
                <MessageCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{story.interaction_summary.comments}</span>
                <span className="text-xs">评论</span>
              </div>
            )}
            {story.interaction_summary?.followups && story.interaction_summary.followups > 0 && (
              <div className="flex items-center space-x-1 text-muted-foreground hover:text-orange-600 transition-colors">
                <HelpCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{story.interaction_summary.followups}</span>
                <span className="text-xs">问题</span>
              </div>
            )}
            {story.interaction_summary?.appreciations && story.interaction_summary.appreciations > 0 && (
              <div className="flex items-center space-x-1 text-muted-foreground hover:text-red-500 transition-colors">
                <Heart className="h-4 w-4" />
                <span className="text-sm font-medium">{story.interaction_summary.appreciations}</span>
                <span className="text-xs">点赞</span>
              </div>
            )}
          </div>
        )}

        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          src={story.audio_url}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      </div>
    </Card>
  )
}

export default StoryCard
