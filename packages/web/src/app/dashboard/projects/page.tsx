'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { useProjectStore } from '@/stores/project-store'
import { LoadingButton } from '@/components/ui/loading'
import { SmartPurchasePrompt } from '@/components/wallet/purchase-prompt'
import { WalletStatus } from '@/components/wallet/wallet-status'
import { formatRelativeTime, getErrorMessage } from '@/lib/utils'
import api from '@/lib/api'
import type { ResourceWallet } from '@saga/shared/types'

export default function ProjectsPage() {
  const router = useRouter()
  const { 
    projects, 
    isLoading, 
    error, 
    fetchProjects, 
    deleteProject, 
    clearError 
  } = useProjectStore()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [wallet, setWallet] = useState<ResourceWallet | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
    fetchWalletStatus()
  }, [fetchProjects])

  const fetchWalletStatus = async () => {
    try {
      setWalletLoading(true)
      const response = await api.get('/api/wallets/me')
      if (response.data.success) {
        setWallet(response.data.data)
      }
    } catch (err) {
      console.error('Error fetching wallet status:', err)
    } finally {
      setWalletLoading(false)
    }
  }

  const handleDeleteProject = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return
    }

    setDeletingId(id)
    try {
      await deleteProject(id)
      toast.success('Project deleted successfully')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading && projects.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your family story projects and track their progress.
          </p>
        </div>
        <Link href="/dashboard/projects/new" className="btn-primary">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </Link>
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

      {/* Purchase Prompt */}
      {!walletLoading && (
        <div className="mb-6">
          <SmartPurchasePrompt wallet={wallet} />
        </div>
      )}

      {/* Wallet Status */}
      {!walletLoading && wallet && (
        <div className="mb-6">
          <WalletStatus showDetails={false} />
        </div>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating your first family story project.
          </p>
          <div className="mt-6">
            <Link href="/dashboard/projects/new" className="btn-primary">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Project
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {project.title}
                    </h3>
                    {/* Role Badge */}
                    <div className="flex items-center mt-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        project.userRole === 'facilitator' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {project.userRole === 'facilitator' ? (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Facilitator
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Storyteller
                          </>
                        )}
                      </span>
                      
                      {/* Subscription Status */}
                      {project.subscription && (
                        <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          project.subscription.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {project.subscription.isActive ? (
                            <>
                              <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                              Active
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 bg-red-400 rounded-full mr-1"></div>
                              Expired
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {project.userRole === 'facilitator' && (
                      <Link
                        href={`/dashboard/projects/${project.id}/edit`}
                        className="text-gray-400 hover:text-gray-600"
                        title="Edit project"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                    )}
                    {project.userRole === 'facilitator' && (
                      <button
                        onClick={() => handleDeleteProject(project.id, project.title)}
                        disabled={deletingId === project.id}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        title="Delete project"
                      >
                        {deletingId === project.id ? (
                          <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-600"></div>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {project.description || 'No description provided'}
                </p>

                {/* Project Members */}
                {project.roles && project.roles.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Team Members
                      </span>
                      <span className="text-xs text-gray-400">
                        {project.roles.length} member{project.roles.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {project.facilitators?.slice(0, 2).map((facilitator) => (
                        <div key={facilitator.userId} className="flex items-center text-xs text-gray-600">
                          <svg className="w-3 h-3 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span className="truncate">{facilitator.userName}</span>
                        </div>
                      ))}
                      {project.storytellers?.slice(0, 2).map((storyteller) => (
                        <div key={storyteller.userId} className="flex items-center text-xs text-gray-600">
                          <svg className="w-3 h-3 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="truncate">{storyteller.userName}</span>
                        </div>
                      ))}
                      {project.roles.length > 4 && (
                        <div className="text-xs text-gray-400">
                          +{project.roles.length - 4} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>{project.storyCount || 0} stories</span>
                  <div className="text-right">
                    {project.subscription && project.subscription.isActive && project.subscription.daysRemaining !== null && (
                      <div className={`text-xs ${
                        project.subscription.daysRemaining <= 7 
                          ? 'text-amber-600' 
                          : project.subscription.daysRemaining <= 30 
                            ? 'text-blue-600' 
                            : 'text-gray-500'
                      }`}>
                        {project.subscription.daysRemaining} days left
                      </div>
                    )}
                    <span>Updated {formatRelativeTime(project.updatedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="btn-outline text-sm"
                  >
                    View Details
                  </Link>
                  
                  <div className="flex items-center space-x-2">
                    {project.userRole === 'facilitator' && (
                      <Link
                        href={`/dashboard/projects/${project.id}/invite`}
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        title="Invite family members"
                      >
                        Invite
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/projects/${project.id}/stories`}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      Stories
                    </Link>
                    {project.subscription && !project.subscription.isActive && (
                      <Link
                        href={`/dashboard/billing/renew?project=${project.id}`}
                        className="text-amber-600 hover:text-amber-700 text-sm font-medium"
                        title="Renew subscription"
                      >
                        Renew
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="px-6 pb-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(((project.storyCount || 0) / 10) * 100, 100)}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {project.storyCount || 0} of 10+ stories collected
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}