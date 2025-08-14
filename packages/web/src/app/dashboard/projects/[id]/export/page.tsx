'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { useProjectStore } from '@/stores/project-store'
import { LoadingButton } from '@/components/ui/loading'
import { formatRelativeTime, getErrorMessage } from '@/lib/utils'
import { apiClient } from '@/lib/api'

interface ExportRequest {
  id: string
  projectId: string
  facilitatorId: string
  status: 'pending' | 'processing' | 'ready' | 'failed'
  downloadUrl?: string
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

export default function ProjectExportPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  
  const {
    currentProject,
    projectStats,
    isLoading: projectLoading,
    error: projectError,
    fetchProject,
    fetchProjectStats,
    clearError,
  } = useProjectStore()

  const [exports, setExports] = useState<ExportRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatingExport, setCreatingExport] = useState(false)
  const [downloadingExport, setDownloadingExport] = useState<string | null>(null)

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId)
      fetchProjectStats(projectId)
      fetchProjectExports()
    }
  }, [projectId, fetchProject, fetchProjectStats])

  const fetchProjectExports = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await apiClient.exports.list()
      const allExports = response.data.data
      
      // Filter exports for this project
      const projectExports = allExports.filter((exp: ExportRequest) => exp.projectId === projectId)
      setExports(projectExports)
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to load exports')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateExport = async () => {
    if (!currentProject) return

    setCreatingExport(true)
    
    try {
      await apiClient.exports.create(projectId)
      toast.success('Export request created successfully')
      await fetchProjectExports() // Refresh the list
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setCreatingExport(false)
    }
  }

  const handleDownload = async (exportId: string) => {
    if (!currentProject) return

    setDownloadingExport(exportId)
    
    try {
      const response = await apiClient.exports.download(exportId)
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/zip' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${currentProject.title.replace(/[^a-zA-Z0-9]/g, '_')}_export.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('Download started')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDownloadingExport(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'pending':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Ready for Download'
      case 'processing':
        return 'Processing'
      case 'pending':
        return 'Pending'
      case 'failed':
        return 'Failed'
      default:
        return status
    }
  }

  if (projectLoading && !currentProject) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-32 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentProject) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Project not found</h2>
          <p className="mt-2 text-gray-600">The project you're looking for doesn't exist.</p>
          <Link href="/dashboard/projects" className="mt-4 btn-primary inline-block">
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-8">
        <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
          <Link href="/dashboard/projects" className="hover:text-gray-700">
            Projects
          </Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href={`/dashboard/projects/${currentProject.id}`} className="hover:text-gray-700">
            {currentProject.title}
          </Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900">Export</span>
        </nav>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Export Project</h1>
        <p className="mt-1 text-sm text-gray-600">
          Download all stories and data from "{currentProject.title}"
        </p>
      </div>

      {/* Project Overview */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Project Overview</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">What's included in your export:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• All audio recordings in original quality</li>
              <li>• Complete transcripts and edited versions</li>
              <li>• Photo attachments and story metadata</li>
              <li>• Comments and follow-up questions</li>
              <li>• Project information and member details</li>
              <li>• Organized folder structure by date</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Create Export */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Export</h2>
          <p className="text-sm text-gray-600 mb-6">
            Generate a complete archive of all project data. Large projects may take several minutes to process.
          </p>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Export Format: ZIP Archive</p>
              <p className="text-sm text-gray-500">Includes all files organized in folders</p>
            </div>
            <LoadingButton
              onClick={handleCreateExport}
              isLoading={creatingExport}
              className="px-6"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Create Export
            </LoadingButton>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {(error || projectError) && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error || projectError}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => {
                  setError(null)
                  clearError()
                }}
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

      {/* Export History */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Export History</h2>
            <button
              onClick={fetchProjectExports}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="animate-pulse border border-gray-200 rounded-lg p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : exports.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No exports yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Create your first export to download project data.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {exports.map((exportReq) => (
                <div
                  key={exportReq.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(exportReq.status)}`}>
                          {getStatusText(exportReq.status)}
                        </span>
                        <span className="text-sm text-gray-500">
                          Requested {formatRelativeTime(exportReq.createdAt)}
                        </span>
                      </div>
                      
                      {exportReq.expiresAt && exportReq.status === 'ready' && (
                        <p className="text-sm text-gray-500">
                          Expires {formatRelativeTime(exportReq.expiresAt)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {exportReq.status === 'ready' && (
                        <LoadingButton
                          onClick={() => handleDownload(exportReq.id)}
                          isLoading={downloadingExport === exportReq.id}
                          className="btn-primary text-sm"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download
                        </LoadingButton>
                      )}
                      
                      {exportReq.status === 'processing' && (
                        <div className="flex items-center text-sm text-gray-500">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                          Processing...
                        </div>
                      )}
                      
                      {exportReq.status === 'failed' && (
                        <LoadingButton
                          onClick={handleCreateExport}
                          isLoading={creatingExport}
                          className="btn-outline text-sm"
                        >
                          Retry
                        </LoadingButton>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Additional Information */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Export Details</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p><strong>File Structure:</strong> Stories are organized by creation date in separate folders</p>
          <p><strong>Audio Format:</strong> Original format preserved (typically MP3 or M4A)</p>
          <p><strong>Transcripts:</strong> Both original and edited versions included as text files</p>
          <p><strong>Metadata:</strong> JSON files with story details, timestamps, and interaction data</p>
          <p><strong>Availability:</strong> Download links expire after 7 days for security</p>
        </div>
      </div>
    </div>
  )
}