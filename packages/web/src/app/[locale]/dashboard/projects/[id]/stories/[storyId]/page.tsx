'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from '@/components/ui/enhanced-card'
import { ModernAudioPlayer } from '@/components/ui/modern-audio-player'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Edit, Share, Download, Heart, MessageCircle, ChevronLeft, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { storyService, Story } from '@/lib/stories'
import { useAuthStore } from '@/stores/auth-store'
import { StoryInteractions } from '@/components/interactions/story-interactions'
import { canUserPerformAction } from '@saga/shared/lib/permissions'
import { toast } from 'sonner'

export default function StoryDetailPage() {
  const params = useParams()
  const { user } = useAuthStore()
  const locale = useLocale()
  const t = useTranslations('stories')
  const withLocale = (path: string) => `/${locale}${path}`
  const projectId = params.id as string
  const storyId = params.storyId as string

  const [story, setStory] = useState<Story | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [isEditingTranscript, setIsEditingTranscript] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'facilitator' | 'storyteller' | null>(null)

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
        setEditedTitle(storyData.title || '')
        setEditedTranscript(storyData.transcript || '')
        
        // Determine user role - check if user is the storyteller
        const isStoryteller = storyData.storyteller_id === user.id
        setUserRole(isStoryteller ? 'storyteller' : 'facilitator')
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

  const canEditStory = userRole === 'storyteller' && story?.storyteller_id === user?.id

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



  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100 p-6">
        <div className="max-w-7xl mx-auto">
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
        <div className="max-w-7xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-gray-900">Error</h1>
          <p className="text-gray-600 mt-2">{error}</p>
          <Link href={withLocale(`/dashboard/projects/${projectId}`)}>
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
        <div className="max-w-7xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-gray-900">Story not found</h1>
          <Link href={withLocale(`/dashboard/projects/${projectId}`)}>
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
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={withLocale(`/dashboard/projects/${projectId}`)}>
            <EnhancedButton variant="secondary" size="sm">
              <ChevronLeft className="h-4 w-4 mr-2" />
              {t('detail.backToStories')}
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
              <EnhancedCardHeader className="pb-3">
                {/* Header content removed for cleaner layout */}
              </EnhancedCardHeader>
              <EnhancedCardContent>
                {/* Story Title */}
                <div className="mb-6">
                  {isEditingTitle && canEditStory ? (
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
                      {canEditStory && (
                        <EnhancedButton 
                          variant="outline" 
                          size="sm"
                          onClick={() => setIsEditingTitle(true)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </EnhancedButton>
                      )}
                    </div>
                  )}
                </div>



                {/* Audio Player */}
                {story.audio_url && (
                  <div className="mb-6">
                    <ModernAudioPlayer
                      src={story.audio_url}
                      showDownload={true}
                    />
                  </div>
                )}

                {/* Transcript */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Transcript</h3>
                    {canEditStory && (
                      <EnhancedButton 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsEditingTranscript(!isEditingTranscript)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        {isEditingTranscript ? 'Cancel' : 'Edit'}
                      </EnhancedButton>
                    )}
                  </div>
                  
                  {isEditingTranscript && canEditStory ? (
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
                            setEditedTranscript(story.transcript || '')
                          }}
                        >
                          Cancel
                        </EnhancedButton>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-gray max-w-none">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {story.transcript || 'No transcript available'}
                      </p>
                    </div>
                  )}
                </div>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Comments and Follow-up Questions */}
            <StoryInteractions
              storyId={storyId}
              projectId={projectId}
              userRole={userRole || 'facilitator'}
              isProjectOwner={false}
              isStoryteller={story.storyteller_id === user?.id}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* AI Suggested Questions */}
            {story.ai_follow_up_questions && story.ai_follow_up_questions.length > 0 && (
              <EnhancedCard>
                <EnhancedCardHeader>
                  <EnhancedCardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-sage-600" />
                    {t('detail.aiSuggestedQuestions')}
                  </EnhancedCardTitle>
                </EnhancedCardHeader>
                <EnhancedCardContent>
                  <div className="space-y-2">
                    {story.ai_follow_up_questions.map((question, index) => (
                      <button
                        key={index}
                        className="text-left p-3 text-sm text-gray-700 hover:bg-sage-50 rounded-lg border border-gray-200 w-full transition-colors"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </EnhancedCardContent>
              </EnhancedCard>
            )}

            {/* Story Actions */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle>Story Actions</EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <div className="space-y-3">
                  <EnhancedButton variant="outline" size="sm" className="w-full justify-start">
                    <Heart className="w-4 h-4 mr-2" />
                    {t('detail.addToFavorites')}
                  </EnhancedButton>
                  <EnhancedButton variant="outline" size="sm" className="w-full justify-start">
                    <Download className="w-4 w-4 mr-2" />
                    {t('detail.downloadAudio')}
                  </EnhancedButton>
                  <EnhancedButton variant="outline" size="sm" className="w-full justify-start">
                    <Share className="w-4 h-4 mr-2" />
                    {t('actions.shareStory')}
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