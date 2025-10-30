'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  ArrowRight,
  Settings, 
  Archive,
  MoreHorizontal,
  Loader2,
  Users,
  Download,
  Copy,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import { useLocale } from 'next-intl'

interface ProjectActionsProps {
  projectId: string
  projectName: string
  userRole: 'facilitator' | 'storyteller' | 'admin'
  isOwner?: boolean
  status: 'active' | 'archived' | 'planning'
  onEnterProject?: () => void
  onManageProject?: () => void
  onArchiveProject?: () => void
  onDeleteProject?: () => void
  onInviteMembers?: () => void
  onExportProject?: () => void
  onDuplicateProject?: () => void
  variant?: 'inline' | 'dropdown'
  size?: 'sm' | 'default' | 'lg'
}

export function ProjectActions({
  projectId,
  projectName,
  userRole,
  isOwner = false,
  status,
  onEnterProject,
  onManageProject,
  onArchiveProject,
  onDeleteProject,
  onInviteMembers,
  onExportProject,
  onDuplicateProject,
  variant = 'inline',
  size = 'sm'
}: ProjectActionsProps) {
  const locale = useLocale()
  const withLocale = (path: string) => {
    if (!path || typeof path !== 'string') return path as any
    if (!path.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }
  const [isArchiving, setIsArchiving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const canManage = userRole === 'facilitator' || userRole === 'admin' || isOwner
  const canArchive = (userRole === 'admin' || isOwner) && status !== 'archived'
  const canDelete = userRole === 'admin' || isOwner

  const handleArchive = async () => {
    setIsArchiving(true)
    try {
      await onArchiveProject?.()
    } finally {
      setIsArchiving(false)
      setShowArchiveDialog(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDeleteProject?.()
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  if (variant === 'dropdown') {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="tertiary" size={size}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEnterProject} asChild>
              <Link href={withLocale(`/dashboard/projects/${projectId}`)}>
                <ArrowRight className="w-4 h-4 mr-2" />
                Enter Project
              </Link>
            </DropdownMenuItem>
            
            {canManage && (
              <>
                <DropdownMenuItem onClick={onManageProject} asChild>
                  <Link href={withLocale(`/dashboard/projects/${projectId}/settings`)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Manage Project
                  </Link>
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={onInviteMembers}>
                  <Users className="w-4 h-4 mr-2" />
                  Invite Members
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuItem onClick={onExportProject}>
              <Download className="w-4 h-4 mr-2" />
              Export Stories
            </DropdownMenuItem>

            {canManage && (
              <DropdownMenuItem onClick={onDuplicateProject}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate Project
              </DropdownMenuItem>
            )}

            {(canArchive || canDelete) && <DropdownMenuSeparator />}

            {canArchive && (
              <DropdownMenuItem 
                onClick={() => setShowArchiveDialog(true)}
                className="text-warning"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive Project
              </DropdownMenuItem>
            )}

            {canDelete && (
              <DropdownMenuItem 
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Project
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Archive Confirmation Dialog */}
        <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to archive "{projectName}"? The project will be moved to your archived projects and members will no longer be able to add new stories.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleArchive}
                disabled={isArchiving}
                className="bg-warning hover:bg-warning/90"
              >
                {isArchiving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Archive Project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete "{projectName}"? This action cannot be undone and all stories, comments, and project data will be lost forever.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete Forever
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  // Inline variant
  return (
    <div className="flex items-center justify-between w-full gap-2">
      {/* Primary Action */}
      <Button 
        variant="primary" 
        size={size} 
        className="flex-1"
        onClick={onEnterProject}
        asChild
      >
        <Link href={withLocale(`/dashboard/projects/${projectId}`)}>
          Enter Project
          <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
      </Button>

      {/* Secondary Actions */}
      <div className="flex items-center gap-1">
        {canManage && (
          <Button 
            variant="tertiary" 
            size={size}
            onClick={onManageProject}
            asChild
          >
            <Link href={withLocale(`/dashboard/projects/${projectId}/settings`)}>
              <Settings className="w-4 h-4" />
            </Link>
          </Button>
        )}

        {canArchive && (
          <Button 
            variant="destructive-tertiary" 
            size={size}
            onClick={() => setShowArchiveDialog(true)}
            disabled={isArchiving}
          >
            {isArchiving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
          </Button>
        )}

        {/* More actions dropdown for additional options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="tertiary" size={size}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {canManage && (
              <DropdownMenuItem onClick={onInviteMembers}>
                <Users className="w-4 h-4 mr-2" />
                Invite Members
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={onExportProject}>
              <Download className="w-4 h-4 mr-2" />
              Export Stories
            </DropdownMenuItem>

            {canManage && (
              <DropdownMenuItem onClick={onDuplicateProject}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate Project
              </DropdownMenuItem>
            )}

            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Project
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{projectName}"? The project will be moved to your archived projects and members will no longer be able to add new stories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleArchive}
              disabled={isArchiving}
              className="bg-warning hover:bg-warning/90"
            >
              {isArchiving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Archive Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{projectName}"? This action cannot be undone and all stories, comments, and project data will be lost forever.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}