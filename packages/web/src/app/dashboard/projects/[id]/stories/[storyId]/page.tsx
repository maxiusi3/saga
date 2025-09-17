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
import { useAuthStore } from '@/stores/auth-store'
import { createClientSupabase } from '@/lib/supabase'
import { StoryInteractions } from '@/components/interactions/story-interactions'
import { canUserPerformAction } from '@saga/shared/lib/permissions'
import { toast } from 'sonner'

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



export default function StoryDetailPage() {
  const params = useParams()
  const { user } = useAuthStore()
  const projectId = params.id as string
  const storyId = params.storyId as string

  const [story, setStory] = useState<Story | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [isEditingTranscript, setIsEditingTranscript] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 用户权限状态
  const [userRole, setUserRole] = useState<string>('')
  const [isProjectOwner, setIsProjectOwner] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const loadStory = async () => {
      try {
        // Load real story data from Supabase
        const story = await storyService.getStoryById(storyId)
        console.log('Raw story data from database:', story)
        if (!story) {
          setError('Story not found')
          setLoading(false)
          return
        }

        // 获取storyteller的用户资料
        const supabase = createClientSupabase()
        let storytellerName = 'Unknown User'
        let storytellerAvatar = ''

        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('name, email, avatar_url')
            .eq('id', story.storyteller_id)
            .single()

          if (profile) {
            storytellerName = profile.name || profile.email || 'Unknown User'
            storytellerAvatar = profile.avatar_url || ''
          }
        } catch (profileError) {
          console.warn('Failed to fetch storyteller profile:', profileError)
        }

        const storyData = {
          id: story.id,
          title: story.title || 'Untitled Story',
          timestamp: story.created_at,
          storyteller_name: storytellerName,
          storyteller_avatar: storytellerAvatar,
          audio_url: story.audio_url || '',
          audio_duration: story.audio_duration || 0,
          transcript: story.transcript || story.content || 'No transcript available',
          photo_url: '',
          type: 'story'
        }
        setStory(storyData)
        setEditedTitle(storyData.title)
        setEditedTranscript(storyData.transcript)

        // Interactions are loaded within the StoryInteractions component
        setLoading(false)
      } catch (error) {
        console.error('Error loading story:', error)
        setError('Failed to load story')
        setLoading(false)
      }
    }

    loadStory()
    loadUserRole()
  }, [storyId, projectId, user])

  const loadUserRole = async () => {
    if (!user || !projectId) return

    try {
      // 获取认证token
      const supabase = createClientSupabase()
      const { data: { session } } = await supabase.auth.getSession()

      // 构建认证头
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      // 获取项目信息和用户角色
      const response = await fetch(`/api/projects/${projectId}/overview`, {
        credentials: 'include',
        headers
      })

      if (response.ok) {
        const data = await response.json()

        // 检查是否是项目所有者
        const isOwner = data.project?.facilitator_id === user.id
        setIsProjectOwner(isOwner)

        // 获取用户在项目中的角色
        const userMember = data.members?.find((member: any) => member.user_id === user.id)
        if (userMember) {
          setUserRole(userMember.role)
        } else if (isOwner) {
          setUserRole('facilitator')
        }
      }
    } catch (error) {
      console.error('Error loading user role:', error)
      // 默认设置为facilitator以避免权限问题
      setUserRole('facilitator')
    }
  }

  const togglePlayback = async () => {
    if (!audioRef.current) return

    try {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        // 确保音频已经加载
        if (audioRef.current.readyState < 2) {
          console.log('Audio not ready, loading...')
          await new Promise((resolve) => {
            const onCanPlay = () => {
              audioRef.current?.removeEventListener('canplay', onCanPlay)
              resolve(void 0)
            }
            audioRef.current?.addEventListener('canplay', onCanPlay)
            audioRef.current?.load()
          })
        }

        await audioRef.current.play()
        setIsPlaying(true)
      }
    } catch (error) {
      console.error('Audio playback error:', error)
      setIsPlaying(false)
      toast.error('Failed to play audio')
    }
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
      const supabase = createClientSupabase()
      const { error } = await supabase
        .from('stories')
        .update({ title: editedTitle.trim() })
        .eq('id', storyId)

      if (error) {
        console.error('Error updating title:', error)
        toast.error('Failed to update title')
        return
      }

      setStory({ ...story, title: editedTitle.trim() })
      setIsEditingTitle(false)
      toast.success('Title updated successfully')
    } catch (error) {
      console.error('Error updating title:', error)
      toast.error('Failed to update title')
    }
  }

  const saveTranscript = async () => {
    if (!story || editedTranscript.trim() === story.transcript) {
      setIsEditingTranscript(false)
      return
    }

    try {
      const supabase = createClientSupabase()
      const { error } = await supabase
        .from('stories')
        .update({ transcript: editedTranscript.trim() })
        .eq('id', storyId)

      if (error) {
        console.error('Error updating transcript:', error)
        toast.error('Failed to update transcript')
        return
      }

      setStory({ ...story, transcript: editedTranscript.trim() })
      setIsEditingTranscript(false)
      toast.success('Transcript updated successfully')
    } catch (error) {
      console.error('Error updating transcript:', error)
      toast.error('Failed to update transcript')
    }
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
            {canUserPerformAction('canEditStoryTitles', userRole as any, isProjectOwner) && (
              <Button variant="ghost" size="icon" onClick={() => setIsEditingTitle(true)}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
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
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={(e) => {
                console.error('Audio error:', e)
                console.error('Audio URL:', story.audio_url)
                setIsPlaying(false)
                toast.error('Audio failed to load')
              }}
              onLoadStart={() => console.log('Audio loading started')}
              onCanPlay={() => console.log('Audio can play')}
              onLoadedData={() => console.log('Audio data loaded')}
              onWaiting={() => console.log('Audio waiting for data')}
              onStalled={() => console.log('Audio stalled')}
              preload="metadata"
            />
          </div>
        </Card>
      )}

      {/* Transcript */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-foreground">Transcript</h3>
            {canUserPerformAction('canEditStoryTranscripts', userRole as any, isProjectOwner) && (
              <div className="flex space-x-2">
                {isEditingTranscript ? (
                  <>
                    <Button variant="outline" size="sm" onClick={saveTranscript}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingTranscript(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingTranscript(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            )}
          </div>

          {isEditingTranscript ? (
            <Textarea
              value={editedTranscript}
              onChange={(e) => setEditedTranscript(e.target.value)}
              className="min-h-[200px] text-foreground leading-relaxed"
              placeholder="Enter transcript..."
            />
          ) : (
            <div className="prose prose-foreground max-w-none">
              <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                {story.transcript}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Interactions */}
      <StoryInteractions
        storyId={storyId}
        projectId={projectId}
        userRole={userRole}
        isProjectOwner={isProjectOwner}
        isStoryteller={story?.storyteller_id === user?.id}
      />

      {/* Debug info - temporary */}
      <div className="mt-4 p-4 bg-gray-100 text-xs">
        <p>Debug Info:</p>
        <p>story.storyteller_id: {story?.storyteller_id}</p>
        <p>user.id: {user?.id}</p>
        <p>isStoryteller: {String(story?.storyteller_id === user?.id)}</p>
        <p>userRole: {userRole}</p>
        <p>isProjectOwner: {String(isProjectOwner)}</p>
        <details className="mt-2">
          <summary>Raw story object:</summary>
          <pre className="mt-1 text-xs overflow-auto max-h-40">
            {JSON.stringify(story, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  )
}
