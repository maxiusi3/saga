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
import { ArrowLeft, Edit, Send, ZoomIn } from 'lucide-react'
import Link from 'next/link'
import { storyService } from '@/lib/stories'
import { useAuthStore } from '@/stores/auth-store'
import { createClientSupabase } from '@/lib/supabase'
import { StoryInteractions } from '@/components/interactions/story-interactions'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { canUserPerformAction } from '@saga/shared/lib/permissions'
import { toast } from 'sonner'

interface Story {
  id: string
  title: string
  timestamp: string
  storyteller_id: string
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
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [isEditingTranscript, setIsEditingTranscript] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

// 用户权限状态
const [userRole, setUserRole] = useState<string>('')
const [isProjectOwner, setIsProjectOwner] = useState(false)

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

// 生成音频URL - 检查实际的存储桶
let audioUrl = story.audio_url
if (!audioUrl && story.audio_duration > 0) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const buckets = ['saga', 'audio-recordings']
  const possibleFormats = ['webm', 'mp3', 'wav', 'm4a']
  
  for (const bucket of buckets) {
    for (const format of possibleFormats) {
      const testUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${story.id}.${format}`
      try {
        const response = await fetch(testUrl, { method: 'HEAD' })
        if (response.ok) {
          audioUrl = testUrl
          console.log('Found audio at:', testUrl)
          break
        }
      } catch (e) {
        // 继续尝试
      }
    }
    if (audioUrl) break
  }
  
  // 如果还没找到，尝试项目ID作为文件夹
  if (!audioUrl) {
    for (const bucket of buckets) {
      for (const format of possibleFormats) {
        const testUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${story.project_id}/${story.id}.${format}`
        try {
          const response = await fetch(testUrl, { method: 'HEAD' })
          if (response.ok) {
            audioUrl = testUrl
            console.log('Found audio at:', testUrl)
            break
          }
        } catch (e) {}
      }
      if (audioUrl) break
    }
  }
}


      const storyData = {
        id: story.id,
        title: story.title || 'Untitled Story',
        timestamp: story.created_at,
        storyteller_id: story.storyteller_id,
        storyteller_name: storytellerName,
        storyteller_avatar: storytellerAvatar,
        audio_url: audioUrl, // 使用生成或检测到的URL
        audio_duration: story.audio_duration || 0,
        transcript: story.transcript || story.content || 'No transcript available',
        photo_url: '',
        type: 'story'
      }

      // 调试信息
      console.log('Raw story from database:', story)
      console.log('Generated audio URL:', audioUrl)

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

{/* Audio Player Debug */}
{story.type === 'story' && (
  <Card className="p-6">
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">Audio Recording Debug</h3>
      
      {/* 原始数据调试 */}
      <div className="bg-yellow-100 p-4 rounded">
        <h4 className="font-bold">原始Story对象所有字段：</h4>
        <pre className="text-xs overflow-auto max-h-40">
          {JSON.stringify(story, null, 2)}
        </pre>
      </div>

      <div className="text-sm bg-gray-100 p-4 rounded">
        <p><strong>Story Type:</strong> {story.type}</p>
        <p><strong>Audio URL:</strong> {story.audio_url || 'null/undefined'}</p>
        <p><strong>Audio Duration:</strong> {story.audio_duration || 'null/undefined'}</p>
        <p><strong>Story ID:</strong> {story.id}</p>
      </div>

      {story.audio_url ? (
        <div>
          <p className="text-green-600">✅ Audio URL exists, loading player...</p>
          <AudioPlayer
            src={story.audio_url}
            title={story.title}
            className="w-full"
          />
        </div>
      ) : (
        <p className="text-red-600">❌ No audio URL found</p>
      )}
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


    </div>
  )
}
