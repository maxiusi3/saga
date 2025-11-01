'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useTranslations } from 'next-intl'
import { 
  Play,
  Pause,
  Volume2,
  Edit,
  Save,
  X,
  MessageCircle,
  Heart,
  Share,
  Download,
  Calendar,
  Clock,
  User,
  Camera,
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
  MoreHorizontal
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Story {
  id: string
  title: string
  content?: string
  transcript: string
  storyteller: {
    id: string
    name: string
    avatar?: string
  }
  audioUrl: string
  duration: number
  createdAt: string
  chapter?: {
    id: string
    name: string
    color?: string
  }
  theme?: string
  photos: Array<{
    id: string
    url: string
    caption?: string
    isPrimary?: boolean
  }>
  status: 'new' | 'reviewed' | 'pending'
  engagementScore?: number
}

interface Comment {
  id: string
  author: {
    id: string
    name: string
    avatar?: string
  }
  content: string
  createdAt: string
  replies?: Comment[]
}

interface StoryDetailPageProps {
  story: Story
  comments: Comment[]
  projectId: string
  userRole: 'facilitator' | 'storyteller' | 'admin'
  canEdit?: boolean
  onUpdateStory?: (updates: Partial<Story>) => Promise<void>
  onAddComment?: (content: string, parentId?: string) => Promise<void>
  onAddFollowUp?: (question: string) => Promise<void>
  onUploadPhoto?: (file: File) => Promise<void>
}

export function StoryDetailPage({
  story,
  comments,
  projectId,
  userRole,
  canEdit = false,
  onUpdateStory,
  onAddComment,
  onAddFollowUp,
  onUploadPhoto
}: StoryDetailPageProps) {
  const t = useTranslations('stories')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [isEditingTranscript, setIsEditingTranscript] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState(story.transcript)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)
  const [newComment, setNewComment] = useState('')
  const [newFollowUp, setNewFollowUp] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')

  // locale-aware 链接助手
  const params = useParams()
  const locale = (params?.locale as string) || ''
  const withLocale = (path: string) => {
    const sanitized = path.startsWith('/') ? path : `/${path}`
    const hasLocale = /^\/(en|zh|fr|es)(\/|$)/.test(sanitized)
    if (!locale || hasLocale) return sanitized
    return `/${locale}${sanitized}`
  }

  const primaryPhoto = story.photos.find(p => p.isPrimary) || story.photos[0]

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleSaveTranscript = async () => {
    if (onUpdateStory) {
      await onUpdateStory({ transcript: editedTranscript })
      setIsEditingTranscript(false)
    }
  }

  const handleAddComment = async () => {
    if (newComment.trim() && onAddComment) {
      await onAddComment(newComment)
      setNewComment('')
    }
  }

  const handleAddFollowUp = async () => {
    if (newFollowUp.trim() && onAddFollowUp) {
      await onAddFollowUp(newFollowUp)
      setNewFollowUp('')
    }
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href={withLocale(`/dashboard/projects/${projectId}/stories`)}>
            <Button variant="tertiary" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Stories
            </Button>
          </Link>
          <div>
            <h1 className="text-h1 font-bold text-foreground">{story.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar size="xs">
                  <AvatarImage src={story.storyteller.avatar} />
                  <AvatarFallback>{story.storyteller.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span>{story.storyteller.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(story.createdAt)}</span>
              </div>
              {story.chapter && (
                <Badge 
                  variant="outline" 
                  size="sm"
                  style={{ 
                    borderColor: story.chapter.color || '#2D5A3D',
                    color: story.chapter.color || '#2D5A3D'
                  }}
                >
                  {story.chapter.name}
                </Badge>
              )}
              <StatusBadge status={story.status} size="sm" />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="tertiary" size="sm">
            <Share className="w-4 h-4 mr-1" />
            Share
          </Button>
          <Button variant="tertiary" size="sm">
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          {canEdit && (
            <Button variant="secondary" size="sm">
              <Edit className="w-4 h-4 mr-1" />
              {t('actions.editStory')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Photo Gallery */}
          {story.photos.length > 0 && (
            <Card variant="content">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Main Photo */}
                  <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                    <img 
                      src={story.photos[selectedPhotoIndex]?.url || primaryPhoto?.url}
                      alt={story.photos[selectedPhotoIndex]?.caption || story.title}
                      className="w-full h-full object-cover"
                    />
                    {story.photos.length > 1 && (
                      <>
                        <button
                          onClick={() => setSelectedPhotoIndex(Math.max(0, selectedPhotoIndex - 1))}
                          className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                          disabled={selectedPhotoIndex === 0}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedPhotoIndex(Math.min(story.photos.length - 1, selectedPhotoIndex + 1))}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                          disabled={selectedPhotoIndex === story.photos.length - 1}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Thumbnail Gallery */}
                  {story.photos.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {story.photos.map((photo, index) => (
                        <button
                          key={photo.id}
                          onClick={() => setSelectedPhotoIndex(index)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                            index === selectedPhotoIndex 
                              ? 'border-primary' 
                              : 'border-transparent hover:border-border'
                          }`}
                        >
                          <img 
                            src={photo.url} 
                            alt={photo.caption || `Photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audio Player */}
          <Card variant="content">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Audio Recording</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(story.duration)}</span>
                  </div>
                </div>
                
                {/* Audio Controls */}
                <div className="flex items-center gap-4">
                  <Button
                    variant={isPlaying ? "secondary" : "primary"}
                    size="sm"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  
                  {/* Progress Bar */}
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-full rounded-full transition-all duration-200"
                      style={{ width: `${(currentTime / story.duration) * 100}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-16"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transcript */}
          <Card variant="content">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Transcript</CardTitle>
                {canEdit && (
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() => setIsEditingTranscript(!isEditingTranscript)}
                  >
                    {isEditingTranscript ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditingTranscript ? (
                <div className="space-y-4">
                  <Textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    rows={10}
                    className="w-full"
                  />
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={handleSaveTranscript}>
                      <Save className="w-4 h-4 mr-1" />
                      Save Changes
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => {
                        setEditedTranscript(story.transcript)
                        setIsEditingTranscript(false)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                    {story.transcript}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card variant="content">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Family Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Comment */}
              <div className="space-y-3">
                <Textarea
                  placeholder="Share your thoughts about this story..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <Button variant="primary" size="sm" onClick={handleAddComment}>
                  <Send className="w-4 h-4 mr-1" />
                  Add Comment
                </Button>
              </div>

              {/* Comments List */}
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Avatar size="sm">
                        <AvatarImage src={comment.author.avatar} />
                        <AvatarFallback>{comment.author.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground">{comment.author.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-foreground">{comment.content}</p>
                        <Button
                          variant="tertiary"
                          size="sm"
                          onClick={() => setReplyingTo(comment.id)}
                          className="mt-2"
                        >
                          Reply
                        </Button>
                      </div>
                    </div>

                    {/* Reply Form */}
                    {replyingTo === comment.id && (
                      <div className="ml-12 space-y-2">
                        <Textarea
                          placeholder="Write a reply..."
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => handleAddReply(comment.id)}
                          >
                            Reply
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => setReplyingTo(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="ml-12 space-y-3">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="flex items-start gap-3">
                            <Avatar size="xs">
                              <AvatarImage src={reply.author.avatar} />
                              <AvatarFallback>{reply.author.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-foreground text-sm">{reply.author.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(reply.createdAt)}
                                </span>
                              </div>
                              <p className="text-foreground text-sm">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Follow-up Questions */}
          {(userRole === 'facilitator' || userRole === 'admin') && (
            <Card variant="content">
              <CardHeader>
                <CardTitle className="text-lg">Add Follow-up Question</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Ask a follow-up question about this story..."
                  value={newFollowUp}
                  onChange={(e) => setNewFollowUp(e.target.value)}
                  rows={3}
                />
                <Button variant="primary" size="sm" onClick={handleAddFollowUp} className="w-full">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Question
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Story Metadata */}
          <Card variant="content">
            <CardHeader>
              <CardTitle className="text-lg">Story Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Duration</span>
                <span className="font-medium">{formatDuration(story.duration)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Recorded</span>
                <span className="font-medium">{formatDate(story.createdAt)}</span>
              </div>
              {story.theme && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Theme</span>
                  <Badge variant="outline" size="sm">{story.theme}</Badge>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Comments</span>
                <span className="font-medium">{comments.length}</span>
              </div>
              {story.engagementScore && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Engagement</span>
                  <span className="font-medium">{Math.round(story.engagementScore)}%</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}