/**
 * Subscription Plan Service Tests
 */

import { SubscriptionPlanService } from '../services/subscription-plan-service'
import { SubscriptionPlanModel } from '../models/subscription-plan'
import { SubscriptionModel } from '../models/subscription'
import type { SubscriptionPlan, Subscription } from '@saga/shared/types'

// Mock the models
jest.mock('../models/subscription-plan')
jest.mock('../models/subscription')
jest.mock('../config/stripe')

const mockSubscriptionPlanModel = SubscriptionPlanModel as jest.Mocked<typeof SubscriptionPlanModel>
const mockSubscriptionModel = SubscriptionModel as jest.Mocked<typeof SubscriptionModel>

describe('SubscriptionPlanService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockPlan: SubscriptionPlan = {
    id: 'plan-1',
    name: 'Family Plan',
    description: 'Perfect for families',
    price: 99.99,
    interval: 'year',
    currency: 'USD',
    features: {
      projectVouchers: 2,
      facilitatorSeats: 3,
      storytellerSeats: 3,
      storageGB: 15,
      aiFeatures: true,
      prioritySupport: true,
      advancedAnalytics: true,
      customBranding: false,
      apiAccess: false
    },
    limits: {
      maxProjects: 3,
      maxStoriesPerProject: 500,
      maxFamilyMembers: 8
    },
    isActive: true,
    isPopular: true,
    sortOrder: 2,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const mockSubscription: Subscription = {
    id: 'sub-1',
    facilitator_id: 'user-1',
    status: 'active',
    current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    created_at: new Date(),
    updated_at: new Date(),
    plan_id: 'plan-1'
  }

  describe('getAvailablePlans', () => {
    it('should return all active plans when no interval specified', async () => {
      const mockPlans = [mockPlan]
      mockSubscriptionPlanModel.getActivePlans.mockResolvedValue(mockPlans)

      const result = await SubscriptionPlanService.getAvailablePlans()

      expect(result).toEqual(mockPlans)
      expect(mockSubscriptionPlanModel.getActivePlans).toHaveBeenCalledTimes(1)
    })

    it('should return plans filtered by interval', async () => {
      const mockPlans = [mockPlan]
      mockSubscriptionPlanModel.getPlansByInterval.mockResolvedValue(mockPlans)

      const result = await SubscriptionPlanService.getAvailablePlans('year')

      expect(result).toEqual(mockPlans)
      expect(mockSubscriptionPlanModel.getPlansByInterval).toHaveBeenCalledWith('year')
    })
  })

  describe('getCurrentPlan', () => {
    it('should return current plan for project', async () => {
      mockSubscriptionModel.findByProjectId.mockResolvedValue(mockSubscription)
      mockSubscriptionPlanModel.findById.mockResolvedValue(mockPlan)

      const result = await SubscriptionPlanService.getCurrentPlan('project-1')

      expect(result).toEqual(mockPlan)
      expect(mockSubscriptionModel.findByProjectId).toHaveBeenCalledWith('project-1')
      expect(mockSubscriptionPlanModel.findById).toHaveBeenCalledWith('plan-1')
    })

    it('should return null when no subscription exists', async () => {
      mockSubscriptionModel.findByProjectId.mockResolvedValue(null)

      const result = await SubscriptionPlanService.getCurrentPlan('project-1')

      expect(result).toBeNull()
    })

    it('should return null when subscription has no plan_id', async () => {
      const subscriptionWithoutPlan = { ...mockSubscription, plan_id: undefined }
      mockSubscriptionModel.findByProjectId.mockResolvedValue(subscriptionWithoutPlan)

      const result = await SubscriptionPlanService.getCurrentPlan('project-1')

      expect(result).toBeNull()
    })
  })

  describe('previewPlanChange', () => {
    const newPlan: SubscriptionPlan = {
      ...mockPlan,
      id: 'plan-2',
      name: 'Legacy Plan',
      price: 199.99,
      features: {
        ...mockPlan.features,
        projectVouchers: 5,
        facilitatorSeats: 10,
        storytellerSeats: 10,
        storageGB: 50,
        customBranding: true,
        apiAccess: true
      }
    }

    it('should preview plan upgrade', async () => {
      mockSubscriptionModel.findByProjectId.mockResolvedValue(mockSubscription)
      mockSubscriptionPlanModel.findById
        .mockResolvedValueOnce(mockPlan) // current plan
        .mockResolvedValueOnce(newPlan)  // new plan

      const result = await SubscriptionPlanService.previewPlanChange('project-1', 'plan-2')

      expect(result.currentPlan).toEqual(mockPlan)
      expect(result.newPlan).toEqual(newPlan)
      expect(result.priceChange.amount).toBe(100) // 199.99 - 99.99
      expect(result.priceChange.isIncrease).toBe(true)
      expect(result.featureChanges).toHaveLength(9) // Number of features
    })

    it('should throw error when no subscription found', async () => {
      mockSubscriptionModel.findByProjectId.mockResolvedValue(null)

      await expect(
        SubscriptionPlanService.previewPlanChange('project-1', 'plan-2')
      ).rejects.toThrow('No active subscription found')
    })

    it('should throw error when current plan not found', async () => {
      mockSubscriptionModel.findByProjectId.mockResolvedValue(mockSubscription)
      mockSubscriptionPlanModel.findById.mockResolvedValueOnce(null)

      await expect(
        SubscriptionPlanService.previewPlanChange('project-1', 'plan-2')
      ).rejects.toThrow('Current plan not found')
    })

    it('should throw error when new plan not found', async () => {
      mockSubscriptionModel.findByProjectId.mockResolvedValue(mockSubscription)
      mockSubscriptionPlanModel.findById
        .mockResolvedValueOnce(mockPlan)
        .mockResolvedValueOnce(null)

      await expect(
        SubscriptionPlanService.previewPlanChange('project-1', 'plan-2')
      ).rejects.toThrow('New plan not found')
    })
  })

  describe('upgradePlan', () => {
    const upgradeRequest = {
      planId: 'plan-2',
      effectiveImmediately: true
    }

    const newPlan: SubscriptionPlan = {
      ...mockPlan,
      id: 'plan-2',
      name: 'Legacy Plan',
      price: 199.99
    }

    it('should upgrade plan successfully', async () => {
      const updatedSubscription = { ...mockSubscription, plan_id: 'plan-2' }
      
      mockSubscriptionModel.findByProjectId.mockResolvedValue(mockSubscription)
      mockSubscriptionPlanModel.findById
        .mockResolvedValueOnce(newPlan)
        .mockResolvedValueOnce(mockPlan)
      mockSubscriptionModel.update.mockResolvedValue(updatedSubscription)

      const result = await SubscriptionPlanService.upgradePlan('project-1', upgradeRequest)

      expect(result.subscription).toEqual(updatedSubscription)
      expect(mockSubscriptionModel.update).toHaveBeenCalledWith(mockSubscription.id, {
        planId: 'plan-2',
        status: 'active'
      })
    })

    it('should throw error when no subscription found', async () => {
      mockSubscriptionModel.findByProjectId.mockResolvedValue(null)

      await expect(
        SubscriptionPlanService.upgradePlan('project-1', upgradeRequest)
      ).rejects.toThrow('No active subscription found')
    })

    it('should throw error when new plan not found', async () => {
      mockSubscriptionModel.findByProjectId.mockResolvedValue(mockSubscription)
      mockSubscriptionPlanModel.findById.mockResolvedValue(null)

      await expect(
        SubscriptionPlanService.upgradePlan('project-1', upgradeRequest)
      ).rejects.toThrow('Plan not found')
    })

    it('should throw error when trying to upgrade to cheaper plan', async () => {
      const cheaperPlan = { ...mockPlan, id: 'plan-cheap', price: 49.99 }
      
      mockSubscriptionModel.findByProjectId.mockResolvedValue(mockSubscription)
      mockSubscriptionPlanModel.findById
        .mockResolvedValueOnce(cheaperPlan)
        .mockResolvedValueOnce(mockPlan)

      await expect(
        SubscriptionPlanService.upgradePlan('project-1', { planId: 'plan-cheap' })
      ).rejects.toThrow('Cannot upgrade to a plan with lower or equal price')
    })
  })

  describe('downgradePlan', () => {
    const downgradeRequest = {
      planId: 'plan-starter',
      reason: 'Cost reduction'
    }

    const starterPlan: SubscriptionPlan = {
      ...mockPlan,
      id: 'plan-starter',
      name: 'Starter Plan',
      price: 49.99
    }

    it('should schedule downgrade successfully', async () => {
      const updatedSubscription = { 
        ...mockSubscription, 
        metadata: {
          scheduledDowngrade: {
            newPlanId: 'plan-starter',
            effectiveDate: mockSubscription.current_period_end.toISOString(),
            reason: 'Cost reduction'
          }
        }
      }
      
      mockSubscriptionModel.findByProjectId.mockResolvedValue(mockSubscription)
      mockSubscriptionPlanModel.findById
        .mockResolvedValueOnce(starterPlan)
        .mockResolvedValueOnce(mockPlan)
      mockSubscriptionModel.update.mockResolvedValue(updatedSubscription)

      const result = await SubscriptionPlanService.downgradePlan('project-1', downgradeRequest)

      expect(result).toEqual(updatedSubscription)
      expect(mockSubscriptionModel.update).toHaveBeenCalledWith(
        mockSubscription.id,
        expect.objectContaining({
          planId: 'plan-starter',
          metadata: expect.objectContaining({
            scheduledDowngrade: expect.any(Object)
          })
        })
      )
    })

    it('should throw error when no subscription found', async () => {
      mockSubscriptionModel.findByProjectId.mockResolvedValue(null)

      await expect(
        SubscriptionPlanService.downgradePlan('project-1', downgradeRequest)
      ).rejects.toThrow('No active subscription found')
    })

    it('should throw error when trying to downgrade to more expensive plan', async () => {
      const expensivePlan = { ...mockPlan, id: 'plan-expensive', price: 299.99 }
      
      mockSubscriptionModel.findByProjectId.mockResolvedValue(mockSubscription)
      mockSubscriptionPlanModel.findById
        .mockResolvedValueOnce(expensivePlan)
        .mockResolvedValueOnce(mockPlan)

      await expect(
        SubscriptionPlanService.downgradePlan('project-1', { planId: 'plan-expensive' })
      ).rejects.toThrow('Cannot downgrade to a plan with higher or equal price')
    })
  })

  describe('cancelScheduledDowngrade', () => {
    it('should cancel scheduled downgrade successfully', async () => {
      const updatedSubscription = { ...mockSubscription, metadata: null }
      
      mockSubscriptionModel.findByProjectId.mockResolvedValue(mockSubscription)
      mockSubscriptionModel.update.mockResolvedValue(updatedSubscription)

      const result = await SubscriptionPlanService.cancelScheduledDowngrade('project-1')

      expect(result).toEqual(updatedSubscription)
      expect(mockSubscriptionModel.update).toHaveBeenCalledWith(mockSubscription.id, {
        metadata: null
      })
    })

    it('should throw error when no subscription found', async () => {
      mockSubscriptionModel.findByProjectId.mockResolvedValue(null)

      await expect(
        SubscriptionPlanService.cancelScheduledDowngrade('project-1')
      ).rejects.toThrow('No active subscription found')
    })
  })

  describe('getPlanRecommendations', () => {
    it('should return plan recommendations based on usage', async () => {
      const betterPlan = { ...mockPlan, id: 'plan-better', price: 79.99 }
      
      mockSubscriptionModel.findByProjectId.mockResolvedValue(mockSubscription)
      mockSubscriptionPlanModel.findById.mockResolvedValue(mockPlan)
      mockSubscriptionPlanModel.getActivePlans.mockResolvedValue([mockPlan, betterPlan])

      const result = await SubscriptionPlanService.getPlanRecommendations('project-1')

      expect(result).toBeDefined()
      expect(result?.recommendedPlan).toEqual(betterPlan)
      expect(result?.potentialSavings).toBe(20) // 99.99 - 79.99
      expect(result?.usageAnalysis).toBeDefined()
    })

    it('should return null when no current plan', async () => {
      mockSubscriptionModel.findByProjectId.mockResolvedValue(null)

      const result = await SubscriptionPlanService.getPlanRecommendations('project-1')

      expect(result).toBeNull()
    })

    it('should return null when no better plan found', async () => {
      mockSubscriptionModel.findByProjectId.mockResolvedValue(mockSubscription)
      mockSubscriptionPlanModel.findById.mockResolvedValue(mockPlan)
      mockSubscriptionPlanModel.getActivePlans.mockResolvedValue([mockPlan])

      const result = await SubscriptionPlanService.getPlanRecommendations('project-1')

      expect(result).toBeNull()
    })
  })
})