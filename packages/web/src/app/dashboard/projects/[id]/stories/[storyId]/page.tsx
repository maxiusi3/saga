'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Play, Pause, Edit, Send, ZoomIn } from 'lucide-react'
import Link from 'next/link'
import { storyService } from '@/lib/stories'

interface Story {
  id: string
  title: string
  timestamp: string
  storyteller_name: string
  storyteller_avatar?: string
  audio_url: string
  audio_duration: number
  transcript: string
  photo_url?: string
  type: 'story' | 'chapter_summary'
}

interface Interaction {
  id: string
  type: 'comment' | 'followup'
  author_name: string
  author_avatar?: string
  content: string
  timestamp: string
}

export default function StoryDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const storyId = params.storyId as string
  
  const [story, setStory] = useState<Story | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [commentText, setCommentText] = useState('')
  const [followupText, setFollowupText] = useState('')
  const [loading, setLoading] = useState(true)
  
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const loadStory = async () => {
      try {
        // Load real story data from Supabase
        const story = await storyService.getStoryById(storyId)
        if (!story) {
          setError('Story not found')
          setLoading(false)
          return
        }

        setStory({
          id: story.id,
          title: story.title || 'Untitled Story',
          timestamp: story.created_at,
          storyteller_name: 'Storyteller', // TODO: Get from user profile
          storyteller_avatar: '',
          audio_url: story.audio_url || '',
          audio_duration: story.audio_duration || 0,
          transcript: story.transcript || story.content || 'No transcript available',
          photo_url: '',
          type: 'story'
        })
        setEditedTitle(story.title || 'Untitled Story')

        // TODO: Load real interactions from database
        setInteractions([])
        setLoading(false)
      } catch (error) {
        console.error('Error loading story:', error)
        setError('Failed to load story')
        setLoading(false)
      }
    }

    loadStory()
  }, [storyId])

  const togglePlayback = () => {
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
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const changePlaybackSpeed = (speed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed
      setPlaybackSpeed(speed)
    }
  }

  const saveTitle = async () => {
    if (!story || editedTitle.trim() === story.title) {
      setIsEditingTitle(false)
      return
    }

    try {
      // TODO: Update story title in Supabase
      setStory({ ...story, title: editedTitle })
      setIsEditingTitle(false)
    } catch (error) {
      console.error('Error updating title:', error)
    }
  }

  const submitComment = async () => {
    if (!commentText.trim()) return

    const newComment: Interaction = {
      id: Date.now().toString(),
      type: 'comment',
      author_name: 'Current User', // TODO: Get from auth context
      author_avatar: '',
      content: commentText,
      timestamp: new Date().toISOString()
    }

    setInteractions([...interactions, newComment])
    setCommentText('')
  }

  const submitFollowup = async () => {
    if (!followupText.trim()) return

    const newFollowup: Interaction = {
      id: Date.now().toString(),
      type: 'followup',
      author_name: 'Current User', // TODO: Get from auth context
      author_avatar: '',
      content: followupText,
      timestamp: new Date().toISOString()
    }

    setInteractions([...interactions, newFollowup])
    setFollowupText('')
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 bg-muted rounded animate-pulse"></div>
          <div className="h-8 w-64 bg-muted rounded animate-pulse"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-foreground">Story not found</h1>
        <Link href={`/dashboard/projects/${projectId}`}>
          <Button variant="outline" className="mt-4">
            Back to Project
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link href={`/dashboard/projects/${projectId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        
        {isEditingTitle ? (
          <div className="flex-1 flex space-x-2">
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="text-2xl font-bold h-auto py-2"
              onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
            />
            <Button variant="outline" onClick={saveTitle}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setIsEditingTitle(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex items-center space-x-2">
            <h1 className="text-3xl font-bold text-foreground">{story.title}</h1>
            <Button variant="ghost" size="icon" onClick={() => setIsEditingTitle(true)}>
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Story Metadata */}
      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
        <span>{formatTimestamp(story.timestamp)}</span>
        <span>•</span>
        <span>{story.storyteller_name}</span>
        {story.type === 'chapter_summary' && (
          <>
            <span>•</span>
            <Badge variant="secondary">Chapter Summary</Badge>
          </>
        )}
      </div>

      {/* Photo Viewer */}
      {story.photo_url && (
        <Card className="p-4">
          <div className="relative">
            <img 
              src={story.photo_url} 
              alt="Story photo" 
              className="w-full max-w-2xl mx-auto rounded-lg"
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-2 right-2 bg-background/80"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Audio Player */}
      {story.type === 'story' && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Audio Recording</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Speed:</span>
                {[1, 1.25, 1.5, 2].map((speed) => (
                  <Button
                    key={speed}
                    variant={playbackSpeed === speed ? "default" : "ghost"}
                    size="sm"
                    onClick={() => changePlaybackSpeed(speed)}
                    className="text-xs"
                  >
                    {speed}x
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="outline" size="icon" onClick={togglePlayback}>
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>

              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max={story.audio_duration}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="text-sm text-muted-foreground min-w-fit">
                {formatTime(currentTime)} / {formatTime(story.audio_duration)}
              </div>
            </div>

            <audio
              ref={audioRef}
              src={story.audio_url}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
            />
          </div>
        </Card>
      )}

      {/* Transcript */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-foreground">Transcript</h3>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
          
          <div className="prose prose-foreground max-w-none">
            <div className="whitespace-pre-wrap text-foreground leading-relaxed">
              {story.transcript}
            </div>
          </div>
        </div>
      </Card>

      {/* Interactions */}
      <Card className="p-6">
        <div className="space-y-6">
          <h3 className="font-semibold text-foreground">Comments & Questions</h3>

          {/* Existing Interactions */}
          <div className="space-y-4">
            {interactions.map((interaction) => (
              <div key={interaction.id} className="flex space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={interaction.author_avatar} />
                  <AvatarFallback>
                    {interaction.author_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-foreground text-sm">
                      {interaction.author_name}
                    </span>
                    <Badge variant={interaction.type === 'followup' ? 'outline' : 'secondary'} className="text-xs">
                      {interaction.type === 'followup' ? 'Question' : 'Comment'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(interaction.timestamp)}
                    </span>
                  </div>
                  <p className="text-foreground text-sm">{interaction.content}</p>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Add New Interactions */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Leave a comment</label>
              <div className="flex space-x-2">
                <Textarea
                  placeholder="Share your thoughts..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1"
                  rows={2}
                />
                <Button 
                  variant="outline" 
                  onClick={submitComment}
                  disabled={!commentText.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

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
                  disabled={!followupText.trim()}
                  className="bg-primary"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
