'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Settings, Search, Play, Sparkles, BookOpen, Clock, Heart, Filter, Plus, Edit, Trash2, UserPlus, MessageCircle, HelpCircle } from 'lucide-react'
import Link from 'next/link'
import { ChapterSummaryCard } from '@/components/story/chapter-summary-card'
import { ChapterProgress } from '@/components/chapters/chapter-progress'
import { PromptQueue } from '@/components/prompts/prompt-queue'
import { AIGeneratedContent } from '@saga/shared/lib/ai-services'
import {
  ActionPermissionGate,
  RolePermissionGate,
  PermissionProvider,
} from '@/components/permissions/PermissionGate'
import { UserRole, getRoleDisplayInfo } from '@saga/shared/lib/permissions'
import { projectService, ProjectWithMembers } from '@/lib/projects'
import { storyService, Story } from '@/lib/stories'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'react-hot-toast'

interface StoryWithDetails extends Story {
  storyteller_name?: string
  storyteller_avatar?: string
  duration?: number
  category?: string
  prompt?: string
  ai_content?: AIGeneratedContent
  interaction_summary?: {
    comments: number
    followups: number
    appreciations: number
  }
  has_new_interactions?: boolean
  type?: 'story' | 'chapter_summary'
  comments_count?: number
  follow_ups_count?: number
  latest_interaction_time?: string | null
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

export default function ProjectDetailPage() {
  const params = useParams()
  const { user } = useAuthStore()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectWithMembers | null>(null)
  const [stories, setStories] = useState<StoryWithDetails[]>([])
  const [chapterSummaries, setChapterSummaries] = useState<ChapterSummary[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'stories' | 'chapters'>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadProject = async () => {
      if (!user?.id) {
        setError('User not authenticated')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Load real project data
        const userProjects = await projectService.getUserProjects(user.id)
        const project = userProjects.find(p => p.id === projectId)

        if (!project) {
          setError('Project not found or access denied')
          setLoading(false)
          return
        }

        setProject(project)

        // Load real stories from database
        try {
          const projectStories = await storyService.getStoriesByProject(projectId)
          console.log('Loaded stories for project:', projectStories)
          setStories(projectStories)
        } catch (storyError) {
          console.error('Error loading stories:', storyError)
          // Don't fail the whole page if stories can't be loaded
          setStories([])
        }
      } catch (error) {
        console.error('Error loading project:', error)
        setError('Failed to load project data')
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [projectId, user?.id])

  // Handle story deletion
  const handleDeleteStory = async (storyId: string) => {
    if (!confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
      return
    }

    try {
      const success = await storyService.deleteStory(storyId)
      if (success) {
        setStories(prev => prev.filter(story => story.id !== storyId))
        toast.success('Story deleted successfully')
      } else {
        toast.error('Failed to delete story')
      }
    } catch (error) {
      console.error('Error deleting story:', error)
      toast.error('Failed to delete story')
    }
  }

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

  if (error) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-foreground">Error</h1>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-4">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-foreground">Project not found</h1>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-4">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  const roleInfo = project.user_role ? getRoleDisplayInfo(project.user_role) : null

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
            <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
            <div className="flex items-center space-x-3 mt-3">
              {roleInfo && (
                <Badge variant={roleInfo.color as any}>
                  <span className="mr-1">{roleInfo.icon}</span>
                  {roleInfo.label}
                  {project.is_owner && ' (Owner)'}
                </Badge>
              )}
              <div className="text-sm text-muted-foreground">
                {project.member_count} members • {project.story_count} stories
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <ActionPermissionGate
              action="canCreateStories"
              userRole={project.user_role}
              isProjectOwner={project.is_owner}
            >
              <Link href={`/dashboard/projects/${projectId}/record`}>
                <Button variant="default">
                  <Plus className="h-4 w-4 mr-2" />
                  Record Story
                </Button>
              </Link>
            </ActionPermissionGate>

            {project.is_owner && (
              <Link href={`/dashboard/projects/${projectId}/invitations`}>
                <Button variant="outline">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Members
                </Button>
              </Link>
            )}

            <ActionPermissionGate
              action="canEditProjectSettings"
              userRole={project.user_role}
              isProjectOwner={project.is_owner}
            >
              <Link href={`/dashboard/projects/${projectId}/settings`}>
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
            </ActionPermissionGate>
          </div>
        </div>

        {/* Chapter Progress and Prompt Queue */}
        <RolePermissionGate allowedRoles={['facilitator']} userRole={project.user_role}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChapterProgress
              projectId={projectId}
              projectCreatedAt={project.created_at}
              servicePlanId="basic_annual"
            />
            <PromptQueue
              projectId={projectId}
              onPromptDelivered={() => {
                // Refresh stories when a prompt is delivered
                // fetchStories()
              }}
            />
          </div>
        </RolePermissionGate>

        {/* Stories */}
        <div className="space-y-6">
          {stories.length === 0 ? (
            <Card className="p-12 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="max-w-md mx-auto space-y-6">
                <div className="text-5xl mb-4">🎭</div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold text-foreground">Start Your Story Journey</h2>
                  <p className="text-muted-foreground">
                    {project.user_role === 'storyteller'
                      ? 'Share your precious memories and let family stories be passed down'
                      : 'Invite family members to start recording and sharing their stories'
                    }
                  </p>
                </div>

                <ActionPermissionGate
                  action="canCreateStories"
                  userRole={project.user_role}
                  isProjectOwner={project.is_owner}
                >
                  <Link href={`/dashboard/projects/${projectId}/record`}>
                    <Button size="lg" className="bg-primary hover:bg-primary/90">
                      <BookOpen className="h-5 w-5 mr-2" />
                      Record Your First Story
                    </Button>
                  </Link>
                </ActionPermissionGate>

                {/* Quick Tips */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 text-sm">
                  <div className="space-y-2">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-muted-foreground">AI Smart Transcription</p>
                  </div>
                  <div className="space-y-2">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <MessageCircle className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-muted-foreground">Family Interactive Comments</p>
                  </div>
                  <div className="space-y-2">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <Heart className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-muted-foreground">Permanent Memory Storage</p>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {stories.map((story) => (
                <Link key={story.id} href={`/dashboard/projects/${projectId}/stories/${story.id}`}>
                  <div className="flex items-start space-x-3 p-4 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border border-border/50 hover:border-primary/20 bg-card">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={story.storyteller_avatar} />
                      <AvatarFallback>
                        {story.storyteller_name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-base font-medium text-foreground truncate">
                          {story.title || story.ai_generated_title || 'Untitled'}
                        </p>
                        <span className="text-sm text-muted-foreground flex-shrink-0 ml-2">
                          {story.latest_interaction_time
                            ? new Date(story.latest_interaction_time).toLocaleDateString()
                            : new Date(story.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {story.ai_summary || story.content || 'No summary available'}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <MessageCircle className="w-4 h-4" />
                            <span>{story.comments_count || 0}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <HelpCircle className="w-4 h-4" />
                            <span>{story.follow_ups_count || 0}</span>
                          </div>
                          {story.duration && (
                            <div className="text-sm text-muted-foreground">
                              {Math.floor(story.duration / 60)}:{String(story.duration % 60).padStart(2, '0')}
                            </div>
                          )}
                        </div>
                        {story.latest_interaction_time && (
                          <span className="text-sm text-muted-foreground">
                            Last activity: {new Date(story.latest_interaction_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PermissionProvider>
  )
}
