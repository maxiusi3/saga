'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
      <div className="min-h-screen bg-gradient-to-br from-secondary/10 to-primary/10 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-muted rounded animate-pulse"></div>
          <div className="h-96 bg-muted rounded-lg animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary/10 to-primary/10 p-4">
        <div className="max-w-2xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-foreground">Authentication Required</h1>
          <p className="text-muted-foreground mt-2">Please sign in to create a project.</p>
          <Link href="/auth/signin">
            <Button className="mt-4">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const canCreateProject = resources && resources.project_vouchers > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/10 to-primary/10 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Navigation */}
        <Link
          href="/dashboard"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-foreground">
            Create New Project
          </h1>
          
          <p className="text-muted-foreground max-w-md mx-auto">
            Start capturing precious family stories by creating a new story project
          </p>
        </div>

        {/* Resource Check */}
        {!canCreateProject ? (
          <Card className="p-6 border-warning bg-warning/10">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-warning mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-warning-foreground mb-2">
                  No Project Vouchers Available
                </h3>
                <p className="text-warning-foreground/80">
                  You have used all your available project vouchers. To create more projects, please upgrade your plan or contact support for more options.
                </p>
                <div className="mt-4 space-x-3">
                  <Link href="/dashboard/billing">
                    <Button variant="outline" className="border-warning text-warning-foreground hover:bg-warning/20">
                      Upgrade Plan
                    </Button>
                  </Link>
                  <Button variant="ghost" className="text-warning-foreground hover:bg-warning/20">
                    Contact Support
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleCreateProject}>
            <Card className="p-8">
              <div className="space-y-6">
                {/* Project Name */}
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
                    <p className="text-sm text-muted-foreground mt-1">
                      We'll send an invitation to this email address
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <span className="text-destructive-foreground">{error}</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    className="sm:w-auto"
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    type="submit"
                    variant="default"
                    disabled={isCreating}
                    className="flex-1 sm:flex-none sm:min-w-48"
                  >
                    {isCreating ? 'Creating Project...' : 'Create Project'}
                  </Button>
                </div>
              </div>
            </Card>
          </form>
        )}
      </div>
    </div>
  )
}
