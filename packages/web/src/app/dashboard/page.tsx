'use client'

import { useState, useEffect } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { User } from '@supabase/supabase-js'

interface Project {
  id: string
  title: string
  storyteller_name: string
  storyteller_avatar?: string
  co_facilitators: Array<{
    id: string
    name: string
    avatar?: string
  }>
  status: 'active' | 'invite_sent' | 'invite_expired' | 'new_story'
  story_count: number
  created_at: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [isFirstTime, setIsFirstTime] = useState(false)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        // Mock data for now - replace with actual Supabase queries
        const mockProjects: Project[] = [
          {
            id: '1',
            title: "Dad's Life Story",
            storyteller_name: 'John Doe',
            storyteller_avatar: '',
            co_facilitators: [
              { id: '1', name: 'Beth Smith', avatar: '' }
            ],
            status: 'new_story',
            story_count: 3,
            created_at: '2024-01-15'
          },
          {
            id: '2',
            title: "Grandma's Memories",
            storyteller_name: 'Mary Johnson',
            storyteller_avatar: '',
            co_facilitators: [],
            status: 'active',
            story_count: 7,
            created_at: '2024-01-10'
          }
        ]

        // Simulate loading delay
        setTimeout(() => {
          setProjects(mockProjects)
          setIsFirstTime(mockProjects.length === 0)
          setLoading(false)
        }, 1000)

      } catch (error) {
        console.error('Error loading dashboard:', error)
        setLoading(false)
      }
    }

    loadDashboard()
  }, [supabase])

  const getStatusBadge = (status: Project['status'], storyCount: number) => {
    switch (status) {
      case 'new_story':
        return <Badge variant="default" className="bg-furbridge-orange text-white">1 New Story!</Badge>
      case 'active':
        return <Badge variant="secondary">Active</Badge>
      case 'invite_sent':
        return <Badge variant="outline">Invite Sent</Badge>
      case 'invite_expired':
        return <Badge variant="destructive">Invite Expired</Badge>
      default:
        return null
    }
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
        
        {/* Resource Summary Card */}
        <FurbridgeCard className="p-4 min-w-fit">
          <div className="text-sm">
            <div className="font-medium text-gray-900 mb-1">Available Seats</div>
            <div className="text-gray-600 space-y-1">
              <div>• 1 Project</div>
              <div>• 0 Facilitator</div>
              <div>• 1 Storyteller</div>
            </div>
          </div>
        </FurbridgeCard>
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
                  {getStatusBadge(project.status, project.story_count)}
                </div>

                {/* Storyteller */}
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={project.storyteller_avatar} />
                    <AvatarFallback>
                      {project.storyteller_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-gray-900">
                      {project.storyteller_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      Storyteller
                    </div>
                  </div>
                </div>

                {/* Co-facilitators */}
                {project.co_facilitators.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Co-facilitators:</span>
                    <div className="flex -space-x-2">
                      {project.co_facilitators.map((facilitator) => (
                        <Avatar key={facilitator.id} className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={facilitator.avatar} />
                          <AvatarFallback className="text-xs">
                            {facilitator.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                )}

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
