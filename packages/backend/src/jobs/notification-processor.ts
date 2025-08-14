import { NotificationService } from '../services/notification-service'
import { PushNotificationService } from '../services/push-notification-service'
import { DeviceTokenModel } from '../models/device-token'
import { DeviceTokenMaintenanceService } from '../services/device-token-service'

export class NotificationProcessor {
  private static isProcessing = false
  private static processingInterval: NodeJS.Timeout | null = null

  /**
   * Start the notification processor
   */
  static start(): void {
    if (this.processingInterval) {
      console.log('Notification processor already running')
      return
    }

    console.log('Starting notification processor...')
    
    // Process notifications every 30 seconds
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processScheduledNotifications()
      }
    }, 30000)

    // Also run cleanup tasks periodically
    setInterval(async () => {
      await this.runCleanupTasks()
    }, 60 * 60 * 1000) // Every hour
  }

  /**
   * Stop the notification processor
   */
  static stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
      console.log('Notification processor stopped')
    }
  }

  /**
   * Process scheduled notifications
   */
  private static async processScheduledNotifications(): Promise<void> {
    if (this.isProcessing) {
      return
    }

    this.isProcessing = true

    try {
      await NotificationService.processScheduledNotifications()
    } catch (error) {
      console.error('Error processing scheduled notifications:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Run cleanup tasks
   */
  private static async runCleanupTasks(): Promise<void> {
    try {
      console.log('Running notification cleanup tasks...')

      // Clean up old notifications (older than 30 days)
      const deletedNotifications = await NotificationService.cleanupOldNotifications(30)
      if (deletedNotifications > 0) {
        console.log(`Cleaned up ${deletedNotifications} old notifications`)
      }

      // Run device token maintenance
      await DeviceTokenMaintenanceService.runDailyMaintenance()

      // Clean up invalid push notification tokens
      const invalidTokens = await PushNotificationService.cleanupInvalidTokens()
      if (invalidTokens > 0) {
        console.log(`Cleaned up ${invalidTokens} invalid push notification tokens`)
      }

      console.log('Notification cleanup tasks completed')
    } catch (error) {
      console.error('Error running cleanup tasks:', error)
    }
  }

  /**
   * Process a single notification immediately
   */
  static async processNotification(notificationId: string): Promise<void> {
    try {
      // This would be used for immediate processing of high-priority notifications
      // Implementation would depend on specific requirements
      console.log(`Processing immediate notification: ${notificationId}`)
    } catch (error) {
      console.error(`Error processing notification ${notificationId}:`, error)
    }
  }

  /**
   * Get processor status
   */
  static getStatus() {
    return {
      isRunning: this.processingInterval !== null,
      isProcessing: this.isProcessing,
      lastProcessed: new Date().toISOString(),
    }
  }
}