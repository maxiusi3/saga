'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MessageCircle, HelpCircle, Send, Clock, CheckCircle, Mic } from 'lucide-react'
import { interactionService, Interaction } from '@/lib/interactions'
import { StorageService } from '@/lib/storage'
import { useAuthStore } from '@/stores/auth-store'
import { canUserPerformAction } from '@saga/shared'
import { toast } from 'react-hot-toast'
import { useLocale } from 'next-intl'

interface StoryInteractionsProps {
  storyId: string
  projectId: string
  userRole: string
  isProjectOwner: boolean
  isStoryteller?: boolean
  className?: string
}

export function StoryInteractions({
  storyId,
  projectId,
  userRole,
  isProjectOwner,
  isStoryteller = false,
  className = ''
}: StoryInteractionsProps) {
  const locale = useLocale()
  const withLocale = (path: string) => {
    if (!path || typeof path !== 'string') return path as any
    if (!path.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }
  const { user } = useAuthStore()
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [followupText, setFollowupText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [submittingFollowup, setSubmittingFollowup] = useState(false)
  const [commentImages, setCommentImages] = useState<File[]>([])
  const [commentUploads, setCommentUploads] = useState<Array<{ url: string; thumbUrl: string }>>([])
  const [commentPreviewUrls, setCommentPreviewUrls] = useState<string[]>([])
  const [isUploadingImages, setIsUploadingImages] = useState(false)

  const persistUploads = (uploads: Array<{ url: string; thumbUrl: string }>) => {
    try { localStorage.setItem(`commentUploads:${storyId}`, JSON.stringify(uploads)) } catch {}
  }
  const loadPersistedUploads = () => {
    try {
      const raw = localStorage.getItem(`commentUploads:${storyId}`)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) setCommentUploads(arr)
      }
    } catch {}
  }

  // 权限检查
  const canAddComments = canUserPerformAction('canAddComments', userRole as any, isProjectOwner)
  const canAskFollowups = canUserPerformAction('canAskFollowUpQuestions', userRole as any, isProjectOwner)

  // 加载交互记录
  useEffect(() => {
    loadInteractions()
    loadPersistedUploads()
  }, [storyId])

  // 当页面获得焦点时重新加载数据（用户从录音页面返回时）
  useEffect(() => {
    const handleFocus = () => { if (!isUploadingImages) loadInteractions() }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [isUploadingImages])

  const loadInteractions = async () => {
    try {
      setLoading(true)
      const data = await interactionService.getStoryInteractions(storyId)
      setInteractions(data)
    } catch (error) {
      console.error('Error loading interactions:', error)
      toast.error('Failed to load interactions')
    } finally {
      setLoading(false)
    }
  }

  const submitComment = async () => {
    if (!commentText.trim() || !user) return
    if (commentText.length > 3000) {
      toast.error('Comment exceeds 3000 characters')
      return
    }
    if (commentImages.length > 6) {
      toast.error('You can upload up to 6 images')
      return
    }

    setSubmittingComment(true)
    try {
      const storage = new StorageService()
      const uploads: Array<{ url: string; thumbUrl: string }> = []
      for (let i = 0; i < commentImages.length; i++) {
        const f = commentImages[i]
        const res = await storage.uploadImageWithThumb(f, `images/interactions/${storyId}`)
        if (res.success && res.url && res.thumbUrl) {
          uploads.push({ url: res.url, thumbUrl: res.thumbUrl })
        }
      }
      const combined = commentUploads.length > 0 ? [...commentUploads, ...uploads] : uploads
      setCommentUploads(combined)
      persistUploads(combined)
      const newComment = await interactionService.createInteraction({
        story_id: storyId,
        type: 'comment',
        content: commentText.trim(),
        attachments: combined
      })

      if (newComment) {
        setInteractions(prev => [...prev, newComment])
        setCommentText('')
        setCommentImages([])
        setCommentUploads([])
        persistUploads([])
        loadInteractions()
        toast.success('Comment added successfully')
      } else {
        toast.error('Failed to add comment')
      }
    } catch (error) {
      console.error('Error submitting comment:', error)
      toast.error('Failed to add comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const submitFollowup = async () => {
    if (!followupText.trim() || !user) return

    setSubmittingFollowup(true)
    try {
      const newFollowup = await interactionService.createInteraction({
        story_id: storyId,
        type: 'followup',
        content: followupText.trim()
      })

      if (newFollowup) {
        setInteractions(prev => [...prev, newFollowup])
        setFollowupText('')
        toast.success('Follow-up question sent successfully')
      } else {
        toast.error('Failed to send follow-up question')
      }
    } catch (error) {
      console.error('Error submitting followup:', error)
      toast.error('Failed to send follow-up question')
    } finally {
      setSubmittingFollowup(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getInteractionIcon = (type: string) => {
    return type === 'comment' ? (
      <MessageCircle className="h-4 w-4 text-blue-500" />
    ) : (
      <HelpCircle className="h-4 w-4 text-orange-500" />
    )
  }

  const getInteractionBadge = (type: string, answeredAt?: string) => {
    if (type === 'comment') {
      return <Badge variant="secondary">Comment</Badge>
    } else {
      return (
        <Badge variant={answeredAt ? "default" : "destructive"}>
          {answeredAt ? (
            <>
              <CheckCircle className="h-3 w-3 mr-1" />
              Answered
            </>
          ) : (
            <>
              <Clock className="h-3 w-3 mr-1" />
              Pending
            </>
          )}
        </Badge>
      )
    }
  }

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-muted rounded"></div>
            <div className="h-3 bg-muted rounded w-5/6"></div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Interactions ({interactions.length})
          </h3>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            <span>{interactions.filter(i => i.type === 'comment').length}</span>
            <HelpCircle className="h-4 w-4 ml-2" />
            <span>{interactions.filter(i => i.type === 'followup').length}</span>
          </div>
        </div>

        {/* Interactions List */}
        {interactions.length > 0 ? (
          <div className="space-y-4">
            {interactions.map((interaction) => (
              <div key={interaction.id} className="flex space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={interaction.facilitator_avatar} />
                  <AvatarFallback>
                    {interaction.facilitator_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-2">
                    {getInteractionIcon(interaction.type)}
                    <span className="font-medium text-sm text-foreground">
                      {interaction.facilitator_name}
                    </span>
                    {getInteractionBadge(interaction.type, interaction.answered_at)}
                    {interaction.type === 'followup' && isStoryteller && !interaction.answered_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // 传递追问ID和内容到录音页面
                          const params = new URLSearchParams({
                            followup: interaction.id,
                            content: interaction.content
                          })
                          window.location.href = withLocale(`/dashboard/projects/${projectId}/record?${params.toString()}`)
                        }}
                        className="h-7 px-2"
                      >
                        <Mic className="h-3 w-3 mr-1" /> Record Answer
                      </Button>
                    )}

                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(interaction.created_at)}
                    </span>
                  </div>
                  <p className="text-foreground text-sm bg-muted p-3 rounded-lg">
                    {interaction.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No interactions yet</p>
            <p className="text-sm">Be the first to leave a comment or ask a question!</p>
          </div>
        )}

        <Separator />

        {/* Add New Interactions */}
        <div className="space-y-4">
          {/* Comment Section - Available to both facilitators and storytellers */}
        {canAddComments && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Leave a comment</label>
            <div className="flex space-x-2">
              <Textarea
                placeholder="Share your thoughts or encouragement..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1"
                rows={2}
              />
              <Button
                variant="outline"
                onClick={submitComment}
                disabled={!commentText.trim() || submittingComment}
                className="self-end"
              >
                {submittingComment ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <input type="file" accept="image/jpeg,image/png" multiple onChange={async (e) => {
              const files = Array.from(e.target.files || [])
              const sliced = files.slice(0, 6)
              setCommentImages(sliced)
              setCommentPreviewUrls(sliced.map(f => URL.createObjectURL(f)))
              const storage = new StorageService()
              const ups: Array<{ url: string; thumbUrl: string }> = []
              setIsUploadingImages(true)
              for (let i = 0; i < sliced.length; i++) {
                const res = await storage.uploadImageWithThumb(sliced[i], `images/interactions/${storyId}`)
                if (res.success && res.url && res.thumbUrl) ups.push({ url: res.url, thumbUrl: res.thumbUrl })
              }
              setCommentUploads(ups)
              persistUploads(ups)
              setIsUploadingImages(false)
            }} />
            <div className="flex flex-wrap gap-2">
              {(commentUploads.length > 0 ? commentUploads.map(i => i.thumbUrl) : commentPreviewUrls).map((src, idx) => (
                <img key={idx} src={src} alt="thumb" className="w-16 h-16 object-cover rounded" />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Comments are sent as warm, encouraging messages to the storyteller.
            </p>
          </div>
        )}

          {/* Follow-up Question Section - Only for facilitators */}
          {canAskFollowups && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Ask a follow-up question</label>
              <div className="flex space-x-2">
                <Textarea
                  placeholder="What would you like to know more about?"
                  value={followupText}
                  onChange={(e) => setFollowupText(e.target.value)}
                  className="flex-1"
                  rows={2}
                />
                <Button
                  variant="default"
                  onClick={submitFollowup}
                  disabled={!followupText.trim() || submittingFollowup}
                  className="self-end"
                >
                  {submittingFollowup ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  ) : (
                    <HelpCircle className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Follow-up questions become new recording prompts for the storyteller.
              </p>
            </div>
          )}

          {/* Message for storytellers about responding to follow-ups */}
          {isStoryteller && !canAddComments && !canAskFollowups && (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">You can respond to follow-up questions by clicking "Record Answer" above.</p>
            </div>
          )}

          {!canAddComments && !canAskFollowups && !isStoryteller && (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">You don't have permission to add interactions.</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
