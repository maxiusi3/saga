'use client'

import { useState, useEffect } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageCircle, HelpCircle, Heart, Calendar, Mic } from 'lucide-react'
import Link from 'next/link'

interface Message {
  id: string
  type: 'comment' | 'followup' | 'appreciation'
  story_id: string
  story_title: string
  author_name: string
  author_avatar?: string
  content: string
  created_at: string
  is_read: boolean
  requires_response?: boolean
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'followups'>('all')

  useEffect(() => {
    const loadMessages = async () => {
      // Mock data - replace with actual Supabase queries
      const mockMessages: Message[] = [
        {
          id: '1',
          type: 'followup',
          story_id: '1',
          story_title: 'My First Job at the Factory',
          author_name: 'Alex Johnson',
          author_avatar: '',
          content: 'That sounds like it was quite an adventure! What were your coworkers like? Did you make any lasting friendships there?',
          created_at: '2024-01-21T09:15:00Z',
          is_read: false,
          requires_response: true
        },
        {
          id: '2',
          type: 'comment',
          story_id: '2',
          story_title: 'Meeting Your Mother',
          author_name: 'Beth Smith',
          author_avatar: '',
          content: 'This is such a beautiful story, Dad! I love hearing about how you and Mom met. The way you describe that first dance is so romantic.',
          created_at: '2024-01-20T14:30:00Z',
          is_read: false,
          requires_response: false
        },
        {
          id: '3',
          type: 'appreciation',
          story_id: '2',
          story_title: 'Meeting Your Mother',
          author_name: 'Alex Johnson',
          author_avatar: '',
          content: 'Thank you for sharing this with us. It means so much to hear these stories in your own voice.',
          created_at: '2024-01-20T11:45:00Z',
          is_read: true,
          requires_response: false
        },
        {
          id: '4',
          type: 'followup',
          story_id: '3',
          story_title: 'Growing Up During the War',
          author_name: 'Beth Smith',
          author_avatar: '',
          content: 'I had no idea things were so difficult back then. How did your family manage to get enough food during the rationing?',
          created_at: '2024-01-19T16:20:00Z',
          is_read: true,
          requires_response: true
        },
        {
          id: '5',
          type: 'comment',
          story_id: '1',
          story_title: 'My First Job at the Factory',
          author_name: 'Beth Smith',
          author_avatar: '',
          content: 'I can just picture you walking into that big factory for the first time! You were so young.',
          created_at: '2024-01-18T13:10:00Z',
          is_read: true,
          requires_response: false
        }
      ]

      setTimeout(() => {
        setMessages(mockMessages)
        setLoading(false)
      }, 1000)
    }

    loadMessages()
  }, [])

  const filteredMessages = messages.filter(message => {
    switch (filter) {
      case 'unread':
        return !message.is_read
      case 'followups':
        return message.type === 'followup'
      default:
        return true
    }
  })

  const unreadCount = messages.filter(m => !m.is_read).length
  const followupCount = messages.filter(m => m.type === 'followup' && !m.is_read).length

  const getMessageIcon = (type: Message['type']) => {
    switch (type) {
      case 'followup':
        return <HelpCircle className="h-5 w-5 text-furbridge-orange" />
      case 'appreciation':
        return <Heart className="h-5 w-5 text-furbridge-teal" />
      default:
        return <MessageCircle className="h-5 w-5 text-furbridge-warm-gray" />
    }
  }

  const getMessageTypeLabel = (type: Message['type']) => {
    switch (type) {
      case 'followup':
        return 'Follow-up Question'
      case 'appreciation':
        return 'Appreciation'
      default:
        return 'Comment'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    }
  }

  const handleRecordResponse = (messageId: string, storyTitle: string) => {
    // Navigate to record page with the follow-up question as context
    const message = messages.find(m => m.id === messageId)
    if (message) {
      const encodedPrompt = encodeURIComponent(`Follow-up to "${storyTitle}": ${message.content}`)
      window.location.href = `/storyteller/record?prompt=${encodedPrompt}&type=followup`
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
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
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Messages from Family</h1>
            <p className="text-gray-600 mt-1">
              See what your family is saying about your stories
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Messages ({messages.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('followups')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === 'followups'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Questions ({followupCount})
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="space-y-4">
          {filteredMessages.length === 0 ? (
            <FurbridgeCard className="p-12 text-center">
              <div className="space-y-4">
                <div className="text-6xl">💬</div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {filter === 'unread' ? 'No New Messages' : 
                   filter === 'followups' ? 'No Questions' : 'No Messages Yet'}
                </h2>
                <p className="text-gray-600 max-w-md mx-auto">
                  {filter === 'unread' 
                    ? "You're all caught up! Your family hasn't sent any new messages."
                    : filter === 'followups'
                    ? "No follow-up questions at the moment. Keep sharing your stories!"
                    : "Your family hasn't sent any messages yet. Share some stories to get the conversation started!"
                  }
                </p>
                {filter !== 'all' && (
                  <FurbridgeButton
                    variant="outline"
                    onClick={() => setFilter('all')}
                  >
                    View All Messages
                  </FurbridgeButton>
                )}
              </div>
            </FurbridgeCard>
          ) : (
            filteredMessages.map((message) => (
              <FurbridgeCard 
                key={message.id} 
                className={`p-6 hover:shadow-md transition-shadow ${
                  !message.is_read ? 'ring-2 ring-furbridge-orange/20 bg-furbridge-orange/5' : ''
                }`}
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={message.author_avatar} />
                        <AvatarFallback className="bg-furbridge-teal text-white">
                          {message.author_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900">
                            {message.author_name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {getMessageTypeLabel(message.type)}
                          </Badge>
                          {!message.is_read && (
                            <Badge variant="default" className="bg-furbridge-orange text-white text-xs">
                              New
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-sm text-gray-600">
                            About: "{message.story_title}"
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-sm text-gray-500">
                            {formatDate(message.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0">
                      {getMessageIcon(message.type)}
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="pl-13">
                    <p className="text-gray-900 leading-relaxed">
                      {message.content}
                    </p>
                  </div>

                  {/* Actions */}
                  {message.type === 'followup' && (
                    <div className="pl-13 pt-2">
                      <FurbridgeButton
                        variant="orange"
                        size="sm"
                        onClick={() => handleRecordResponse(message.id, message.story_title)}
                      >
                        <Mic className="h-4 w-4 mr-2" />
                        Record Answer
                      </FurbridgeButton>
                    </div>
                  )}
                </div>
              </FurbridgeCard>
            ))
          )}
        </div>

        {/* Bottom Navigation Hint */}
        <div className="text-center text-sm text-gray-600 pt-8">
          <p>
            Want to share more stories?{' '}
            <Link href="/storyteller/record" className="text-furbridge-orange hover:underline">
              Record a new story
            </Link>
            {' '}or{' '}
            <Link href="/storyteller/stories" className="text-furbridge-orange hover:underline">
              view your stories
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
