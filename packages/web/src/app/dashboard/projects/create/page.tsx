'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Users, Sparkles, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'
import { projectService } from '@/lib/projects'
import { toast } from 'react-hot-toast'

interface UserResources {
  project_vouchers: number
  facilitator_seats: number
  storyteller_seats: number
}

export default function CreateProjectPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [storytellerEmail, setStorytellerEmail] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [resources, setResources] = useState<UserResources | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Pre-fill storyteller email with current user's email
  useEffect(() => {
    if (user?.email && !storytellerEmail) {
      setStorytellerEmail(user.email)
    }
  }, [user?.email, storytellerEmail])

  useEffect(() => {
    const loadUserResources = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        // For now, use mock data for user resources
        // TODO: Implement real user resource tracking
        const mockResources: UserResources = {
          project_vouchers: 5, // Unlimited for now
          facilitator_seats: 10,
          storyteller_seats: 20
        }

        setResources(mockResources)
        setLoading(false)
      } catch (err) {
        setError('Failed to load your resources')
        setLoading(false)
      }
    }

    loadUserResources()
  }, [user?.id])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!projectName.trim()) {
      setError('Project name is required')
      return
    }

    if (!storytellerEmail.trim()) {
      setError('Storyteller email is required')
      return
    }

    if (!user?.id) {
      setError('User not authenticated')
      return
    }

    if (!resources || resources.project_vouchers < 1) {
      setError('You need at least 1 project voucher to create a project')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      // 1. Create project in database
      const project = await projectService.createProject({
        title: projectName.trim(),
        description: projectDescription.trim() || undefined,
        owner_id: user.id
      })

      if (!project) {
        throw new Error('Failed to create project')
      }

      // 2. Invite storyteller if email is different from current user
      if (storytellerEmail.trim().toLowerCase() !== user.email?.toLowerCase()) {
        try {
          await projectService.inviteMember({
            project_id: project.id,
            user_email: storytellerEmail.trim(),
            role: 'storyteller',
            invited_by: user.id
          })
          toast.success('Project created and invitation sent!')
        } catch (inviteError) {
          console.error('Failed to invite storyteller:', inviteError)
          toast.success('Project created! Please invite the storyteller manually.')
        }
      } else {
        toast.success('Project created successfully!')
      }

      // 3. Redirect to project page
      router.push(`/dashboard/projects/${project.id}`)
    } catch (err) {
      console.error('Error creating project:', err)
      setError('Failed to create project. Please try again.')
      toast.error('Failed to create project')
    } finally {
      setIsCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-96 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 p-4">
        <div className="max-w-2xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-gray-900">Authentication Required</h1>
          <p className="text-gray-600 mt-2">Please sign in to create a project.</p>
          <Link href="/auth/signin">
            <FurbridgeButton className="mt-4">
              Sign In
            </FurbridgeButton>
          </Link>
        </div>
      </div>
    )
  }

  const canCreateProject = resources && resources.project_vouchers > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Navigation */}
        <Link 
          href="/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-furbridge-orange/10 rounded-full flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-furbridge-orange" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900">
            Create New Project
          </h1>
          
          <p className="text-gray-600 max-w-md mx-auto">
            Start capturing precious family stories by creating a new story project
          </p>
        </div>

        {/* Resource Check */}
        {!canCreateProject ? (
          <FurbridgeCard className="p-6 border-amber-200 bg-amber-50">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-amber-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-2">
                  No Project Vouchers Available
                </h3>
                <p className="text-amber-800 mb-4">
                  You need at least 1 project voucher to create a new project. 
                  Purchase a Saga Package to get project vouchers and seats.
                </p>
                <Link href="/dashboard/purchase">
                  <FurbridgeButton variant="orange" size="sm">
                    Purchase Package
                  </FurbridgeButton>
                </Link>
              </div>
            </div>
          </FurbridgeCard>
        ) : (
          <>
            {/* Resource Status */}
            <FurbridgeCard className="p-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-furbridge-teal" />
                  Your Available Resources
                </h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-furbridge-orange">
                      {resources.project_vouchers}
                    </div>
                    <div className="text-sm text-gray-600">
                      Project Vouchers
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-furbridge-teal">
                      {resources.facilitator_seats}
                    </div>
                    <div className="text-sm text-gray-600">
                      Facilitator Seats
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-furbridge-warm-gray">
                      {resources.storyteller_seats}
                    </div>
                    <div className="text-sm text-gray-600">
                      Storyteller Seats
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <strong>Creating this project will consume:</strong> 1 Project Voucher + 1 Storyteller Seat
                </div>
              </div>
            </FurbridgeCard>

            {/* Project Form */}
            <FurbridgeCard className="p-8">
              <form onSubmit={handleCreateProject} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="projectName">Project Name *</Label>
                    <Input
                      id="projectName"
                      type="text"
                      placeholder="e.g., Dad's Life Story"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="projectDescription">Project Description</Label>
                    <Textarea
                      id="projectDescription"
                      placeholder="Optional: Describe what stories you'd like to capture..."
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="storytellerEmail">Storyteller Email *</Label>
                    <Input
                      id="storytellerEmail"
                      type="email"
                      placeholder="storyteller@example.com"
                      value={storytellerEmail}
                      onChange={(e) => setStorytellerEmail(e.target.value)}
                      className="mt-1"
                      required
                    />
                    <p className="text-sm text-gray-600 mt-1">
                      We'll send an invitation to this email address
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <span className="text-red-800">{error}</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  <FurbridgeButton
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    className="sm:w-auto"
                  >
                    Cancel
                  </FurbridgeButton>
                  
                  <FurbridgeButton
                    type="submit"
                    variant="orange"
                    disabled={isCreating}
                    className="flex-1 sm:flex-none sm:min-w-48"
                  >
                    {isCreating ? 'Creating Project...' : 'Create Project'}
                  </FurbridgeButton>
                </div>
              </form>
            </FurbridgeCard>

            {/* Help Text */}
            <div className="text-center text-sm text-gray-600">
              <p>
                Need help getting started?{' '}
                <a href="mailto:support@saga.family" className="text-furbridge-orange hover:underline">
                  Contact Support
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
