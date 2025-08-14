'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useProjectStore } from '@/stores/project-store'
import { useProjectWebSocket } from '@/hooks/use-websocket'
import { LoadingCard } from '@/components/ui/loading'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import ResourceWalletSummary from '@/components/wallet/resource-wallet-summary'
import { formatRelativeTime } from '@/lib/utils'

interface ProjectCardProps {
  project: any;
}

function ProjectCard({ project }: ProjectCardProps) {
  // Mock data for demonstration - in real app, this would come from API
  const storyteller = { name: 'John Doe', avatar: '/avatars/john.jpg' };
  const coFacilitators = [
    { name: 'Beth Smith', avatar: '/avatars/beth.jpg' },
    { name: 'Mike Johnson', avatar: '/avatars/mike.jpg' }
  ];
  const newStoriesCount = Math.floor(Math.random() * 3); // Random for demo
  
  const getStatusBadge = () => {
    if (newStoriesCount > 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {newStoriesCount} New Story{newStoriesCount > 1 ? 'ies' : 'y'}!
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Active
      </span>
    );
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
      <Link href={`/dashboard/projects/${project.id}/feed`}>
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {project.name}
            </h3>
            
            {/* Storyteller Info */}
            <div className="flex items-center mb-2">
              <div className="w-6 h-6 bg-gray-300 rounded-full mr-2 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600">
                  {storyteller.name.charAt(0)}
                </span>
              </div>
              <span className="text-sm text-gray-600">{storyteller.name}</span>
            </div>

            {/* Co-Facilitator Avatars */}
            {coFacilitators.length > 0 && (
              <div className="flex items-center">
                <span className="text-xs text-gray-500 mr-2">Co-facilitators:</span>
                <div className="flex -space-x-1">
                  {coFacilitators.slice(0, 3).map((facilitator, index) => (
                    <div 
                      key={index}
                      className="w-5 h-5 bg-gray-200 rounded-full border border-white flex items-center justify-center"
                      title={facilitator.name}
                    >
                      <span className="text-xs font-medium text-gray-600">
                        {facilitator.name.charAt(0)}
                      </span>
                    </div>
                  ))}
                  {coFacilitators.length > 3 && (
                    <div className="w-5 h-5 bg-gray-100 rounded-full border border-white flex items-center justify-center">
                      <span className="text-xs text-gray-500">+{coFacilitators.length - 3}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-between items-center">
            {getStatusBadge()}
            <Button variant="outline" size="sm">
              View Stories
            </Button>
          </div>
        </div>
      </Link>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { projects, isLoading, fetchProjects } = useProjectStore()
  const websocket = useProjectWebSocket(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetchProjects()
  }, [fetchProjects])

  // Listen for real-time updates (optional in demo mode)
  useEffect(() => {
    try {
      const cleanup = websocket.onStoryUploaded((data) => {
        console.log('New story uploaded:', data)
        // Refresh projects to get updated stats
        fetchProjects()
      })

      return cleanup
    } catch (error) {
      console.log('WebSocket not available in demo mode')
      return () => {}
    }
  }, [websocket, fetchProjects])

  const handleCreateProject = () => {
    // TODO: Check for available Project Vouchers
    // If available, proceed to creation
    // If not, prompt to buy a package
    router.push('/dashboard/projects/new')
  }

  if (!mounted) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {(projects || []).length === 0 ? `Welcome, ${user?.name?.split(' ')[0] || 'User'}!` : 'My Sagas'}
        </h1>
        {(projects || []).length === 0 ? (
          <p className="text-gray-600">
            Let's start by creating a home for your family's stories.
          </p>
        ) : (
          <p className="text-gray-600">
            Manage your family story projects and collaborate with loved ones.
          </p>
        )}
      </div>

      {/* Resource Wallet Summary */}
      <div className="mb-8">
        <ResourceWalletSummary />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Projects
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {(projects || []).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Stories
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {totalStories}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Family Members
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {(projects || []).reduce((sum, project) => sum + (project.memberCount || 1), 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Projects */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Recent Projects
              </h3>
              <Link
                href="/dashboard/projects"
                className="text-sm font-medium text-primary-600 hover:text-primary-500"
              >
                View all
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <LoadingCard key={i} />
                ))}
              </div>
            ) : recentProjects.length > 0 ? (
              <div className="space-y-4">
                {recentProjects.map((project) => (
                  <div
                    key={project.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-primary-600"
                        >
                          {project.name}
                        </Link>
                        <p className="text-sm text-gray-500 mt-1">
                          {project.description || 'No description'}
                        </p>
                        <div className="flex items-center mt-2 text-xs text-gray-400">
                          <span>{project.storyCount || 0} stories</span>
                          <span className="mx-2">•</span>
                          <span>Updated {formatRelativeTime(project.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="btn-outline text-xs"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating your first family story project.
                </p>
                <div className="mt-6">
                  <Link href="/dashboard/projects/new" className="btn-primary">
                    Create Project
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Quick Actions
            </h3>
            
            <div className="space-y-3">
              <Link
                href="/dashboard/projects/new"
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Create New Project</p>
                  <p className="text-sm text-gray-500">Start collecting family stories</p>
                </div>
              </Link>

              <Link
                href="/dashboard/stories"
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-secondary-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Browse Stories</p>
                  <p className="text-sm text-gray-500">Listen to family memories</p>
                </div>
              </Link>

              <Link
                href="/dashboard/exports"
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Export Stories</p>
                  <p className="text-sm text-gray-500">Download your family archive</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status - Only show if WebSocket is actually connected */}
      {websocket.isConnected && (
        <div className="fixed bottom-4 right-4 bg-green-100 border border-green-200 rounded-lg p-3 shadow-lg">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
            <span className="text-sm text-green-800">Connected to real-time updates</span>
          </div>
        </div>
      )}
    </div>
  )
}