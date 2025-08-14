/**
 * Subscription Plan Controller
 * Handles HTTP requests for subscription plan management
 */

import { Request, Response } from 'express'
import { SubscriptionPlanService } from '../services/subscription-plan-service'
import { SubscriptionPlanModel } from '../models/subscription-plan'
import type { PlanUpgradeRequest, PlanDowngradeRequest } from '@saga/shared/types'

export class SubscriptionPlanController {
  /**
   * Get all available subscription plans
   */
  static async getPlans(req: Request, res: Response): Promise<void> {
    try {
      const { interval } = req.query
      const plans = await SubscriptionPlanService.getAvailablePlans(
        interval as 'month' | 'year' | undefined
      )

      res.json({
        success: true,
        data: { plans }
      })
    } catch (error: any) {
      console.error('Error fetching subscription plans:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_PLANS_ERROR',
          message: error.message || 'Failed to fetch subscription plans'
        }
      })
    }
  }

  /**
   * Get plans filtered by interval
   */
  static async getPlansByInterval(req: Request, res: Response): Promise<void> {
    try {
      const { interval } = req.params
      
      if (!['month', 'year'].includes(interval)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INTERVAL',
            message: 'Interval must be "month" or "year"'
          }
        })
        return
      }

      const plans = await SubscriptionPlanModel.getPlansByInterval(interval as 'month' | 'year')

      res.json({
        success: true,
        data: { plans }
      })
    } catch (error: any) {
      console.error('Error fetching plans by interval:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_PLANS_ERROR',
          message: error.message || 'Failed to fetch plans'
        }
      })
    }
  }

  /**
   * Get current plan for a project
   */
  static async getCurrentPlan(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId || req.body.projectId
      
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PROJECT_ID',
            message: 'Project ID is required'
          }
        })
        return
      }

      const currentPlan = await SubscriptionPlanService.getCurrentPlan(projectId)

      res.json({
        success: true,
        data: { currentPlan }
      })
    } catch (error: any) {
      console.error('Error fetching current plan:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_CURRENT_PLAN_ERROR',
          message: error.message || 'Failed to fetch current plan'
        }
      })
    }
  }

  /**
   * Get project-specific plans (includes current plan info)
   */
  static async getProjectPlans(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params
      const { interval } = req.query

      const [plans, currentPlan] = await Promise.all([
        SubscriptionPlanService.getAvailablePlans(interval as 'month' | 'year' | undefined),
        SubscriptionPlanService.getCurrentPlan(projectId)
      ])

      // Mark current plan
      const plansWithCurrentFlag = plans.map(plan => ({
        ...plan,
        isCurrentPlan: currentPlan && plan.id === currentPlan.id
      }))

      res.json({
        success: true,
        data: { 
          plans: plansWithCurrentFlag,
          currentPlan 
        }
      })
    } catch (error: any) {
      console.error('Error fetching project plans:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_PROJECT_PLANS_ERROR',
          message: error.message || 'Failed to fetch project plans'
        }
      })
    }
  }

  /**
   * Preview plan change
   */
  static async previewPlanChange(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId || req.body.projectId
      const { planId } = req.body

      if (!projectId || !planId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Project ID and plan ID are required'
          }
        })
        return
      }

      const preview = await SubscriptionPlanService.previewPlanChange(projectId, planId)

      res.json({
        success: true,
        data: preview
      })
    } catch (error: any) {
      console.error('Error previewing plan change:', error)
      res.status(400).json({
        success: false,
        error: {
          code: 'PREVIEW_ERROR',
          message: error.message || 'Failed to preview plan change'
        }
      })
    }
  }

  /**
   * Upgrade subscription plan
   */
  static async upgradePlan(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId || req.body.projectId
      const upgradeRequest: PlanUpgradeRequest = req.body

      if (!projectId || !upgradeRequest.planId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Project ID and plan ID are required'
          }
        })
        return
      }

      const result = await SubscriptionPlanService.upgradePlan(projectId, upgradeRequest)

      res.json({
        success: true,
        data: result
      })
    } catch (error: any) {
      console.error('Error upgrading plan:', error)
      res.status(400).json({
        success: false,
        error: {
          code: 'UPGRADE_ERROR',
          message: error.message || 'Failed to upgrade plan'
        }
      })
    }
  }

  /**
   * Downgrade subscription plan
   */
  static async downgradePlan(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId || req.body.projectId
      const downgradeRequest: PlanDowngradeRequest = req.body

      if (!projectId || !downgradeRequest.planId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Project ID and plan ID are required'
          }
        })
        return
      }

      const subscription = await SubscriptionPlanService.downgradePlan(projectId, downgradeRequest)

      res.json({
        success: true,
        data: { subscription }
      })
    } catch (error: any) {
      console.error('Error downgrading plan:', error)
      res.status(400).json({
        success: false,
        error: {
          code: 'DOWNGRADE_ERROR',
          message: error.message || 'Failed to downgrade plan'
        }
      })
    }
  }

  /**
   * Cancel scheduled downgrade
   */
  static async cancelScheduledDowngrade(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId || req.body.projectId

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PROJECT_ID',
            message: 'Project ID is required'
          }
        })
        return
      }

      const subscription = await SubscriptionPlanService.cancelScheduledDowngrade(projectId)

      res.json({
        success: true,
        data: { subscription }
      })
    } catch (error: any) {
      console.error('Error canceling scheduled downgrade:', error)
      res.status(400).json({
        success: false,
        error: {
          code: 'CANCEL_DOWNGRADE_ERROR',
          message: error.message || 'Failed to cancel scheduled downgrade'
        }
      })
    }
  }

  /**
   * Get plan recommendations
   */
  static async getPlanRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId || req.body.projectId

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PROJECT_ID',
            message: 'Project ID is required'
          }
        })
        return
      }

      const recommendations = await SubscriptionPlanService.getPlanRecommendations(projectId)

      res.json({
        success: true,
        data: recommendations
      })
    } catch (error: any) {
      console.error('Error fetching plan recommendations:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'RECOMMENDATIONS_ERROR',
          message: error.message || 'Failed to fetch plan recommendations'
        }
      })
    }
  }
}