import { NotificationModel } from '../models/notification'
import { NotificationPreferencesModel } from '../models/notification-preferences'
import { DeviceTokenModel } from '../models/device-token'
import { PushNotificationService } from './push-notification-service'
import { EmailNotificationService } from './email-notification-service'
import type { 
  CreateNotificationInput,
  NotificationType,
  NotificationDeliveryMethod,
  NotificationDeliveryResult,
  BulkNotificationInput,
  Notification
} from '@saga/shared/types'

export class NotificationService {
  /**
   * Create and send a notification to a user
   */
  static async createAndSendNotification(data: CreateNotificationInput): Promise<{
    notification: Notification
    deliveryResults: NotificationDeliveryResult[]
  }> {
    // Get user's notification preferences
    const deliveryMethods = data.deliveryMethod || 
      await NotificationPreferencesModel.getDeliveryMethods(data.userId, data.type)

    // Check if user is in quiet hours
    const isQuietHours = await NotificationPreferencesModel.isInQuietHours(data.userId)
    
    // If in quiet hours, schedule for later or filter out push notifications
    let finalDeliveryMethods = deliveryMethods
    let scheduledAt = data.scheduledAt

    if (isQuietHours && !scheduledAt) {
      // For urgent notifications, still send email but delay push
      finalDeliveryMethods = deliveryMethods.filter(method => method !== 'push')
      
      // Schedule push notification for after quiet hours
      if (deliveryMethods.includes('push')) {
        // This would need more sophisticated scheduling logic
        // For now, we'll just delay by 1 hour
        scheduledAt = new Date(Date.now() + 60 * 60 * 1000)
      }
    }

    // Create notification record
    const notification = await NotificationModel.create({
      ...data,
      deliveryMethod: finalDeliveryMethods,
      scheduledAt,
    })

    // Send notification immediately if not scheduled
    let deliveryResults: NotificationDeliveryResult[] = []
    if (!scheduledAt || scheduledAt <= new Date()) {
      deliveryResults = await this.sendNotification(notification)
    }

    return { notification, deliveryResults }
  }

