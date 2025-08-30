'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useOnboarding } from '@/hooks/use-onboarding'
import { api } from '@/lib/api'

interface Project {
  id: string
  name: string
  description?: string
  status: 'active' | 'archived'
  created_at: string
  storyCount?: number
  memberCount?: number
  lastActivity?: string
}

interface ProjectStats {
  totalStories: number
  activeMembers: number
  pendingInvitations: number
  totalDuration: number
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { completeFirstInvitation, onboardingState } = useOnboarding()

  useEffect(() => {
    if (params.id) {
      loadProject(params.id as string);
    }
  }, [params.id]);

  const loadProject = async (projectId: string) => {
    try {
      setLoading(true);

      // Load project data
      const projectResponse = await api.projects.get(projectId);
      setProject(projectResponse.data);

      // Load project stats
      const statsResponse = await api.projects.getStats(projectId);
      setStats(statsResponse.data);

    } catch (error) {
      console.error('Failed to load project:', error);
      // Handle error - maybe redirect to projects list or show error message
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMembers = () => {
    // Mark onboarding step as complete
    if (onboardingState.userRole === 'facilitator' && !onboardingState.hasInvitedFirstMember) {
      completeFirstInvitation();
    }
    router.push(`/dashboard/projects/${params.id}/invite`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">项目未找到</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b" role="banner">
        <div className="container-responsive responsive-padding">
          {/* Breadcrumb */}
          <nav className="mb-4" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm text-gray-500">
              <li>
                <Link href="/dashboard" className="hover:text-gray-700 focus-visible">
                  项目
                </Link>
              </li>
              <li>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </li>
              <li className="text-gray-900 font-medium" aria-current="page">
                {project.name}
              </li>
            </ol>
          </nav>

          {/* Project Header */}
          <div className="mobile-stack items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-gray-600 mb-2">{project.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>{stats?.totalStories || 0} 个故事</span>
                <span>{stats?.activeMembers || 0} 位成员</span>
                <span>创建于 {new Date(project.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <Button
              onClick={handleInviteMembers}
              className="mobile-full touch-target bg-blue-600 hover:bg-blue-700 text-white"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              邀请成员
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-responsive responsive-padding" role="main">
        {/* Project Stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card className="p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.totalStories}</div>
              <div className="text-sm text-gray-600">收集的故事</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-green-600">{stats.activeMembers}</div>
              <div className="text-sm text-gray-600">活跃成员</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingInvitations}</div>
              <div className="text-sm text-gray-600">待接受邀请</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-purple-600">{Math.round(stats.totalDuration / 60)}</div>
              <div className="text-sm text-gray-600">总时长(分钟)</div>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card className="hover:shadow-lg transition-all duration-200 border-2 border-blue-100 bg-blue-50">
            <Link
              href={`/dashboard/projects/${project.id}/stories`}
              className="block p-6 focus-visible"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">管理故事</h3>
                  <p className="text-gray-600 text-sm">查看、编辑和组织收集的故事</p>
                </div>
              </div>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200 border-2 border-green-100 bg-green-50">
            <button
              onClick={handleInviteMembers}
              className="w-full p-6 text-left focus-visible"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">邀请成员</h3>
                  <p className="text-gray-600 text-sm">邀请家庭成员参与故事收集</p>
                </div>
              </div>
            </button>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200 border-2 border-gray-100 bg-gray-50">
            <Link
              href={`/dashboard/projects/${project.id}/settings`}
              className="block p-6 focus-visible"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">项目设置</h3>
                  <p className="text-gray-600 text-sm">管理项目配置和权限</p>
                </div>
              </div>
            </Link>
          </Card>
        </div>

        {/* Onboarding Guidance */}
        {onboardingState.userRole === 'facilitator' && !onboardingState.hasInvitedFirstMember && (
          <Card className="p-6 border-2 border-yellow-200 bg-yellow-50 mb-8">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">下一步：邀请家庭成员</h3>
                <p className="text-yellow-700 mb-4">
                  您的项目已创建成功！现在邀请家庭成员开始收集他们的珍贵故事。
                </p>
                <Button
                  onClick={handleInviteMembers}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  立即邀请成员
                </Button>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
