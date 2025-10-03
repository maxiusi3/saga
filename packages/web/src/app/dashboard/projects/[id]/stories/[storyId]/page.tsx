'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from '@/components/ui/enhanced-card'
import { ModernAudioPlayer } from '@/components/ui/modern-audio-player'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit, Send, Share, Download, Heart, MessageCircle, User, Calendar, Tag, ChevronLeft, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { storyService } from '@/lib/stories'
import { useAuthStore } from '@/stores/auth-store'
import { StoryInteractions } from '@/components/interactions/story-interactions'
import { canUserPerformAction } from '@saga/shared/lib/permissions'
import { toast } from 'sonner'

interface Story {
  id: string
  title: string
  timestamp: string
  storyteller_id: string
  storyteller_name: string
  storyteller_avatar?: string
  audio_url: string | undefined
  audio_duration: number
  transcript: string
  photo_url?: string
  type: 'story' | 'chapter_summary'
  ai_summary?: string
  ai_follow_up_questions?: string[]
}

export default function StoryDetailPage() {
  const params = useParams()
  const { user } = useAuthStore()
  const projectId = params.id as string
  const storyId = params.storyId as string

  const [story, setStory] = useState<Story | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [isEditingTranscript, setIsEditingTranscript] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState('')
  const [newComment, setNewComment] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadStory = async () => {
      if (!user?.id) {
        setError('User not authenticated')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Load real story data
        const storyData = await storyService.getStoryById(storyId)
        if (!storyData) {
          setError('Story not found or access denied')
          setLoading(false)
          return
        }

        setStory(storyData)
        setEditedTitle(storyData.title)
        setEditedTranscript(storyData.transcript)
      } catch (error) {
        console.error('Error loading story:', error)
        setError('Failed to load story data')
      } finally {
        setLoading(false)
      }
    }

    loadStory()
  }, [storyId, user?.id])

  const handleSaveTitle = async () => {
    if (!story || !editedTitle.trim()) return

    try {
      const success = await storyService.updateStory(story.id, { title: editedTitle.trim() })
      if (success) {
        setStory(prev => prev ? { ...prev, title: editedTitle.trim() } : null)
        setIsEditingTitle(false)
        toast.success('Title updated successfully')
      } else {
        toast.error('Failed to update title')
      }
    } catch (error) {
      console.error('Error updating title:', error)
      toast.error('Failed to update title')
    }
  }

  const handleSaveTranscript = async () => {
    if (!story) return

    try {
      const success = await storyService.updateStory(story.id, { transcript: editedTranscript })
      if (success) {
        setStory(prev => prev ? { ...prev, transcript: editedTranscript } : null)
        setIsEditingTranscript(false)
        toast.success('Transcript updated successfully')
      } else {
        toast.error('Failed to update transcript')
      }
    } catch (error) {
      console.error('Error updating transcript:', error)
      toast.error('Failed to update transcript')
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !story) return

    try {
      // This would integrate with the real interactions service
      console.log('Adding comment:', newComment)
      setNewComment('')
      toast.success('Comment added successfully')
    } catch (error) {
      console.error('Error adding comment:', error)
      toast.error('Failed to add comment')
    }
  }

  const handleAskQuestion = async () => {
    if (!newQuestion.trim() || !story) return

    try {
      // This would integrate with the real interactions service
      console.log('Asking question:', newQuestion)
      setNewQuestion('')
      toast.success('Question sent successfully')
    } catch (error) {
      console.error('Error asking question:', error)
      toast.error('Failed to send question')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100 p-6">
        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-gray-900">Error</h1>
          <p className="text-gray-600 mt-2">{error}</p>
          <Link href={`/dashboard/projects/${projectId}`}>
            <EnhancedButton variant="outline" className="mt-4">
              Back to Project
            </EnhancedButton>
          </Link>
        </div>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100 p-6">
        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-gray-900">Story not found</h1>
          <Link href={`/dashboard/projects/${projectId}`}>
            <EnhancedButton variant="outline" className="mt-4">
              Back to Project
            </EnhancedButton>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/dashboard/projects/${projectId}`}>
            <EnhancedButton variant="secondary" size="sm">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Stories
            </EnhancedButton>
          </Link>
          <div className="flex items-center gap-3 ml-auto">
            <EnhancedButton variant="outline" size="sm">
              <Share className="h-4 w-4 mr-2" />
              Share
            </EnhancedButton>
            <EnhancedButton variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </EnhancedButton>
            <EnhancedButton variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </EnhancedButton>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Story Header */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={story.storyteller_avatar} />
                      <AvatarFallback>
                        {story.storyteller_name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{story.storyteller_name}</span>
                        <Badge className="bg-green-100 text-green-800">Storyteller</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(story.timestamp).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Tag className="w-4 h-4" />
                          Childhood
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                {/* Story Title */}
                <div className="mb-6">
                  {isEditingTitle ? (
                    <div className="flex gap-2">
                      <Input
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="text-2xl font-bold"
                        placeholder="Story title..."
                      />
                      <EnhancedButton onClick={handleSaveTitle} size="sm">
                        Save
                      </EnhancedButton>
                      <EnhancedButton 
                        variant="outline" 
                        onClick={() => {
                          setIsEditingTitle(false)
                          setEditedTitle(story.title)
                        }}
                        size="sm"
                      >
                        Cancel
                      </EnhancedButton>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <h1 className="text-2xl font-bold text-gray-900">{story.title}</h1>
                      <EnhancedButton 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsEditingTitle(true)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </EnhancedButton>
                    </div>
                  )}
                </div>

                {/* Story Photo */}
                {story.photo_url && (
                  <div className="mb-6">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={story.photo_url}
                        alt="Story photo"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute top-4 right-4">
                        <EnhancedButton variant="secondary" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Add Photo
                        </EnhancedButton>
                      </div>
                    </div>
                  </div>
                )}

                {/* Audio Player */}
                {story.audio_url && (
                  <div className="mb-6">
                    <ModernAudioPlayer
                      src={story.audio_url}
                      title={story.title}
                      duration={story.audio_duration}
                    />
                  </div>
                )}

                {/* Transcript */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Transcript</h3>
                    <EnhancedButton 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsEditingTranscript(!isEditingTranscript)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {isEditingTranscript ? 'Cancel' : 'Edit'}
                    </EnhancedButton>
                  </div>
                  
                  {isEditingTranscript ? (
                    <div className="space-y-4">
                      <Textarea
                        value={editedTranscript}
                        onChange={(e) => setEditedTranscript(e.target.value)}
                        className="min-h-[200px]"
                        placeholder="Story transcript..."
                      />
                      <div className="flex gap-2">
                        <EnhancedButton onClick={handleSaveTranscript}>
                          Save Changes
                        </EnhancedButton>
                        <EnhancedButton 
                          variant="outline"
                          onClick={() => {
                            setIsEditingTranscript(false)
                            setEditedTranscript(story.transcript)
                          }}
                        >
                          Cancel
                        </EnhancedButton>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-gray max-w-none">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {story.transcript}
                      </p>
                    </div>
                  )}
                </div>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Comments Section */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-sage-600" />
                  Family Comments
                  <Badge variant="outline">3</Badge>
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                {/* Add Comment */}
                <div className="mb-6">
                  <div className="flex gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback>
                        {user?.email?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <Textarea
                        placeholder="Share your thoughts about this story..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="mb-2"
                        rows={3}
                      />
                      <EnhancedButton 
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        size="sm"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Post Comment
                      </EnhancedButton>
                    </div>
                  </div>
                </div>

                {/* Existing Comments */}
                <div className="space-y-4">
                  {/* Mock comments - would be replaced with real data */}
                  <div className="flex gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback>M</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">Mike</span>
                          <span className="text-xs text-gray-500">2 days ago</span>
                        </div>
                        <p className="text-sm text-gray-700">
                          This brings back so many memories! Thank you for sharing this story.
                        </p>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <button className="flex items-center gap-1 hover:text-gray-700">
                          <Heart className="w-3 h-3" />
                          Like
                        </button>
                        <button className="hover:text-gray-700">Reply</button>
                      </div>
                    </div>
                  </div>
                </div>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Follow-up Questions */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-sage-600" />
                  Follow-up Questions
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <div className="space-y-4">
                  <div>
                    <Textarea
                      placeholder="Ask a follow-up question about this story..."
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      rows={3}
                    />
                    <EnhancedButton 
                      onClick={handleAskQuestion}
                      disabled={!newQuestion.trim()}
                      className="w-full mt-2"
                      size="sm"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Ask Question
                    </EnhancedButton>
                  </div>

                  {/* AI Suggested Questions */}
                  {story.ai_follow_up_questions && story.ai_follow_up_questions.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">AI Suggested Questions</h4>
                      <div className="space-y-2">
                        {story.ai_follow_up_questions.map((question, index) => (
                          <button
                            key={index}
                            onClick={() => setNewQuestion(question)}
                            className="text-left p-2 text-sm text-gray-600 hover:bg-gray-50 rounded border border-gray-200 w-full"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Story Actions */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle>Story Actions</EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <div className="space-y-3">
                  <EnhancedButton variant="outline" size="sm" className="w-full justify-start">
                    <Heart className="w-4 h-4 mr-2" />
                    Add to Favorites
                  </EnhancedButton>
                  <EnhancedButton variant="outline" size="sm" className="w-full justify-start">
                    <Download className="w-4 w-4 mr-2" />
                    Download Audio
                  </EnhancedButton>
                  <EnhancedButton variant="outline" size="sm" className="w-full justify-start">
                    <Share className="w-4 h-4 mr-2" />
                    Share Story
                  </EnhancedButton>
                </div>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </div>
      </div>
    </div>
  )
}