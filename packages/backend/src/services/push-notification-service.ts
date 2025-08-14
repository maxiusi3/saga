import { firebaseAdmin } from '../config/firebase'
import { DeviceTokenModel } from '../models/device-token'
import { DeviceTokenService } from './device-token-service'
import type { DeviceToken } from '@saga/shared/types'

export interface PushNotificationPayload {
  title: string
  body: string
  data?: Record<string, any>
  imageUrl?: string
  clickAction?: string
}

export interface PushNotificationResult {
  success: boolean
  messageId?: string
  error?: string
  failedTokens?: string[]
}

export class PushNotificationService {
  /**
   * Send push notification to a specific user
   */
  static async sendToUser(userId: string, payload: PushNotificationPayload): Promise<PushNotificationResult> {
    try {
      const deviceTokens = await DeviceTokenService.getUserTokens(userId)
      
      if (deviceTokens.length === 0) {
        return {
          success: false,
          error: 'No active device tokens found for user',
        }
      }

      const tokens = deviceTokens.map(dt => dt.token)
      const result = await this.sendToTokens(tokens, payload)
      
      // Handle failed tokens by deactivating them
      if (result.failedTokens && result.failedTokens.length > 0) {
        await DeviceTokenService.handleInvalidTokens(result.failedTokens)
      }
      
      return result
    } catch (error) {
      console.error('Error sending push notification to user:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send push notification to multiple users
   */
  static async sendToUsers(userIds: string[], payload: PushNotificationPayload): Promise<PushNotificationResult> {
    try {
      const deviceTokens = await DeviceTokenModel.findActiveTokensByUserIds(userIds)
      
      if (deviceTokens.length === 0) {
        return {
          success: false,
          error: 'No active device tokens found for users',
        }
      }

      const tokens = deviceTokens.map(dt => dt.token)
      return this.sendToTokens(tokens, payload)
    } catch (error) {
      console.error('Error sending push notification to users:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send push notification to specific device tokens
   */
  static async sendToTokens(tokens: string[], payload: PushNotificationPayload): Promise<PushNotificationResult> {
    try {
      if (tokens.length === 0) {
        return {
          success: false,
          error: 'No tokens provided',
        }
      }

      // Prepare the message
      const message = {
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data ? this.stringifyData(payload.data) : undefined,
        android: {
          notification: {
            clickAction: payload.clickAction || 'FLUTTER_NOTIFICATION_CLICK',
            channelId: 'saga_notifications',
            priority: 'high' as const,
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
              },
              badge: 1,
              sound: 'default',
              category: payload.clickAction,
            },
          },
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            image: payload.imageUrl,
            requireInteraction: false,
            actions: payload.clickAction ? [
              {
                action: payload.clickAction,
                title: 'View',
              },
            ] : undefined,
          },
        },
        tokens,
      }

      // Send the message
      const response = await firebaseAdmin.messaging().sendEachForMulticast(message)

      // Handle failed tokens
      const failedTokens: string[] = []
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const token = tokens[idx]
            failedTokens.push(token)
            
            // Handle specific error cases
            if (resp.error?.code === 'messaging/registration-token-not-registered' ||
                resp.error?.code === 'messaging/invalid-registration-token') {
              // Deactivate invalid tokens
              DeviceTokenModel.deactivateToken(token).catch(err => {
                console.error('Error deactivating token:', err)
              })
            }
          }
        })
      }

      return {
        success: response.successCount > 0,
        messageId: response.responses.find(r => r.success)?.messageId,
        error: response.failureCount > 0 ? `${response.failureCount} tokens failed` : undefined,
        failedTokens: failedTokens.length > 0 ? failedTokens : undefined,
      }
    } catch (error) {
      console.error('Error sending push notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send push notification to a topic (for broadcast messages)
   */
  static async sendToTopic(topic: string, payload: PushNotificationPayload): Promise<PushNotificationResult> {
    try {
      const message = {
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data ? this.stringifyData(payload.data) : undefined,
        topic,
      }

      const messageId = await firebaseAdmin.messaging().send(message)

      return {
        success: true,
        messageId,
      }
    } catch (error) {
      console.error('Error sending push notification to topic:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Subscribe device tokens to a topic
   */
  static async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    try {
      await firebaseAdmin.messaging().subscribeToTopic(tokens, topic)
      console.log(`Subscribed ${tokens.length} tokens to topic: ${topic}`)
    } catch (error) {
      console.error('Error subscribing to topic:', error)
      throw error
    }
  }

  /**
   * Unsubscribe device tokens from a topic
   */
  static async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    try {
      await firebaseAdmin.messaging().unsubscribeFromTopic(tokens, topic)
      console.log(`Unsubscribed ${tokens.length} tokens from topic: ${topic}`)
    } catch (error) {
      console.error('Error unsubscribing from topic:', error)
      throw error
    }
  }

  /**
   * Validate a device token
   */
  static async validateToken(token: string): Promise<boolean> {
    try {
      // Try to send a dry-run message to validate the token
      await firebaseAdmin.messaging().send({
        token,
        notification: {
          title: 'Test',
          body: 'Test',
        },
      }, true) // dry-run mode

      return true
    } catch (error: any) {
      if (error.code === 'messaging/registration-token-not-registered' ||
          error.code === 'messaging/invalid-registration-token') {
        return false
      }
      
      // For other errors, assume token is valid
      return true
    }
  }

  /**
   * Clean up invalid device tokens
   */
  static async cleanupInvalidTokens(): Promise<number> {
    try {
      // Get all active tokens
      const allTokens = await DeviceTokenModel.db('device_tokens')
        .where('is_active', true)
        .select('token')

      let invalidCount = 0
      const batchSize = 100

      // Process tokens in batches
      for (let i = 0; i < allTokens.length; i += batchSize) {
        const batch = allTokens.slice(i, i + batchSize)
        const tokens = batch.map(t => t.token)

        try {
          // Send a dry-run message to validate tokens
          const response = await firebaseAdmin.messaging().sendEachForMulticast({
            tokens,
            notification: {
              title: 'Test',
              body: 'Test',
            },
          }, true) // dry-run mode

          // Deactivate failed tokens
          const invalidTokens: string[] = []
          response.responses.forEach((resp, idx) => {
            if (!resp.success && 
                (resp.error?.code === 'messaging/registration-token-not-registered' ||
                 resp.error?.code === 'messaging/invalid-registration-token')) {
              invalidTokens.push(tokens[idx])
            }
          })

          if (invalidTokens.length > 0) {
            await DeviceTokenModel.bulkDeactivateTokens(invalidTokens)
            invalidCount += invalidTokens.length
          }
        } catch (error) {
          console.error('Error validating token batch:', error)
        }
      }

      console.log(`Cleaned up ${invalidCount} invalid device tokens`)
      return invalidCount
    } catch (error) {
      console.error('Error cleaning up invalid tokens:', error)
      return 0
    }
  }

  /**
   * Convert data object to string values (required by FCM)
   */
  private static stringifyData(data: Record<string, any>): Record<string, string> {
    const stringData: Record<string, string> = {}
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        stringData[key] = value
      } else {
        stringData[key] = JSON.stringify(value)
      }
    }

    return stringData
  }

  /**
   * Get push notification statistics
   */
  static async getStats() {
    const activeTokens = await DeviceTokenModel.db('device_tokens')
      .where('is_active', true)
      .count('* as count')
      .first()

    const tokensByPlatform = await DeviceTokenModel.db('device_tokens')
      .where('is_active', true)
      .groupBy('platform')
      .select('platform')
      .count('* as count')

    return {
      activeTokens: parseInt(activeTokens?.count as string) || 0,
      platformBreakdown: tokensByPlatform.reduce((acc, item) => {
        acc[item.platform] = parseInt(item.count as string)
        return acc
      }, {} as Record<string, number>),
    }
  }
}