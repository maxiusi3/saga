'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard } from '@/components/ui/enhanced-card'
import { StoryCard } from '@/components/ui/story-card'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Settings, Search, Play, Sparkles, BookOpen, Clock, Heart, Filter, Plus, Edit, Trash2, UserPlus, MessageCircle, HelpCircle, Users, BarChart3, Download, Share, ExternalLink } from 'lucide-react'
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
import { ErrorBoundary } from '@/components/error-boundary'

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
  const locale = useLocale()
  const tProjects = useTranslations('projects')
  const tCommon = useTranslations('common')
  const withLocale = (path: string) => {
    if (!path.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }

  const [project, setProject] = useState<ProjectWithMembers | null>(null)
  const [stories, setStories] = useState<StoryWithDetails[]>([])
  const [chapterSummaries, setChapterSummaries] = useState<ChapterSummary[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'stories' | 'chapters'>('all')
  const [selectedStorytellerFilter, setSelectedStorytellerFilter] = useState<string>('all')
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'most-comments'>('latest')
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
        console.log('User projects loaded:', userProjects)
        
        if (!userProjects || !Array.isArray(userProjects)) {
          console.error('Invalid user projects response:', userProjects)
          setError('Failed to load projects')
          setLoading(false)
          return
        }
        
        const project = userProjects.find(p => p.id === projectId)

        if (!project) {
          console.error('Project not found in user projects:', { projectId, userProjectsCount: userProjects.length })
          setError('Project not found or access denied')
          setLoading(false)
          return
        }

        // Ensure members is always an array before setting state
        const safeProject = {
          ...project,
          members: Array.isArray(project.members) ? project.members : []
        }

        console.log('Project set:', safeProject)
        setProject(safeProject)

        // Load real stories from database
        try {
          const projectStories = await storyService.getStoriesByProject(projectId)
          console.log('Loaded stories for project:', projectStories)
          setStories(projectStories || [])
        } catch (storyError) {
          console.error('Error loading stories:', storyError)
          // Don't fail the whole page if stories can't be loaded
          setStories([])
        }
      } catch (error) {
        console.error('Error loading project:', error)
        // If projects service fails completely, show mock data
        if (projectId === '1') {
          setProject({
            id: '1',
            name: "Grandma's Memoir",
            description: 'Recording grandma\'s life stories and family traditions',
            facilitator_id: user.id,
            status: 'active',
            created_at: '2023-12-01T00:00:00Z',
            updated_at: '2023-12-01T00:00:00Z',
            members: [],
            member_count: 3,
            story_count: 37,
            user_role: 'facilitator' as UserRole,
            is_owner: true
          });
          setStories([]);
        } else {
          setError('Failed to load project data')
        }
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

  // Filter and sort stories
  const safeStories = Array.isArray(stories) ? stories : []
  const filteredStories = safeStories.filter(story => {
    if (searchQuery && !story.title?.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !story.ai_summary?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    if (selectedStorytellerFilter !== 'all' && story.storyteller_name !== selectedStorytellerFilter) {
      return false
    }
    return true
  }).sort((a, b) => {
    switch (sortBy) {
      case 'latest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'most-comments':
        return (b.comments_count || 0) - (a.comments_count || 0)
      default:
        return 0
    }
  })

  // Get unique storytellers for filter  
  const storytellers = Array.from(new Set(safeStories.map(s => s?.storyteller_name).filter(Boolean)))

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
        <h1 className="text-2xl font-bold text-foreground">{tCommon('status.error')}</h1>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Link href={withLocale('/dashboard')}>
          <EnhancedButton variant="outline">
            {tCommon('actions.back')} to Dashboard
          </EnhancedButton>
        </Link>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-foreground">{tProjects('errors.notFound')}</h1>
        <Link href={withLocale('/dashboard')}>
          <EnhancedButton variant="outline">
            {tCommon('actions.back')} to Dashboard
          </EnhancedButton>
        </Link>
      </div>
    )
  }

  // CRITICAL: Ensure all arrays are initialized before any rendering
  if (!project.members || !Array.isArray(project.members)) {
    console.error('CRITICAL: project.members is not an array!', project.members)
    project.members = []
  }

  const roleInfo = project.user_role ? getRoleDisplayInfo(project.user_role) : null

  // Add safety check for project data
  if (!project.user_role) {
    console.warn('Project missing user_role:', project)
  }
  
  // Log complete project data for debugging (only once)
  console.log('Complete project data:', JSON.stringify(project, null, 2))

  try {
    return (
      <ErrorBoundary>
        <PermissionProvider 
          userRole={project.user_role} 
          isProjectOwner={project.is_owner}
          projectId={projectId}
        >
        <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
              <div className="flex items-center gap-4">
                <Badge className="bg-yellow-100 text-yellow-800">{safeStories.length} {tProjects('detail.stats.stories')}</Badge>
                {roleInfo && (
                  <Badge variant={roleInfo.color as any}>
                    <span className="mr-1">{roleInfo.icon}</span>
                    {roleInfo.label}
                    {project.is_owner && ` (${tProjects('roles.owner')})`}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <EnhancedButton variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                {tProjects('detail.actions.exportStories')}
              </EnhancedButton>
                {project.is_owner && (
                <Link href={withLocale(`/dashboard/projects/${projectId}/settings`)}>
                  <EnhancedButton variant="outline" size="sm">
                    <Users className="w-4 h-4 mr-2" />
                    {tProjects('detail.actions.manageProject')}
                  </EnhancedButton>
                </Link>
              )}
              <ActionPermissionGate
                action="canCreateStories"
                userRole={project.user_role}
                isProjectOwner={project.is_owner}
              >
                <Link href={withLocale(`/dashboard/projects/${projectId}/record`)}>
                  <EnhancedButton>
                    <Plus className="w-4 h-4 mr-2" />
                    {tProjects('detail.actions.recordNewStory')}
                  </EnhancedButton>
                </Link>
              </ActionPermissionGate>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1">
              <EnhancedCard>
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{tProjects('detail.filters.title')}</h3>
                  
                  {/* Storyteller Filter */}
                  <div className="mb-6">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">{tProjects('detail.filters.allStorytellers')}</label>
                    <select 
                      value={selectedStorytellerFilter}
                      onChange={(e) => setSelectedStorytellerFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
                    >
                      <option value="all">{tProjects('detail.filters.allStorytellers')}</option>
                      {storytellers.map(storyteller => (
                        <option key={storyteller} value={storyteller}>{storyteller}</option>
                      ))}
                    </select>
                  </div>

                  {/* Theme Filter */}
                  <div className="mb-6">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">{tProjects('detail.filters.allThemes')}</label>
                    <select 
                      value={selectedThemeFilter}
                      onChange={(e) => setSelectedThemeFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
                    >
                      <option value="all">{tProjects('detail.filters.allThemes')}</option>
                      <option value="childhood">{tProjects('detail.filters.themes.childhood')}</option>
                      <option value="family">{tProjects('detail.filters.themes.family')}</option>
                      <option value="immigration">{tProjects('detail.filters.themes.immigration')}</option>
                    </select>
                  </div>

                  {/* Sort Options */}
                  <div className="mb-6">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">{tProjects('detail.filters.sortBy')}</label>
                    <FilterTabs
                      options={[
                        { value: 'latest', label: tProjects('detail.filters.sortOptions.latest') },
                        { value: 'oldest', label: tProjects('detail.filters.sortOptions.oldest') },
                        { value: 'most-comments', label: tProjects('detail.filters.sortOptions.mostComments') }
                      ]}
                      value={sortBy}
                      onValueChange={(value: string) => setSortBy(value as any)}
                    />
                  </div>
                </div>
              </EnhancedCard>

              {/* Quick Actions */}
              <EnhancedCard className="mt-6">
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{tProjects('detail.quickActions.title')}</h3>
                  <div className="space-y-3">
                    <EnhancedButton variant="outline" size="sm" className="w-full justify-start">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      {tProjects('detail.quickActions.exportAll')}
                    </EnhancedButton>
                    <EnhancedButton variant="outline" size="sm" className="w-full justify-start">
                      <Filter className="w-4 h-4 mr-2" />
                      {tProjects('detail.quickActions.archiveSelected')}
                    </EnhancedButton>
                    <EnhancedButton variant="outline" size="sm" className="w-full justify-start">
                      <Share className="w-4 h-4 mr-2" />
                      {tProjects('detail.quickActions.refreshFeed')}
                    </EnhancedButton>
                  </div>
                </div>
              </EnhancedCard>

              {/* Story Statistics */}
              <EnhancedCard className="mt-6">
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{tProjects('detail.statistics.title')}</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{tProjects('detail.statistics.totalStories')}</span>
                      <span className="font-medium">{stories.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{tProjects('detail.statistics.thisMonth')}</span>
                      <span className="font-medium">5</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{tProjects('detail.statistics.totalComments')}</span>
                      <span className="font-medium">{stories.reduce((sum, s) => sum + (s.comments_count || 0), 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{tProjects('detail.statistics.followUpQuestions')}</span>
                      <span className="font-medium">{stories.reduce((sum, s) => sum + (s.follow_ups_count || 0), 0)}</span>
                    </div>
                  </div>
                </div>
              </EnhancedCard>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              {/* Project Validity Period Progress */}
              <EnhancedCard className="mb-6">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-sage-600" />
                      <h3 className="font-semibold text-gray-900">{tProjects('detail.validityPeriod.title')}</h3>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-sage-600">287 {tProjects('detail.validityPeriod.days')}</span> {tProjects('detail.validityPeriod.remaining')}
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-sage-500 to-sage-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: '78%' }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{tProjects('detail.validityPeriod.started')} Jan 15, 2024</span>
                      <span>{tProjects('detail.validityPeriod.expires')} Jan 15, 2025</span>
                    </div>
                  </div>
                  
                  {/* Status Info */}
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <Badge className="bg-green-100 text-green-800">{tProjects('detail.validityPeriod.status.active')}</Badge>
                    <span className="text-gray-600">{tProjects('detail.validityPeriod.serviceAvailable')}</span>
                  </div>
                </div>
              </EnhancedCard>

              {/* Stories List */}
              {filteredStories.length === 0 ? (
                <EnhancedCard className="p-12 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <div className="max-w-md mx-auto space-y-6">
                    <div className="text-5xl mb-4">{tProjects('detail.empty.emoji')}</div>
                    <div className="space-y-3">
                      <h2 className="text-2xl font-semibold text-foreground">{tProjects('detail.empty.title')}</h2>
                      <p className="text-muted-foreground">
                        {project.user_role === 'storyteller'
                          ? tProjects('detail.empty.storytellerMessage')
                          : tProjects('detail.empty.facilitatorMessage')
                        }
                      </p>
                    </div>

                    <ActionPermissionGate
                      action="canCreateStories"
                      userRole={project.user_role}
                      isProjectOwner={project.is_owner}
                    >
                      <Link href={withLocale(`/dashboard/projects/${projectId}/record`)}>
                        <EnhancedButton size="lg">
                          <BookOpen className="h-5 w-5 mr-2" />
                          {tProjects('detail.empty.action')}
                        </EnhancedButton>
                      </Link>
                    </ActionPermissionGate>
                  </div>
                </EnhancedCard>
              ) : (
                <div className="space-y-4">
                  {filteredStories.map((story) => {
                    // Get story text preview (first 50 characters)
                    const textPreview = story.transcript 
                      ? story.transcript.substring(0, 50) + (story.transcript.length > 50 ? '...' : '')
                      : story.ai_summary?.substring(0, 50) + (story.ai_summary && story.ai_summary.length > 50 ? '...' : '') || 'No content available'
                    
                    return (
                      <StoryCard
                        key={story.id}
                        id={story.id}
                        title={story.title || story.ai_generated_title || 'Untitled Story'}
                        author={{
                          name: story.storyteller_name || 'Unknown',
                          avatar: story.storyteller_avatar,
                          role: roleInfo?.label
                        }}
                        duration={story.duration ? `${Math.floor(story.duration / 60)}:${String(story.duration % 60).padStart(2, '0')}` : '0:00'}
                        createdAt={new Date(story.created_at).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                        description={textPreview}
                        thumbnail={(story as any).primary_image?.url}
                        tags={story.category ? [{ label: story.category, color: 'primary' as const }] : []}
                        stats={{
                          comments: story.comments_count || 0,
                          followUps: story.follow_ups_count || 0
                        }}
                        lastInteractionTime={story.latest_interaction_time 
                          ? new Date(story.latest_interaction_time).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : undefined
                        }
                        onPlay={() => window.location.href = withLocale(`/dashboard/projects/${projectId}/stories/${story.id}`)}
                        onComment={() => window.location.href = withLocale(`/dashboard/projects/${projectId}/stories/${story.id}#comments`)}
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                      />
                    )
                  })}
                  
                  {/* Load More Button */}
                  <div className="text-center pt-6">
                    <EnhancedButton variant="outline">
                      {tProjects('detail.loadMore')}
                    </EnhancedButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </PermissionProvider>
      </ErrorBoundary>
    )
  } catch (renderError) {
    console.error('Render error:', renderError)
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-foreground">Render Error</h1>
        <p className="text-muted-foreground mt-2">{String(renderError)}</p>
        <Link href={withLocale('/dashboard')}>
          <EnhancedButton variant="outline">
            Back to Dashboard
          </EnhancedButton>
        </Link>
      </div>
    )
  }
}