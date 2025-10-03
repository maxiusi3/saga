'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard } from '@/components/ui/enhanced-card'
import { ModernSwitch } from '@/components/ui/modern-switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { ArrowLeft, UserPlus, Trash2, Download, Share, RefreshCw, Users, Crown, Shield, Calendar, FileText, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

// Mock data for the project management page
const mockProject = {
  id: '1',
  title: "Grandma's Memoir",
  description: 'Recording grandma\'s precious memories and family stories',
  created_at: '2024-01-15T10:00:00Z',
  is_owner: true,
  members: [
    {
      id: '1',
      user_id: 'user1',
      role: 'facilitator' as const,
      status: 'active',
      name: 'John Smith',
      email: 'john@example.com'
    },
    {
      id: '2', 
      user_id: 'user2',
      role: 'storyteller' as const,
      status: 'active',
      name: 'Aunt Mary',
      email: 'mary@example.com'
    },
    {
      id: '3',
      user_id: 'user3', 
      role: 'co_facilitator' as const,
      status: 'pending',
      name: 'Uncle Bob',
      email: 'bob@example.com'
    }
  ]
}

const mockUser = {
  id: 'current-user',
  email: 'current@example.com'
}

export default function ProjectSettingsPage() {
  const params = useParams()
  const projectId = params.id as string
  
  const [projectTitle, setProjectTitle] = useState(mockProject.title)
  const [projectDescription, setProjectDescription] = useState(mockProject.description)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'storyteller' | 'co_facilitator' | 'facilitator'>('storyteller')
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)

  const handleSaveProjectDetails = async () => {
    setSaving(true)
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaving(false)
    console.log('Project updated:', { title: projectTitle, description: projectDescription })
  }

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return
    
    setInviting(true)
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setInviting(false)
    setInviteEmail('')
    console.log('Member invited:', { email: inviteEmail, role: inviteRole })
  }

  const handleRemoveMember = async (memberId: string) => {
    console.log('Removing member:', memberId)
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    console.log('Updating role:', { memberId, newRole })
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  const handleExportArchive = async () => {
    setSaving(true)
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    setSaving(false)
    console.log('Archive exported')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/dashboard/projects/${projectId}`}>
            <EnhancedButton variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </EnhancedButton>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Project Management</h1>
            <p className="text-gray-600 mt-1">{mockProject.title}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <EnhancedCard>
              <div className="p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <EnhancedButton variant="secondary" size="sm" className="w-full justify-start">
                    <Users className="w-4 h-4 mr-2" />
                    Invite Members
                  </EnhancedButton>
                  <EnhancedButton variant="secondary" size="sm" className="w-full justify-start">
                    <Download className="w-4 h-4 mr-2" />
                    Export Data
                  </EnhancedButton>
                  <EnhancedButton variant="secondary" size="sm" className="w-full justify-start">
                    <Share className="w-4 h-4 mr-2" />
                    Share Project
                  </EnhancedButton>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-3">Project Stats</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created</span>
                      <span className="text-gray-900">{new Date(mockProject.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stories</span>
                      <span className="text-gray-900">12</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Members</span>
                      <span className="text-gray-900">{mockProject.members.length + 1}</span>
                    </div>
                  </div>
                </div>
              </div>
            </EnhancedCard>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Project Overview */}
            <EnhancedCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Project Overview</h2>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="text-center p-4 bg-sage-50 rounded-lg">
                    <Calendar className="w-8 h-8 text-sage-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900">{new Date(mockProject.created_at).toLocaleDateString()}</div>
                    <div className="text-sm text-gray-600">Created</div>
                  </div>
                  <div className="text-center p-4 bg-sage-50 rounded-lg">
                    <FileText className="w-8 h-8 text-sage-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900">12</div>
                    <div className="text-sm text-gray-600">Stories</div>
                  </div>
                  <div className="text-center p-4 bg-sage-50 rounded-lg">
                    <Users className="w-8 h-8 text-sage-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900">{mockProject.members.length + 1}</div>
                    <div className="text-sm text-gray-600">Members</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="project-title" className="text-sm font-medium text-gray-700">Project Name</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="project-title"
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
                        className="flex-1"
                      />
                      <EnhancedButton
                        onClick={handleSaveProjectDetails}
                        disabled={saving || (projectTitle.trim() === mockProject.title && projectDescription.trim() === mockProject.description)}
                        size="sm"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </EnhancedButton>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-sm font-medium text-gray-700">Project Description</Label>
                    <Textarea
                      id="description"
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="Add a description for your project..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </EnhancedCard>

            {/* Member Management */}
            <EnhancedCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Member Management</h2>
                  <EnhancedButton size="sm">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Member
                  </EnhancedButton>
                </div>

                {/* Invite Form */}
                <div className="bg-sage-50 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-gray-900 mb-3">Invite New Member</h3>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
                    >
                      <option value="storyteller">Storyteller</option>
                      <option value="co_facilitator">Co-Facilitator</option>
                      <option value="facilitator">Facilitator</option>
                    </select>
                    <EnhancedButton
                      onClick={handleInviteMember}
                      disabled={inviting || !inviteEmail.trim()}
                      size="sm"
                    >
                      {inviting ? 'Inviting...' : 'Send Invite'}
                    </EnhancedButton>
                  </div>
                </div>

                {/* Members List */}
                <div className="space-y-4">
                  {/* Project Owner */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-amber-100 text-amber-700">
                          You
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          You (Owner)
                          <Crown className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="text-sm text-gray-600">{mockUser.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-amber-100 text-amber-800">Owner</Badge>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                  </div>

                  {/* Project Members */}
                  {mockProject.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-sage-100 text-sage-700">
                            {member.name?.charAt(0) || 'M'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            {member.name}
                            {member.role === 'facilitator' && <Shield className="w-4 h-4 text-blue-500" />}
                            {member.role === 'storyteller' && <Users className="w-4 h-4 text-green-500" />}
                          </div>
                          <div className="text-sm text-gray-600">Role: {
                            member.role === 'facilitator' ? 'Facilitator' :
                            member.role === 'co_facilitator' ? 'Co-Facilitator' :
                            member.role === 'storyteller' ? 'Storyteller' : member.role
                          }</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge className={
                          member.role === 'facilitator' ? 'bg-blue-100 text-blue-800' :
                          member.role === 'co_facilitator' ? 'bg-purple-100 text-purple-800' :
                          'bg-green-100 text-green-800'
                        }>
                          {member.role === 'facilitator' ? 'Facilitator' :
                           member.role === 'co_facilitator' ? 'Co-Facilitator' :
                           'Storyteller'}
                        </Badge>
                        <Badge className={
                          member.status === 'active' ? 'bg-green-100 text-green-800' :
                          member.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }>
                          {member.status === 'active' ? 'Active' :
                           member.status === 'pending' ? 'Pending' :
                           member.status}
                        </Badge>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {member.status === 'active' && (
                            <select
                              value={member.role}
                              onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                              className="text-xs px-2 py-1 border border-gray-300 rounded"
                            >
                              <option value="storyteller">Storyteller</option>
                              <option value="co_facilitator">Co-Facilitator</option>
                              <option value="facilitator">Facilitator</option>
                            </select>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <EnhancedButton variant="destructive" size="sm">
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
                                <AlertDialogAction
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="bg-red-600 text-white hover:bg-red-700"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </EnhancedCard>

            {/* Project Settings */}
            <EnhancedCard>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Project Settings</h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Project Visibility</p>
                      <p className="text-sm text-gray-600">Control who can view this project</p>
                    </div>
                    <ModernSwitch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Allow Comments</p>
                      <p className="text-sm text-gray-600">Members can comment on stories</p>
                    </div>
                    <ModernSwitch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Auto Transcription</p>
                      <p className="text-sm text-gray-600">Automatically convert audio to text</p>
                    </div>
                    <ModernSwitch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Email Notifications</p>
                      <p className="text-sm text-gray-600">Send email notifications for new stories</p>
                    </div>
                    <ModernSwitch />
                  </div>
                </div>
              </div>
            </EnhancedCard>

            {/* Data Management */}
            <EnhancedCard>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Data Management</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-sage-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Export Complete Archive</p>
                      <p className="text-sm text-gray-600">Download all stories, transcripts and media files</p>
                    </div>
                    <EnhancedButton
                      variant="secondary"
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
                    </EnhancedButton>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Share Project</p>
                      <p className="text-sm text-gray-600">Generate sharing link for family members</p>
                    </div>
                    <EnhancedButton variant="secondary">
                      <Share className="h-4 w-4 mr-2" />
                      Share
                    </EnhancedButton>
                  </div>
                </div>
              </div>
            </EnhancedCard>

            {/* Danger Zone */}
            <EnhancedCard>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-red-600 mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </h2>
                
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-900">Transfer Project Ownership</p>
                        <p className="text-sm text-red-700">Transfer project ownership to another member</p>
                      </div>
                      <EnhancedButton variant="destructive" size="sm">
                        Transfer Ownership
                      </EnhancedButton>
                    </div>
                  </div>

                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-900">Delete Project</p>
                        <p className="text-sm text-red-700">Permanently delete this project and all related data</p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <EnhancedButton variant="destructive" size="sm">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Project
                          </EnhancedButton>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Project</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will permanently delete the project and all related data, including stories, comments and media files. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700">
                              Confirm Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
            </EnhancedCard>
          </div>
        </div>
      </div>
    </div>
  )
}