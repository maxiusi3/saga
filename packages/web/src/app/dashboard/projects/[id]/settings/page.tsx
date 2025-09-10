'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { ArrowLeft, UserPlus, Trash2, Download, Share, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'
import { projectService, ProjectWithMembers } from '@/lib/projects'
import { UserRole, getRoleDisplayInfo } from '@saga/shared'
import { InvitationManager } from '@/components/invitations/invitation-manager'
import { toast } from 'react-hot-toast'

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectWithMembers | null>(null)
  const [projectTitle, setProjectTitle] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('storyteller')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadProject = async () => {
      if (!user?.id) {
        setLoading(false)
        setError('User not authenticated')
        return
      }

      try {
        setLoading(true)
        setError(null)

        const projectData = await projectService.getProjectById(projectId, user.id)
        if (!projectData) {
          setError('Project not found or access denied')
          setLoading(false)
          return
        }

        // Check if user has permission to access settings
        if (!projectData.is_owner && projectData.user_role !== 'facilitator') {
          setError('You do not have permission to access project settings')
          setLoading(false)
          return
        }

        setProject(projectData)
        setProjectTitle(projectData.title)
        setProjectDescription(projectData.description || '')
      } catch (error) {
        console.error('Error loading project:', error)
        setError('Failed to load project data')
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [projectId, user?.id])

  // Handle project update
  const handleSaveProjectDetails = async () => {
    if (!project || !user?.id) return

    if (!projectTitle.trim()) {
      toast.error('Project title is required')
      return
    }

    setSaving(true)
    try {
      const updatedProject = await projectService.updateProject(project.id, {
        title: projectTitle.trim(),
        description: projectDescription.trim() || undefined
      })

      if (updatedProject) {
        setProject(prev => prev ? { ...prev, ...updatedProject } : null)
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

  // Handle member invitation
  const handleInviteMember = async () => {
    if (!project || !user?.id) return

    if (!inviteEmail.trim()) {
      toast.error('Email is required')
      return
    }

    setInviting(true)
    try {
      const member = await projectService.inviteMember({
        project_id: project.id,
        user_email: inviteEmail.trim(),
        role: inviteRole,
        invited_by: user.id
      })

      if (member) {
        toast.success('Invitation sent successfully')
        setInviteEmail('')
        // Reload project to get updated member list
        const updatedProject = await projectService.getProjectById(projectId, user.id)
        if (updatedProject) {
          setProject(updatedProject)
        }
      } else {
        toast.error('Failed to send invitation. User may not exist.')
      }
    } catch (error) {
      console.error('Error inviting member:', error)
      toast.error('Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  // Handle member removal
  const handleRemoveMember = async (memberId: string) => {
    if (!project || !user?.id) return

    try {
      const success = await projectService.removeMember(memberId)
      if (success) {
        toast.success('Member removed successfully')
        // Reload project to get updated member list
        const updatedProject = await projectService.getProjectById(projectId, user.id)
        if (updatedProject) {
          setProject(updatedProject)
        }
      } else {
        toast.error('Failed to remove member')
      }
    } catch (error) {
      console.error('Error removing member:', error)
      toast.error('Failed to remove member')
    }
  }

  // Handle role update
  const handleUpdateRole = async (memberId: string, newRole: UserRole) => {
    if (!project || !user?.id) return

    try {
      const success = await projectService.updateMemberRole(memberId, newRole)
      if (success) {
        toast.success('Role updated successfully')
        // Reload project to get updated member list
        const updatedProject = await projectService.getProjectById(projectId, user.id)
        if (updatedProject) {
          setProject(updatedProject)
        }
      } else {
        toast.error('Failed to update role')
      }
    } catch (error) {
      console.error('Error updating role:', error)
      toast.error('Failed to update role')
    }
  }



  const handleExportArchive = async () => {
    try {
      setSaving(true)
      toast.loading('Preparing export archive...', { id: 'export' })

      const response = await fetch(`/api/projects/${projectId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error('Failed to generate export archive')
      }

      // 获取文件名
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `${project?.name || 'project'}_export.zip`

      // 下载文件
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Export archive downloaded successfully!', { id: 'export' })
    } catch (error) {
      console.error('Error exporting archive:', error)
      toast.error('Failed to export archive. Please try again.', { id: 'export' })
    } finally {
      setSaving(false)
    }
  }

  const getRoleBadge = (role: UserRole) => {
    const roleInfo = getRoleDisplayInfo(role)
    return <Badge variant={roleInfo.color as any}>{roleInfo.icon} {roleInfo.label}</Badge>
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="primary">Active</Badge>
      case 'pending':
        return <Badge variant="outline">Invited</Badge>
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>
      case 'removed':
        return <Badge variant="destructive">Removed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 bg-muted rounded animate-pulse"></div>
          <div className="h-8 w-64 bg-muted rounded animate-pulse"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-foreground">Error</h1>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-4">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-foreground">Project not found</h1>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-4">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link href={`/dashboard/projects/${projectId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Project Settings</h1>
      </div>

      {/* Project Details */}
      <Card className="p-6">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Project Details</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-title">Project Name</Label>
              <div className="flex space-x-2 mt-1">
                <Input
                  id="project-title"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleSaveProjectDetails}
                  disabled={saving || (projectTitle.trim() === project.title && projectDescription.trim() === (project.description || ''))}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>

            {/* Project Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <div className="flex space-x-2">
                <textarea
                  id="description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="flex-1 min-h-[80px] px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Add a description for your project..."
                />
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Created on {new Date(project.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </Card>

      {/* Members Management */}
      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-foreground">Members</h2>
          </div>

          {/* Invite Member Form */}
          <div className="border border-border rounded-lg p-4 bg-muted">
            <h3 className="text-sm font-medium text-foreground mb-3">Invite New Member</h3>
            <div className="flex space-x-2">
              <Input
                type="email"
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="storyteller">Storyteller</option>
                <option value="co_facilitator">Co-Facilitator</option>
                <option value="facilitator">Facilitator</option>
              </select>
              <Button
                onClick={handleInviteMember}
                disabled={inviting || !inviteEmail.trim()}
              >
                {inviting ? 'Inviting...' : 'Invite'}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Project Owner */}
            {project.is_owner && (
              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-primary/5">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {user?.email?.charAt(0).toUpperCase() || 'O'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-foreground">You (Owner)</div>
                    <div className="text-sm text-muted-foreground">{user?.email}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge variant="primary">👑 Owner</Badge>
                  {getStatusBadge('active')}
                </div>
              </div>
            )}

            {/* Project Members */}
            {project.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {member.user_id?.charAt(0).toUpperCase() || 'M'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-foreground">Member</div>
                    <div className="text-sm text-muted-foreground">Role: {member.role}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {getRoleBadge(member.role)}
                  {getStatusBadge(member.status)}

                  {/* Role Update Dropdown */}
                  {project.is_owner && member.status === 'active' && (
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.id, e.target.value as UserRole)}
                      className="text-sm px-2 py-1 border border-border rounded"
                    >
                      <option value="storyteller">Storyteller</option>
                      <option value="co_facilitator">Co-Facilitator</option>
                      <option value="facilitator">Facilitator</option>
                    </select>
                  )}

                  {/* Remove Member Button */}
                  {project.is_owner && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Member</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove this member from the project?
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveMember(member.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Invitation Management */}
      {project.is_owner && (
        <InvitationManager projectId={projectId} />
      )}

      {/* Data Management */}
      <Card className="p-6">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Data Management</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 border border-border rounded-lg">
              <div>
                <div className="font-medium text-foreground">Export Full Archive</div>
                <div className="text-sm text-muted-foreground">
                  Download all stories, transcripts, and media files
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleExportArchive}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
