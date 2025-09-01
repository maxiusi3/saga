'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Play, Pause, ArrowLeft, MessageCircle, HelpCircle, Heart, Mic } from 'lucide-react'
import Link from 'next/link'

interface Story {
  id: string
  title: string
  prompt: string
  category: string
  audio_url: string
  duration: number
  created_at: string
  project_name: string
}

interface Feedback {
  id: string
  type: 'comment' | 'followup' | 'appreciation'
  author_name: string
  author_avatar?: string
  content: string
  created_at: string
  is_new: boolean
}

export default function StorytellerStoryDetailPage() {
  const params = useParams()
  const storyId = params.id as string
  
  const [story, setStory] = useState<Story | null>(null)
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [loading, setLoading] = useState(true)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const loadStoryAndFeedback = async () => {
      // Mock data - replace with actual Supabase queries
      const mockStory: Story = {
        id: storyId,
        title: 'My First Job at the Factory',
        prompt: 'Tell me about your first job. What was it like walking in on your first day?',
        category: 'Career',
        audio_url: '/mock-audio.mp3', // This would be a real audio URL
        duration: 180,
        created_at: '2024-01-20T10:30:00Z',
        project_name: "Dad's Life Story"
      }

      const mockFeedback: Feedback[] = [
        {
          id: '1',
          type: 'comment',
          author_name: 'Beth Smith',
          author_avatar: '',
          content: 'I can just picture you walking into that big factory for the first time! You were so young.',
          created_at: '2024-01-20T14:30:00Z',
          is_new: false
        },
        {
          id: '2',
          type: 'followup',
          author_name: 'Alex Johnson',
          author_avatar: '',
          content: 'That sounds like it was quite an adventure! What were your coworkers like? Did you make any lasting friendships there?',
          created_at: '2024-01-21T09:15:00Z',
          is_new: true
        },
        {
          id: '3',
          type: 'appreciation',
          author_name: 'Alex Johnson',
          author_avatar: '',
          content: 'Thank you for sharing this story with us. It really helps us understand what life was like back then.',
          created_at: '2024-01-21T11:45:00Z',
          is_new: true
        }
      ]

      setTimeout(() => {
        setStory(mockStory)
        setFeedback(mockFeedback)
        setLoading(false)
      }, 1000)
    }

    if (storyId) {
      loadStoryAndFeedback()
    }
  }, [storyId])

  const handlePlayPause = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getFeedbackIcon = (type: Feedback['type']) => {
    switch (type) {
      case 'followup':
        return <HelpCircle className="h-5 w-5 text-furbridge-orange" />
      case 'appreciation':
        return <Heart className="h-5 w-5 text-furbridge-teal" />
      default:
        return <MessageCircle className="h-5 w-5 text-furbridge-warm-gray" />
    }
  }

  const getFeedbackTypeLabel = (type: Feedback['type']) => {
    switch (type) {
      case 'followup':
        return 'Follow-up Question'
      case 'appreciation':
        return 'Appreciation'
      default:
        return 'Comment'
    }
  }

  const handleRecordFollowup = (feedbackId: string) => {
    const feedbackItem = feedback.find(f => f.id === feedbackId)
    if (feedbackItem && feedbackItem.type === 'followup') {
      const encodedPrompt = encodeURIComponent(`Follow-up to "${story?.title}": ${feedbackItem.content}`)
      window.location.href = `/storyteller/record?prompt=${encodedPrompt}&type=followup`
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 flex items-center justify-center p-4">
        <FurbridgeCard className="max-w-md w-full p-8 text-center">
          <div className="text-6xl mb-4">😔</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Story Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            We couldn't find the story you're looking for.
          </p>
          <Link href="/storyteller/stories">
            <FurbridgeButton variant="orange" className="w-full">
              Back to My Stories
            </FurbridgeButton>
          </Link>
        </FurbridgeCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Navigation */}
        <Link 
          href="/storyteller/stories"
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Stories
        </Link>

        {/* Story Header */}
        <FurbridgeCard className="p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {story.title}
                  </h1>
                  <Badge variant="outline">
                    {story.category}
                  </Badge>
                </div>
                
                <p className="text-gray-600 mb-4">
                  "{story.prompt}"
                </p>
                
                <div className="text-sm text-gray-500">
                  Shared on {formatDate(story.created_at)} • {story.project_name}
                </div>
              </div>
            </div>
          </div>
        </FurbridgeCard>

        {/* Audio Player */}
        <FurbridgeCard className="p-8">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Your Recording
              </h2>
              
              {/* Play/Pause Button */}
              <FurbridgeButton
                variant="orange"
                size="lg"
                onClick={handlePlayPause}
                className="w-20 h-20 rounded-full p-0"
              >
                {isPlaying ? (
                  <Pause className="h-8 w-8" />
                ) : (
                  <Play className="h-8 w-8 ml-1" />
                )}
              </FurbridgeButton>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max={story.duration}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-sm text-gray-600">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(story.duration)}</span>
              </div>
            </div>

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

        {/* Feedback Section */}
        <FurbridgeCard className="p-6" id="feedback">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Family Feedback ({feedback.length})
              </h2>
              {feedback.some(f => f.is_new) && (
                <Badge variant="default" className="bg-furbridge-orange text-white">
                  {feedback.filter(f => f.is_new).length} New
                </Badge>
              )}
            </div>

            {feedback.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">💬</div>
                <p className="text-gray-600">
                  No feedback yet. Your family will see this story and can leave comments or ask follow-up questions.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedback.map((item) => (
                  <div 
                    key={item.id}
                    className={`border rounded-lg p-4 ${
                      item.is_new ? 'border-furbridge-orange bg-furbridge-orange/5' : 'border-gray-200'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={item.author_avatar} />
                            <AvatarFallback className="bg-furbridge-teal text-white text-sm">
                              {item.author_name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">
                                {item.author_name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {getFeedbackTypeLabel(item.type)}
                              </Badge>
                              {item.is_new && (
                                <Badge variant="default" className="bg-furbridge-orange text-white text-xs">
                                  New
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatDate(item.created_at)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex-shrink-0">
                          {getFeedbackIcon(item.type)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="pl-11">
                        <p className="text-gray-900">
                          {item.content}
                        </p>
                        
                        {/* Follow-up Action */}
                        {item.type === 'followup' && (
                          <div className="mt-3">
                            <FurbridgeButton
                              variant="orange"
                              size="sm"
                              onClick={() => handleRecordFollowup(item.id)}
                            >
                              <Mic className="h-4 w-4 mr-2" />
                              Record Answer
                            </FurbridgeButton>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FurbridgeCard>
      </div>
    </div>
  )
}
