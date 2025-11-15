'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from '@/components/ui/enhanced-card'
import { ModernAudioPlayer } from '@/components/ui/modern-audio-player'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Edit, Share, Download, Heart, MessageCircle, ChevronLeft, MoreHorizontal, Mic } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { storyService, Story } from '@/lib/stories'
import { useAuthStore } from '@/stores/auth-store'
import { StoryInteractions } from '@/components/interactions/story-interactions'
import { interactionService } from '@/lib/interactions'
import { StorageService } from '@/lib/storage'
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
  const [segments, setSegments] = useState<any[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [isEditingSeg, setIsEditingSeg] = useState<boolean>(false)
  const [editedSegContent, setEditedSegContent] = useState<string>('')
  const [viewerOpen, setViewerOpen] = useState<boolean>(false)
  const [viewerIdx, setViewerIdx] = useState<number>(0)
  const [editingImages, setEditingImages] = useState<Array<{ url: string; thumbUrl: string }>>([])
  const [segmentsCollapsed, setSegmentsCollapsed] = useState<boolean>(false)
  const [commentImages, setCommentImages] = useState<Array<{ url: string; thumbUrl: string; interaction_id?: string }>>([])
  const [selectedImages, setSelectedImages] = useState<Record<string, boolean>>({})

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

        const segs = Array.isArray((storyData as any).segments) ? (storyData as any).segments : []
        segs.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        setSegments(segs)
        setSelectedIndex(0)

        const interactions = await interactionService.getStoryInteractions(storyId)
        const imgs: Array<{ url: string; thumbUrl: string; interaction_id?: string }> = []
        interactions.forEach((it: any) => {
          if (Array.isArray(it.attachments)) {
            it.attachments.forEach((a: any) => {
              if (a.url && a.thumbUrl) imgs.push({ url: a.url, thumbUrl: a.thumbUrl, interaction_id: it.id })
            })
          }
        })
        setCommentImages(imgs)
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
            <EnhancedButton variant="default" size="sm" onClick={() => {
              const params = new URLSearchParams({ parent: String(storyId) })
              window.location.href = withLocale(`/dashboard/projects/${projectId}/record?${params.toString()}`)
            }}>
              <Mic className="h-4 w-4 mr-2" />
              {t('detail.recordFollowUp')}
            </EnhancedButton>
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
                <div className="mb-6">
                  <ModernAudioPlayer
                    src={(selectedIndex === 0 ? story.audio_url : (segments[selectedIndex - 1]?.audio_url)) || ''}
                    showDownload={true}
                    onPrevSegment={() => {
                      if (selectedIndex > 0) {
                        const nextIndex = selectedIndex - 1
                        setSelectedIndex(nextIndex)
                        setIsEditingSeg(false)
                        const text = nextIndex === 0 ? (story.transcript || '') : (segments[nextIndex - 1]?.transcript || '')
                        setEditedSegContent(text)
                      }
                    }}
                    onNextSegment={() => {
                      if (selectedIndex < segments.length) {
                        const nextIndex = selectedIndex + 1
                        setSelectedIndex(nextIndex)
                        setIsEditingSeg(false)
                        const text = nextIndex === 0 ? (story.transcript || '') : (segments[nextIndex - 1]?.transcript || '')
                        setEditedSegContent(text)
                      }
                    }}
                  />
                </div>

                {Array.isArray((story as any).images) && (story as any).images.length > 0 && (
                  <div className="mb-6 grid grid-cols-3 gap-2">
                    {(story as any).images.map((img: any, idx: number) => (
                      <img key={idx} src={img.thumbUrl || img.url} alt="story" className="w-full h-24 object-cover rounded" />
                    ))}
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
                        onClick={() => {
                          setIsEditingSeg(!isEditingSeg)
                          const text = selectedIndex === 0 ? (story.transcript || '') : (segments[selectedIndex - 1]?.transcript || '')
                          setEditedSegContent(text)
                          const imgs = selectedIndex === 0 ? (Array.isArray((story as any).images) ? (story as any).images : []) : (Array.isArray(segments[selectedIndex - 1]?.images) ? segments[selectedIndex - 1].images : [])
                          setEditingImages(imgs.slice())
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        {isEditingSeg ? 'Cancel' : 'Edit'}
                      </EnhancedButton>
                    )}
                  </div>
                  
                  {isEditingSeg ? (
                    <div className="space-y-4">
                      <div
                        className="min-h-[200px] p-3 border rounded bg-white"
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => setEditedSegContent((e.target as HTMLElement).innerHTML)}
                        dangerouslySetInnerHTML={{ __html: editedSegContent }}
                      />
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {editingImages.map((img, idx) => (
                            <div key={idx} className="relative">
                              <img src={img.thumbUrl || img.url} alt="img" className="w-16 h-16 object-cover rounded" />
                              <button
                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6"
                                onClick={() => {
                                  setEditingImages(prev => prev.filter((_, i) => i !== idx))
                                }}
                                aria-label="Remove"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        <input type="file" accept="image/jpeg,image/png" multiple onChange={async (e) => {
                          const files = Array.from(e.target.files || []).slice(0, 6)
                          const storage = new StorageService()
                          const ups: Array<{ url: string; thumbUrl: string }> = []
                          for (let i = 0; i < files.length; i++) {
                            const res = await storage.uploadImageWithThumb(files[i], `images/stories/${storyId}`)
                            if (res.success && res.url && res.thumbUrl) ups.push({ url: res.url, thumbUrl: res.thumbUrl })
                          }
                          setEditingImages(prev => [...prev, ...ups])
                        }} />
                      </div>
                      <div className="flex gap-2">
                        <EnhancedButton onClick={async () => {
                          try {
                            if (selectedIndex === 0) {
                              const ok = await storyService.updateStory(story.id, { transcript: editedSegContent, images: editingImages as any })
                              if (ok) setStory(prev => prev ? { ...prev, transcript: editedSegContent, images: editingImages as any } : prev)
                            } else {
                              const headers: Record<string, string> = { 'Content-Type': 'application/json' }
                              const supa = createClientSupabase()
                              const { data: { session } } = await supa.auth.getSession()
                              if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
                              const next = segments.slice()
                              next[selectedIndex - 1] = { ...next[selectedIndex - 1], transcript: editedSegContent, images: editingImages }
                              const resp = await fetch(`/api/stories/${storyId}/segments`, { method: 'POST', credentials: 'include', headers, body: JSON.stringify({ segments: next }) })
                              if (resp.ok) setSegments(next)
                            }
                            setIsEditingSeg(false)
                            toast.success('Saved')
                          } catch {
                            toast.error('Save failed')
                          }
                        }}>
                          Save
                        </EnhancedButton>
                        <EnhancedButton variant="outline" onClick={() => { setIsEditingSeg(false) }}>
                          Cancel
                        </EnhancedButton>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-gray max-w-none">
                      <div className="text-gray-700 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: selectedIndex === 0 ? (story.transcript || '') : (segments[selectedIndex - 1]?.transcript || '') }} />
                      {selectedIndex > 0 && Array.isArray(segments[selectedIndex - 1]?.images) && segments[selectedIndex - 1].images.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {segments[selectedIndex - 1].images.map((img: any, idx: number) => (
                            <img key={idx} src={img.thumbUrl || img.url} alt="img" className="w-16 h-16 object-cover rounded cursor-zoom-in" onClick={() => { setViewerIdx(idx); setViewerOpen(true) }} />
                          ))}
                        </div>
                      )}
                      {selectedIndex === 0 && Array.isArray((story as any).images) && (story as any).images.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(story as any).images.map((img: any, idx: number) => (
                            <img key={idx} src={img.thumbUrl || img.url} alt="img" className="w-16 h-16 object-cover rounded cursor-zoom-in" onClick={() => { setViewerIdx(idx); setViewerOpen(true) }} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </EnhancedCardContent>
            </EnhancedCard>
            {/* Segments moved to sidebar */}

            {/* Comments and Follow-up Questions */}
            <StoryInteractions
              storyId={storyId}
              projectId={projectId}
              userRole={userRole || 'facilitator'}
              isProjectOwner={false}
              isStoryteller={story.storyteller_id === user?.id}
            />

            {canEditStory && (
              <EnhancedCard>
                <EnhancedCardHeader>
                  <EnhancedCardTitle>{t('detail.commentImages')}</EnhancedCardTitle>
                </EnhancedCardHeader>
                <EnhancedCardContent>
                  {commentImages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No comment images</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        {commentImages.map((img, idx) => (
                          <label key={idx} className="block">
                            <input type="checkbox" className="mr-2" checked={!!selectedImages[String(idx)]} onChange={(e) => setSelectedImages(prev => ({ ...prev, [String(idx)]: e.target.checked }))} />
                            <img src={img.thumbUrl} alt="comment" className="w-full h-24 object-cover rounded" />
                          </label>
                        ))}
                      </div>
                      <EnhancedButton onClick={handleSelectImagesToStory}>{t('detail.addSelectedToStory')}</EnhancedButton>
                    </div>
                  )}
                </EnhancedCardContent>
              </EnhancedCard>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Segments at top */}
            <EnhancedCard>
              <EnhancedCardHeader className="flex items-center justify-between">
                <EnhancedCardTitle>Segments</EnhancedCardTitle>
                <div className="text-xs text-muted-foreground">{[...segments].length + 1} segments</div>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <div className="mb-2">
                  <EnhancedButton variant="outline" size="sm" onClick={() => setSegmentsCollapsed(v => !v)}>
                    {segmentsCollapsed ? 'Expand' : 'Collapse'}
                  </EnhancedButton>
                </div>
                {!segmentsCollapsed && (
                  <div className="space-y-3">
                    {[{ id: 'original', created_at: story.created_at, audio_url: story.audio_url, transcript: story.transcript }, ...segments].map((item: any, idx: number) => (
                      <button key={item.id || idx} className={`w-full text-left p-3 rounded border transition ${selectedIndex === idx ? 'border-blue-500 bg-blue-50' : 'hover:bg-sage-50'}`} onClick={() => {
                        setSelectedIndex(idx)
                        setIsEditingSeg(false)
                        const text = idx === 0 ? (story.transcript || '') : (segments[idx - 1]?.transcript || '')
                        setEditedSegContent(text)
                      }}>
                        <h3 className="text-lg font-semibold">{idx === 0 ? 'Original' : `Segment ${idx}`}</h3>
                        <div className="text-xs text-muted-foreground mt-1">{new Date(item.created_at).toLocaleString()}</div>
                      </button>
                    ))}
                  </div>
                )}
                {segmentsCollapsed && (
                  <div>
                    {(() => {
                      const item = [{ id: 'original', created_at: story.created_at }, ...segments][selectedIndex]
                      return (
                        <div className="p-3 rounded border bg-sage-50">
                          <h3 className="text-lg font-semibold">{selectedIndex === 0 ? 'Original' : `Segment ${selectedIndex}`}</h3>
                          <div className="text-xs text-muted-foreground mt-1">{new Date(item.created_at).toLocaleString()}</div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </EnhancedCardContent>
            </EnhancedCard>
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
      {viewerOpen && selectedIndex > 0 && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setViewerOpen(false)}>
          <div className="relative max-w-4xl w-full px-6" onClick={(e) => e.stopPropagation()}>
            <img src={segments[selectedIndex - 1].images[viewerIdx]?.url} alt="full" className="max-h-[80vh] mx-auto" />
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <EnhancedButton variant="secondary" onClick={() => setViewerIdx((viewerIdx - 1 + segments[selectedIndex - 1].images.length) % segments[selectedIndex - 1].images.length)}>◀</EnhancedButton>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <EnhancedButton variant="secondary" onClick={() => setViewerIdx((viewerIdx + 1) % segments[selectedIndex - 1].images.length)}>▶</EnhancedButton>
            </div>
            <div className="absolute right-4 top-4">
              <EnhancedButton variant="secondary" onClick={() => setViewerOpen(false)}>✕</EnhancedButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
  const handleSelectImagesToStory = async () => {
    const chosen = commentImages.filter((img, idx) => selectedImages[String(idx)])
    if (chosen.length === 0 || !story) return
    try {
      const supa = createClientSupabase()
      const { data: { session } } = await supa.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
      const resp = await fetch(`/api/stories/${story.id}/images/select-from-interactions`, {
        method: 'POST', credentials: 'include', headers, body: JSON.stringify({ images: chosen })
      })
      if (resp.ok) {
        const json = await resp.json()
        setStory(prev => prev ? { ...prev, images: json.images } as any : prev)
        toast.success('Images added to story')
      } else {
        toast.error('Failed to add images')
      }
    } catch {
      toast.error('Failed to add images')
    }
  }
