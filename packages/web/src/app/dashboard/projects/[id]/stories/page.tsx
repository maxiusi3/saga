'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { useProjectStore } from '@/stores/project-store'
import { LoadingButton } from '@/components/ui/loading'
import { formatRelativeTime, getErrorMessage } from '@/lib/utils'

export default function ProjectStoriesPage() {
  const params = useParams()
  const projectId = params.id as string
  
  const {
    currentProject,
    stories,
    isLoading,
    error,
    fetchProject,
    fetchStories,
    searchStories,
    clearError,
  } = useProjectStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'ready' | 'processing'>('all')

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId)
      fetchStories(projectId)
    }
  }, [projectId, fetchProject, fetchStories])

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await searchStories(projectId, query)
      setSearchResults(results)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      handleSearch(query)
    }, 300)

    return () => clearTimeout(timeoutId)
  }

  const filteredStories = stories.filter(story => {
    if (selectedFilter === 'all') return true
    return story.status === selectedFilter
  })

  const displayStories = searchQuery ? searchResults : filteredStories

  if (isLoading && !currentProject) {
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

  if (!currentProject) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <span className="text-gray-900">Stories</span>
        </nav>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stories</h1>
          <p className="mt-1 text-sm text-gray-600">
            Browse and interact with stories from "{currentProject.title}"
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            href={`/dashboard/projects/${currentProject.id}`}
            className="btn-outline"
          >
            Back to Project
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="input pl-10"
                  placeholder="Search stories by title or transcript..."
                />
                {isSearching && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Filter */}
            <div className="sm:w-48">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as any)}
                className="input"
              >
                <option value="all">All Stories</option>
                <option value="ready">Ready</option>
                <option value="processing">Processing</option>
              </select>
            </div>
          </div>

          {searchQuery && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
              </p>
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Clear search
              </button>
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

      {/* Stories List */}
      {displayStories.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {searchQuery ? 'No stories found' : 'No stories yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery 
              ? 'Try adjusting your search terms or filters.'
              : 'Stories will appear here once family members start recording.'
            }
          </p>
          {!searchQuery && (
            <div className="mt-6">
              <Link
                href={`/dashboard/projects/${currentProject.id}/invite`}
                className="btn-primary"
              >
                Invite Family Members
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {displayStories.map((story) => (
            <div
              key={story.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        {story.title || 'Untitled Story'}
                      </h3>
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
      {displayStories.length > 0 && !searchQuery && (
        <div className="mt-8 text-center">
          <LoadingButton
            onClick={() => fetchStories(projectId, { page: 2 })}
            isLoading={isLoading}
            className="btn-outline"
          >
            Load More Stories
          </LoadingButton>
        </div>
      )}
    </div>
  )
}