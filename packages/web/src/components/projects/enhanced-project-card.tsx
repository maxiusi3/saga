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
  ArrowRight,
  TrendingUp,
  Activity,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'

interface ProjectMember {
  id: string
  name: string
  avatar?: string
  role: 'facilitator' | 'storyteller' | 'admin'
  lastActive?: string
}

interface ProjectStats {
  totalStories: number
  totalMembers: number
  lastActivity?: string
  pendingFollowups?: number
  weeklyActivity?: number
  completionRate?: number
}

interface EnhancedProjectCardProps {
  id: string
  name: string
  description?: string
  status: 'active' | 'archived' | 'planning'
  members: ProjectMember[]
  stats: ProjectStats
  userRole: 'facilitator' | 'storyteller' | 'admin'
  isOwner?: boolean
  createdAt: string
  onEnterProject?: () => void
  onManageProject?: () => void
  onArchiveProject?: () => void
}

export function EnhancedProjectCard({
  id,
  name,
  description,
  status,
  members,
  stats,
  userRole,
  isOwner = false,
  createdAt,
  onEnterProject,
  onManageProject,
  onArchiveProject
}: EnhancedProjectCardProps) {
  const displayMembers = members.slice(0, 4)
  const remainingMembers = Math.max(0, members.length - 4)

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

  const formatCreatedDate = (createdAt: string) => {
    return new Date(createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getActivityTrend = () => {
    if (!stats.weeklyActivity) return null
    
    if (stats.weeklyActivity > 5) {
      return { icon: <TrendingUp className="w-3 h-3 text-success" />, label: 'High activity', color: 'text-success' }
    } else if (stats.weeklyActivity > 2) {
      return { icon: <Activity className="w-3 h-3 text-warning" />, label: 'Moderate activity', color: 'text-warning' }
    } else {
      return { icon: <Clock className="w-3 h-3 text-muted-foreground" />, label: 'Low activity', color: 'text-muted-foreground' }
    }
  }

  const activityTrend = getActivityTrend()

  return (
    <Card 
      variant="action" 
      className="group hover:shadow-lg transition-all duration-200 hover:border-primary/30 h-full flex flex-col"
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
            
            {/* Creation Date */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
              <Calendar className="w-3 h-3" />
              <span>Created {formatCreatedDate(createdAt)}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <StatusBadge status={status} size="sm" />
            <RoleBadge role={userRole} size="sm" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="py-4 flex-1">
        {/* Enhanced Statistics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            <div>
              <span className="text-sm font-medium text-foreground">
                {stats.totalStories}
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                {stats.totalStories === 1 ? 'Story' : 'Stories'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <div>
              <span className="text-sm font-medium text-foreground">
                {stats.totalMembers}
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                {stats.totalMembers === 1 ? 'Member' : 'Members'}
              </span>
            </div>
          </div>
        </div>

        {/* Activity Trend */}
        {activityTrend && (
          <div className="flex items-center gap-2 mb-4 p-2 bg-muted/30 rounded-lg">
            {activityTrend.icon}
            <span className={`text-xs font-medium ${activityTrend.color}`}>
              {activityTrend.label}
            </span>
            {stats.weeklyActivity && (
              <span className="text-xs text-muted-foreground">
                ({stats.weeklyActivity} this week)
              </span>
            )}
          </div>
        )}

        {/* Member Avatars with Last Active Info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {displayMembers.map((member) => (
                <div key={member.id} className="relative">
                  <Avatar size="sm" className="border-2 border-background">
                    <AvatarImage src={member.avatar} alt={member.name} />
                    <AvatarFallback className="text-xs">
                      {member.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {/* Active indicator for recently active members */}
                  {member.lastActive && new Date(member.lastActive).getTime() > Date.now() - 24 * 60 * 60 * 1000 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-background" />
                  )}
                </div>
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

          {/* Pending Notifications with Enhanced Info */}
          {stats.pendingFollowups && stats.pendingFollowups > 0 && (
            <div className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-warning" />
              <Badge variant="warning" size="sm">
                {stats.pendingFollowups} pending
              </Badge>
            </div>
          )}
        </div>

        {/* Last Activity with Enhanced Timestamp */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span>{formatLastActivity(stats.lastActivity)}</span>
          </div>
          
          {/* Completion Rate */}
          {stats.completionRate !== undefined && (
            <div className="flex items-center gap-1">
              <span>{Math.round(stats.completionRate)}% complete</span>
            </div>
          )}
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
            <Link href={`/dashboard/projects/${id}`}>
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
                <Link href={`/dashboard/projects/${id}/settings`}>
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