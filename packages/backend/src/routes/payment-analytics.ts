/**
 * Payment Analytics Routes
 * API endpoints for payment analytics and reporting
 */

import { Router } from 'express'
import { PaymentAnalyticsController } from '../controllers/payment-analytics-controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// All payment analytics routes require authentication
router.use(authMiddleware)

/**
 * @route GET /api/payment-analytics
 * @desc Get comprehensive payment analytics
 * @access Private (Admin)
 * @query { startDate?: string, endDate?: string, groupBy?: 'day'|'week'|'month' }
 */
router.get(
  '/',
  PaymentAnalyticsController.getPaymentAnalyticsValidation,
  PaymentAnalyticsController.getPaymentAnalytics
)

/**
 * @route GET /api/payment-analytics/metrics
 * @desc Get basic payment metrics
 * @access Private (Admin)
 * @query { startDate?: string, endDate?: string }
 */
router.get(
  '/metrics',
  PaymentAnalyticsController.getPaymentMetricsValidation,
  PaymentAnalyticsController.getPaymentMetrics
)

/**
 * @route GET /api/payment-analytics/revenue
 * @desc Get revenue analytics over time
 * @access Private (Admin)
 * @query { startDate?: string, endDate?: string, groupBy?: 'day'|'week'|'month' }
 */
router.get(
  '/revenue',
  PaymentAnalyticsController.getRevenueAnalyticsValidation,
  PaymentAnalyticsController.getRevenueAnalytics
)

/**
 * @route GET /api/payment-analytics/payment-methods
 * @desc Get payment method breakdown
 * @access Private (Admin)
 * @query { startDate?: string, endDate?: string }
 */
router.get(
  '/payment-methods',
  PaymentAnalyticsController.getPaymentMethodBreakdownValidation,
  PaymentAnalyticsController.getPaymentMethodBreakdown
)

/**
 * @route GET /api/payment-analytics/packages
 * @desc Get package performance analytics
 * @access Private (Admin)
 * @query { startDate?: string, endDate?: string }
 */
router.get(
  '/packages',
  PaymentAnalyticsController.getPackagePerformanceValidation,
  PaymentAnalyticsController.getPackagePerformance
)

/**
 * @route GET /api/payment-analytics/customer-lifetime-value
 * @desc Get customer lifetime value analytics
 * @access Private (Admin)
 */
router.get(
  '/customer-lifetime-value',
  PaymentAnalyticsController.getCustomerLifetimeValue
)

/**
 * @route GET /api/payment-analytics/conversion-funnel
 * @desc Get conversion funnel data
 * @access Private (Admin)
 * @query { startDate?: string, endDate?: string }
 */
router.get(
  '/conversion-funnel',
  PaymentAnalyticsController.getConversionFunnelValidation,
  PaymentAnalyticsController.getConversionFunnel
)

/**
 * @route GET /api/payment-analytics/failures
 * @desc Get payment failure analysis
 * @access Private (Admin)
 * @query { startDate?: string, endDate?: string }
 */
router.get(
  '/failures',
  PaymentAnalyticsController.getPaymentFailureAnalysisValidation,
  PaymentAnalyticsController.getPaymentFailureAnalysis
)

export default router