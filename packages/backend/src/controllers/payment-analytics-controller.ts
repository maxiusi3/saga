/**
 * Payment Analytics Controller
 * Handles payment analytics and reporting endpoints
 */

import { Request, Response } from 'express'
import { query, validationResult } from 'express-validator'
import { PaymentAnalyticsService } from '../services/payment-analytics-service'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'

export class PaymentAnalyticsController {
  /**
   * Get comprehensive payment analytics
   */
  static getPaymentAnalyticsValidation = [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
    query('groupBy').optional().isIn(['day', 'week', 'month']).withMessage('Group by must be day, week, or month')
  ]

  static getPaymentAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    // TODO: Add admin role check
    // if (!req.user.isAdmin) {
    //   throw createError('Admin access required', 403, 'ADMIN_REQUIRED')
    // }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { startDate, endDate, groupBy } = req.query

    const options = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      groupBy: (groupBy as 'day' | 'week' | 'month') || 'day'
    }

    const analytics = await PaymentAnalyticsService.getPaymentAnalytics(options)

    const response: ApiResponse = {
      data: analytics,
      message: 'Payment analytics retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Get payment metrics
   */
  static getPaymentMetricsValidation = [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
  ]

  static getPaymentMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { startDate, endDate } = req.query

    const options = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    }

    const metrics = await PaymentAnalyticsService.getPaymentMetrics(options)

    const response: ApiResponse = {
      data: metrics,
      message: 'Payment metrics retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Get revenue analytics
   */
  static getRevenueAnalyticsValidation = [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
    query('groupBy').optional().isIn(['day', 'week', 'month']).withMessage('Group by must be day, week, or month')
  ]

  static getRevenueAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { startDate, endDate, groupBy } = req.query

    const options = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      groupBy: (groupBy as 'day' | 'week' | 'month') || 'day'
    }

    const revenueAnalytics = await PaymentAnalyticsService.getRevenueAnalytics(options)

    const response: ApiResponse = {
      data: revenueAnalytics,
      message: 'Revenue analytics retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Get payment method breakdown
   */
  static getPaymentMethodBreakdownValidation = [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
  ]

  static getPaymentMethodBreakdown = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { startDate, endDate } = req.query

    const options = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    }

    const breakdown = await PaymentAnalyticsService.getPaymentMethodBreakdown(options)

    const response: ApiResponse = {
      data: { breakdown },
      message: 'Payment method breakdown retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Get package performance
   */
  static getPackagePerformanceValidation = [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
  ]

  static getPackagePerformance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { startDate, endDate } = req.query

    const options = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    }

    const performance = await PaymentAnalyticsService.getPackagePerformance(options)

    const response: ApiResponse = {
      data: { performance },
      message: 'Package performance retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Get customer lifetime value analytics
   */
  static getCustomerLifetimeValue = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const clvAnalytics = await PaymentAnalyticsService.getCustomerLifetimeValue()

    const response: ApiResponse = {
      data: clvAnalytics,
      message: 'Customer lifetime value analytics retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Get conversion funnel
   */
  static getConversionFunnelValidation = [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
  ]

  static getConversionFunnel = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { startDate, endDate } = req.query

    const options = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    }

    const conversionFunnel = await PaymentAnalyticsService.getConversionFunnel(options)

    const response: ApiResponse = {
      data: conversionFunnel,
      message: 'Conversion funnel retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Get payment failure analysis
   */
  static getPaymentFailureAnalysisValidation = [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
  ]

  static getPaymentFailureAnalysis = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { startDate, endDate } = req.query

    const options = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    }

    const failureAnalysis = await PaymentAnalyticsService.getPaymentFailureAnalysis(options)

    const response: ApiResponse = {
      data: failureAnalysis,
      message: 'Payment failure analysis retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })
}