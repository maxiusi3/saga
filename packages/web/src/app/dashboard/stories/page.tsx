'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { useProjectStore } from '@/stores/project-store'
import { LoadingButton } from '@/components/ui/loading'
import { formatRelativeTime, getErrorMessage } from '@/lib/utils'
import { apiClient } from '@/lib/api'

interface StoryWithProject {
  id: string
  projectId: string
  title?: string
  audioUrl: string
  audioDuration?: number
  transcript?: string
  photoUrl?: string
  status: 'processing' | 'ready' | 'failed'
  createdAt: Date
  updatedAt: Date
  project: {
    id: string
    title: string
  }
  _count?: {
    interactions: number
  }
}

export default function AllStoriesPage() {
  const { projects, fetchProjects } = useProjectStore()
  const [stories, setStories] = useState<StoryWithProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  useEffect(() => {
    fetchProjects()
    fetchAllStories()
  }, [fetchProjects])

  const fetchAllStories = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Fetch stories from all projects
      const allStories: StoryWithProject[] = []
      
      for (const project of projects) {
        try {
          const response = await apiClient.stories.list(project.id)
          const projectStories = response.data.data.stories.map((story: any) => ({
            ...story,
            project: {
              id: project.id,
              title: project.title,
            },
          }))
          allStories.push(...projectStories)
        } catch (error) {
          console.error(`Failed to fetch stories for project ${project.id}:`, error)
        }
      }

      // Sort by creation date (newest first)
      allStories.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setStories(allStories)
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to load stories')
    } finally {
      setIsLoading(false)
    }
  }

  // Filter stories based on search and filters
  const filteredStories = stories.filter(story => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      const matchesTitle = story.title?.toLowerCase().includes(searchLower)
      const matchesTranscript = story.transcript?.toLowerCase().includes(searchLower)
      const matchesProject = story.project.title.toLowerCase().includes(searchLower)
      
      if (!matchesTitle && !matchesTranscript && !matchesProject) {
        return false
      }
    }

    // Project filter
    if (selectedProject !== 'all' && story.projectId !== selectedProject) {
      return false
    }

    // Status filter
    if (selectedStatus !== 'all' && story.status !== selectedStatus) {
      return false
    }

    return true
  })

  if (isLoading && stories.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
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
        <h1 className="text-2xl font-bold text-gray-900">All Stories</h1>
        <p className="mt-1 text-sm text-gray-600">
          Browse and listen to stories from all your family projects.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-10"
                  placeholder="Search stories..."
                />
              </div>
            </div>

            {/* Project Filter */}
            <div>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="input"
              >
                <option value="all">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="input"
              >
                <option value="all">All Status</option>
                <option value="ready">Ready</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Results Summary */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {filteredStories.length} of {stories.length} stories
            </p>
            {(searchQuery || selectedProject !== 'all' || selectedStatus !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedProject('all')
                  setSelectedStatus('all')
                }}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Clear filters
              </button>
            )}
          </div>
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

      {/* Stories List */}
      {filteredStories.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {searchQuery || selectedProject !== 'all' || selectedStatus !== 'all' 
              ? 'No stories found' 
              : 'No stories yet'
            }
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery || selectedProject !== 'all' || selectedStatus !== 'all'
              ? 'Try adjusting your search terms or filters.'
              : 'Stories will appear here once family members start recording.'
            }
          </p>
          {!searchQuery && selectedProject === 'all' && selectedStatus === 'all' && (
            <div className="mt-6">
              <Link href="/dashboard/projects/new" className="btn-primary">
                Create Your First Project
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredStories.map((story) => (
            <div
              key={story.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Link
                        href={`/dashboard/projects/${story.project.id}`}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        {story.project.title}
                      </Link>
                      <span className="text-gray-300">•</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        story.status === 'ready' 
                          ? 'bg-green-100 text-green-800'
                          : story.status === 'processing'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {story.status === 'ready' ? 'Ready' : story.status === 'processing' ? 'Processing' : 'Failed'}
                      </span>
                    </div>

                    <h3 className="text-lg font-medium text-gray-900 mb-3">
                      {story.title || 'Untitled Story'}
                    </h3>

                    {story.transcript && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                        {story.transcript}
                      </p>
                    )}

                    <div className="flex items-center space-x-6 text-sm text-gray-500">
                      {story.audioDuration && (
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {Math.round(story.audioDuration / 60)} min
                        </div>
                      )}
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {story._count?.interactions || 0} interactions
                      </div>
                      <span>{formatRelativeTime(story.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {story.photoUrl && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={story.photoUrl}
                          alt="Story photo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <Link
                      href={`/dashboard/stories/${story.id}`}
                      className="btn-primary text-sm"
                    >
                      Listen & Interact
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {filteredStories.length > 0 && (
        <div className="mt-8 text-center">
          <LoadingButton
            onClick={fetchAllStories}
            isLoading={isLoading}
            className="btn-outline"
          >
            Refresh Stories
          </LoadingButton>
        </div>
      )}
    </div>
  )
}