  /**
   * Send a notification using specified delivery methods
   */
  static async sendNotification(notification: Notification): Promise<NotificationDeliveryResult[]> {
    const results: NotificationDeliveryResult[] = []

    for (const method of notification.deliveryMethod) {
      try {
        let result: NotificationDeliveryResult

        switch (method) {
          case 'push':
            result = await this.sendPushNotification(notification)
            break
          case 'email':
            result = await this.sendEmailNotification(notification)
            break
          case 'websocket':
            result = await this.sendWebSocketNotification(notification)
            break
          default:
            result = {
              method,
              success: false,
              error: `Unsupported delivery method: ${method}`,
            }
        }

        results.push(result)
      } catch (error) {
        console.error(`Error sending ${method} notification:`, error)
        results.push({
          method,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Update notification status based on results
    const hasSuccess = results.some(r => r.success)
    const allFailed = results.every(r => !r.success)

    if (hasSuccess) {
      await NotificationModel.update(notification.id, {
        status: 'sent',
        sentAt: new Date(),
      })
    } else if (allFailed) {
      await NotificationModel.update(notification.id, {
        status: 'failed',
      })
    }

    return results
  }

  /**
   * Send push notification
   */
  private static async sendPushNotification(notification: Notification): Promise<NotificationDeliveryResult> {
    try {
      const deviceTokens = await DeviceTokenModel.findByUserId(notification.userId, true)
      
      if (deviceTokens.length === 0) {
        return {
          method: 'push',
          success: false,
          error: 'No active device tokens found',
        }
      }

      const result = await PushNotificationService.sendToUser(notification.userId, {
        title: notification.title,
        body: notification.body,
        data: notification.data,
      })

      return {
        method: 'push',
        success: result.success,
        error: result.error,
        messageId: result.messageId,
      }
    } catch (error) {
      return {
        method: 'push',
        success: false,
        error: error instanceof Error ? error.message : 'Push notification failed',
      }
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(notification: Notification): Promise<NotificationDeliveryResult> {
    try {
      const result = await EmailNotificationService.sendNotificationEmail(
        notification.userId,
        notification.type,
        {
          title: notification.title,
          body: notification.body,
          data: notification.data,
        }
      )

      return {
        method: 'email',
        success: result.success,
        error: result.error,
        messageId: result.messageId,
      }
    } catch (error) {
      return {
        method: 'email',
        success: false,
        error: error instanceof Error ? error.message : 'Email notification failed',
      }
    }
  }

  /**
   * Send WebSocket notification
   */
  private static async sendWebSocketNotification(notification: Notification): Promise<NotificationDeliveryResult> {
    try {
      // This would integrate with the WebSocket system
      // For now, we'll just mark it as successful
      return {
        method: 'websocket',
        success: true,
        messageId: `ws_${notification.id}`,
      }
    } catch (error) {
      return {
        method: 'websocket',
        success: false,
        error: error instanceof Error ? error.message : 'WebSocket notification failed',
      }
    }
  }

  /**
   * Send bulk notifications to multiple users
   */
  static async sendBulkNotification(data: BulkNotificationInput): Promise<{
    notifications: Notification[]
    deliveryResults: NotificationDeliveryResult[][]
  }> {
    const notifications: Notification[] = []
    const deliveryResults: NotificationDeliveryResult[][] = []

    for (const userId of data.userIds) {
      try {
        const result = await this.createAndSendNotification({
          userId,
          type: data.type,
          title: data.title,
          body: data.body,
          data: data.data,
          deliveryMethod: data.deliveryMethod,
        })

        notifications.push(result.notification)
        deliveryResults.push(result.deliveryResults)
      } catch (error) {
        console.error(`Error sending notification to user ${userId}:`, error)
        // Continue with other users even if one fails
      }
    }

    return { notifications, deliveryResults }
  }

  /**
   * Process scheduled notifications
   */
  static async processScheduledNotifications(): Promise<void> {
    const pendingNotifications = await NotificationModel.findPendingNotifications(50)

    for (const notification of pendingNotifications) {
      try {
        await this.sendNotification(notification)
      } catch (error) {
        console.error(`Error processing scheduled notification ${notification.id}:`, error)
        
        // Mark as failed after retries
        await NotificationModel.update(notification.id, {
          status: 'failed',
        })
      }
    }
  }

  /**
   * Get notification templates for different types
   */
  static getNotificationTemplate(type: NotificationType, data?: Record<string, any>) {
    const templates = {
      story_uploaded: {
        title: 'New Story Uploaded',
        body: data?.storytellerName 
          ? `${data.storytellerName} shared a new story: "${data.storyTitle}"`
          : 'A new story has been uploaded to your project',
        emailSubject: 'New Story in Your Saga Project',
      },
      story_processed: {
        title: 'Story Ready',
        body: 'Your story has been processed and is ready to view',
        emailSubject: 'Your Story is Ready',
      },
      interaction_added: {
        title: 'New Comment',
        body: data?.facilitatorName
          ? `${data.facilitatorName} commented on your story`
          : 'Someone commented on your story',
        emailSubject: 'New Comment on Your Story',
      },
      follow_up_question: {
        title: 'Follow-up Question',
        body: data?.facilitatorName
          ? `${data.facilitatorName} asked a follow-up question`
          : 'You have a new follow-up question',
        emailSubject: 'New Follow-up Question',
      },
      export_ready: {
        title: 'Export Ready',
        body: 'Your family stories export is ready for download',
        emailSubject: 'Your Saga Export is Ready',
      },
      invitation_received: {
        title: 'Invitation to Share Stories',
        body: data?.facilitatorName
          ? `${data.facilitatorName} invited you to share your family stories`
          : 'You\'ve been invited to share your family stories',
        emailSubject: 'Invitation to Share Your Family Stories',
      },
      subscription_expiring: {
        title: 'Subscription Expiring Soon',
        body: `Your Saga subscription expires in ${data?.daysRemaining || 7} days`,
        emailSubject: 'Your Saga Subscription is Expiring Soon',
      },
      subscription_expired: {
        title: 'Subscription Expired',
        body: 'Your Saga subscription has expired. Renew to continue sharing stories.',
        emailSubject: 'Your Saga Subscription Has Expired',
      },
      project_archived: {
        title: 'Project Archived',
        body: data?.projectName
          ? `Your project "${data.projectName}" has been archived. You can still view and export all content.`
          : 'Your project has been archived. You can still view and export all content.',
        emailSubject: 'Your Saga Project Has Been Archived',
      },
      subscription_renewed: {
        title: 'Subscription Renewed',
        body: data?.projectName && data?.newExpiryDate
          ? `Your subscription for "${data.projectName}" has been renewed until ${new Date(data.newExpiryDate).toLocaleDateString()}.`
          : 'Your Saga subscription has been renewed.',
        emailSubject: 'Your Saga Subscription Has Been Renewed',
      },
    }

    return templates[type] || {
      title: 'Notification',
      body: 'You have a new notification',
      emailSubject: 'Saga Notification',
    }
  }

  /**
   * Clean up old notifications
   */
  static async cleanupOldNotifications(daysOld = 30): Promise<number> {
    return NotificationModel.deleteOldNotifications(daysOld)
  }

  /**
   * Send archival notification when project transitions to archival mode
   */
  static async sendArchivalNotification(
    userId: string, 
    projectId: string, 
    projectName: string
  ): Promise<void> {
    // Send push notification
    await this.createAndSendNotification({
      userId,
      type: 'project_archived',
      title: 'Project Archived',
      body: `Your project "${projectName}" has been archived. You can still view and export all content.`,
      data: { projectId, projectName },
      deliveryMethod: ['push']
    });

    // Send detailed email using template
    const { EmailNotificationService } = await import('./email-notification-service');
    await EmailNotificationService.sendProjectArchivedEmail(userId, {
      userName: 'User', // This should be fetched from user data
      projectName,
      renewalUrl: `${process.env.WEB_APP_URL}/projects/${projectId}/renew`,
      projectUrl: `${process.env.WEB_APP_URL}/projects/${projectId}`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@saga.app'
    });
  }

  /**
   * Send subscription renewal notification
   */
  static async sendSubscriptionRenewalNotification(
    userId: string,
    projectId: string,
    projectName: string,
    newExpiryDate: Date
  ): Promise<void> {
    // Send push notification
    await this.createAndSendNotification({
      userId,
      type: 'subscription_renewed',
      title: 'Subscription Renewed',
      body: `Your subscription for "${projectName}" has been renewed until ${newExpiryDate.toLocaleDateString()}.`,
      data: { projectId, projectName, newExpiryDate: newExpiryDate.toISOString() },
      deliveryMethod: ['push']
    });

    // Send detailed email using template
    const { EmailNotificationService } = await import('./email-notification-service');
    await EmailNotificationService.sendSubscriptionRenewedEmail(userId, {
      userName: 'User', // This should be fetched from user data
      projectName,
      newExpiryDate: newExpiryDate.toLocaleDateString(),
      projectUrl: `${process.env.WEB_APP_URL}/projects/${projectId}`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@saga.app'
    });
  }

  /**
   * Send expiry warning notification
   */
  static async sendExpiryWarningNotification(
    userId: string,
    projectId: string,
    projectName: string,
    daysUntilExpiry: number
  ): Promise<void> {
    // Send push notification
    await this.createAndSendNotification({
      userId,
      type: 'subscription_expiring',
      title: 'Subscription Expiring Soon',
      body: `Your subscription for "${projectName}" expires in ${daysUntilExpiry} days. Renew to continue adding content.`,
      data: { projectId, projectName, daysUntilExpiry },
      deliveryMethod: ['push']
    });

    // Send detailed email using template
    const { EmailNotificationService } = await import('./email-notification-service');
    await EmailNotificationService.sendSubscriptionExpiringEmail(userId, {
      userName: 'User', // This should be fetched from user data
      projectName,
      daysUntilExpiry,
      renewalUrl: `${process.env.WEB_APP_URL}/projects/${projectId}/renew`,
      projectUrl: `${process.env.WEB_APP_URL}/projects/${projectId}`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@saga.app'
    });
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStats(userId?: string) {
    // This would return statistics about notification delivery rates, etc.
    // Implementation would depend on specific analytics requirements
    return {
      totalSent: 0,
      deliveryRate: 0,
      unreadCount: userId ? await NotificationModel.getUnreadCount(userId) : 0,
    }
  }
}