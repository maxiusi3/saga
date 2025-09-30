'use client'

import React from 'react'
import { ProjectCard } from '@/components/dashboard/project-card'

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

interface Project {
  id: string
  name: string
  description?: string
  status: 'active' | 'archived' | 'planning'
  members: ProjectMember[]
  stats: ProjectStats
  userRole: 'facilitator' | 'storyteller' | 'admin'
  isOwner?: boolean
}

interface ProjectGridProps {
  projects: Project[]
  onEnterProject?: (projectId: string) => void
  onManageProject?: (projectId: string) => void
  onArchiveProject?: (projectId: string) => void
  className?: string
}

export function ProjectGrid({
  projects,
  onEnterProject,
  onManageProject,
  onArchiveProject,
  className = ''
}: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className={`text-center py-16 ${className}`}>
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-h2 text-foreground">No Projects Yet</h2>
          <p className="text-muted-foreground">
            Create your first family biography project to start preserving your stories.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      {/* Responsive Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            id={project.id}
            name={project.name}
            description={project.description}
            status={project.status}
            members={project.members}
            stats={project.stats}
            userRole={project.userRole}
            isOwner={project.isOwner}
            onEnterProject={() => onEnterProject?.(project.id)}
            onManageProject={() => onManageProject?.(project.id)}
            onArchiveProject={() => onArchiveProject?.(project.id)}
          />
        ))}
      </div>

      {/* Grid Layout Info for Development */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          Showing {projects.length} {projects.length === 1 ? 'project' : 'projects'}
        </p>
      </div>
    </div>
  )
}

// Responsive breakpoint utilities for consistent grid behavior
export const gridBreakpoints = {
  sm: 'grid-cols-1',           // Mobile: 1 column
  md: 'md:grid-cols-2',        // Tablet: 2 columns
  lg: 'lg:grid-cols-3',        // Desktop: 3 columns
  xl: 'xl:grid-cols-4',        // Large Desktop: 4 columns
  '2xl': '2xl:grid-cols-5'     // Extra Large: 5 columns (optional)
}

// Grid spacing utilities
export const gridSpacing = {
  tight: 'gap-4',
  default: 'gap-6',
  loose: 'gap-8'
}