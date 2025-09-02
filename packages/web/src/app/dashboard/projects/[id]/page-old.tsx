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
            ],
            processingStatus: 'completed',
            confidence: 0.94
          },
          interaction_summary: {
            comments: 3,
            followups: 1,
            appreciations: 2
          },
          has_new_interactions: true,
          type: 'story'
        },
        {
          id: '3',
          title: 'My First Job at the Factory',
          storyteller_name: 'John Doe',
          storyteller_avatar: '',
          duration: 680, // 11 minutes
          created_at: '2024-01-18T14:20:00Z',
          audio_url: '/mock-audio-3.mp3',
          category: 'Career',
          prompt: 'Tell me about your first job. What was it like walking in on your first day?',
          ai_content: {
            title: 'My First Day at the Factory',
            transcript: 'It was 1965 when I walked through those factory doors for the first time. I was nervous but excited to start earning my own money. The sound of the machines was overwhelming, and there were people everywhere. My supervisor, Mr. Johnson, showed me around and introduced me to my coworkers.',
            summary: 'A memorable account of starting work at a factory in 1965, capturing the excitement and nervousness of a first job.',
            followUpQuestions: [
              'What were your coworkers like?',
              'What was the most challenging part of learning the job?',
              'How did you feel at the end of that first day?'
            ],
            processingStatus: 'completed',
            confidence: 0.91
          },
          interaction_summary: {
            comments: 5,
            followups: 2,
            appreciations: 3
          },
          has_new_interactions: false,
          type: 'story'
        }
      ]

      const mockChapterSummaries: ChapterSummary[] = [
        {
          id: 'chapter-1',
          chapter_number: 1,
          chapter_title: 'Childhood Memories',
          ai_summary: 'This chapter captures the essence of growing up in the 1950s through vivid childhood memories. John shares stories of his neighborhood on Maple Street, family traditions, and the simple joys of childhood. The stories reveal a time when communities were close-knit and children had more freedom to explore and play.',
          story_count: 3,
          total_duration: 1200, // 20 minutes
          created_at: '2024-01-19T15:45:00Z',
          themes: ['Community', 'Family', 'Innocence', 'Nostalgia'],
          key_moments: [
            'Playing outside until streetlights came on',
            'Mother calling for dinner with a bell',
            'Knowing all the neighbors by name'
          ],
          type: 'chapter_summary'
        }
      ]

      setTimeout(() => {
        setProject(mockProject)
        setStories(mockStories)
        setChapterSummaries(mockChapterSummaries)
        setLoading(false)
      }, 1000)
    }

    loadProject()
  }, [projectId])

  // Filter and combine stories and chapter summaries
  const filteredContent = () => {
    let content: (Story | ChapterSummary)[] = []

    if (filterType === 'all' || filterType === 'stories') {
      content = [...content, ...stories]
    }

    if (filterType === 'all' || filterType === 'chapters') {
      content = [...content, ...chapterSummaries]
    }

    // Filter by search query
    if (searchQuery) {
      content = content.filter(item => {
        if (item.type === 'story') {
          const story = item as Story
          return story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                 story.ai_content?.transcript?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                 story.category.toLowerCase().includes(searchQuery.toLowerCase())
        } else {
          const chapter = item as ChapterSummary
          return chapter.chapter_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                 chapter.ai_summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                 chapter.themes.some(theme => theme.toLowerCase().includes(searchQuery.toLowerCase()))
        }
      })
    }

    // Sort by creation date (newest first)
    return content.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

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
            {/* Record Story Button - Only for storytellers */}
            <RolePermissionGate allowedRoles={['storyteller']} userRole={project.user_role}>
              <Link href={`/dashboard/projects/${projectId}/record`}>
                <FurbridgeButton variant="orange">
                  <Plus className="h-4 w-4 mr-2" />
                  Record Story
                </FurbridgeButton>
              </Link>
            </RolePermissionGate>

            {/* Project Settings - Only for facilitators and owners */}
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

        {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-600" />
          <Input
            placeholder="Search stories and chapters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-600" />
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('stories')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filterType === 'stories'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Stories
            </button>
            <button
              onClick={() => setFilterType('chapters')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filterType === 'chapters'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Sparkles className="h-3 w-3 mr-1 inline" />
              AI Summaries
            </button>
          </div>
        </div>
      </div>

      {/* AI-Powered Stories Feed */}
      <div className="space-y-6">
        {filteredContent().length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📖</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No matching content found' : 'No stories yet'}
            </h2>
            <p className="text-gray-600 mb-6">
              {searchQuery
                ? 'Try adjusting your search terms or filters'
                : project.user_role === 'storyteller'
                  ? 'Start sharing your memories by recording your first story'
                  : 'Invite your storyteller to begin capturing precious memories'
              }
            </p>
            {!searchQuery && project.user_role === 'storyteller' && (
              <Link href={`/dashboard/projects/${projectId}/record`}>
                <FurbridgeButton variant="orange" size="lg">
                  <Plus className="h-5 w-5 mr-2" />
                  Record Your First Story
                </FurbridgeButton>
              </Link>
            )}
          </div>
        ) : (
          filteredContent().map((item) => {
            if (item.type === 'chapter_summary') {
              const chapterSummary = item as ChapterSummary
              return (
                <ChapterSummaryCard
                  key={chapterSummary.id}
                  chapterSummary={chapterSummary}
                  onClick={() => {
                    // Navigate to chapter view or expand
                    console.log('View chapter:', chapterSummary.id)
                  }}
                />
              )
            } else {
              const story = item as Story
              return (
                <StoryCard
                  key={story.id}
                  story={story}
                  onPlay={(storyId) => {
                    console.log('Play story:', storyId)
                  }}
                  onViewDetails={(storyId) => {
                    window.location.href = `/dashboard/projects/${projectId}/stories/${storyId}`
                  }}
                  onEdit={(storyId) => {
                    console.log('Edit story:', storyId)
                    // Navigate to story edit page
                    window.location.href = `/dashboard/projects/${projectId}/stories/${storyId}/edit`
                  }}
                  onDelete={(storyId) => {
                    console.log('Delete story:', storyId)
                    // Show confirmation dialog and delete
                    if (confirm('Are you sure you want to delete this story?')) {
                      // Handle story deletion
                    }
                  }}
                  showAIContent={true}
                  userRole={project.user_role}
                  isProjectOwner={project.is_owner}
                />
              )
            }
          })
        )}


      </div>
    </PermissionProvider>
  )
}
