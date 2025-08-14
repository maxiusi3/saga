/**
 * Subscription Plan Service
 * Handles subscription plan management, upgrades, and downgrades
 */

import Stripe from 'stripe'
import { stripe } from '../config/stripe'
import { SubscriptionPlanModel } from '../models/subscription-plan'
import { SubscriptionModel } from '../models/subscription'
import { ResourceWalletService } from './resource-wallet-service'
import type { 
  SubscriptionPlan, 
  PlanChangePreview, 
  PlanUpgradeRequest, 
  PlanDowngradeRequest,
  Subscription 
} from '@saga/shared/types'

export class SubscriptionPlanService {
  /**
   * Get all available subscription plans
   */
  static async getAvailablePlans(interval?: 'month' | 'year'): Promise<SubscriptionPlan[]> {
    if (interval) {
      return await SubscriptionPlanModel.getPlansByInterval(interval)
    }
    return await SubscriptionPlanModel.getActivePlans()
  }

  /**
   * Get current plan for a user/project
   */
  static async getCurrentPlan(projectId: string): Promise<SubscriptionPlan | null> {
    const subscription = await SubscriptionModel.findByProjectId(projectId)
    if (!subscription || !subscription.planId) {
      return null
    }

    return await SubscriptionPlanModel.findById(subscription.planId)
  }

  /**
   * Preview plan change (upgrade or downgrade)
   */
  static async previewPlanChange(
    projectId: string, 
    newPlanId: string
  ): Promise<PlanChangePreview> {
    const subscription = await SubscriptionModel.findByProjectId(projectId)
    if (!subscription) {
      throw new Error('No active subscription found')
    }

    const currentPlan = subscription.planId 
      ? await SubscriptionPlanModel.findById(subscription.planId)
      : null
    
    if (!currentPlan) {
      throw new Error('Current plan not found')
    }

    const newPlan = await SubscriptionPlanModel.findById(newPlanId)
    if (!newPlan) {
      throw new Error('New plan not found')
    }

    // Calculate price changes
    const priceDifference = newPlan.price - currentPlan.price
    const isIncrease = priceDifference > 0

    // Calculate prorated amount based on remaining time
    const now = new Date()
    const periodEnd = new Date(subscription.currentPeriodEnd)
    const totalPeriodDays = newPlan.interval === 'year' ? 365 : 30
    const remainingDays = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    const proratedAmount = isIncrease 
      ? (priceDifference * remainingDays) / totalPeriodDays
      : 0

    // Calculate next billing amount
    const nextBillingAmount = newPlan.price

    // Calculate feature changes
    const featureChanges = this.calculateFeatureChanges(currentPlan, newPlan)

    // Calculate effective date and next billing date
    const effectiveDate = new Date() // Immediate for upgrades, end of period for downgrades
    const nextBillingDate = isIncrease 
      ? new Date(now.getTime() + (newPlan.interval === 'year' ? 365 : 30) * 24 * 60 * 60 * 1000)
      : periodEnd

    return {
      currentPlan,
      newPlan,
      priceChange: {
        amount: Math.abs(priceDifference),
        isIncrease,
        proratedAmount: proratedAmount > 0 ? proratedAmount : undefined,
        nextBillingAmount
      },
      featureChanges,
      effectiveDate,
      nextBillingDate
    }
  }

