import { Request, Response } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { NotificationModel } from '../models/notification'
import { NotificationPreferencesModel } from '../models/notification-preferences'
import { DeviceTokenModel } from '../models/device-token'
import { NotificationService } from '../services/notification-service'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'

export class NotificationController {
  /**
   * Get user's notifications
   */
  static getNotificationsValidation = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('status').optional().isIn(['pending', 'sent', 'delivered', 'failed', 'read']).withMessage('Invalid status'),
    query('type').optional().isIn([
      'story_uploaded', 'story_processed', 'interaction_added', 'follow_up_question',
      'export_ready', 'invitation_received', 'subscription_expiring', 'subscription_expired'
    ]).withMessage('Invalid notification type'),
  ]

  static getNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { page = 1, limit = 20, status, type } = req.query

    const notifications = await NotificationModel.findByUserId(req.user.id, {
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
      status: status as any,
      type: type as any,
    })

    const unreadCount = await NotificationModel.getUnreadCount(req.user.id)

    const response: ApiResponse = {
      data: {
        notifications,
        unreadCount,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          hasMore: notifications.length === Number(limit),
        },
      },
      message: 'Notifications retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  /**
   * Mark notification as read
   */
  static markAsReadValidation = [
    param('id').isUUID().withMessage('Invalid notification ID format'),
  ]

  static markAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { id } = req.params

    // Verify notification belongs to user
    const notification = await NotificationModel.findById(id)
    if (!notification) {
      throw createError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND')
    }

    if (notification.userId !== req.user.id) {
      throw createError('Access denied', 403, 'ACCESS_DENIED')
    }

    const updatedNotification = await NotificationModel.markAsRead(id)

    const response: ApiResponse = {
      data: updatedNotification,
      message: 'Notification marked as read',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  /**
   * Mark all notifications as read
   */
  static markAllAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const updatedCount = await NotificationModel.markAllAsRead(req.user.id)

    const response: ApiResponse = {
      data: { updatedCount },
      message: 'All notifications marked as read',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  /**
   * Get notification preferences
   */
  static getPreferences = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const preferences = await NotificationPreferencesModel.findOrCreateByUserId(req.user.id)

    const response: ApiResponse = {
      data: preferences,
      message: 'Notification preferences retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  /**
   * Update notification preferences
   */
  static updatePreferencesValidation = [
    body('storyUploaded').optional().isArray().withMessage('Story uploaded must be an array'),
    body('storyUploaded.*').optional().isIn(['push', 'email', 'websocket']).withMessage('Invalid delivery method'),
    body('storyProcessed').optional().isArray().withMessage('Story processed must be an array'),
    body('storyProcessed.*').optional().isIn(['push', 'email', 'websocket']).withMessage('Invalid delivery method'),
    body('interactionAdded').optional().isArray().withMessage('Interaction added must be an array'),
    body('interactionAdded.*').optional().isIn(['push', 'email', 'websocket']).withMessage('Invalid delivery method'),
    body('followUpQuestion').optional().isArray().withMessage('Follow up question must be an array'),
    body('followUpQuestion.*').optional().isIn(['push', 'email', 'websocket']).withMessage('Invalid delivery method'),
    body('exportReady').optional().isArray().withMessage('Export ready must be an array'),
    body('exportReady.*').optional().isIn(['push', 'email', 'websocket']).withMessage('Invalid delivery method'),
    body('invitationReceived').optional().isArray().withMessage('Invitation received must be an array'),
    body('invitationReceived.*').optional().isIn(['push', 'email', 'websocket']).withMessage('Invalid delivery method'),
    body('subscriptionExpiring').optional().isArray().withMessage('Subscription expiring must be an array'),
    body('subscriptionExpiring.*').optional().isIn(['push', 'email', 'websocket']).withMessage('Invalid delivery method'),
    body('subscriptionExpired').optional().isArray().withMessage('Subscription expired must be an array'),
    body('subscriptionExpired.*').optional().isIn(['push', 'email', 'websocket']).withMessage('Invalid delivery method'),
    body('emailEnabled').optional().isBoolean().withMessage('Email enabled must be a boolean'),
    body('pushEnabled').optional().isBoolean().withMessage('Push enabled must be a boolean'),
    body('quietHoursStart').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid quiet hours start format (HH:MM)'),
    body('quietHoursEnd').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid quiet hours end format (HH:MM)'),
    body('timezone').optional().isString().withMessage('Timezone must be a string'),
  ]

  static updatePreferences = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const preferences = await NotificationPreferencesModel.update(req.user.id, req.body)

    const response: ApiResponse = {
      data: preferences,
      message: 'Notification preferences updated successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  /**
   * Register device token for push notifications
   */
  static registerDeviceTokenValidation = [
    body('token').notEmpty().withMessage('Device token is required'),
    body('platform').isIn(['ios', 'android', 'web']).withMessage('Invalid platform'),
    body('deviceId').optional().isString().withMessage('Device ID must be a string'),
  ]

  static registerDeviceToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { token, platform, deviceId } = req.body

    const deviceToken = await DeviceTokenModel.create({
      userId: req.user.id,
      token,
      platform,
      deviceId,
    })

    const response: ApiResponse = {
      data: deviceToken,
      message: 'Device token registered successfully',
      timestamp: new Date().toISOString(),
    }

    res.status(201).json(response)
  })

  /**
   * Get user's device tokens
   */
  static getDeviceTokens = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const deviceTokens = await DeviceTokenModel.findByUserId(req.user.id)

    const response: ApiResponse = {
      data: deviceTokens,
      message: 'Device tokens retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  /**
   * Deactivate device token
   */
  static deactivateDeviceTokenValidation = [
    body('token').notEmpty().withMessage('Device token is required'),
  ]

  static deactivateDeviceToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { token } = req.body

    // Verify token belongs to user
    const deviceToken = await DeviceTokenModel.findByToken(token)
    if (!deviceToken || deviceToken.userId !== req.user.id) {
      throw createError('Device token not found', 404, 'TOKEN_NOT_FOUND')
    }

    const success = await DeviceTokenModel.deactivateToken(token)

    const response: ApiResponse = {
      data: { success },
      message: success ? 'Device token deactivated successfully' : 'Failed to deactivate device token',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  /**
   * Test notification (for development/testing)
   */
  static testNotificationValidation = [
    body('type').isIn([
      'story_uploaded', 'story_processed', 'interaction_added', 'follow_up_question',
      'export_ready', 'invitation_received', 'subscription_expiring', 'subscription_expired'
    ]).withMessage('Invalid notification type'),
    body('title').optional().isString().withMessage('Title must be a string'),
    body('body').optional().isString().withMessage('Body must be a string'),
    body('data').optional().isObject().withMessage('Data must be an object'),
  ]

  static testNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      throw createError('Test notifications not allowed in production', 403, 'NOT_ALLOWED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { type, title, body, data } = req.body

    const template = NotificationService.getNotificationTemplate(type, data)

    const result = await NotificationService.createAndSendNotification({
      userId: req.user.id,
      type,
      title: title || template.title,
      body: body || template.body,
      data,
    })

    const response: ApiResponse = {
      data: result,
      message: 'Test notification sent successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  /**
   * Get notification statistics (admin only)
   */
  static getStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    // This would need admin role checking
    // For now, just return basic stats for the user
    const stats = await NotificationService.getNotificationStats(req.user.id)

    const response: ApiResponse = {
      data: stats,
      message: 'Notification statistics retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })
}