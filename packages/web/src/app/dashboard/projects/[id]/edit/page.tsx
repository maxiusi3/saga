'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'react-hot-toast'
import { useProjectStore } from '@/stores/project-store'
import { LoadingButton } from '@/components/ui/loading'
import { getErrorMessage } from '@/lib/utils'

const projectSchema = z.object({
  title: z.string().min(1, 'Project title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
})

type ProjectFormData = z.infer<typeof projectSchema>

export default function EditProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  
  const {
    currentProject,
    isLoading,
    error,
    fetchProject,
    updateProject,
    clearError,
  } = useProjectStore()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
  })

  const title = watch('title')
  const description = watch('description')

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId)
    }
  }, [projectId, fetchProject])

  useEffect(() => {
    if (currentProject) {
      reset({
        title: currentProject.title,
        description: currentProject.description || '',
      })
    }
  }, [currentProject, reset])

  const onSubmit = async (data: ProjectFormData) => {
    if (!currentProject) return

    try {
      clearError()
      await updateProject(currentProject.id, data)
      toast.success('Project updated successfully!')
      router.push(`/dashboard/projects/${currentProject.id}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  if (isLoading && !currentProject) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="space-y-6">
              <div>
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
              <div>
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-24 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentProject) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Project not found</h2>
          <p className="mt-2 text-gray-600">The project you're trying to edit doesn't exist or has been deleted.</p>
          <Link href="/dashboard/projects" className="mt-4 btn-primary inline-block">
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <span className="text-gray-900">Edit</span>
        </nav>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Edit Project</h1>
            <p className="mt-1 text-sm text-gray-600">
              Update your project details and settings.
            </p>
          </div>

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
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Project Title *
              </label>
              <input
                {...register('title')}
                type="text"
                className={`mt-1 input ${errors.title ? 'input-error' : ''}`}
                placeholder="e.g., Mom's Life Stories, Family History Project"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Choose a meaningful name that represents the stories you'll collect.
              </p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={4}
                className={`mt-1 input ${errors.description ? 'input-error' : ''}`}
                placeholder="Describe what stories you plan to collect, who will be involved, or any special focus areas..."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Optional: Add context about your project goals and scope.
              </p>
            </div>

            {/* Preview */}
            {(title || description) && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Preview</h4>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900">{title || 'Project Title'}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {description || 'No description provided'}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-500 mt-3">
                    <span>{currentProject.storyCount || 0} stories</span>
                    <span>Updated just now</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <Link
                href={`/dashboard/projects/${currentProject.id}`}
                className="btn-outline"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                isLoading={isLoading}
                className="px-8"
              >
                Save Changes
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-8 bg-white shadow rounded-lg border border-red-200">
        <div className="px-6 py-4 border-b border-red-200 bg-red-50">
          <h2 className="text-lg font-medium text-red-900">Danger Zone</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Delete Project</h3>
              <p className="text-sm text-gray-500 mt-1">
                Permanently delete this project and all associated stories. This action cannot be undone.
              </p>
            </div>
            <Link
              href={`/dashboard/projects/${currentProject.id}`}
              className="btn-danger"
            >
              Delete Project
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}