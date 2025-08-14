/**
 * Subscription Plans Routes
 * Handles subscription plan management, upgrades, and downgrades
 */

import { Router } from 'express'
import { SubscriptionPlanController } from '../controllers/subscription-plan-controller'
import { authMiddleware } from '../middleware/auth'
import { archivalMiddleware } from '../middleware/archival'

const router = Router()

// Apply authentication middleware to all routes
router.use(authMiddleware)

// Get all available subscription plans
router.get('/', SubscriptionPlanController.getPlans)

// Get plans filtered by interval (monthly/yearly)
router.get('/interval/:interval', SubscriptionPlanController.getPlansByInterval)

// Get plan recommendations for a project
router.get('/recommendations/:projectId', SubscriptionPlanController.getPlanRecommendations)

// Get current plan for a project
router.get('/current/:projectId', SubscriptionPlanController.getCurrentPlan)

// Preview plan change
router.post('/preview-change', SubscriptionPlanController.previewPlanChange)

// Upgrade subscription plan
router.post('/upgrade', SubscriptionPlanController.upgradePlan)

// Downgrade subscription plan
router.post('/downgrade', SubscriptionPlanController.downgradePlan)

// Cancel scheduled downgrade
router.post('/cancel-downgrade', SubscriptionPlanController.cancelScheduledDowngrade)

// Project-specific routes
router.get('/projects/:projectId', SubscriptionPlanController.getProjectPlans)
router.get('/projects/:projectId/current', SubscriptionPlanController.getCurrentPlan)
router.get('/projects/:projectId/recommendations', SubscriptionPlanController.getPlanRecommendations)
router.post('/projects/:projectId/preview-change', SubscriptionPlanController.previewPlanChange)
router.post('/projects/:projectId/upgrade', archivalMiddleware, SubscriptionPlanController.upgradePlan)
router.post('/projects/:projectId/downgrade', SubscriptionPlanController.downgradePlan)

export default router