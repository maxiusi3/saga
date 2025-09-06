'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { formatRelativeTime } from '@/lib/utils'
import { apiClient } from '@/lib/api'

interface ProjectMember {
  id: string
  userId: string
  role: 'facilitator' | 'storyteller'
  userName: string
  userEmail: string
  joinedAt: string
  lastActive?: string
}

interface ProjectMembersPanelProps {
  projectId: string
  currentUserId: string
  isProjectOwner: boolean
}

export function ProjectMembersPanel({ 
  projectId, 
  currentUserId, 
  isProjectOwner 
}: ProjectMembersPanelProps) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [removingMember, setRemovingMember] = useState<string | null>(null)

  useEffect(() => {
    fetchProjectMembers()
  }, [projectId])

  const fetchProjectMembers = async () => {
    try {
      setIsLoading(true)
      const members = await apiClient.projects.getMembers(projectId)
      setMembers(members)
    } catch (error) {
      console.error('Failed to fetch project members:', error)
      toast.error('Failed to load project members')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveMember = async (userId: string, memberName: string) => {
    const confirmed = confirm(
      `Are you sure you want to remove ${memberName} from this project? They will lose access to all project content.`
    )

    if (!confirmed) return

    try {
      setRemovingMember(userId)
      await apiClient.projects.removeMember(projectId, userId)
      setMembers(prev => prev.filter(member => member.userId !== userId))
      toast.success(`${memberName} has been removed from the project`)
    } catch (error) {
      console.error('Failed to remove member:', error)
      toast.error('Failed to remove member')
    } finally {
      setRemovingMember(null)
    }
  }

  const getRoleIcon = (role: string) => {
    if (role === 'facilitator') {
      return (
        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )
    } else {
      return (
        <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>
      )
    }
  }

  const getRoleBadge = (role: string) => {
    if (role === 'facilitator') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
          Facilitator
        </span>
      )
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary-foreground">
          Storyteller
        </span>
      )
    }
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-medium text-foreground">Project Members</h2>
        </div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const facilitators = members.filter(member => member.role === 'facilitator')
  const storytellers = members.filter(member => member.role === 'storyteller')

  return (
    <div className="bg-card rounded-lg shadow">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-medium text-foreground">Project Members</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {members.length} member{members.length !== 1 ? 's' : ''} • {facilitators.length} facilitator{facilitators.length !== 1 ? 's' : ''} • {storytellers.length} storyteller{storytellers.length !== 1 ? 's' : ''}
        </p>
      </div>
      
      <div className="p-6">
        {/* Facilitators Section */}
        {facilitators.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-foreground mb-3">
              Facilitators ({facilitators.length})
            </h3>
            <div className="space-y-3">
              {facilitators.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getRoleIcon(member.role)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-foreground">
                          {member.userName}
                          {member.userId === currentUserId && (
                            <span className="text-xs text-muted-foreground ml-1">(You)</span>
                          )}
                        </p>
                        {getRoleBadge(member.role)}
                      </div>
                      <p className="text-xs text-muted-foreground">{member.userEmail}</p>
                      <p className="text-xs text-muted-foreground/80">
                        Joined {formatRelativeTime(member.joinedAt)}
                        {member.lastActive && (
                          <span> • Active {formatRelativeTime(member.lastActive)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  {isProjectOwner && member.userId !== currentUserId && (
                    <button
                      onClick={() => handleRemoveMember(member.userId, member.userName)}
                      disabled={removingMember === member.userId}
                      className="text-destructive hover:text-destructive/80 text-sm font-medium disabled:opacity-50"
                    >
                      {removingMember === member.userId ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Storytellers Section */}
        {storytellers.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">
              Storytellers ({storytellers.length})
            </h3>
            <div className="space-y-3">
              {storytellers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getRoleIcon(member.role)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-foreground">
                          {member.userName}
                        </p>
                        {getRoleBadge(member.role)}
                      </div>
                      <p className="text-xs text-muted-foreground">{member.userEmail}</p>
                      <p className="text-xs text-muted-foreground/80">
                        Joined {formatRelativeTime(member.joinedAt)}
                        {member.lastActive && (
                          <span> • Active {formatRelativeTime(member.lastActive)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  {isProjectOwner && (
                    <button
                      onClick={() => handleRemoveMember(member.userId, member.userName)}
                      disabled={removingMember === member.userId}
                      className="text-destructive hover:text-destructive/80 text-sm font-medium disabled:opacity-50"
                    >
                      {removingMember === member.userId ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {members.length === 0 && (
          <div className="text-center py-6">
            <svg className="mx-auto h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <p className="mt-2 text-sm text-muted-foreground">No members found</p>
          </div>
        )}
      </div>
    </div>
  )
}