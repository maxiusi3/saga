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
import { BookOpen, Users, MessageCircle, Crown, Plus } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading, initialize } = useAuthStore()
  const [projects, setProjects] = useState<ProjectWithMembers[]>([])
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
          <h1 className="text-display text-foreground">My Sagas</h1>
          <p className="text-muted-foreground mt-2">
            Manage your family story projects
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Link href="/dashboard/projects/create">
            <Button variant="secondary">
              <BookOpen className="w-4 h-4 mr-2" />
              Create New Saga
            </Button>
          </Link>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {project.name}
                  </CardTitle>
                  <div className="flex flex-col items-end space-y-2">
                    {getStatusBadge(project.story_count)}
                    {getRoleBadge(project.user_role, project.is_owner)}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {/* Project Description */}
                {project.description && (
                  <CardDescription className="line-clamp-2 mb-4">
                    {project.description}
                  </CardDescription>
                )}

                {/* Project Stats */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Users className="w-4 h-4" />
                    <span>{project.member_count} member{project.member_count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MessageCircle className="w-4 h-4" />
                    <span>{project.story_count} stor{project.story_count !== 1 ? 'ies' : 'y'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Create New Project Card */}
        <Link href="/dashboard/projects/create">
          <Card className="group border-2 border-dashed border-border hover:border-primary hover:bg-muted/50 transition-all cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center h-full min-h-[200px] space-y-4 p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground mb-2">Create New Saga</h3>
                <p className="text-sm text-muted-foreground">
                  Start a new family story project
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
