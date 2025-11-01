'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, BookOpen, Users, MessageCircle, Crown } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'
import { projectService, ProjectWithMembers } from '@/lib/projects'
import { useTranslations } from 'next-intl'

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
  const params = useParams()
  const locale = (params?.locale as string) || 'en'
  const tProjects = useTranslations('projects')
  const tCommon = useTranslations('common')
  const withLocale = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`
    return `/${locale}${normalized}`
  }
  const [projects, setProjects] = useState<ProjectWithMembers[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProjects = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        console.log('Loading projects for user:', user.id)
        const userProjects = await projectService.getUserProjects(user.id)
        console.log('Loaded projects:', userProjects)
        setProjects(userProjects || [])
      } catch (error) {
        console.error('Error loading projects:', error)
        setProjects([])
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [user?.id])

  const getStatusBadge = (storyCount: number) => {
    if (storyCount === 0) {
      return <Badge variant="secondary">{tProjects('status.new')}</Badge>
    } else if (storyCount < 5) {
      return <Badge variant="outline">{tProjects('status.gettingStarted')}</Badge>
    } else {
      return <Badge variant="default">{tProjects('status.active')}</Badge>
    }
  }

  const getRoleBadge = (role: string, isOwner: boolean) => {
    if (isOwner) {
      return (
        <Badge variant="default" className="bg-yellow-100 text-yellow-800">
          <Crown className="w-3 h-3 mr-1" />
          {tProjects('roles.owner')}
        </Badge>
      )
    }
    
    switch (role) {
      case 'facilitator':
        return <Badge variant="default">{tProjects('roles.facilitator')}</Badge>
      case 'co_facilitator':
        return <Badge variant="secondary">{tProjects('roles.coFacilitator')}</Badge>
      case 'storyteller':
        return <Badge variant="outline">{tProjects('roles.storyteller')}</Badge>
      default:
        return <Badge variant="outline">{tProjects('roles.member')}</Badge>
    }
  }

  const handleCreateProject = () => {
    // 统一跳转到创建页，资源消费在RPC中进行；不足时再引导购买
    router.push(withLocale('/dashboard/projects/create'))
  }

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{tProjects('list.title')}</h1>
            <p className="text-muted-foreground mt-2">
              {tProjects('list.subtitle')}
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
          <h1 className="text-3xl font-bold text-foreground">{tProjects('list.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {tProjects('list.subtitle')}
          </p>
        </div>
        
        {/* Action Buttons（仅在非空时展示）*/}
        {projects.length > 0 && (
          <div className="flex space-x-3">
            <Button onClick={handleCreateProject} variant="default">
              <Plus className="w-4 h-4 mr-2" />
              {tProjects('list.createNew')}
            </Button>
          </div>
        )}
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link key={project.id} href={withLocale(`/dashboard/projects/${project.id}`)}>
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {project.name}
                  </CardTitle>
                  <div className="flex flex-col items-end space-y-2">
                    {getStatusBadge(project.story_count || 0)}
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
                      <span>{project.story_count || 0} {tProjects('list.stats.stories')}</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      <span>{project.member_count || 0} {tProjects('list.stats.members')}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Create New Project Card（仅在非空时展示）*/}
        {projects.length > 0 && (
          <Card
            className="group border-2 border-dashed border-border hover:border-primary hover:bg-muted/50 transition-all cursor-pointer"
            onClick={handleCreateProject}
          >
            <CardContent className="flex flex-col items-center justify-center h-full min-h-[200px] space-y-4 p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground mb-2">{tProjects('list.createCard.title')}</h3>
                <p className="text-sm text-muted-foreground">
                  {tProjects('list.createCard.subtitle')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Empty State */}
      {projects.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">{tProjects('list.empty.emoji')}</div>
          <h2 className="text-2xl font-bold text-foreground mb-2">{tProjects('list.empty.title')}</h2>
          <p className="text-muted-foreground mb-6">
            {tProjects('list.empty.subtitle')}
          </p>
          <Button onClick={handleCreateProject} size="lg">
            <Plus className="w-5 h-5 mr-2" />
            {tProjects('list.createFirst')}
          </Button>
        </div>
      )}
    </div>
  )
}
