'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { ArrowLeft, UserPlus, Trash2, Download, Share } from 'lucide-react'
import Link from 'next/link'

interface ProjectMember {
  id: string
  name: string
  email: string
  role: 'facilitator' | 'storyteller' | 'co_facilitator'
  avatar?: string
  status: 'active' | 'invited' | 'expired'
}

interface Project {
  id: string
  title: string
  created_at: string
  members: ProjectMember[]
}

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  
  const [project, setProject] = useState<Project | null>(null)
  const [projectTitle, setProjectTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadProject = async () => {
      // Mock data - replace with actual Supabase queries
      const mockProject: Project = {
        id: projectId,
        title: "Dad's Life Story",
        created_at: '2024-01-15T10:30:00Z',
        members: [
          {
            id: '1',
            name: 'Alex Smith',
            email: 'alex@example.com',
            role: 'facilitator',
            avatar: '',
            status: 'active'
          },
          {
            id: '2',
            name: 'John Doe',
            email: 'john@example.com',
            role: 'storyteller',
            avatar: '',
            status: 'active'
          },
          {
            id: '3',
            name: 'Beth Smith',
            email: 'beth@example.com',
            role: 'co_facilitator',
            avatar: '',
            status: 'active'
          }
        ]
      }

      setTimeout(() => {
        setProject(mockProject)
        setProjectTitle(mockProject.title)
        setLoading(false)
      }, 1000)
    }

    loadProject()
  }, [projectId])

  const handleSaveTitle = async () => {
    if (!project || projectTitle.trim() === project.title) return

    setSaving(true)
    try {
      // TODO: Update project title in Supabase
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setProject({ ...project, title: projectTitle })
    } catch (error) {
      console.error('Error updating project title:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleInviteFacilitator = async () => {
    // TODO: Check for available facilitator seats and open invitation flow
    alert('Invite facilitator functionality coming soon')
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!project) return

    try {
      // TODO: Remove member from project in Supabase
      const updatedMembers = project.members.filter(m => m.id !== memberId)
      setProject({ ...project, members: updatedMembers })
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  const handleExportArchive = async () => {
    // TODO: Generate and download full project archive
    alert('Export functionality coming soon')
  }

  const getRoleBadge = (role: ProjectMember['role']) => {
    switch (role) {
      case 'facilitator':
        return <Badge variant="default" className="bg-furbridge-orange text-white">Facilitator</Badge>
      case 'storyteller':
        return <Badge variant="secondary">Storyteller</Badge>
      case 'co_facilitator':
        return <Badge variant="outline">Co-Facilitator</Badge>
    }
  }

  const getStatusBadge = (status: ProjectMember['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-furbridge-teal text-white">Active</Badge>
      case 'invited':
        return <Badge variant="outline">Invited</Badge>
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 bg-gray-100 rounded animate-pulse"></div>
          <div className="h-8 w-64 bg-gray-100 rounded animate-pulse"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900">Project not found</h1>
        <Link href="/dashboard">
          <FurbridgeButton variant="outline" className="mt-4">
            Back to Dashboard
          </FurbridgeButton>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link href={`/dashboard/projects/${projectId}`}>
          <FurbridgeButton variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </FurbridgeButton>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Project Settings</h1>
      </div>

      {/* Project Details */}
      <FurbridgeCard className="p-6">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Project Details</h2>
          
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
                <FurbridgeButton
                  variant="outline"
                  onClick={handleSaveTitle}
                  disabled={saving || projectTitle.trim() === project.title}
                >
                  {saving ? 'Saving...' : 'Save'}
                </FurbridgeButton>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              Created on {new Date(project.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </FurbridgeCard>

      {/* Members Management */}
      <FurbridgeCard className="p-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Members</h2>
            <FurbridgeButton variant="outline" onClick={handleInviteFacilitator}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Co-Facilitator
            </FurbridgeButton>
          </div>

          <div className="space-y-4">
            {project.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback>
                      {member.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-gray-900">{member.name}</div>
                    <div className="text-sm text-gray-600">{member.email}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {getRoleBadge(member.role)}
                  {getStatusBadge(member.status)}
                  
                  {member.role !== 'facilitator' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <FurbridgeButton variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </FurbridgeButton>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Member</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {member.name} from this project? 
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
      </FurbridgeCard>

      {/* Data Management */}
      <FurbridgeCard className="p-6">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Data Management</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 border border-gray-200 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">Export Full Archive</div>
                <div className="text-sm text-gray-600">
                  Download all stories, transcripts, and media files
                </div>
              </div>
              <FurbridgeButton variant="outline" onClick={handleExportArchive}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </FurbridgeButton>
            </div>
          </div>
        </div>
      </FurbridgeCard>
    </div>
  )
}
