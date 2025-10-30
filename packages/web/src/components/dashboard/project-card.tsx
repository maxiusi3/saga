'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge, RoleBadge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Users, 
  MessageCircle, 
  Calendar, 
  Settings, 
  Archive,
  Crown,
  Clock,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { useLocale } from 'next-intl'

interface ProjectMember {
  id: string
  name: string
  avatar?: string
  role: 'facilitator' | 'storyteller' | 'admin'
}

interface ProjectStats {
  totalStories: number
  totalMembers: number
  lastActivity?: string
  pendingFollowups?: number
}

interface ProjectCardProps {
  id: string
  name: string
  description?: string
  status: 'active' | 'archived' | 'planning'
  members: ProjectMember[]
  stats: ProjectStats
  userRole: 'facilitator' | 'storyteller' | 'admin'
  isOwner?: boolean
  onEnterProject?: () => void
  onManageProject?: () => void
  onArchiveProject?: () => void
}

export function ProjectCard({
  id,
  name,
  description,
  status,
  members,
  stats,
  userRole,
  isOwner = false,
  onEnterProject,
  onManageProject,
  onArchiveProject
}: ProjectCardProps) {
  const locale = useLocale()
  const withLocale = (path: string) => {
    if (!path || typeof path !== 'string') return path as any
    if (!path.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }
  const displayMembers = members.slice(0, 4) // Show max 4 avatars
  const remainingMembers = Math.max(0, members.length - 4)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'archived': return 'neutral'
      case 'planning': return 'warning'
      default: return 'neutral'
    }
  }

  const formatLastActivity = (lastActivity?: string) => {
    if (!lastActivity) return 'No recent activity'
    
    const date = new Date(lastActivity)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Active now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return date.toLocaleDateString()
  }

  return (
    <Card 
      variant="action" 
      className="group hover:shadow-lg transition-all duration-200 hover:border-primary/30"
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg truncate">{name}</CardTitle>
              {isOwner && (
                <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={status} size="sm" />
            <RoleBadge role={userRole} size="sm" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="py-4">
        {/* Project Statistics */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              {stats.totalStories} {stats.totalStories === 1 ? 'Story' : 'Stories'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-muted-foreground">
              {stats.totalMembers} {stats.totalMembers === 1 ? 'Member' : 'Members'}
            </span>
          </div>
        </div>

        {/* Member Avatars */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {displayMembers.map((member) => (
                <Avatar key={member.id} size="sm" className="border-2 border-background">
                  <AvatarImage src={member.avatar} alt={member.name} />
                  <AvatarFallback className="text-xs">
                    {member.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {remainingMembers > 0 && (
                <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                  <span className="text-xs text-muted-foreground font-medium">
                    +{remainingMembers}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Pending Notifications */}
          {stats.pendingFollowups && stats.pendingFollowups > 0 && (
            <Badge variant="warning" size="sm">
              {stats.pendingFollowups} pending
            </Badge>
          )}
        </div>

        {/* Last Activity */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatLastActivity(stats.lastActivity)}</span>
        </div>
      </CardContent>

      <CardFooter className="pt-4 border-t border-border/50">
        <div className="flex items-center justify-between w-full gap-2">
          {/* Primary Action */}
          <Button 
            variant="primary" 
            size="sm" 
            className="flex-1"
            onClick={onEnterProject}
            asChild
          >
            <Link href={withLocale(`/dashboard/projects/${id}`)}>
              Enter Project
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>

          {/* Secondary Actions */}
          <div className="flex items-center gap-1">
            {(userRole === 'facilitator' || userRole === 'admin' || isOwner) && (
              <Button 
                variant="tertiary" 
                size="sm"
                onClick={onManageProject}
                asChild
              >
                <Link href={withLocale(`/dashboard/projects/${id}/settings`)}>
                  <Settings className="w-4 h-4" />
                </Link>
              </Button>
            )}

            {(userRole === 'admin' || isOwner) && status !== 'archived' && (
              <Button 
                variant="destructive-tertiary" 
                size="sm"
                onClick={onArchiveProject}
              >
                <Archive className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}