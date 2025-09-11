import { useMemo } from 'react'
import { 
  UserRole, 
  UserPermissions, 
  calculateUserPermissions, 
  canUserPerformAction 
} from '@saga/shared'

interface UsePermissionsProps {
  userRole?: UserRole
  isProjectOwner?: boolean
  projectId?: string
  userId?: string
}

interface UsePermissionsReturn {
  permissions: UserPermissions
  canPerform: (action: keyof UserPermissions) => boolean
  hasRole: (role: UserRole) => boolean
  isOwner: boolean
  isFacilitator: boolean
  isStoryteller: boolean
}

/**
 * Hook to manage user permissions within a project context
 */
export function usePermissions({
  userRole,
  isProjectOwner = false,
  projectId,
  userId
}: UsePermissionsProps): UsePermissionsReturn {
  
  const permissions = useMemo(() => {
    if (!userRole) {
      // Return empty permissions if no role is provided
      return calculateUserPermissions('storyteller', false) // Default to most restrictive
    }
    
    return calculateUserPermissions(userRole, isProjectOwner)
  }, [userRole, isProjectOwner])

  const canPerform = useMemo(() => {
    return (action: keyof UserPermissions) => {
      if (!userRole) return false
      return canUserPerformAction(action, userRole, isProjectOwner)
    }
  }, [userRole, isProjectOwner])

  const hasRole = useMemo(() => {
    return (role: UserRole) => userRole === role
  }, [userRole])

  return {
    permissions,
    canPerform,
    hasRole,
    isOwner: isProjectOwner,
    isFacilitator: userRole === 'facilitator',
    isStoryteller: userRole === 'storyteller',
  }
}

/**
 * Hook to check specific permissions for UI components
 */
export function usePermissionCheck(
  action: keyof UserPermissions,
  userRole?: UserRole,
  isProjectOwner: boolean = false
): boolean {
  return useMemo(() => {
    if (!userRole) return false
    return canUserPerformAction(action, userRole, isProjectOwner)
  }, [action, userRole, isProjectOwner])
}

/**
 * Hook for role-based conditional rendering
 */
export function useRoleAccess(
  allowedRoles: UserRole[],
  userRole?: UserRole,
  isProjectOwner: boolean = false
): boolean {
  return useMemo(() => {
    if (!userRole) return false
    if (isProjectOwner) return true // Project owners have access to everything
    return allowedRoles.includes(userRole)
  }, [allowedRoles, userRole, isProjectOwner])
}
