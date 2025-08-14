'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { useProjectStore } from '@/stores/project-store'
import { LoadingButton } from '@/components/ui/loading'
import { formatRelativeTime, getErrorMessage } from '@/lib/utils'
import { ProjectMembersPanel } from '@/components/projects/project-members-panel'
import { ProjectAnalyticsPanel } from '@/components/projects/project-analytics-panel'
import { ProjectSettingsPanel } from '@/components/projects/project-settings-panel'
import { FacilitatorActivityFeed } from '@/components/stories/facilitator-activity-feed'
import { text } from 'stream/consumers'
import { text } from 'stream/consumers'

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  
  const {
    currentProject,
    projectStats,
    stories,
    isLoading,
    error,
    fetchProject,
    fetchProjectStats,
    fetchStories,
    deleteProject,
    clearError,
  } = useProjectStore()

  const [deletingProject, setDeletingProject] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'analytics' | 'settings'>('overview')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [isProjectOwner, setIsProjectOwner] = useState(false)

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId)
      fetchProjectStats(projectId)
      fetchStories(projectId, { limit: 5 })
      
      // Get current user info from localStorage or auth store
      const userId = localStorage.getItem('userId') || ''
      setCurrentUserId(userId)
      
      // Check if current user is project owner (this would come from project data)
      // For now, we'll assume the first facilitator is the owner
      setIsProjectOwner(true) // This should be determined from actual project data
    }
  }, [projectId, fetchProject, fetchProjectStats, fetchStories])

  const handleDeleteProject = async () => {
    if (!currentProject) return

    const confirmed = confirm(
      `Are you sure you want to delete "${currentProject.title}"? This action cannot be undone and will delete all associated stories.`
    )

    if (!confirmed) return

    setDeletingProject(true)
    try {
      await deleteProject(currentProject.id)
      toast.success('Project deleted successfully')
      router.push('/dashboard/projects')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDeletingProject(false)
    }
  }

  if (isLoading && !currentProject) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="h-6 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="h-6 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentProject) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Project not found</h2>
          <p className="mt-2 text-gray-600">The project you're looking for doesn't exist or has been deleted.</p>
          <Link href="/dashboard/projects" className="mt-4 btn-primary inline-block">
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-8">
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Projects
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{currentProject.title}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {currentProject.description || 'No description provided'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            href={`/dashboard/projects/${currentProject.id}/edit`}
            className="btn-outline"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </Link>
          <LoadingButton
            onClick={handleDeleteProject}
            isLoading={deletingProject}
            className="btn-danger"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </LoadingButton>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'members'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Members
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Settings
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
                  ? 'border-prima00'
                  : 'border-transparent text-gray-500 hover:text-gray300'
              }`}
            >
              Overview
            </button>
            <button
              onClick=ers')}
              className={`py-2 px-1 border-b-
                activeTab === 'members'
                  ? 'border-primary-500 text-primary-600'
                  : 'bory-300'
              }`}
            >
              Members
            </button>
            <button
              onClick={(
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                active
                  ? 'border-primary-500 text-0'
                  : 'border-transparent text-gray-500 hover:text-gray-00'
              }`}
            >
              Analytics
            </button>
            <button
              onCl
              cl
gs'
                  ? 'border-prim0'
                  : 'border-transparent text-gray-500 '
              }`}
            >
              Settings
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Cont/}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">s-3 -col1 lg:gridnt *eay-300der-gr:borovery-700 hr:text-grahoveary-60primxt--500 teary 'settintiveTab ===          ac      ext-sm ${um tedi2 font-m-1 border-b-={`py-2 pxameassNngs')}titiveTab('set() => setAck={ic-3-grayborder hover:700primary-60alytics'b === 'anTa')}icsalyteTab('an setActiv) =>raer:border-g-700 hovt-grayhover:tex500 -gray-nt textreer-transpadsm ${m text-nt-mediu2 fomembctiveTab(' => setA{()ay-border-grer:ov00 h-7imary-6prtext-ry-500 = 'overvtiveTab == spacex flex
          {/* Project Stats */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Project Overview</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600">
                    {projectStats?.totalStories || currentProject.storyCount || 0}
                  </div>
                  <div className="text-sm text-gray-500">Stories</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-secondary-600">
                    {projectStats?.totalDuration ? Math.round(projectStats.totalDuration / 60) : 0}
                  </div>
                  <div className="text-sm text-gray-500">Minutes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {projectStats?.completedChapters || 0}
                  </div>
                  <div className="text-sm text-gray-500">Chapters</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {currentProject.memberCount || 1}
                  </div>
                  <div className="text-sm text-gray-500">Members</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Stories */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Recent Stories</h2>
              <Link
                href={`/dashboard/projects/${currentProject.id}/stories`}
                className="text-sm font-medium text-primary-600 hover:text-primary-500"
              >
                View all
              </Link>
            </div>
            <div className="p-6">
              {stories.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No stories yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Stories will appear here once family members start recording.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stories.slice(0, 5).map((story) => (
                    <div
                      key={story.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {story.title || 'Untitled Story'}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {story.duration ? `${Math.round(story.duration / 60)} minutes` : 'Processing...'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatRelativeTime(story.createdAt)}
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/stories/${story.id}`}
                        className="btn-outline text-xs"
                      >
                        Listen
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-6 space-y-3">
              <Link
                href={`/dashboard/projects/${currentProject.id}/invite`}
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
                  <p className="text-sm font-medium text-gray-900">Invite Family Members</p>
                  <p className="text-sm text-gray-500">Send invitations to storytellers</p>
                </div>
              </Link>

              <Link
                href={`/dashboard/projects/${currentProject.id}/stories`}
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
                  <p className="text-sm text-gray-500">Listen to recorded memories</p>
                </div>
              </Link>

              <Link
                href={`/dashboard/projects/${currentProject.id}/export`}
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
                  <p className="text-sm font-medium text-gray-900">Export Archive</p>
                  <p className="text-sm text-gray-500">Download all stories</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Project Info */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Project Details</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="text-sm text-gray-900 mt-1">
                  {formatRelativeTime(currentProject.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="text-sm text-gray-900 mt-1">
                  {formatRelativeTime(currentProject.updatedAt)}
                </dd>
              </div>
              {projectStats?.lastStoryDate && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Story</dt>
                  <dd className="text-sm text-gray-900 mt-1">
                    {formatRelativeTime(projectStats.lastStoryDate)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="text-sm text-gray-900 mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </dd>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ProjectMembersPanel
            projectId={projectId}
            currentUserId={currentUserId}
            isProjectOwner={isProjectOwner}
          />
          <FacilitatorActivityFeed
            projectId={projectId}
            activities={[]} // This would be fetched from an API
          />
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-8">
          <ProjectAnalyticsPanel projectId={projectId} />
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-4xl">
          <ProjectSettingsPanel
            projectId={projectId}
            currentSettings={{
              id: currentProject?.id || '',
              name: currentProject?.title || '',
              description: currentProject?.description || '',
              isPublic: false,
              allowGuestAccess: false,
              autoGenerateChapterSummaries: true,
              notificationSettings: {
                newStoryNotifications: true,
                newInteractionNotifications: true,
                weeklyDigest: false
              },
              subscriptionStatus: 'active',
              subscriptionExpiresAt: undefined,
              archivalStatus: 'active'
            }}
            isProjectOwner={isProjectOwner}
            onSettingsUpdate={(settings) => {
              // Update the current project with new settings
              console.log('Settings updated:', settings)
            }}
          />
        </div>
      )}
    </div>
  )
}