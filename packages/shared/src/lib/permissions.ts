export type UserRole = 'facilitator' | 'storyteller'
export type MemberStatus = 'pending' | 'active' | 'declined' | 'removed'

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: UserRole
  status: MemberStatus
  invited_by?: string
  invited_at: string
  joined_at?: string
  created_at: string
  updated_at: string
}

export interface UserPermissions {
  // Project-level permissions
  canEditProjectSettings: boolean
  canInviteMembers: boolean
  canRemoveMembers: boolean
  canDeleteProject: boolean
  
  // Story-level permissions
  canCreateStories: boolean
  canEditStoryTitles: boolean
  canEditStoryTranscripts: boolean
  canDeleteStories: boolean
  canViewAllStories: boolean
  
  // Comment and interaction permissions
  canAddComments: boolean
  canAskFollowUpQuestions: boolean
  canViewComments: boolean
  
  // AI content permissions
  canEditAIContent: boolean
  canViewAIContent: boolean
}

/**
 * Calculate user permissions based on their role in a project
 */
export function calculateUserPermissions(
  userRole: UserRole,
  isProjectOwner: boolean = false
): UserPermissions {
  // 基于用户的实际角色计算权限，项目所有者额外获得管理权限
  let basePermissions: UserPermissions

  switch (userRole) {
    case 'facilitator':
      basePermissions = {
        canEditProjectSettings: true,
        canInviteMembers: true,
        canRemoveMembers: true,
        canDeleteProject: false, // Only project owner can delete
        canCreateStories: false,
        canEditStoryTitles: false, // Cannot edit story titles (only owner can)
        canEditStoryTranscripts: false, // Cannot edit transcripts (only owner can)
        canDeleteStories: true,
        canViewAllStories: true,
        canAddComments: true,
        canAskFollowUpQuestions: true,
        canViewComments: true,
        canEditAIContent: true,
        canViewAIContent: true,
      }
      break



    case 'storyteller':
      basePermissions = {
        canEditProjectSettings: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canDeleteProject: false,
        canCreateStories: true, // Primary function - can record stories
        canEditStoryTitles: true, // Can edit their own story titles
        canEditStoryTranscripts: true, // Can edit transcripts
        canDeleteStories: false,
        canViewAllStories: true, // Can view all stories in the project
        canAddComments: true, // Can add comments
        canAskFollowUpQuestions: false, // Cannot ask follow-up questions
        canViewComments: true,
        canEditAIContent: false,
        canViewAIContent: true, // Can view AI-generated content for their stories
      }
      break

    default:
      // No permissions for unknown roles
      basePermissions = {
        canEditProjectSettings: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canDeleteProject: false,
        canCreateStories: false,
        canEditStoryTitles: false,
        canEditStoryTranscripts: false,
        canDeleteStories: false,
        canViewAllStories: false,
        canAddComments: false,
        canAskFollowUpQuestions: false,
        canViewComments: false,
        canEditAIContent: false,
        canViewAIContent: false,
      }
      break
  }

  // 如果是项目所有者，额外获得管理权限
  if (isProjectOwner) {
    const ownerPermissions = {
      ...basePermissions,
      canEditProjectSettings: true,
      canInviteMembers: true,
      canRemoveMembers: true,
      canDeleteProject: true,
      canEditStoryTitles: true, // Owner can always edit story titles
      canEditStoryTranscripts: true, // Owner can always edit transcripts
      canDeleteStories: true,
      canViewAllStories: true,
      canAddComments: true,
      canAskFollowUpQuestions: userRole === 'storyteller' ? false : true, // Storyteller owner still can't ask follow-ups
      canViewComments: true,
      canEditAIContent: true,
      canViewAIContent: true,
    }

    return ownerPermissions
  }

  return basePermissions
}

/**
 * Check if a user can perform a specific action
 */
export function canUserPerformAction(
  action: keyof UserPermissions,
  userRole: UserRole,
  isProjectOwner: boolean = false
): boolean {
  const permissions = calculateUserPermissions(userRole, isProjectOwner)
  return permissions[action]
}

/**
 * Get role display information
 */
export function getRoleDisplayInfo(role: UserRole) {
  switch (role) {
    case 'facilitator':
      return {
        label: 'Facilitator',
        description: 'Can manage project settings and edit all content',
        color: 'bg-primary text-primary-foreground',
        icon: '👑'
      }

    case 'storyteller':
      return {
        label: 'Storyteller',
        description: 'Can record stories and respond to comments',
        color: 'bg-accent text-accent-foreground',
        icon: '🎙️'
      }
    default:
      return {
        label: 'Unknown',
        description: 'Unknown role',
        color: 'bg-muted text-muted-foreground',
        icon: '❓'
      }
  }
}

/**
 * Validate role transitions (for role changes)
 */
export function canChangeRole(
  fromRole: UserRole,
  toRole: UserRole,
  changerRole: UserRole,
  isChangerProjectOwner: boolean
): boolean {
  // Only facilitators and project owners can change roles
  if (changerRole !== 'facilitator' && !isChangerProjectOwner) {
    return false
  }

  // Cannot change project owner role (would need to transfer ownership)
  if (fromRole === 'facilitator' && isChangerProjectOwner) {
    return false
  }

  // All other role changes are allowed for facilitators
  return true
}
