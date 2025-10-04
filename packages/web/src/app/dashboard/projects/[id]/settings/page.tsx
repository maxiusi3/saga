'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard } from '@/components/ui/enhanced-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { ArrowLeft, Trash2, Crown } from 'lucide-react'
import Link from 'next/link'
import { projectService, ProjectWithMembers } from '@/lib/projects'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'react-hot-toast'

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const projectId = params.id as string
  
  const [project, setProject] = useState<ProjectWithMembers | null>(null)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'storyteller' | 'facilitator'>('storyteller')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    const loadProject = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const projects = await projectService.getUserProjects(user.id)
        const currentProject = projects.find(p => p.id === projectId)
        
        if (!currentProject) {
          toast.error('Project not found or access denied')
          router.push('/dashboard')
          return
        }

        setProject(currentProject)
        setProjectName(currentProject.name)
        setProjectDescription(currentProject.description || '')
      } catch (error) {
        console.error('Error loading project:', error)
        toast.error('Failed to load project')
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [projectId, user?.id, router])

  const handleSaveProjectDetails = async () => {
    if (!projectName.trim()) {
      toast.error('Project name is required')
      return
    }

    setSaving(true)
    try {
      const updated = await projectService.updateProject(projectId, {
        name: projectName.trim(),
        description: projectDescription.trim()
      })

      if (updated) {
        setProject(prev => prev ? { ...prev, name: updated.name, description: updated.description } : null)
        toast.success('Project updated successfully')
      } else {
        toast.error('Failed to update project')
      }
    } catch (error) {
      console.error('Error updating project:', error)
      toast.error('Failed to update project')
    } finally {
      setSaving(false)
    }
  }

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Email is required')
      return
    }

    if (!user?.id) {
      toast.error('User not authenticated')
      return
    }
    
    setInviting(true)
    try {
      const member = await projectService.inviteMember({
        project_id: projectId,
        user_email: inviteEmail.trim(),
        role: inviteRole,
        invited_by: user.id
      })

      if (member) {
        toast.success(`Invitation sent to ${inviteEmail}`)
        setInviteEmail('')
        const projects = await projectService.getUserProjects(user.id)
        const updated = projects.find(p => p.id === projectId)
        if (updated) setProject(updated)
      } else {
        toast.error('Failed to send invitation')
      }
    } catch (error) {
      console.error('Error inviting member:', error)
      toast.error('Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      const success = await projectService.removeMember(memberId)
      if (success) {
        toast.success('Member removed successfully')
        if (user?.id) {
          const projects = await projectService.getUserProjects(user.id)
          const updated = projects.find(p => p.id === projectId)
          if (updated) setProject(updated)
        }
      } else {
        toast.error('Failed to remove member')
      }
    } catch (error) {
      console.error('Error removing member:', error)
      toast.error('Failed to remove member')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!project || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100 p-6">
        <div className="max-w-7xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-gray-900">
            {!user ? 'Please sign in' : 'Project not found'}
          </h1>
          <Link href="/dashboard">
            <EnhancedButton variant="outline" className="mt-4">
              Back to Dashboard
            </EnhancedButton>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href={`/dashboard/projects/${projectId}`}>
              <EnhancedButton variant="secondary" size="sm" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </EnhancedButton>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Project Management</h1>
            <p className="text-gray-600 mt-1">{project.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <EnhancedCard>
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Project Stats</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created</span>
                    <span className="font-medium">{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Stories</span>
                    <span className="font-medium">{project.story_count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Members</span>
                    <span className="font-medium">{project.member_count || 0}</span>
                  </div>
                </div>
              </div>
            </EnhancedCard>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <EnhancedCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Project Overview</h2>
                  <Badge className="bg-green-100 text-green-800">
                    {project.status === 'active' ? 'Active' : 'Archived'}
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="projectName">Project Name</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="projectName"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="Enter project name"
                      />
                      <EnhancedButton onClick={handleSaveProjectDetails} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </EnhancedButton>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="projectDescription">Project Description</Label>
                    <Textarea
                      id="projectDescription"
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="Enter project description"
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </EnhancedCard>

            <EnhancedCard>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Member Management</h2>

                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3">Invite New Member</h3>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="storyteller">Storyteller</SelectItem>
                        <SelectItem value="facilitator">Facilitator</SelectItem>
                      </SelectContent>
                    </Select>
                    <EnhancedButton onClick={handleInviteMember} disabled={inviting}>
                      {inviting ? 'Sending...' : 'Send Invite'}
                    </EnhancedButton>
                  </div>
                </div>

                <div className="space-y-3">
                  {project.members && project.members.length > 0 ? (
                    project.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {member.user_id?.charAt(0)?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {member.user_id === user.id ? 'You (Owner)' : `User ${member.user_id.substring(0, 8)}`}
                              </span>
                              {member.user_id === project.facilitator_id && (
                                <Crown className="h-4 w-4 text-yellow-500" />
                              )}
                            </div>
                            <div className="text-sm text-gray-600">Role: {member.role}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {member.status}
                          </Badge>
                          {member.user_id !== user.id && project.is_owner && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <EnhancedButton variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </EnhancedButton>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove this member from the project?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleRemoveMember(member.id)}>
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No members yet. Invite someone to get started!
                    </div>
                  )}
                </div>
              </div>
            </EnhancedCard>
          </div>
        </div>
      </div>
    </div>
  )
}
