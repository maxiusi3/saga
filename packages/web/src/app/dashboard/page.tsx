'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { WelcomeFlow } from '@/components/onboarding/welcome-flow'
import { OnboardingHints, OnboardingEmptyState } from '@/components/onboarding/onboarding-hints'
import { useOnboarding } from '@/hooks/use-onboarding'

interface Project {
  id: string
  name: string
  description?: string
  storyCount: number
  lastActivity: string
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const {
    shouldShowWelcome,
    completeWelcome,
    completeFirstProject,
    onboardingState
  } = useOnboarding()

  useEffect(() => {
    // 模拟加载数据
    setTimeout(() => {
      const mockProjects = [
        {
          id: '1',
          name: '我的家庭故事',
          description: '记录我们家庭的珍贵回忆',
          storyCount: 5,
          lastActivity: '2天前'
        },
        {
          id: '2',
          name: '爷爷的回忆录',
          description: '爷爷的人生故事',
          storyCount: 12,
          lastActivity: '1周前'
        }
      ]

      // Only show projects if user has completed welcome or has projects
      if (onboardingState.hasCompletedWelcome || mockProjects.length > 0) {
        setProjects(mockProjects)
      }

      setLoading(false)
    }, 1000)
  }, [onboardingState.hasCompletedWelcome])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center responsive-padding">
        <div className="text-center">
          <div className="skeleton w-8 h-8 rounded-full mx-auto mb-4"></div>
          <div className="text-lg">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Welcome Flow */}
      {shouldShowWelcome && (
        <WelcomeFlow
          onComplete={() => completeWelcome('facilitator')} // Default to facilitator, can be enhanced
          userRole={onboardingState.userRole || undefined}
        />
      )}

      {/* Skip to main content anchor */}
      <a id="main-content" className="sr-only" tabIndex={-1}>
        Main content
      </a>

      {/* Header */}
      <header className="bg-white shadow-sm border-b" role="banner">
        <div className="container-responsive">
          <div className="mobile-stack items-start sm:items-center justify-between py-4 sm:py-6 gap-4">
            <div className="mobile-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">我的项目</h1>
              <p className="text-gray-600 mt-1 mobile-hide">管理您的家庭故事项目</p>
            </div>
            <Button
              asChild
              size="lg"
              className="mobile-full touch-target bg-blue-600 hover:bg-blue-700 text-white"
              aria-label="创建新的家庭故事项目"
            >
              <Link href="/dashboard/projects/new">
                <span className="mobile-only" aria-hidden="true">+ </span>创建新项目
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-responsive responsive-padding" role="main" id="main-content">
        {/* Onboarding Hints */}
        <OnboardingHints className="mb-6" />

        {projects.length === 0 ? (
          /* Enhanced Empty State with Onboarding */
          onboardingState.userRole ? (
            <OnboardingEmptyState userRole={onboardingState.userRole} />
          ) : (
            <section className="text-center py-8 sm:py-12 lg:py-16" aria-labelledby="empty-state-heading">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6" aria-hidden="true">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" role="img" aria-label="书本图标">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 id="empty-state-heading" className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                  还没有项目
                </h2>
                <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">
                  创建您的第一个家庭故事项目，开始记录珍贵的回忆
                </p>
                <Button
                  asChild
                  size="lg"
                  className="touch-target-large bg-blue-600 hover:bg-blue-700 text-white"
                  aria-label="创建您的第一个家庭故事项目"
                  onClick={() => {
                    // Mark first project creation when user clicks
                    if (onboardingState.userRole === 'facilitator') {
                      completeFirstProject()
                    }
                  }}
                >
                  <Link href="/dashboard/projects/new">
                    开始创建项目
                  </Link>
                </Button>
              </div>
            </section>
          )
        ) : (
          /* Projects Grid */
          <section aria-labelledby="projects-heading">
            <h2 id="projects-heading" className="sr-only">项目列表</h2>
            <div className="grid-responsive" role="list" aria-label={`${projects.length} 个项目`}>
              {projects.map((project, index) => (
                <Card key={project.id} className="hover:shadow-lg transition-all duration-200 group" role="listitem">
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="block p-4 sm:p-6 focus-visible"
                    aria-label={`查看项目: ${project.name}${project.description ? `, ${project.description}` : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {project.name}
                      </h3>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>

                    {project.description && (
                      <p className="text-gray-600 mb-4 text-sm sm:text-base line-clamp-2">
                        {project.description}
                      </p>
                    )}

                    <div className="mobile-stack items-start sm:items-center justify-between text-xs sm:text-sm text-gray-500 gap-2">
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 110 2h-1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6H3a1 1 0 110-2h4z" />
                        </svg>
                        <span aria-label={`包含 ${project.storyCount} 个故事`}>{project.storyCount} 个故事</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>最后活动: <time dateTime={project.lastActivity}>{project.lastActivity}</time></span>
                      </div>
                    </div>
                  </Link>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
