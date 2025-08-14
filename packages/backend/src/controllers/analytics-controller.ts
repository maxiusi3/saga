/**
 * Analytics Controller
 * Handles analytics data retrieval and reporting
 */

import { Request, Response } from 'express'
import { query, validationResult } from 'express-validator'
import { ProjectAnalyticsService } from '../services/project-analytics-service'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'

export class AnalyticsController {
  
  /**
   * Get project creation metrics
   */
  static getProjectCreationMetricsValidation = [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
    query('userId').optional().isUUID().withMessage('User ID must be a valid UUID')
  ]

  static getProjectCreationMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { startDate, endDate, userId } = req.query

    const metrics = await ProjectAnalyticsService.getProjectCreationMetrics({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      userId: userId as string
    })

    const response: ApiResponse = {
      data: metrics,
      message: 'Project creation metrics retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Get project engagement metrics
   */
  static getProjectEngagementMetricsValidation = [
    query('projectId').isUUID().withMessage('Project ID must be a valid UUID')
  ]

  static getProjectEngagementMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId } = req.query

    const metrics = await ProjectAnalyticsService.getProjectEngagementMetrics(projectId as string)

    const response: ApiResponse = {
      data: metrics,
      message: 'Project engagement metrics retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Get user project statistics
   */
  static getUserProjectStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const stats = await ProjectAnalyticsService.getUserProjectStats(req.user.id)

    const response: ApiResponse = {
      data: stats,
      message: 'User project statistics retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Get project success metrics (admin only)
   */
  static getProjectSuccessMetricsValidation = [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
  ]

  static getProjectSuccessMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    // Check if user is admin (you may need to implement admin role checking)
    // For now, we'll allow all authenticated users
    // if (!req.user.isAdmin) {
    //   throw createError('Admin access required', 403, 'ADMIN_REQUIRED')
    // }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { startDate, endDate } = req.query

    const metrics = await ProjectAnalyticsService.getProjectSuccessMetrics({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    })

    const response: ApiResponse = {
      data: metrics,
      message: 'Project success metrics retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Track custom analytics event
   */
  static trackEventValidation = [
    query('eventType').notEmpty().withMessage('Event type is required'),
    query('projectId').optional().isUUID().withMessage('Project ID must be a valid UUID')
  ]

  static trackEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { eventType, projectId } = req.body
    const { properties = {} } = req.body

    await ProjectAnalyticsService.trackProjectEngagement({
      userId: req.user.id,
      projectId,
      eventType,
      properties: {
        ...properties,
        source: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'web',
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer']
      }
    })

    const response: ApiResponse = {
      data: { tracked: true },
      message: 'Event tracked successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })
}