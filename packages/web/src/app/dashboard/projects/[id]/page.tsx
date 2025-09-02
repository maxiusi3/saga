'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Settings, Search, Play, MessageCircle, HelpCircle, Sparkles, BookOpen, Clock, Heart, Filter, Plus, Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { StoryCard } from '@/components/story/story-card'
import { ChapterSummaryCard } from '@/components/story/chapter-summary-card'
import { AIGeneratedContent } from '../../../../../shared/src/lib/ai-services'
import { ActionPermissionGate, RolePermissionGate, PermissionProvider } from '@/components/permissions/PermissionGate'
import { UserRole, getRoleDisplayInfo } from '@saga/shared'

interface Story {
  id: string
  title: string
  storyteller_name: string
  storyteller_avatar?: string
  duration: number
  created_at: string
  audio_url: string
  category: string
  prompt: string
  ai_content?: AIGeneratedContent
  interaction_summary: {
    comments: number
    followups: number
    appreciations: number
  }
  has_new_interactions: boolean
  type: 'story' | 'chapter_summary'
}

interface ChapterSummary {
  id: string
  chapter_number: number
  chapter_title: string
  ai_summary: string
  story_count: number
  total_duration: number
  created_at: string
  themes: string[]
  key_moments: string[]
  type: 'chapter_summary'
}

interface Project {
  id: string
  title: string
  description?: string
  owner_id: string
  storyteller_name: string
  storyteller_avatar?: string
  status: 'awaiting_invitation' | 'active'
  user_role: UserRole
  is_owner: boolean
  member_count: number
  story_count: number
}

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  
  const [project, setProject] = useState<Project | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [chapterSummaries, setChapterSummaries] = useState<ChapterSummary[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'stories' | 'chapters'>('all')

  useEffect(() => {
    const loadProject = async () => {
      // Mock data - replace with actual Supabase queries
      const mockProject: Project = {
        id: projectId,
        title: "Dad's Life Story",
        description: "A collection of stories about our father's incredible life journey",
        owner_id: 'owner-123',
        storyteller_name: 'John Doe',
        storyteller_avatar: '',
        status: 'active',
        user_role: projectId === '2' ? 'storyteller' : projectId === '3' ? 'co_facilitator' : 'facilitator',
        is_owner: projectId === '1',
        member_count: 3,
        story_count: 12
      }

      const mockStories: Story[] = [
        {
          id: '1',
          title: 'Growing Up in the 1950s',
          storyteller_name: 'John Doe',
          storyteller_avatar: '',
          duration: 420, // 7 minutes
          created_at: '2024-01-20T10:30:00Z',
          audio_url: '/mock-audio-1.mp3',
          category: 'Childhood Memories',
          prompt: 'Tell me about your earliest childhood memory. Can you describe what you remember about that moment?',
          ai_content: {
            title: 'Growing Up in the 1950s',
            transcript: 'I remember when I was just seven years old, living in that small house on Maple Street. The neighborhood was so different back then - kids played outside until the streetlights came on, and everyone knew each other. My mother would call us in for dinner by ringing a bell from the front porch.',
            summary: 'A vivid recollection of childhood in the 1950s, highlighting the close-knit community and simpler times.',
            followUpQuestions: [
              'What games did you and the neighborhood kids play?',
              'Can you tell me more about your house on Maple Street?',
              'What was your favorite thing about that neighborhood?'
            ]
          },
          interaction_summary: {
            comments: 3,
            followups: 2,
            appreciations: 8
          },
          has_new_interactions: true,
          type: 'story'
        }
      ]

      // Simulate loading delay
      setTimeout(() => {
        setProject(mockProject)
        setStories(mockStories)
        setLoading(false)
      }, 1000)
    }

    loadProject()
  }, [projectId])

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
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
          <Link href={`/dashboard/projects/${projectId}/settings`}>
            <FurbridgeButton variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </FurbridgeButton>
          </Link>
        </div>

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

  const roleInfo = getRoleDisplayInfo(project.user_role)

  return (
    <PermissionProvider 
      userRole={project.user_role} 
      isProjectOwner={project.is_owner}
      projectId={projectId}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
            {project.description && (
              <p className="text-gray-600 mt-1">{project.description}</p>
            )}
            <div className="flex items-center space-x-3 mt-3">
              <Badge className={roleInfo.color}>
                <span className="mr-1">{roleInfo.icon}</span>
                {roleInfo.label}
                {project.is_owner && ' (Owner)'}
              </Badge>
              <div className="text-sm text-gray-500">
                {project.member_count} members • {project.story_count} stories
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <RolePermissionGate allowedRoles={['storyteller']} userRole={project.user_role}>
              <Link href={`/dashboard/projects/${projectId}/record`}>
                <FurbridgeButton variant="orange">
                  <Plus className="h-4 w-4 mr-2" />
                  Record Story
                </FurbridgeButton>
              </Link>
            </RolePermissionGate>

            <ActionPermissionGate 
              action="canEditProjectSettings" 
              userRole={project.user_role} 
              isProjectOwner={project.is_owner}
            >
              <Link href={`/dashboard/projects/${projectId}/settings`}>
                <FurbridgeButton variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </FurbridgeButton>
              </Link>
            </ActionPermissionGate>
          </div>
        </div>

        {/* Stories */}
        <div className="space-y-6">
          {stories.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📖</div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">No stories yet</h2>
              <p className="text-gray-600 mb-6">
                {project.user_role === 'storyteller'
                  ? 'Start sharing your memories by recording your first story'
                  : 'Invite your storyteller to begin capturing precious memories'
                }
              </p>
              <RolePermissionGate allowedRoles={['storyteller']} userRole={project.user_role}>
                <Link href={`/dashboard/projects/${projectId}/record`}>
                  <FurbridgeButton variant="orange" size="lg">
                    <Plus className="h-5 w-5 mr-2" />
                    Record Your First Story
                  </FurbridgeButton>
                </Link>
              </RolePermissionGate>
            </div>
          ) : (
            stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                onPlay={(storyId) => console.log('Play story:', storyId)}
                onViewDetails={(storyId) => {
                  window.location.href = `/dashboard/projects/${projectId}/stories/${storyId}`
                }}
                onEdit={(storyId) => {
                  window.location.href = `/dashboard/projects/${projectId}/stories/${storyId}/edit`
                }}
                onDelete={(storyId) => {
                  if (confirm('Are you sure you want to delete this story?')) {
                    console.log('Delete story:', storyId)
                  }
                }}
                showAIContent={true}
                userRole={project.user_role}
                isProjectOwner={project.is_owner}
              />
            ))
          )}
        </div>
      </div>
    </PermissionProvider>
  )
}
