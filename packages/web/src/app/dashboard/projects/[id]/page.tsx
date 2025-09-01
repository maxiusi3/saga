'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Settings, Search, Play, MessageCircle, HelpCircle } from 'lucide-react'
import Link from 'next/link'

interface Story {
  id: string
  title: string
  timestamp: string
  storyteller_name: string
  storyteller_avatar?: string
  audio_duration: number
  transcript_snippet: string
  photo_url?: string
  comments_count: number
  followup_count: number
  type: 'story' | 'chapter_summary'
}

interface Project {
  id: string
  title: string
  storyteller_name: string
  storyteller_avatar?: string
  status: 'awaiting_invitation' | 'active'
}

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  
  const [project, setProject] = useState<Project | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProject = async () => {
      // Mock data - replace with actual Supabase queries
      const mockProject: Project = {
        id: projectId,
        title: "Dad's Life Story",
        storyteller_name: 'John Doe',
        storyteller_avatar: '',
        status: 'active'
      }

      const mockStories: Story[] = [
        {
          id: '1',
          title: 'Growing Up in the 1950s',
          timestamp: '2024-01-20T10:30:00Z',
          storyteller_name: 'John Doe',
          storyteller_avatar: '',
          audio_duration: 420, // 7 minutes
          transcript_snippet: 'I remember when I was just seven years old, living in that small house on Maple Street...',
          photo_url: '',
          comments_count: 3,
          followup_count: 1,
          type: 'story'
        },
        {
          id: '2',
          title: 'Chapter 1: Early Years Summary',
          timestamp: '2024-01-19T15:45:00Z',
          storyteller_name: 'AI Assistant',
          storyteller_avatar: '',
          audio_duration: 0,
          transcript_snippet: 'This chapter covers John\'s early childhood memories from ages 5-12, including his family life, school experiences, and the neighborhood he grew up in...',
          comments_count: 0,
          followup_count: 0,
          type: 'chapter_summary'
        },
        {
          id: '3',
          title: 'My First Job at the Factory',
          timestamp: '2024-01-18T14:20:00Z',
          storyteller_name: 'John Doe',
          storyteller_avatar: '',
          audio_duration: 680, // 11 minutes
          transcript_snippet: 'It was 1965 when I walked through those factory doors for the first time. I was nervous but excited...',
          photo_url: '',
          comments_count: 5,
          followup_count: 2,
          type: 'story'
        }
      ]

      setTimeout(() => {
        setProject(mockProject)
        setStories(mockStories)
        setLoading(false)
      }, 1000)
    }

    loadProject()
  }, [projectId])

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
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

  const filteredStories = stories.filter(story =>
    story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    story.transcript_snippet.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-10" />
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900">Project not found</h1>
        <Link href="/dashboard">
          <FurbridgeButton variant="outline" className="mt-4">
            Back to Dashboard
          </FurbridgeButton>
        </Link>
      </div>
    )
  }

  if (project.status === 'awaiting_invitation') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
          <Link href={`/dashboard/projects/${projectId}/settings`}>
            <FurbridgeButton variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </FurbridgeButton>
          </Link>
        </div>

        {/* Awaiting Invitation State */}
        <div className="text-center py-16">
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-6xl mb-4">📬</div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Invite a Storyteller to Begin
            </h2>
            <p className="text-gray-600">
              Send an invitation to your family member to start capturing their stories.
            </p>
            <FurbridgeButton variant="orange" size="lg">
              Invite Storyteller
            </FurbridgeButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
        <Link href={`/dashboard/projects/${projectId}/settings`}>
          <FurbridgeButton variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </FurbridgeButton>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-600" />
        <Input
          placeholder="Search stories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stories Feed */}
      <div className="space-y-4">
        {filteredStories.map((story) => (
          <Link key={story.id} href={`/dashboard/projects/${projectId}/stories/${story.id}`}>
            <FurbridgeCard className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="space-y-4">
                {/* Story Header */}
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {story.title}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>{formatTimestamp(story.timestamp)}</span>
                      <span>{story.storyteller_name}</span>
                    </div>
                  </div>
                  {story.type === 'chapter_summary' && (
                    <Badge variant="secondary">Chapter Summary</Badge>
                  )}
                </div>

                {/* Audio Player (for regular stories) */}
                {story.type === 'story' && (
                  <div className="flex items-center space-x-3 bg-gray-100/50 rounded-lg p-3">
                    <FurbridgeButton variant="ghost" size="icon" className="h-8 w-8">
                      <Play className="h-4 w-4" />
                    </FurbridgeButton>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-furbridge-orange h-2 rounded-full w-1/3"></div>
                    </div>
                    <span className="text-sm text-gray-600">
                      {formatDuration(story.audio_duration)}
                    </span>
                  </div>
                )}

                {/* Transcript Snippet */}
                <p className="text-gray-600 line-clamp-2">
                  {story.transcript_snippet}
                </p>

                {/* Photo Thumbnail */}
                {story.photo_url && (
                  <div className="w-16 h-16 bg-gray-100 rounded-lg"></div>
                )}

                {/* Interaction Summary */}
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  {story.comments_count > 0 && (
                    <div className="flex items-center space-x-1">
                      <MessageCircle className="h-4 w-4" />
                      <span>{story.comments_count} Comments</span>
                    </div>
                  )}
                  {story.followup_count > 0 && (
                    <div className="flex items-center space-x-1">
                      <HelpCircle className="h-4 w-4" />
                      <span>{story.followup_count} Follow-up</span>
                    </div>
                  )}
                </div>
              </div>
            </FurbridgeCard>
          </Link>
        ))}

        {filteredStories.length === 0 && searchQuery && (
          <div className="text-center py-8">
            <p className="text-gray-600">No stories found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  )
}
