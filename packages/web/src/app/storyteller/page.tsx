'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { StorytellerDashboard } from '@/components/storyteller/StorytellerDashboard'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'

export default function StorytellerPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/signin?redirect=/storyteller')
      return
    }

    const urlProjectId = searchParams.get('projectId')
    if (urlProjectId) {
      setProjectId(urlProjectId)
      setIsLoading(false)
    } else {
      // Try to find the user's storyteller project
      findStorytellerProject()
    }
  }, [isAuthenticated, searchParams, router])

  const findStorytellerProject = async () => {
    try {
      setIsLoading(true)
      const response = await api.get('/projects/storyteller')
      
      if (response.data?.project) {
        setProjectId(response.data.project.id)
      } else {
        setError('No storyteller project found. Please contact your family member who invited you.')
      }
    } catch (err: any) {
      console.error('Failed to find storyteller project:', err)
      setError('Unable to load your project. Please try again or contact support.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Redirecting to sign in...</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg">Loading your story space...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Unable to Load</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={findStorytellerProject}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!projectId || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg text-gray-600">Unable to load project information.</p>
        </div>
      </div>
    )
  }

  return (
    <StorytellerDashboard 
      projectId={projectId} 
      userId={user.id} 
    />
  )
}