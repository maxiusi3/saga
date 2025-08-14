'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'react-hot-toast'
import { useProjectStore } from '@/stores/project-store'
import { LoadingButton } from '@/components/ui/loading'
import { getErrorMessage } from '@/lib/utils'

const invitationSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['facilitator', 'storyteller'], {
    required_error: 'Please select a role for this invitation',
  }),
  message: z.string().max(500, 'Message must be less than 500 characters').optional(),
})

type InvitationFormData = z.infer<typeof invitationSchema>

export default function InviteToProjectPage() {
  const params = useParams()
  const projectId = params.id as string
  
  const {
    currentProject,
    isLoading,
    error,
    fetchProject,
    generateInvitation,
    clearError,
  } = useProjectStore()

  const [invitationSent, setInvitationSent] = useState(false)
  const [invitedEmail, setInvitedEmail] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      role: 'storyteller',
      message: `Hi there!\n\nI'd love to have you share your stories and memories as part of our family history project. This is a special way for us to preserve and celebrate the experiences that have shaped our family.\n\nThe process is simple - you'll receive a link to record your stories using your phone or computer. Your stories will be safely stored and can be shared with family members.\n\nI hope you'll join us in creating this meaningful family archive.\n\nWith love,\n[Your name]`,
    },
  })

  const email = watch('email')
  const role = watch('role')
  const message = watch('message')

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId)
    }
  }, [projectId, fetchProject])

  const onSubmit = async (data: InvitationFormData) => {
    if (!currentProject) return

    try {
      clearError()
      await generateInvitation(currentProject.id, data)
      setInvitedEmail(data.email)
      setInvitationSent(true)
      toast.success('Invitation sent successfully!')
      reset()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const handleSendAnother = () => {
    setInvitationSent(false)
    setInvitedEmail('')
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
                <div className="h-32 bg-gray-200 rounded"></div>
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
          <p className="mt-2 text-gray-600">The project you're trying to invite to doesn't exist.</p>
          <Link href="/dashboard/projects" className="mt-4 btn-primary inline-block">
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  if (invitationSent) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8 text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Sent!</h2>
            <p className="text-gray-600 mb-6">
              We've sent an invitation to <strong>{invitedEmail}</strong> to join "{currentProject.title}".
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">What happens next?</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>The recipient will receive an email with instructions</li>
                      <li>They can join using any smartphone or computer</li>
                      <li>You'll be notified when they start sharing stories</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={handleSendAnother}
                className="btn-outline"
              >
                Send Another Invitation
              </button>
              <Link
                href={`/dashboard/projects/${currentProject.id}`}
                className="btn-primary"
              >
                Back to Project
              </Link>
            </div>
          </div>
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
          <span className="text-gray-900">Invite</span>
        </nav>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Invite Family Member</h1>
            <p className="mt-1 text-sm text-gray-600">
              Send an invitation to join "{currentProject.title}" and start sharing stories.
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address *
              </label>
              <input
                {...register('email')}
                type="email"
                className={`mt-1 input ${errors.email ? 'input-error' : ''}`}
                placeholder="family.member@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Enter the email address of the family member you'd like to invite.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Role *
              </label>
              <div className="space-y-3">
                <div className="flex items-start">
                  <input
                    {...register('role')}
                    type="radio"
                    value="storyteller"
                    id="role-storyteller"
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <label htmlFor="role-storyteller" className="block text-sm font-medium text-gray-900">
                      Storyteller
                    </label>
                    <p className="text-sm text-gray-500">
                      The person who will record and share their stories. Perfect for parents, grandparents, or other family members with stories to tell.
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <input
                    {...register('role')}
                    type="radio"
                    value="facilitator"
                    id="role-facilitator"
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <label htmlFor="role-facilitator" className="block text-sm font-medium text-gray-900">
                      Co-Facilitator
                    </label>
                    <p className="text-sm text-gray-500">
                      A family member who will help manage the project, ask follow-up questions, and interact with stories. Great for siblings collaborating together.
                    </p>
                  </div>
                </div>
              </div>
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                Personal Message
              </label>
              <textarea
                {...register('message')}
                rows={8}
                className={`mt-1 input ${errors.message ? 'input-error' : ''}`}
                placeholder="Add a personal message to your invitation..."
              />
              {errors.message && (
                <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Customize the invitation message to make it more personal and encouraging.
              </p>
            </div>

            {/* Preview */}
            {email && role && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Email Preview</h4>
                <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm">
                  <div className="border-b border-gray-200 pb-3 mb-3">
                    <p><strong>To:</strong> {email}</p>
                    <p><strong>Subject:</strong> {role === 'storyteller' 
                      ? `You're invited to share your family stories in "${currentProject.title}"`
                      : `You're invited to collaborate on "${currentProject.title}"`
                    }</p>
                    <p><strong>Role:</strong> {role === 'storyteller' ? 'Storyteller' : 'Co-Facilitator'}</p>
                  </div>
                  <div className="whitespace-pre-wrap text-gray-700">
                    {message || 'No personal message added.'}
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      This invitation includes a secure link to join the project as a {role === 'storyteller' ? 'storyteller' : 'co-facilitator'}.
                    </p>
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
                Send Invitation
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-medium text-blue-900 mb-3">Tips for successful invitations</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li className="flex items-start">
            <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Explain why their stories matter and how they'll be preserved
          </li>
          <li className="flex items-start">
            <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Mention that it's easy to use on any phone or computer
          </li>
          <li className="flex items-start">
            <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Offer to help them get started if they need assistance
          </li>
          <li className="flex items-start">
            <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Follow up with a phone call to answer any questions
          </li>
        </ul>
      </div>
    </div>
  )
}