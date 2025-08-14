'use client'

import { useEffect, useState } from 'react'
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
  project?: {
    id: string
    title: string
  }
}

export default function ExportsPage() {
  const { projects, fetchProjects } = useProjectStore()
  const [exports, setExports] = useState<ExportRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatingExport, setCreatingExport] = useState<string | null>(null)
  const [downloadingExport, setDownloadingExport] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
    fetchExports()
  }, [fetchProjects])

  const fetchExports = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await apiClient.exports.list()
      const exportsData = response.data.data
      
      // Enrich with project data
      const enrichedExports = exportsData.map((exportReq: ExportRequest) => {
        const project = projects.find(p => p.id === exportReq.projectId)
        return {
          ...exportReq,
          project: project ? { id: project.id, title: project.title } : undefined,
        }
      })
      
      setExports(enrichedExports)
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to load exports')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateExport = async (projectId: string) => {
    setCreatingExport(projectId)
    
    try {
      await apiClient.exports.create(projectId)
      toast.success('Export request created successfully')
      await fetchExports() // Refresh the list
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setCreatingExport(null)
    }
  }

  const handleDownload = async (exportId: string, projectTitle: string) => {
    setDownloadingExport(exportId)
    
    try {
      const response = await apiClient.exports.download(exportId)
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/zip' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${projectTitle.replace(/[^a-zA-Z0-9]/g, '_')}_export.zip`
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

  if (isLoading && exports.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Data Exports</h1>
        <p className="mt-1 text-sm text-gray-600">
          Export and download your family story archives.
        </p>
      </div>

      {/* Create New Export */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Export</h2>
          <p className="text-sm text-gray-600 mb-4">
            Select a project to export all its stories, transcripts, and media files as a downloadable archive.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">{project.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {project.storyCount || 0} stories
                    </p>
                  </div>
                  <LoadingButton
                    onClick={() => handleCreateExport(project.id)}
                    isLoading={creatingExport === project.id}
                    className="btn-primary text-sm"
                  >
                    Export
                  </LoadingButton>
                </div>
              </div>
            ))}
          </div>

          {projects.length === 0 && (
            <div className="text-center py-6">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>
              <p className="mt-1 text-sm text-gray-500">
                Create a project first to export stories.
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
                onClick={() => setError(null)}
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
              onClick={fetchExports}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="p-6">
          {exports.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No exports yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Your export requests will appear here once created.
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
                        <h3 className="text-sm font-medium text-gray-900">
                          {exportReq.project?.title || 'Unknown Project'}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(exportReq.status)}`}>
                          {getStatusText(exportReq.status)}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>Requested {formatRelativeTime(exportReq.createdAt)}</span>
                        {exportReq.expiresAt && exportReq.status === 'ready' && (
                          <span>Expires {formatRelativeTime(exportReq.expiresAt)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {exportReq.status === 'ready' && (
                        <LoadingButton
                          onClick={() => handleDownload(exportReq.id, exportReq.project?.title || 'Export')}
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
                          onClick={() => handleCreateExport(exportReq.projectId)}
                          isLoading={creatingExport === exportReq.projectId}
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

      {/* Export Information */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-medium text-blue-900 mb-3">About Exports</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>• Exports include all stories, transcripts, photos, and metadata from a project</p>
          <p>• Files are organized in folders by story creation date</p>
          <p>• Audio files are provided in their original format</p>
          <p>• Transcripts are included as both text files and in a summary document</p>
          <p>• Export files are available for download for 7 days after completion</p>
          <p>• Large projects may take several minutes to process</p>
        </div>
      </div>
    </div>
  )
}