import * as React from "react"
import { cn } from "@/lib/utils"
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader } from "./enhanced-card"
import { EnhancedButton } from "./enhanced-button"
import { Users, Calendar, BookOpen, Settings, Play, MoreHorizontal } from "lucide-react"
import Image from "next/image"

interface ProjectMember {
  id: string
  name: string
  avatar?: string
  role: 'owner' | 'facilitator' | 'storyteller'
  status?: 'active' | 'pending' | 'inactive'
}

interface ProjectCardProps {
  id: string
  title: string
  description?: string
  createdAt: string
  storyCount: number
  members: ProjectMember[]
  status: 'active' | 'completed' | 'archived'
  isOwner?: boolean
  className?: string
  onEnter?: () => void
  onManage?: () => void
  onMore?: () => void
}

const statusConfig = {
  active: {
    label: "进行中",
    className: "bg-success/10 text-success border-success/20"
  },
  completed: {
    label: "已完成", 
    className: "bg-info/10 text-info border-info/20"
  },
  archived: {
    label: "已归档",
    className: "bg-muted text-muted-foreground border-border"
  }
}

const roleConfig = {
  owner: { label: "所有者", color: "text-primary" },
  facilitator: { label: "协助者", color: "text-secondary" },
  storyteller: { label: "讲述者", color: "text-info" }
}

export function ProjectCard({
  id,
  title,
  description,
  createdAt,
  storyCount,
  members,
  status,
  isOwner = false,
  className,
  onEnter,
  onManage,
  onMore
}: ProjectCardProps) {
  const statusStyle = statusConfig[status]
  
  return (
    <EnhancedCard 
      variant="interactive" 
      className={cn(
        "group hover:shadow-lg transition-all duration-300",
        className
      )}
    >
      <EnhancedCardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {title}
              </h3>
              <span className={cn(
                "px-2 py-1 rounded-full text-xs font-medium border",
                statusStyle.className
              )}>
                {statusStyle.label}
              </span>
            </div>
            
            {description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {description}
              </p>
            )}
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{createdAt}</span>
              </div>
              <div className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                <span>{storyCount} 个故事</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{members.length} 位成员</span>
              </div>
            </div>
          </div>
          
          <EnhancedButton
            variant="ghost"
            size="icon"
            onClick={onMore}
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </EnhancedButton>
        </div>
      </EnhancedCardHeader>

      <EnhancedCardContent className="pt-0">
        {/* Members */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {members.slice(0, 4).map((member, index) => (
                <div
                  key={member.id}
                  className="relative"
                  title={`${member.name} (${roleConfig[member.role].label})`}
                >
                  {member.avatar ? (
                    <Image
                      src={member.avatar}
                      alt={member.name}
                      width={32}
                      height={32}
                      className="rounded-full border-2 border-background"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full border-2 border-background bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {member.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  {member.status === 'pending' && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-warning rounded-full border border-background" />
                  )}
                </div>
              ))}
              {members.length > 4 && (
                <div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center">
                  <span className="text-xs font-medium text-muted-foreground">
                    +{members.length - 4}
                  </span>
                </div>
              )}
            </div>
            
            {members.length > 0 && (
              <div className="ml-3 text-xs text-muted-foreground">
                {isOwner ? "你拥有的项目" : "你参与的项目"}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <EnhancedButton
            variant="default"
            size="sm"
            onClick={onEnter}
            className="flex-1"
            leftIcon={<Play className="h-3 w-3" />}
          >
            进入项目
          </EnhancedButton>
          
          {isOwner && (
            <EnhancedButton
              variant="outline"
              size="sm"
              onClick={onManage}
              leftIcon={<Settings className="h-3 w-3" />}
            >
              管理
            </EnhancedButton>
          )}
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  )
}