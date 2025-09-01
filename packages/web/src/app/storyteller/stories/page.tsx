'use client'

import { useState, useEffect } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Play, MessageCircle, Clock, Calendar } from 'lucide-react'
import Link from 'next/link'

interface Story {
  id: string
  title: string
  prompt: string
  category: string
  duration: number
  created_at: string
  status: 'processing' | 'completed'
  feedback_count: number
  has_new_feedback: boolean
  project_name: string
}

export default function MyStoriesPage() {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStories = async () => {
      // Mock data - replace with actual Supabase queries
      const mockStories: Story[] = [
        {
          id: '1',
          title: 'My First Job at the Factory',
          prompt: 'Tell me about your first job. What was it like walking in on your first day?',
          category: 'Career',
          duration: 180,
          created_at: '2024-01-20T10:30:00Z',
          status: 'completed',
          feedback_count: 3,
          has_new_feedback: true,
          project_name: "Dad's Life Story"
        },
        {
          id: '2',
          title: 'Meeting Your Mother',
          prompt: 'Tell me about the day you met your spouse. What was your first impression?',
          category: 'Love & Family',
          duration: 240,
          created_at: '2024-01-18T14:15:00Z',
          status: 'completed',
          feedback_count: 5,
          has_new_feedback: false,
          project_name: "Dad's Life Story"
        },
        {
          id: '3',
          title: 'Growing Up During the War',
          prompt: 'What was it like growing up during wartime? How did it affect your daily life?',
          category: 'Historical Events',
          duration: 320,
          created_at: '2024-01-15T09:45:00Z',
          status: 'completed',
          feedback_count: 2,
          has_new_feedback: false,
          project_name: "Dad's Life Story"
        },
        {
          id: '4',
          title: 'Learning to Drive',
          prompt: 'Tell me about learning to drive. Who taught you and what was that experience like?',
          category: 'Life Skills',
          duration: 0,
          created_at: '2024-01-22T16:20:00Z',
          status: 'processing',
          feedback_count: 0,
          has_new_feedback: false,
          project_name: "Dad's Life Story"
        }
      ]

      setTimeout(() => {
        setStories(mockStories)
        setLoading(false)
      }, 1000)
    }

    loadStories()
  }, [])

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return 'Processing...'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Stories</h1>
            <p className="text-gray-600 mt-1">
              All the stories you've shared with your family
            </p>
          </div>
          
          <Link href="/storyteller/record">
            <FurbridgeButton variant="orange">
              Record New Story
            </FurbridgeButton>
          </Link>
        </div>

        {/* Stories List */}
        <div className="space-y-4">
          {stories.length === 0 ? (
            <FurbridgeCard className="p-12 text-center">
              <div className="space-y-4">
                <div className="text-6xl">📖</div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  No Stories Yet
                </h2>
                <p className="text-gray-600 max-w-md mx-auto">
                  You haven't recorded any stories yet. Start sharing your memories with your family!
                </p>
                <Link href="/storyteller/record">
                  <FurbridgeButton variant="orange" size="lg">
                    Record Your First Story
                  </FurbridgeButton>
                </Link>
              </div>
            </FurbridgeCard>
          ) : (
            stories.map((story) => (
              <FurbridgeCard key={story.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {story.title}
                        </h3>
                        {story.has_new_feedback && (
                          <Badge variant="default" className="bg-furbridge-orange text-white">
                            New Feedback
                          </Badge>
                        )}
                        {story.status === 'processing' && (
                          <Badge variant="secondary">
                            Processing
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-gray-600 text-sm line-clamp-2">
                        "{story.prompt}"
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-gray-500">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">{formatDuration(story.duration)}</span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Badge variant="outline" className="text-xs">
                        {story.category}
                      </Badge>
                      
                      <div className="flex items-center space-x-1 text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm">{formatDate(story.created_at)}</span>
                      </div>
                      
                      {story.feedback_count > 0 && (
                        <div className="flex items-center space-x-1 text-gray-500">
                          <MessageCircle className="h-4 w-4" />
                          <span className="text-sm">
                            {story.feedback_count} comment{story.feedback_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {story.status === 'completed' && (
                        <FurbridgeButton
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link href={`/storyteller/stories/${story.id}`}>
                            <Play className="h-4 w-4 mr-2" />
                            Listen
                          </Link>
                        </FurbridgeButton>
                      )}
                      
                      {story.feedback_count > 0 && (
                        <FurbridgeButton
                          variant={story.has_new_feedback ? "orange" : "outline"}
                          size="sm"
                          asChild
                        >
                          <Link href={`/storyteller/stories/${story.id}#feedback`}>
                            <MessageCircle className="h-4 w-4 mr-2" />
                            {story.has_new_feedback ? 'New' : 'View'} Feedback
                          </Link>
                        </FurbridgeButton>
                      )}
                    </div>
                  </div>
                </div>
              </FurbridgeCard>
            ))
          )}
        </div>

        {/* Bottom Navigation Hint */}
        <div className="text-center text-sm text-gray-600 pt-8">
          <p>
            Want to see what your family is saying? Check your{' '}
            <Link href="/storyteller/messages" className="text-furbridge-orange hover:underline">
              Messages
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
