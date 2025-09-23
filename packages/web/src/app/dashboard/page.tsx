'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'
import { projectService, ProjectWithMembers } from '@/lib/projects'
import { UserRole, getRoleDisplayInfo } from '@saga/shared'
import { BookOpen, Users, MessageCircle, Crown, Plus, HelpCircle } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading, initialize } = useAuthStore()
  const [projects, setProjects] = useState<ProjectWithMembers[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string>('')
  const [projectData, setProjectData] = useState<Record<string, {
    stories: any[]
    pendingInteractions: any[]
    stats: {
      totalStories: number
      pendingFollowups: number
      totalMembers: number
    }
  }>>({})
  const [loading, setLoading] = useState(true)
  const [isFirstTime, setIsFirstTime] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle Magic Link tokens from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const accessToken = urlParams.get('access_token')
    const refreshToken = urlParams.get('refresh_token')
    const type = urlParams.get('type')

    if (accessToken && refreshToken && type === 'magiclink') {
      console.log('Dashboard: Magic Link tokens found, setting session')

      // Set the session using the tokens
      const supabase = createClientSupabase()
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ data, error }) => {
        if (error) {
          console.error('Dashboard: Error setting session:', error)
        } else {
          console.log('Dashboard: Session set successfully')
          // Re-initialize auth store to pick up the new session
          initialize()
          // Clean up URL
          window.history.replaceState({}, document.title, '/dashboard')
        }
      })
    }
  }, [initialize])

  useEffect(() => {
    console.log('Dashboard useEffect triggered:', {
      userId: user?.id,
      isAuthenticated,
      authLoading
    })

    const loadDashboard = async () => {
      console.log('loadDashboard called, authLoading:', authLoading)

      // Wait for auth to be ready
      if (authLoading) {
        console.log('Auth still loading, returning early')
        return
      }

      console.log('Auth check:', { userId: user?.id, isAuthenticated })

      if (!user?.id || !isAuthenticated) {
        console.log('User not authenticated, setting error')
        setLoading(false)
        setError('Please sign in to view your projects')
        return
      }

      try {
        console.log('Starting dashboard load for user:', user.id)
        setLoading(true)
        setError(null)

        console.log('Loading dashboard for user:', user.id)

        // Load user's projects
        const userProjects = await projectService.getUserProjects(user.id)

        console.log('Loaded projects:', userProjects)
        setProjects(userProjects)
        setIsFirstTime(userProjects.length === 0)

        // Set the first project as active by default
        if (userProjects.length > 0) {
          setActiveProjectId(userProjects[0].id)

          // Load data for all projects
          await loadAllProjectsData(userProjects)
        }

      } catch (error) {
        console.error('Error loading dashboard:', error)
        setError('Failed to load projects. Please try refreshing the page.')
      } finally {
        console.log('Dashboard loading finished')
        setLoading(false)
      }
    }

    loadDashboard()
  }, [user?.id, isAuthenticated, authLoading])

  // Load data for all projects
  const loadAllProjectsData = async (userProjects: ProjectWithMembers[]) => {
    try {
      const supabase = createClientSupabase()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        console.error('No session token available')
        return
      }

      const newProjectData: Record<string, any> = {}

      for (const project of userProjects) {
        const projectId = project.id

        // Fetch stories for this project
        const storiesResponse = await fetch(`/api/projects/${projectId}/stories`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        })

        // Fetch pending interactions for this project
        const pendingResponse = await fetch(`/api/projects/${projectId}/interactions/pending`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        })

        const stories = storiesResponse.ok ? (await storiesResponse.json()).stories || [] : []
        const pendingInteractions = pendingResponse.ok ? (await pendingResponse.json()).interactions || [] : []

        newProjectData[projectId] = {
          stories: stories.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ).slice(0, 10), // Keep recent 10 stories per project
          pendingInteractions: pendingInteractions.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ),
          stats: {
            totalStories: stories.length,
            pendingFollowups: pendingInteractions.length,
            totalMembers: project.member_count
          }
        }
      }

      setProjectData(newProjectData)
    } catch (error) {
      console.error('Error loading projects data:', error)
    }
  }

  const getStatusBadge = (storyCount: number) => {
    if (storyCount === 0) {
      return <Badge variant="outline">No Stories Yet</Badge>
    } else if (storyCount === 1) {
      return <Badge variant="primary">1 Story</Badge>
    } else {
      return <Badge variant="secondary">{storyCount} Stories</Badge>
    }
  }

  const getRoleBadge = (role?: UserRole, isOwner?: boolean) => {
    if (isOwner) {
      return (
        <Badge variant="primary">
          <Crown className="w-3 h-3 mr-1" /> Owner
        </Badge>
      )
    }

    if (!role) return null

    const roleInfo = getRoleDisplayInfo(role)
    return <Badge className={roleInfo.color}>{roleInfo.icon} {roleInfo.label}</Badge>
  }

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-16 text-center">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-display text-foreground">Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (isFirstTime) {
    return (
      <div className="container py-16">
        <div className="max-w-2xl mx-auto">
          {/* Welcome Header */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-6">🎭</div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Welcome to Saga
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Start capturing your family's stories with AI-powered tools that help preserve memories for future generations.
            </p>
          </div>

          {/* Main CTA Card */}
          <Card className="p-8 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold text-foreground">
                  Create Your First Family Biography
                </h2>
                <p className="text-muted-foreground">
                  Get started with our free experience - no payment required to begin your family's story journey.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link href="/dashboard/projects/create">
                  <Button size="lg" className="w-full sm:w-auto">
                    <BookOpen className="w-5 h-5 mr-2" />
                    Start Your Family Saga
                  </Button>
                </Link>
              </div>
            </div>
          </Card>

          {/* Features Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Record Stories</h3>
              <p className="text-sm text-muted-foreground">
                Capture family memories with our easy-to-use recording tools
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Collaborate</h3>
              <p className="text-sm text-muted-foreground">
                Invite family members to contribute and share their stories
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">AI-Powered</h3>
              <p className="text-sm text-muted-foreground">
                Get transcripts, summaries, and follow-up questions automatically
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-display text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Your story projects and activities
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex space-x-3">
          {activeProjectId && (
            <Link href={`/dashboard/projects/${activeProjectId}/record`}>
              <Button>
                <MessageCircle className="w-4 h-4 mr-2" />
                Record Story
              </Button>
            </Link>
          )}
          <Link href="/dashboard/projects">
            <Button variant="outline">
              <BookOpen className="w-4 h-4 mr-2" />
              All Projects
            </Button>
          </Link>
        </div>
      </div>

      {/* Project Tabs */}
      <Tabs value={activeProjectId} onValueChange={setActiveProjectId} className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
          {projects.map((project) => (
            <TabsTrigger key={project.id} value={project.id} className="text-left">
              <div className="flex items-center space-x-2">
                <span className="truncate">{project.name}</span>
                {projectData[project.id]?.stats.pendingFollowups > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {projectData[project.id].stats.pendingFollowups}
                  </Badge>
                )}
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        {projects.map((project) => (
          <TabsContent key={project.id} value={project.id}>
            {/* Project Stats and Actions */}
            <div className="flex flex-col lg:flex-row gap-6 mb-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-2">
                      <MessageCircle className="h-8 w-8 text-primary" />
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {projectData[project.id]?.stats.totalStories || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Stories</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-2">
                      <HelpCircle className="h-8 w-8 text-orange-600" />
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {projectData[project.id]?.stats.pendingFollowups || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Pending Follow-ups</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-2">
                      <Users className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {projectData[project.id]?.stats.totalMembers || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Members</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Record Story Action */}
              <div className="flex items-center justify-center lg:justify-start">
                <Link href={`/dashboard/projects/${project.id}/record`}>
                  <Button size="lg" className="h-auto py-4 px-6">
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Record Story
                  </Button>
                </Link>
              </div>
            </div>

            {/* Project Stories & Interactions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Stories for this project */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Stories</CardTitle>
                  <CardDescription>Latest stories in {project.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projectData[project.id]?.stories.map((story) => (
                      <Link key={story.id} href={`/dashboard/projects/${project.id}/stories/${story.id}`}>
                        <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src={story.storyteller_avatar} />
                            <AvatarFallback>
                              {story.storyteller_name?.charAt(0)?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-foreground truncate">
                                {story.title || story.ai_generated_title || 'Untitled'}
                              </p>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {new Date(story.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {story.ai_summary || story.content || 'No summary available'}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                <span>{story.storyteller_name}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                {story.followup_count > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {story.followup_count} follow-ups
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    )) || []}
                    {(!projectData[project.id]?.stories || projectData[project.id]?.stories.length === 0) && (
                      <div className="text-center py-8">
                        <MessageCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">No stories yet</p>
                        <Link href={`/dashboard/projects/${project.id}/record`}>
                          <Button>Record Your First Story</Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Pending Interactions for this project */}
              <Card>
                <CardHeader>
                  <CardTitle>Pending Follow-ups</CardTitle>
                  <CardDescription>
                    {project.user_role === 'storyteller'
                      ? 'Questions on your stories'
                      : 'Follow-ups waiting for responses'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projectData[project.id]?.pendingInteractions.map((interaction) => (
                      <Link key={interaction.id} href={`/dashboard/projects/${project.id}/stories/${interaction.story_id}`}>
                        <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <HelpCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-foreground">
                                Re: {interaction.story_title}
                              </p>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {new Date(interaction.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {interaction.content}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <Badge variant="outline" className="text-xs">
                                Follow-up Question
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Link>
                    )) || []}
                    {(!projectData[project.id]?.pendingInteractions || projectData[project.id]?.pendingInteractions.length === 0) && (
                      <div className="text-center py-8">
                        <HelpCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                        <p className="text-muted-foreground">No pending follow-ups</p>
                        <p className="text-sm text-muted-foreground/70 mt-2">
                          All caught up! 🎉
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
