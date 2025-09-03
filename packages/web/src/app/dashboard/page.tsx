'use client'

import { useState, useEffect } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'
import { projectService, ProjectWithMembers } from '@/lib/projects'
import { UserRole, getRoleDisplayInfo } from '@saga/shared'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [projects, setProjects] = useState<ProjectWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const [isFirstTime, setIsFirstTime] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Load user's projects
        const userProjects = await projectService.getUserProjects(user.id)

        setProjects(userProjects)
        setIsFirstTime(userProjects.length === 0)

      } catch (error) {
        console.error('Error loading dashboard:', error)
        setError('Failed to load projects')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [user?.id])

  const getStatusBadge = (storyCount: number) => {
    if (storyCount === 0) {
      return <Badge variant="outline">No Stories Yet</Badge>
    } else if (storyCount === 1) {
      return <Badge variant="default" className="bg-furbridge-orange text-white">1 Story</Badge>
    } else {
      return <Badge variant="secondary">{storyCount} Stories</Badge>
    }
  }

  const getRoleBadge = (role?: UserRole, isOwner?: boolean) => {
    if (isOwner) {
      return <Badge className="bg-furbridge-teal text-white">👑 Owner</Badge>
    }

    if (!role) return null

    const roleInfo = getRoleDisplayInfo(role)
    return <Badge className={roleInfo.color}>{roleInfo.icon} {roleInfo.label}</Badge>
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900">Error</h1>
        <p className="text-gray-600 mt-2">{error}</p>
        <FurbridgeButton
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Try Again
        </FurbridgeButton>
      </div>
    )
  }

  if (isFirstTime) {
    return (
      <div className="text-center py-16">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-6xl mb-4">📖</div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {user?.user_metadata?.full_name || user?.email}!
          </h1>
          <p className="text-lg text-gray-600">
            Let's start by creating a home for your family's stories.
          </p>
          <Link href="/dashboard/purchase">
            <FurbridgeButton variant="orange" size="lg">
              Create a New Saga
            </FurbridgeButton>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Sagas</h1>
          <p className="text-gray-600 mt-1">
            Manage your family story projects
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Link href="/dashboard/test-notifications">
            <FurbridgeButton variant="outline" className="border-furbridge-orange text-furbridge-orange hover:bg-furbridge-orange hover:text-white">
              Test Notifications
            </FurbridgeButton>
          </Link>
          <Link href="/dashboard/projects/create">
            <FurbridgeButton className="bg-furbridge-teal hover:bg-furbridge-teal/90 text-white">
              Create Project
            </FurbridgeButton>
          </Link>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
            <FurbridgeCard className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="space-y-4">
                {/* Project Header */}
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                    {project.title}
                  </h3>
                  <div className="flex flex-col items-end space-y-2">
                    {getStatusBadge(project.story_count)}
                    {getRoleBadge(project.user_role, project.is_owner)}
                  </div>
                </div>

                {/* Project Description */}
                {project.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {project.description}
                  </p>
                )}

                {/* Project Members */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {project.member_count} member{project.member_count !== 1 ? 's' : ''}
                  </div>
                  <div className="text-sm text-gray-600">
                    {project.story_count} stor{project.story_count !== 1 ? 'ies' : 'y'}
                  </div>
                </div>

                {/* Story Count */}
                <div className="text-sm text-gray-600">
                  {project.story_count} {project.story_count === 1 ? 'story' : 'stories'}
                </div>
              </div>
            </FurbridgeCard>
          </Link>
        ))}

        {/* Create New Project Card */}
        <Link href="/dashboard/purchase">
          <FurbridgeCard className="p-6 border-2 border-dashed border-muted-foreground/25 hover:border-furbridge-orange hover:bg-gray-100/50 transition-all cursor-pointer">
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] space-y-4">
              <div className="text-4xl text-gray-600">+</div>
              <div className="text-center">
                <div className="font-medium text-gray-900">Create New Saga</div>
                <div className="text-sm text-gray-600 mt-1">
                  Start a new family story project
                </div>
              </div>
            </div>
          </FurbridgeCard>
        </Link>
      </div>
    </div>
  )
}
