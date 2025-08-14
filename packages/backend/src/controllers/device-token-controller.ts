import { Response } from 'express'
import { body, validationResult } from 'express-validator'
import { DeviceTokenService } from '../services/device-token-service'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'

export class DeviceTokenController {
  
  /**
   * Validation rules for registering a device token
   */
  static registerTokenValidation = [
    body('token')
      .notEmpty()
      .withMessage('Device token is required')
      .isLength({ min: 50 })
      .withMessage('Invalid token format'),
    body('platform')
      .isIn(['ios', 'android', 'web'])
      .withMessage('Platform must be ios, android, or web'),
    body('deviceId')
      .optional()
      .isString()
      .withMessage('Device ID must be a string')
  ]

  /**
   * Register a new device token
   */
  static registerToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { token, platform, deviceId } = req.body
    const userId = req.user!.id

    try {
      const deviceToken = await DeviceTokenService.registerToken({
        userId,
        token,
        platform,
        deviceId
      })

      const response: ApiResponse<any> = {
        data: {
          id: deviceToken.id,
          platform: deviceToken.platform,
          isActive: deviceToken.isActive,
          createdAt: deviceToken.createdAt
        },
        message: 'Device token registered successfully',
        timestamp: new Date().toISOString()
      }

      res.status(201).json(response)
    } catch (error) {
      console.error('Error registering device token:', error)
      throw createError('Failed to register device token', 500, 'REGISTRATION_ERROR')
    }
  })

  /**
   * Get user's device tokens
   */
  static getUserTokens = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id
    const platform = req.query.platform as 'ios' | 'android' | 'web' | undefined

    try {
      const tokens = await DeviceTokenService.getUserTokens(userId, platform)

      const response: ApiResponse<any> = {
        data: tokens.map(token => ({
          id: token.id,
          platform: token.platform,
          deviceId: token.deviceId,
          isActive: token.isActive,
          lastUsedAt: token.lastUsedAt,
          createdAt: token.createdAt
        })),
        message: 'Device tokens retrieved successfully',
        timestamp: new Date().toISOString()
      }

      res.json(response)
    } catch (error) {
      console.error('Error getting user tokens:', error)
      throw createError('Failed to retrieve device tokens', 500, 'RETRIEVAL_ERROR')
    }
  })

  /**
   * Deactivate a specific device token
   */
  static deactivateToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { token } = req.params
    const userId = req.user!.id

    if (!token) {
      throw createError('Token parameter is required', 400, 'MISSING_TOKEN')
    }

    try {
      // Verify the token belongs to the authenticated user
      const userTokens = await DeviceTokenService.getUserTokens(userId)
      const tokenExists = userTokens.some(t => t.token === token)

      if (!tokenExists) {
        throw createError('Token not found or access denied', 404, 'TOKEN_NOT_FOUND')
      }

      const success = await DeviceTokenService.deactivateToken(token, 'User requested')

      if (!success) {
        throw createError('Token not found or already inactive', 404, 'TOKEN_NOT_FOUND')
      }

      const response: ApiResponse<any> = {
        data: { success: true },
        message: 'Device token deactivated successfully',
        timestamp: new Date().toISOString()
      }

      res.json(response)
    } catch (error) {
      if (error.code) {
        throw error
      }
      console.error('Error deactivating token:', error)
      throw createError('Failed to deactivate device token', 500, 'DEACTIVATION_ERROR')
    }
  })

  /**
   * Deactivate all tokens for the authenticated user
   */
  static deactivateAllTokens = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id
    const platform = req.query.platform as 'ios' | 'android' | 'web' | undefined

    try {
      const count = await DeviceTokenService.deactivateUserTokens(userId, platform)

      const response: ApiResponse<any> = {
        data: { deactivatedCount: count },
        message: `${count} device token(s) deactivated successfully`,
        timestamp: new Date().toISOString()
      }

      res.json(response)
    } catch (error) {
      console.error('Error deactivating all tokens:', error)
      throw createError('Failed to deactivate device tokens', 500, 'DEACTIVATION_ERROR')
    }
  })

  /**
   * Refresh a device token
   */
  static refreshToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { oldToken, newToken, platform, deviceId } = req.body
    const userId = req.user!.id

    if (!oldToken || !newToken) {
      throw createError('Both old and new tokens are required', 400, 'MISSING_TOKENS')
    }

    try {
      // Verify the old token belongs to the authenticated user
      const userTokens = await DeviceTokenService.getUserTokens(userId)
      const oldTokenExists = userTokens.some(t => t.token === oldToken)

      if (!oldTokenExists) {
        throw createError('Old token not found or access denied', 404, 'TOKEN_NOT_FOUND')
      }

      const refreshedToken = await DeviceTokenService.refreshToken(oldToken, {
        userId,
        token: newToken,
        platform,
        deviceId
      })

      const response: ApiResponse<any> = {
        data: {
          id: refreshedToken.id,
          platform: refreshedToken.platform,
          isActive: refreshedToken.isActive,
          createdAt: refreshedToken.createdAt
        },
        message: 'Device token refreshed successfully',
        timestamp: new Date().toISOString()
      }

      res.json(response)
    } catch (error) {
      if (error.code) {
        throw error
      }
      console.error('Error refreshing token:', error)
      throw createError('Failed to refresh device token', 500, 'REFRESH_ERROR')
    }
  })

  /**
   * Check if a token is active (for debugging)
   */
  static checkTokenStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { token } = req.params
    const userId = req.user!.id

    if (!token) {
      throw createError('Token parameter is required', 400, 'MISSING_TOKEN')
    }

    try {
      // Verify the token belongs to the authenticated user
      const userTokens = await DeviceTokenService.getUserTokens(userId)
      const userToken = userTokens.find(t => t.token === token)

      if (!userToken) {
        throw createError('Token not found or access denied', 404, 'TOKEN_NOT_FOUND')
      }

      const isActive = await DeviceTokenService.isTokenActive(token)

      const response: ApiResponse<any> = {
        data: {
          token: token.substring(0, 10) + '...',
          isActive,
          platform: userToken.platform,
          lastUsedAt: userToken.lastUsedAt
        },
        message: 'Token status retrieved successfully',
        timestamp: new Date().toISOString()
      }

      res.json(response)
    } catch (error) {
      if (error.code) {
        throw error
      }
      console.error('Error checking token status:', error)
      throw createError('Failed to check token status', 500, 'STATUS_CHECK_ERROR')
    }
  })

  /**
   * Admin endpoint to get token statistics
   */
  static getTokenStatistics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // This would typically require admin role check
    try {
      const statistics = await DeviceTokenService.getTokenStatistics()

      const response: ApiResponse<any> = {
        data: statistics,
        message: 'Token statistics retrieved successfully',
        timestamp: new Date().toISOString()
      }

      res.json(response)
    } catch (error) {
      console.error('Error getting token statistics:', error)
      throw createError('Failed to retrieve token statistics', 500, 'STATISTICS_ERROR')
    }
  })
}