import type { UserResourceWallet } from '@saga/shared/types'
type ResourceWalletView = Pick<UserResourceWallet, 'projectVouchers' | 'facilitatorSeats' | 'storytellerSeats'>

export interface ResourceRequirement {
  projectVouchers?: number
  facilitatorSeats?: number
  storytellerSeats?: number
}

export interface ResourceValidationResult {
  isValid: boolean
  errors: ResourceValidationError[]
}

export interface ResourceValidationError {
  resourceType: keyof ResourceRequirement
  required: number
  available: number
  message: string
}

export class ResourceValidationService {
  /**
   * Validate if wallet has sufficient resources for an operation
   */
  static validateResources(
    wallet: ResourceWalletView | null,
    requirements: ResourceRequirement
  ): ResourceValidationResult {
    const errors: ResourceValidationError[] = []

    if (!wallet) {
      // If wallet is not loaded, assume insufficient resources
      Object.entries(requirements).forEach(([resourceType, required]) => {
        if (required && required > 0) {
          errors.push({
            resourceType: resourceType as keyof ResourceRequirement,
            required,
            available: 0,
            message: `You need ${required} ${this.getResourceDisplayName(resourceType as keyof ResourceRequirement, required)} but your wallet is not loaded.`
          })
        }
      })
      return { isValid: false, errors }
    }

    // Check each resource requirement
    if (requirements.projectVouchers && wallet.projectVouchers < requirements.projectVouchers) {
      errors.push({
        resourceType: 'projectVouchers',
        required: requirements.projectVouchers,
        available: wallet.projectVouchers,
        message: `You need ${requirements.projectVouchers} ${this.getResourceDisplayName('projectVouchers', requirements.projectVouchers)} but only have ${wallet.projectVouchers}.`
      })
    }

    if (requirements.facilitatorSeats && wallet.facilitatorSeats < requirements.facilitatorSeats) {
      errors.push({
        resourceType: 'facilitatorSeats',
        required: requirements.facilitatorSeats,
        available: wallet.facilitatorSeats,
        message: `You need ${requirements.facilitatorSeats} ${this.getResourceDisplayName('facilitatorSeats', requirements.facilitatorSeats)} but only have ${wallet.facilitatorSeats}.`
      })
    }

    if (requirements.storytellerSeats && wallet.storytellerSeats < requirements.storytellerSeats) {
      errors.push({
        resourceType: 'storytellerSeats',
        required: requirements.storytellerSeats,
        available: wallet.storytellerSeats,
        message: `You need ${requirements.storytellerSeats} ${this.getResourceDisplayName('storytellerSeats', requirements.storytellerSeats)} but only have ${wallet.storytellerSeats}.`
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Get user-friendly display name for resource types
   */
  static getResourceDisplayName(resourceType: keyof ResourceRequirement, count: number): string {
    const names = {
      projectVouchers: count === 1 ? 'Project Voucher' : 'Project Vouchers',
      facilitatorSeats: count === 1 ? 'Facilitator Seat' : 'Facilitator Seats',
      storytellerSeats: count === 1 ? 'Storyteller Seat' : 'Storyteller Seats'
    }
    return names[resourceType]
  }

  /**
   * Get resource icon for UI display
   */
  static getResourceIcon(resourceType: keyof ResourceRequirement): string {
    const icons = {
      projectVouchers: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      facilitatorSeats: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      storytellerSeats: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
    }
    return icons[resourceType]
  }

  /**
   * Get suggested actions for insufficient resources
   */
  static getSuggestedActions(errors: ResourceValidationError[]): Array<{
    label: string
    href: string
    primary: boolean
  }> {
    const actions = []

    // Always suggest purchasing a package if any resources are insufficient
    if (errors.length > 0) {
      actions.push({
        label: 'Purchase Package',
        href: '/dashboard/purchase#packages',
        primary: true
      })

      actions.push({
        label: 'View Wallet',
        href: '/dashboard/purchase',
        primary: false
      })
    }

    return actions
  }

  /**
   * Format multiple resource errors into a single message
   */
  static formatErrorMessage(errors: ResourceValidationError[]): string {
    if (errors.length === 0) return ''
    if (errors.length === 1) return errors[0].message

    const resourceList = errors.map(error => 
      `${error.required} ${this.getResourceDisplayName(error.resourceType, error.required)}`
    ).join(', ')

    return `You need ${resourceList} to complete this action.`
  }

  /**
   * Check if user can perform a specific action
   */
  static canCreateProject(wallet: ResourceWalletView | null): ResourceValidationResult {
    return this.validateResources(wallet, { projectVouchers: 1 })
  }

  static canInviteFacilitator(wallet: ResourceWalletView | null): ResourceValidationResult {
    return this.validateResources(wallet, { facilitatorSeats: 1 })
  }

  static canInviteStoryteller(wallet: ResourceWalletView | null): ResourceValidationResult {
    return this.validateResources(wallet, { storytellerSeats: 1 })
  }

  /**
   * Get the total cost of a package in terms of resources
   */
  static getPackageResources(packageId: string): ResourceRequirement {
    // This would typically come from a package service or API
    const packages: Record<string, ResourceRequirement> = {
      'saga-package-v1': {
        projectVouchers: 1,
        facilitatorSeats: 2,
        storytellerSeats: 2
      },
      'saga-package-premium': {
        projectVouchers: 3,
        facilitatorSeats: 5,
        storytellerSeats: 5
      }
    }

    return packages[packageId] || {}
  }
}

/**
 * React hook for resource validation
 */
export function useResourceValidation(wallet: ResourceWalletView | null) {
  const validateResources = (requirements: ResourceRequirement) => {
    return ResourceValidationService.validateResources(wallet, requirements)
  }

  const canCreateProject = () => {
    return ResourceValidationService.canCreateProject(wallet)
  }

  const canInviteFacilitator = () => {
    return ResourceValidationService.canInviteFacilitator(wallet)
  }

  const canInviteStoryteller = () => {
    return ResourceValidationService.canInviteStoryteller(wallet)
  }

  return {
    validateResources,
    canCreateProject,
    canInviteFacilitator,
    canInviteStoryteller,
    formatErrorMessage: ResourceValidationService.formatErrorMessage,
    getSuggestedActions: ResourceValidationService.getSuggestedActions
  }
}