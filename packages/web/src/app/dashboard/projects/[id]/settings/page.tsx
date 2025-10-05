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
import { InvitationManager } from '@/components/invitations/invitation-manager'

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const projectId = params.id as string
  
  const [project, setProject] = useState<ProjectWithMembers | null>(null)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Actions */}
            <EnhancedCard>
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <EnhancedButton 
                    variant="secondary" 
                    className="w-full justify-start"
                    onClick={() => {
                      // Scroll to Member Management section
                      const memberSection = document.getElementById('member-management')
                      if (memberSection) {
                        memberSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        // Highlight the section briefly
                        memberSection.classList.add('ring-2', 'ring-sage-500', 'ring-offset-2')
                        setTimeout(() => {
                          memberSection.classList.remove('ring-2', 'ring-sage-500', 'ring-offset-2')
                        }, 2000)
                      }
                    }}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Invite Members
                  </EnhancedButton>
                  <EnhancedButton 
                    variant="secondary" 
                    className="w-full justify-start"
                    onClick={() => toast.success('Export feature coming soon!')}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export Data
                  </EnhancedButton>
                  <EnhancedButton 
                    variant="secondary" 
                    className="w-full justify-start"
                    onClick={() => toast.success('Share feature coming soon!')}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share Project
                  </EnhancedButton>
                </div>
              </div>
            </EnhancedCard>

            {/* Project Stats */}
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

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">

            <EnhancedCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Project Overview</h2>
                  <Badge className="bg-green-100 text-green-800">
                    {project.status === 'active' ? 'Active' : 'Archived'}
                  </Badge>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div className="text-center">
                    <svg className="w-8 h-8 mx-auto mb-2 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div className="text-2xl font-bold text-gray-900">{new Date(project.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })}</div>
                    <div className="text-sm text-gray-600">Created</div>
                  </div>
                  <div className="text-center">
                    <svg className="w-8 h-8 mx-auto mb-2 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="text-2xl font-bold text-gray-900">{project.story_count || 0}</div>
                    <div className="text-sm text-gray-600">Stories</div>
                  </div>
                  <div className="text-center">
                    <svg className="w-8 h-8 mx-auto mb-2 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <div className="text-2xl font-bold text-gray-900">{project.member_count || 0}</div>
                    <div className="text-sm text-gray-600">Members</div>
                  </div>
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

            <EnhancedCard id="member-management">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Member Management</h2>
                </div>

                {/* Invitation Manager */}
                <div className="mb-6">
                  <InvitationManager projectId={projectId} />
                </div>

                <div className="border-t pt-6 mb-4">
                  <h3 className="font-medium text-gray-900 mb-4">Current Members</h3>
                </div>

                <div className="space-y-3">
                  {project.members && project.members.length > 0 ? (
                    project.members.map((member) => {
                      const isOwner = member.user_id === user.id;
                      const memberName = isOwner ? 'You (Owner)' : `User ${member.user_id.substring(0, 8)}`;
                      const memberEmail = isOwner ? 'current@example.com' : `user${member.user_id.substring(0, 4)}@example.com`;
                      
                      return (
                        <div
                          key={member.id}
                          className={`flex items-center justify-between p-4 rounded-lg border ${
                            isOwner ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className={isOwner ? 'bg-amber-200 text-amber-800' : 'bg-sage-200 text-sage-800'}>
                                {memberName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{memberName}</span>
                                {isOwner && <Crown className="h-4 w-4 text-amber-500" />}
                                {member.status === 'pending' && (
                                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                              </div>
                              <div className="text-sm text-gray-600">
                                {memberEmail}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Role: {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={
                              member.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : member.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }>
                              {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                            </Badge>
                            {!isOwner && (
                              <>
                                <Select defaultValue={member.role}>
                                  <SelectTrigger className="w-32 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="facilitator">Facilitator</SelectItem>
                                    <SelectItem value="storyteller">Storyteller</SelectItem>
                                  </SelectContent>
                                </Select>
                                {project.is_owner && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <EnhancedButton variant="destructive" size="sm" className="h-8 w-8 p-0">
                                        <Trash2 className="h-4 w-4" />
                                      </EnhancedButton>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to remove this member from the project? This action cannot be undone.
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
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="font-medium">No members yet</p>
                      <p className="text-sm mt-1">Invite someone to get started!</p>
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
