/**
 * Analytics Routes
 * API endpoints for analytics data and tracking
 */

import { Router } from 'express'
import { AnalyticsController } from '../controllers/analytics-controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// All analytics routes require authentication
router.use(authMiddleware)

/**
 * @route GET /api/analytics/projects/creation-metrics
 * @desc Get project creation metrics
 * @access Private
 * @query { startDate?: string, endDate?: string, userId?: string }
 */
router.get(
  '/projects/creation-metrics',
  AnalyticsController.getProjectCreationMetricsValidation,
  AnalyticsController.getProjectCreationMetrics
)

/**
 * @route GET /api/analytics/projects/engagement-metrics
 * @desc Get project engagement metrics
 * @access Private
 * @query { projectId: string }
 */
router.get(
  '/projects/engagement-metrics',
  AnalyticsController.getProjectEngagementMetricsValidation,
  AnalyticsController.getProjectEngagementMetrics
)

/**
 * @route GET /api/analytics/users/project-stats
 * @desc Get current user's project statistics
 * @access Private
 */
router.get(
  '/users/project-stats',
  AnalyticsController.getUserProjectStats
)

/**
 * @route GET /api/analytics/projects/success-metrics
 * @desc Get project success metrics (admin)
 * @access Private (Admin)
 * @query { startDate?: string, endDate?: string }
 */
router.get(
  '/projects/success-metrics',
  AnalyticsController.getProjectSuccessMetricsValidation,
  AnalyticsController.getProjectSuccessMetrics
)

/**
 * @route POST /api/analytics/track
 * @desc Track custom analytics event
 * @access Private
 * @body { eventType: string, projectId?: string, properties?: object }
 */
router.post(
  '/track',
  AnalyticsController.trackEventValidation,
  AnalyticsController.trackEvent
)

export default router