  /**
   * Upgrade subscription plan
   */
  static async upgradePlan(
    projectId: string, 
    request: PlanUpgradeRequest
  ): Promise<{ subscription: Subscription; checkoutUrl?: string }> {
    const subscription = await SubscriptionModel.findByProjectId(projectId)
    if (!subscription) {
      throw new Error('No active subscription found')
    }

    const newPlan = await SubscriptionPlanModel.findById(request.planId)
    if (!newPlan) {
      throw new Error('Plan not found')
    }

    const currentPlan = subscription.planId 
      ? await SubscriptionPlanModel.findById(subscription.planId)
      : null

    // Validate upgrade (new plan should be more expensive or have more features)
    if (currentPlan && newPlan.price <= currentPlan.price) {
      throw new Error('Cannot upgrade to a plan with lower or equal price')
    }

    // Create Stripe checkout session for the upgrade
    let checkoutUrl: string | undefined

    if (newPlan.stripePriceId) {
      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: newPlan.stripePriceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.FRONTEND_URL}/dashboard/projects/${projectId}/subscription?upgrade=success`,
        cancel_url: `${process.env.FRONTEND_URL}/dashboard/projects/${projectId}/subscription/plans`,
        metadata: {
          projectId,
          planId: request.planId,
          type: 'upgrade',
          oldPlanId: subscription.planId || ''
        },
      })

      checkoutUrl = checkoutSession.url || undefined
    }

    // Update subscription with new plan (will be confirmed after payment)
    const updatedSubscription = await SubscriptionModel.update(subscription.id, {
      planId: request.planId,
      status: checkoutUrl ? 'pending' : 'active' // Pending if payment required
    })

    if (!updatedSubscription) {
      throw new Error('Failed to update subscription')
    }

    // If immediate upgrade without payment, update resource wallet
    if (!checkoutUrl && request.effectiveImmediately) {
      await this.updateResourcesForPlanChange(projectId, currentPlan, newPlan)
    }

    return {
      subscription: updatedSubscription,
      checkoutUrl
    }
  }

  /**
   * Downgrade subscription plan
   */
  static async downgradePlan(
    projectId: string, 
    request: PlanDowngradeRequest
  ): Promise<Subscription> {
    const subscription = await SubscriptionModel.findByProjectId(projectId)
    if (!subscription) {
      throw new Error('No active subscription found')
    }

    const newPlan = await SubscriptionPlanModel.findById(request.planId)
    if (!newPlan) {
      throw new Error('Plan not found')
    }

    const currentPlan = subscription.planId 
      ? await SubscriptionPlanModel.findById(subscription.planId)
      : null

    // Validate downgrade (new plan should be less expensive)
    if (currentPlan && newPlan.price >= currentPlan.price) {
      throw new Error('Cannot downgrade to a plan with higher or equal price')
    }

    // Schedule downgrade for end of current billing period
    const effectiveDate = request.effectiveDate || new Date(subscription.currentPeriodEnd)
    
    // Update subscription with new plan (effective at end of period)
    const updatedSubscription = await SubscriptionModel.update(subscription.id, {
      planId: request.planId,
      // Keep current status until effective date
      metadata: {
        scheduledDowngrade: {
          newPlanId: request.planId,
          effectiveDate: effectiveDate.toISOString(),
          reason: request.reason
        }
      }
    })

    if (!updatedSubscription) {
      throw new Error('Failed to schedule downgrade')
    }

    return updatedSubscription
  }

  /**
   * Cancel scheduled downgrade
   */
  static async cancelScheduledDowngrade(projectId: string): Promise<Subscription> {
    const subscription = await SubscriptionModel.findByProjectId(projectId)
    if (!subscription) {
      throw new Error('No active subscription found')
    }

    const updatedSubscription = await SubscriptionModel.update(subscription.id, {
      metadata: null // Remove scheduled downgrade
    })

    if (!updatedSubscription) {
      throw new Error('Failed to cancel scheduled downgrade')
    }

    return updatedSubscription
  }

  /**
   * Process scheduled downgrades (called by cron job)
   */
  static async processScheduledDowngrades(): Promise<void> {
    // This would be called by a scheduled job to process downgrades
    // Implementation would query for subscriptions with scheduled downgrades
    // and apply them when the effective date is reached
    console.log('Processing scheduled downgrades...')
  }

  /**
   * Get plan recommendations based on usage
   */
  static async getPlanRecommendations(projectId: string): Promise<{
    recommendedPlan: SubscriptionPlan;
    reason: string;
    potentialSavings?: number;
    usageAnalysis: {
      currentUsage: Record<string, number>;
      projectedUsage: Record<string, number>;
      efficiency: number;
    };
  } | null> {
    const currentPlan = await this.getCurrentPlan(projectId)
    if (!currentPlan) {
      return null
    }

    // Get usage data (this would come from analytics)
    const usageData = await this.getProjectUsageData(projectId)
    
    // Find optimal plan based on usage
    const allPlans = await SubscriptionPlanModel.getActivePlans()
    const recommendedPlan = this.findOptimalPlan(allPlans, usageData, currentPlan)

    if (!recommendedPlan || recommendedPlan.id === currentPlan.id) {
      return null
    }

    const potentialSavings = currentPlan.price - recommendedPlan.price
    const reason = this.generateRecommendationReason(currentPlan, recommendedPlan, usageData)

    return {
      recommendedPlan,
      reason,
      potentialSavings: potentialSavings > 0 ? potentialSavings : undefined,
      usageAnalysis: {
        currentUsage: usageData.currentUsage,
        projectedUsage: usageData.projectedUsage,
        efficiency: usageData.efficiency
      }
    }
  }

  /**
   * Calculate feature changes between plans
   */
  private static calculateFeatureChanges(
    currentPlan: SubscriptionPlan, 
    newPlan: SubscriptionPlan
  ): PlanChangePreview['featureChanges'] {
    const changes: PlanChangePreview['featureChanges'] = []

    // Compare features
    Object.keys(currentPlan.features).forEach(feature => {
      const currentValue = (currentPlan.features as any)[feature]
      const newValue = (newPlan.features as any)[feature]

      let changeType: 'upgrade' | 'downgrade' | 'same' = 'same'

      if (typeof currentValue === 'number' && typeof newValue === 'number') {
        if (newValue > currentValue) changeType = 'upgrade'
        else if (newValue < currentValue) changeType = 'downgrade'
      } else if (typeof currentValue === 'boolean' && typeof newValue === 'boolean') {
        if (newValue && !currentValue) changeType = 'upgrade'
        else if (!newValue && currentValue) changeType = 'downgrade'
      }

      changes.push({
        feature,
        currentValue,
        newValue,
        changeType
      })
    })

    return changes
  }

  /**
   * Update resource wallet when plan changes
   */
  private static async updateResourcesForPlanChange(
    projectId: string,
    oldPlan: SubscriptionPlan | null,
    newPlan: SubscriptionPlan
  ): Promise<void> {
    // This would update the user's resource wallet based on plan changes
    // Implementation depends on how resources are managed
    console.log(`Updating resources for plan change: ${oldPlan?.name} -> ${newPlan.name}`)
  }

  /**
   * Get project usage data for recommendations
   */
  private static async getProjectUsageData(projectId: string): Promise<{
    currentUsage: Record<string, number>;
    projectedUsage: Record<string, number>;
    efficiency: number;
  }> {
    // This would analyze actual usage patterns
    // For now, return mock data
    return {
      currentUsage: {
        projectVouchers: 80,
        facilitatorSeats: 60,
        storytellerSeats: 90,
        storage: 45
      },
      projectedUsage: {
        projectVouchers: 85,
        facilitatorSeats: 70,
        storytellerSeats: 95,
        storage: 60
      },
      efficiency: 75
    }
  }

  /**
   * Find optimal plan based on usage
   */
  private static findOptimalPlan(
    plans: SubscriptionPlan[],
    usageData: any,
    currentPlan: SubscriptionPlan
  ): SubscriptionPlan | null {
    // Simple logic to find a plan that better matches usage
    // In reality, this would be more sophisticated
    return plans.find(plan => 
      plan.price < currentPlan.price && 
      plan.features.projectVouchers >= Math.ceil(usageData.projectedUsage.projectVouchers / 100 * 2)
    ) || null
  }

  /**
   * Generate recommendation reason
   */
  private static generateRecommendationReason(
    currentPlan: SubscriptionPlan,
    recommendedPlan: SubscriptionPlan,
    usageData: any
  ): string {
    if (recommendedPlan.price < currentPlan.price) {
      return `Based on your usage patterns, you could save money by switching to the ${recommendedPlan.name} plan while still having enough resources for your needs.`
    } else {
      return `Your current usage suggests you would benefit from the additional features and resources in the ${recommendedPlan.name} plan.`
    }
  }
}