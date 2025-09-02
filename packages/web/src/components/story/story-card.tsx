'use client'

import { useState, useRef } from 'react'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Play, Pause, MessageCircle, HelpCircle, Heart, Clock, Sparkles, Volume2 } from 'lucide-react'
import { AIGeneratedContent } from '../../../shared/src/lib/ai-services'

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
  interaction_summary: {
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
  showAIContent?: boolean
}

export function StoryCard({ story, onPlay, onViewDetails, showAIContent = true }: StoryCardProps) {
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
    return story.interaction_summary.comments + 
           story.interaction_summary.followups + 
           story.interaction_summary.appreciations
  }

  return (
    <FurbridgeCard className="p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onViewDetails?.(story.id)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            {/* AI-Generated Title */}
            <div className="flex items-start space-x-2">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                {showAIContent && story.ai_content?.title ? story.ai_content.title : story.title}
              </h3>
              {showAIContent && story.ai_content?.title && (
                <Badge variant="secondary" className="bg-furbridge-orange/10 text-furbridge-orange text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              )}
            </div>
            
            {/* Category and Date */}
            <div className="flex items-center space-x-3 text-sm text-gray-600">
              <Badge variant="outline" className="text-xs">{story.category}</Badge>
              <span>•</span>
              <span>{formatDate(story.created_at)}</span>
              <span>•</span>
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{formatTime(story.duration)}</span>
              </div>
            </div>
          </div>
          
          {story.has_new_interactions && (
            <Badge className="bg-furbridge-orange text-white">New</Badge>
          )}
        </div>

        {/* Storyteller */}
        <div className="flex items-center space-x-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={story.storyteller_avatar} />
            <AvatarFallback className="bg-furbridge-teal text-white text-sm">
              {story.storyteller_name.split(' ').map(n => n[0]).join('')}
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
            <FurbridgeButton
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handlePlayPause()
              }}
              className="w-10 h-10 rounded-full p-0"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </FurbridgeButton>
            
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-furbridge-orange h-2 rounded-full transition-all duration-300"
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
          <div className="flex items-center space-x-4 pt-2 border-t border-gray-100">
            {story.interaction_summary.comments > 0 && (
              <div className="flex items-center space-x-1 text-gray-600">
                <MessageCircle className="h-4 w-4" />
                <span className="text-sm">{story.interaction_summary.comments}</span>
              </div>
            )}
            {story.interaction_summary.followups > 0 && (
              <div className="flex items-center space-x-1 text-furbridge-orange">
                <HelpCircle className="h-4 w-4" />
                <span className="text-sm">{story.interaction_summary.followups}</span>
              </div>
            )}
            {story.interaction_summary.appreciations > 0 && (
              <div className="flex items-center space-x-1 text-furbridge-teal">
                <Heart className="h-4 w-4" />
                <span className="text-sm">{story.interaction_summary.appreciations}</span>
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
    </FurbridgeCard>
  )
}

export default StoryCard
