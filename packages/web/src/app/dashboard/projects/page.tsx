'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, BookOpen, Users, MessageCircle, Crown } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'

// 模拟项目数据类型
interface Project {
  id: string
  name: string
  description: string
  story_count: number
  member_count: number
  user_role: 'facilitator' | 'co_facilitator' | 'storyteller'
  is_owner: boolean
  created_at: string
}

export default function ProjectsPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 模拟加载项目数据
    const loadProjects = async () => {
      try {
        // 模拟 API 调用延迟
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // 模拟项目数据
        const mockProjects: Project[] = [
          {
            id: '1',
            name: 'Smith Family Stories',
            description: 'Capturing three generations of family memories',
            story_count: 12,
            member_count: 8,
            user_role: 'facilitator',
            is_owner: true,
            created_at: '2024-01-15'
          },
          {
            id: '2', 
            name: 'Grandma\'s Kitchen Tales',
            description: 'Stories from the heart of our home',
            story_count: 5,
            member_count: 4,
            user_role: 'storyteller',
            is_owner: false,
            created_at: '2024-02-01'
          }
        ]
        
        setProjects(mockProjects)
      } catch (error) {
        console.error('Error loading projects:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [])

  const getStatusBadge = (storyCount: number) => {
    if (storyCount === 0) {
      return <Badge variant="secondary">New</Badge>
    } else if (storyCount < 5) {
      return <Badge variant="outline">Getting Started</Badge>
    } else {
      return <Badge variant="default">Active</Badge>
    }
  }

  const getRoleBadge = (role: string, isOwner: boolean) => {
    if (isOwner) {
      return (
        <Badge variant="default" className="bg-yellow-100 text-yellow-800">
          <Crown className="w-3 h-3 mr-1" />
          Owner
        </Badge>
      )
    }
    
    switch (role) {
      case 'facilitator':
        return <Badge variant="default">Facilitator</Badge>
      case 'co_facilitator':
        return <Badge variant="secondary">Co-Facilitator</Badge>
      case 'storyteller':
        return <Badge variant="outline">Storyteller</Badge>
      default:
        return <Badge variant="outline">Member</Badge>
    }
  }

  const handleCreateProject = () => {
    // 直接跳转到项目创建页面，跳过购买
    router.push('/dashboard/projects/create')
  }

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Projects</h1>
            <p className="text-muted-foreground mt-2">
              Manage your family story projects
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Projects</h1>
          <p className="text-muted-foreground mt-2">
            Manage your family story projects
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button onClick={handleCreateProject} variant="default">
            <Plus className="w-4 h-4 mr-2" />
            Create New Project
          </Button>
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
                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                  {project.description}
                </p>
                
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <BookOpen className="w-4 h-4 mr-1" />
                      <span>{project.story_count} stories</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      <span>{project.member_count} members</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Create New Project Card */}
        <Card 
          className="group border-2 border-dashed border-border hover:border-primary hover:bg-muted/50 transition-all cursor-pointer"
          onClick={handleCreateProject}
        >
          <CardContent className="flex flex-col items-center justify-center h-full min-h-[200px] space-y-4 p-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-foreground mb-2">Create New Project</h3>
              <p className="text-sm text-muted-foreground">
                Start a new family story project
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {projects.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📖</div>
          <h2 className="text-2xl font-bold text-foreground mb-2">No projects yet</h2>
          <p className="text-muted-foreground mb-6">
            Create your first family story project to get started
          </p>
          <Button onClick={handleCreateProject} size="lg">
            <Plus className="w-5 h-5 mr-2" />
            Create Your First Project
          </Button>
        </div>
      )}
    </div>
  )
}
