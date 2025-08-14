import { DeviceTokenModel } from '../models/device-token'
import type { DeviceToken, CreateDeviceTokenInput } from '@saga/shared/types'

/**
 * Service for managing user device tokens for push notifications
 */
export class DeviceTokenService {
  
  /**
   * Register a new device token for a user
   */
  static async registerToken(data: CreateDeviceTokenInput): Promise<DeviceToken> {
    try {
      // Validate token format based on platform
      this.validateTokenFormat(data.token, data.platform)
      
      // Create or update the device token
      const deviceToken = await DeviceTokenModel.create(data)
      
      console.log(`Device token registered for user ${data.userId} on ${data.platform}`)
      return deviceToken
    } catch (error) {
      console.error('Error registering device token:', error)
      throw error
    }
  }

  /**
   * Get all active tokens for a user
   */
  static async getUserTokens(userId: string, platform?: 'ios' | 'android' | 'web'): Promise<DeviceToken[]> {
    try {
      const tokens = await DeviceTokenModel.findByUserId(userId, true)
      
      if (platform) {
        return tokens.filter(token => token.platform === platform)
      }
      
      return tokens
    } catch (error) {
      console.error(`Error getting tokens for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Get active tokens for multiple users
   */
  static async getTokensForUsers(userIds: string[], platform?: 'ios' | 'android' | 'web'): Promise<DeviceToken[]> {
    try {
      const tokens = await DeviceTokenModel.findActiveTokensByUserIds(userIds)
      
      if (platform) {
        return tokens.filter(token => token.platform === platform)
      }
      
      return tokens
    } catch (error) {
      console.error('Error getting tokens for multiple users:', error)
      throw error
    }
  }

  /**
   * Update the last used timestamp for a token
   */
  static async updateTokenUsage(token: string): Promise<void> {
    try {
      await DeviceTokenModel.updateLastUsed(token)
    } catch (error) {
      console.error(`Error updating token usage for ${token}:`, error)
      // Don't throw here as this is not critical
    }
  }

  /**
   * Deactivate a specific token
   */
  static async deactivateToken(token: string, reason?: string): Promise<boolean> {
    try {
      const success = await DeviceTokenModel.deactivateToken(token)
      
      if (success) {
        console.log(`Device token deactivated: ${token.substring(0, 10)}... ${reason ? `(${reason})` : ''}`)
      }
      
      return success
    } catch (error) {
      console.error(`Error deactivating token ${token}:`, error)
      throw error
    }
  }

  /**
   * Deactivate all tokens for a user
   */
  static async deactivateUserTokens(userId: string, platform?: 'ios' | 'android' | 'web'): Promise<number> {
    try {
      const count = await DeviceTokenModel.deactivateUserTokens(userId, platform)
      console.log(`Deactivated ${count} tokens for user ${userId}${platform ? ` on ${platform}` : ''}`)
      return count
    } catch (error) {
      console.error(`Error deactivating tokens for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Handle invalid tokens (e.g., from FCM/APNS feedback)
   */
  static async handleInvalidTokens(invalidTokens: string[]): Promise<number> {
    try {
      if (invalidTokens.length === 0) {
        return 0
      }

      const count = await DeviceTokenModel.bulkDeactivateTokens(invalidTokens)
      console.log(`Deactivated ${count} invalid tokens`)
      return count
    } catch (error) {
      console.error('Error handling invalid tokens:', error)
      throw error
    }
  }

  /**
   * Clean up old inactive tokens
   */
  static async cleanupInactiveTokens(daysInactive = 30): Promise<number> {
    try {
      const count = await DeviceTokenModel.cleanupInactiveTokens(daysInactive)
      console.log(`Cleaned up ${count} inactive tokens older than ${daysInactive} days`)
      return count
    } catch (error) {
      console.error('Error cleaning up inactive tokens:', error)
      throw error
    }
  }

  /**
   * Get token statistics for monitoring
   */
  static async getTokenStatistics(): Promise<{
    totalActive: number
    totalInactive: number
    byPlatform: Record<string, number>
    recentlyUsed: number
  }> {
    try {
      // This would require additional database queries
      // For now, return placeholder data
      return {
        totalActive: 0,
        totalInactive: 0,
        byPlatform: {
          ios: 0,
          android: 0,
          web: 0
        },
        recentlyUsed: 0
      }
    } catch (error) {
      console.error('Error getting token statistics:', error)
      throw error
    }
  }

  /**
   * Validate token format based on platform
   */
  private static validateTokenFormat(token: string, platform: 'ios' | 'android' | 'web'): void {
    if (!token || token.trim().length === 0) {
      throw new Error('Device token cannot be empty')
    }

    switch (platform) {
      case 'ios':
        // iOS tokens are typically 64 characters (hex) or longer for newer formats
        if (token.length < 64) {
          throw new Error('Invalid iOS device token format')
        }
        break
      
      case 'android':
        // FCM tokens are typically much longer and contain various characters
        if (token.length < 100) {
          throw new Error('Invalid Android/FCM device token format')
        }
        break
      
      case 'web':
        // Web push tokens can vary in length
        if (token.length < 50) {
          throw new Error('Invalid web push token format')
        }
        break
      
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  /**
   * Check if a token exists and is active
   */
  static async isTokenActive(token: string): Promise<boolean> {
    try {
      const deviceToken = await DeviceTokenModel.findByToken(token)
      return deviceToken !== null && deviceToken.isActive
    } catch (error) {
      console.error(`Error checking token status for ${token}:`, error)
      return false
    }
  }

  /**
   * Get tokens grouped by platform for bulk operations
   */
  static async getTokensByPlatform(userIds: string[]): Promise<{
    ios: DeviceToken[]
    android: DeviceToken[]
    web: DeviceToken[]
  }> {
    try {
      const [iosTokens, androidTokens, webTokens] = await Promise.all([
        DeviceTokenModel.getTokensByPlatform(userIds, 'ios'),
        DeviceTokenModel.getTokensByPlatform(userIds, 'android'),
        DeviceTokenModel.getTokensByPlatform(userIds, 'web')
      ])

      return {
        ios: iosTokens,
        android: androidTokens,
        web: webTokens
      }
    } catch (error) {
      console.error('Error getting tokens by platform:', error)
      throw error
    }
  }

  /**
   * Register multiple tokens for a user (useful for multi-device scenarios)
   */
  static async registerMultipleTokens(tokens: CreateDeviceTokenInput[]): Promise<DeviceToken[]> {
    try {
      const results = await Promise.allSettled(
        tokens.map(tokenData => this.registerToken(tokenData))
      )

      const successful: DeviceToken[] = []
      const failed: string[] = []

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value)
        } else {
          failed.push(`Token ${index}: ${result.reason.message}`)
        }
      })

      if (failed.length > 0) {
        console.warn('Some token registrations failed:', failed)
      }

      return successful
    } catch (error) {
      console.error('Error registering multiple tokens:', error)
      throw error
    }
  }

  /**
   * Refresh a token (deactivate old, activate new)
   */
  static async refreshToken(oldToken: string, newTokenData: CreateDeviceTokenInput): Promise<DeviceToken> {
    try {
      // Deactivate the old token
      await this.deactivateToken(oldToken, 'Token refresh')
      
      // Register the new token
      const newToken = await this.registerToken(newTokenData)
      
      console.log(`Token refreshed for user ${newTokenData.userId}`)
      return newToken
    } catch (error) {
      console.error('Error refreshing token:', error)
      throw error
    }
  }
}

/**
 * Background job for token maintenance
 */
export class DeviceTokenMaintenanceService {
  
  /**
   * Run daily maintenance tasks
   */
  static async runDailyMaintenance(): Promise<void> {
    try {
      console.log('Starting device token maintenance...')
      
      // Clean up old inactive tokens
      const cleanedUp = await DeviceTokenService.cleanupInactiveTokens(30)
      
      // Get statistics for monitoring
      const stats = await DeviceTokenService.getTokenStatistics()
      
      console.log('Device token maintenance completed:', {
        cleanedUpTokens: cleanedUp,
        statistics: stats
      })
    } catch (error) {
      console.error('Error during device token maintenance:', error)
    }
  }

  /**
   * Handle feedback from push notification services
   */
  static async processPushFeedback(feedback: {
    invalidTokens: string[]
    unregisteredTokens: string[]
  }): Promise<void> {
    try {
      const allInvalidTokens = [...feedback.invalidTokens, ...feedback.unregisteredTokens]
      
      if (allInvalidTokens.length > 0) {
        await DeviceTokenService.handleInvalidTokens(allInvalidTokens)
      }
    } catch (error) {
      console.error('Error processing push feedback:', error)
    }
  }
}