import React from 'react'
import { UserRole, UserPermissions } from '@saga/shared'
import { usePermissions, usePermissionCheck, useRoleAccess } from '@/hooks/usePermissions'

interface PermissionGateProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  userRole?: UserRole
  isProjectOwner?: boolean
}

interface ActionPermissionGateProps extends PermissionGateProps {
  action: keyof UserPermissions
}

interface RolePermissionGateProps extends PermissionGateProps {
  allowedRoles: UserRole[]
}

/**
 * Gate component that shows/hides content based on specific permission actions
 */
export function ActionPermissionGate({
  children,
  fallback = null,
  action,
  userRole,
  isProjectOwner = false
}: ActionPermissionGateProps) {
  const hasPermission = usePermissionCheck(action, userRole, isProjectOwner)
  
  return hasPermission ? <>{children}</> : <>{fallback}</>
}

/**
 * Gate component that shows/hides content based on user roles
 */
export function RolePermissionGate({
  children,
  fallback = null,
  allowedRoles,
  userRole,
  isProjectOwner = false
}: RolePermissionGateProps) {
  const hasAccess = useRoleAccess(allowedRoles, userRole, isProjectOwner)
  
  return hasAccess ? <>{children}</> : <>{fallback}</>
}

/**
 * Comprehensive permission gate with multiple check types
 */
export function PermissionGate({
  children,
  fallback = null,
  userRole,
  isProjectOwner = false
}: PermissionGateProps) {
  // This is a basic gate that just checks if user has a valid role
  if (!userRole) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

/**
 * Higher-order component for permission-based rendering
 */
export function withPermissions<P extends object>(
  Component: React.ComponentType<P>,
  requiredAction: keyof UserPermissions
) {
  return function PermissionWrappedComponent(
    props: P & { userRole?: UserRole; isProjectOwner?: boolean }
  ) {
    const { userRole, isProjectOwner, ...componentProps } = props
    const hasPermission = usePermissionCheck(requiredAction, userRole, isProjectOwner)
    
    if (!hasPermission) {
      return null
    }
    
    return <Component {...(componentProps as P)} />
  }
}

/**
 * Permission-aware button component
 */
interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  action: keyof UserPermissions
  userRole?: UserRole
  isProjectOwner?: boolean
  disabledMessage?: string
}

export function PermissionButton({
  children,
  action,
  userRole,
  isProjectOwner = false,
  disabledMessage = "You don't have permission to perform this action",
  ...buttonProps
}: PermissionButtonProps) {
  const hasPermission = usePermissionCheck(action, userRole, isProjectOwner)
  
  return (
    <button
      {...buttonProps}
      disabled={!hasPermission || buttonProps.disabled}
      title={!hasPermission ? disabledMessage : buttonProps.title}
    >
      {children}
    </button>
  )
}

/**
 * Permission context for nested components
 */
interface PermissionContextValue {
  userRole?: UserRole
  isProjectOwner: boolean
  permissions: UserPermissions
  canPerform: (action: keyof UserPermissions) => boolean
}

const PermissionContext = React.createContext<PermissionContextValue | null>(null)

export function PermissionProvider({
  children,
  userRole,
  isProjectOwner = false,
  projectId,
  userId
}: {
  children: React.ReactNode
  userRole?: UserRole
  isProjectOwner?: boolean
  projectId?: string
  userId?: string
}) {
  const { permissions, canPerform } = usePermissions({
    userRole,
    isProjectOwner,
    projectId,
    userId
  })
  
  const value: PermissionContextValue = {
    userRole,
    isProjectOwner,
    permissions,
    canPerform
  }
  
  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermissionContext() {
  const context = React.useContext(PermissionContext)
  if (!context) {
    throw new Error('usePermissionContext must be used within a PermissionProvider')
  }
  return context
}
