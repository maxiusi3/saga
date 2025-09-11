/**
 * Service plan configurations for Saga Family Biography projects
 * These settings control service duration and can be used for pricing tiers
 */

export interface ServicePlan {
  id: string
  name: string
  description: string
  durationDays: number
  price?: number
  currency?: string
  features: {
    maxProjects: number
    maxFacilitatorSeats: number
    maxStorytellerSeats: number
    aiFeatures: boolean
    dataExport: boolean
    prioritySupport: boolean
  }
  isDefault?: boolean
}

export const SERVICE_PLANS: ServicePlan[] = [
  {
    id: 'basic_annual',
    name: 'Basic Annual',
    description: 'One year of family story collection service',
    durationDays: 365,
    price: 129,
    currency: 'USD',
    features: {
      maxProjects: 1,
      maxFacilitatorSeats: 2,
      maxStorytellerSeats: 10,
      aiFeatures: true,
      dataExport: true,
      prioritySupport: false
    },
    isDefault: true
  },
  {
    id: 'premium_annual',
    name: 'Premium Annual',
    description: 'One year with extended features and support',
    durationDays: 365,
    price: 199,
    currency: 'USD',
    features: {
      maxProjects: 3,
      maxFacilitatorSeats: 5,
      maxStorytellerSeats: 25,
      aiFeatures: true,
      dataExport: true,
      prioritySupport: true
    }
  },
  {
    id: 'extended_18months',
    name: 'Extended 18 Months',
    description: 'Extended service period for larger families',
    durationDays: 547, // 18 months
    price: 179,
    currency: 'USD',
    features: {
      maxProjects: 2,
      maxFacilitatorSeats: 3,
      maxStorytellerSeats: 15,
      aiFeatures: true,
      dataExport: true,
      prioritySupport: false
    }
  },
  {
    id: 'lifetime',
    name: 'Lifetime Access',
    description: 'Permanent access to your family stories',
    durationDays: 36500, // 100 years
    price: 499,
    currency: 'USD',
    features: {
      maxProjects: 5,
      maxFacilitatorSeats: 10,
      maxStorytellerSeats: 50,
      aiFeatures: true,
      dataExport: true,
      prioritySupport: true
    }
  }
]

/**
 * Get default service plan
 */
export function getDefaultServicePlan(): ServicePlan {
  return SERVICE_PLANS.find(plan => plan.isDefault) || SERVICE_PLANS[0]
}

/**
 * Get service plan by ID
 */
export function getServicePlanById(planId: string): ServicePlan | null {
  return SERVICE_PLANS.find(plan => plan.id === planId) || null
}

/**
 * Calculate service end date based on plan and start date
 */
export function calculateServiceEndDate(startDate: Date, planId: string): Date {
  const plan = getServicePlanById(planId) || getDefaultServicePlan()
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + plan.durationDays)
  return endDate
}

/**
 * Check if service is expired
 */
export function isServiceExpired(endDate: Date): boolean {
  return new Date() > endDate
}

/**
 * Get days remaining in service
 */
export function getDaysRemaining(endDate: Date): number {
  const now = new Date()
  const diffTime = endDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(diffDays, 0)
}

/**
 * Get service progress percentage
 */
export function getServiceProgress(startDate: Date, endDate: Date): number {
  const now = new Date()
  const totalDuration = endDate.getTime() - startDate.getTime()
  const elapsed = now.getTime() - startDate.getTime()
  return Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100)
}

/**
 * Format service status for display
 */
export function formatServiceStatus(endDate: Date): {
  status: 'active' | 'expiring_soon' | 'expired'
  message: string
  daysRemaining: number
} {
  const daysRemaining = getDaysRemaining(endDate)
  const isExpired = isServiceExpired(endDate)
  
  if (isExpired) {
    return {
      status: 'expired',
      message: `Service expired ${Math.abs(daysRemaining)} days ago`,
      daysRemaining: 0
    }
  }
  
  if (daysRemaining <= 30) {
    return {
      status: 'expiring_soon',
      message: `Service expires in ${daysRemaining} days`,
      daysRemaining
    }
  }
  
  return {
    status: 'active',
    message: `Service active for ${daysRemaining} more days`,
    daysRemaining
  }
}
