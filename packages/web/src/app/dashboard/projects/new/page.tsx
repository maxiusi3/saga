'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'react-hot-toast'
import { useProjectStore } from '@/stores/project-store'
import { LoadingButton } from '@/components/ui/loading'
import { WalletStatus } from '@/components/wallet/wallet-status'
import { ResourceErrorAlert } from '@/components/wallet/resource-error-alert'
import { useResourceValidation } from '@/lib/resource-validation'
import { getErrorMessage } from '@/lib/utils'
import api from '@/lib/api'
import type { ResourceWallet } from '@saga/shared/types'

const projectSchema = z.object({
  title: z.string().min(1, 'Project title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
})

type ProjectFormData = z.infer<typeof projectSchema>

export default function NewProjectPage() {
  const router = useRouter()
  const { createProject, isLoading, error, clearError } = useProjectStore()
  const [step, setStep] = useState<'details' | 'package'>('details')
  const [wallet, setWallet] = useState<ResourceWallet | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
  })

  const title = watch('title')
  const description = watch('description')

  const { canCreateProject, formatErrorMessage } = useResourceValidation(wallet)

  useEffect(() => {
    fetchWalletStatus()
  }, [])

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

  const onSubmit = async (data: ProjectFormData) => {
    // Validate resources before creating project
    const validation = canCreateProject()
    if (!validation.isValid) {
      toast.error(formatErrorMessage(validation.errors))
      return
    }

    try {
      clearError()
      const project = await createProject(data)
      toast.success('Project created successfully!')
      
      // Refresh wallet status after project creation
      await fetchWalletStatus()
      
      // Move to package selection step
      setStep('package')
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      
      // Check if it's a resource-related error
      if (errorMessage.includes('insufficient') || errorMessage.includes('voucher')) {
        // Refresh wallet status in case it changed
        await fetchWalletStatus()
      }
      
      toast.error(errorMessage)
    }
  }

  const handlePurchasePackage = () => {
    // This will be implemented when we add Stripe integration
    toast('Package purchase will be implemented with Stripe integration', {
      icon: 'ℹ️',
      duration: 4000,
    })
    router.push('/dashboard/projects')
  }

  const handleSkipPackage = () => {
    router.push('/dashboard/projects')
  }

  if (step === 'package') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            <div className="text-center mb-8">
              <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Project Created Successfully!</h2>
              <p className="text-gray-600">
                Your project "{title}" has been created. Now let's get "The Saga Package" to unlock all features.
              </p>
            </div>

            {/* Package Card */}
            <div className="border-2 border-primary-200 rounded-lg p-6 mb-6 bg-primary-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">The Saga Package</h3>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary-600">$129</div>
                  <div className="text-sm text-gray-500">one-time payment</div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">Unlimited story recordings</span>
                </div>
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">AI-powered transcription</span>
                </div>
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">Family member invitations</span>
                </div>
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">Story export & archive</span>
                </div>
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">1 year of service included</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={handleSkipPackage}
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                >
                  Skip for now
                </button>
                <button
                  onClick={handlePurchasePackage}
                  className="btn-primary"
                >
                  Purchase Package
                </button>
              </div>
            </div>

            <div className="text-center text-sm text-gray-500">
              <p>You can purchase "The Saga Package" later from your project settings.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Projects
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
            <p className="mt-1 text-sm text-gray-600">
              Start collecting and preserving your family's stories and memories.
            </p>
          </div>

          {/* Wallet Status */}
          <div className="mb-6">
            <WalletStatus showDetails={true} />
          </div>

          {/* Insufficient Resources Alert */}
          {!walletLoading && (() => {
            const validation = canCreateProject()
            return !validation.isValid && (
              <div className="mb-6">
                <ResourceErrorAlert
                  errors={validation.errors}
                  title="Cannot Create Project"
                />
              </div>
            )
          })()}

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
                    <span>0 stories</span>
                    <span>Created just now</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <Link
                href="/dashboard/projects"
                className="btn-outline"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                isLoading={isLoading || walletLoading}
                disabled={walletLoading || !canCreateProject().isValid}
                className="px-8"
              >
                {walletLoading 
                  ? 'Loading...' 
                  : !canCreateProject().isValid 
                    ? 'Need Project Voucher' 
                    : 'Create Project'
                }
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}