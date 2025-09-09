import { createClientSupabase } from '@/lib/supabase'
import {
  SagaNotification,
  SagaNotificationSettings,
  SagaNotificationSummary,
  SagaNotificationType,
  createNotificationSummary
} from '@saga/shared'

export class NotificationService {
  private supabase = createClientSupabase()

  /**
   * Get all notifications for a user
   */
  async getNotifications(userId: string, limit = 50): Promise<SagaNotification[]> {
    // Return empty array for now since notifications table doesn't exist
    console.log('NotificationService: notifications table not available, returning empty array')
    return []
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    // Return 0 for now since notifications table doesn't exist
    console.log('NotificationService: notifications table not available, returning 0 unread count')
    return 0
  }

  /**
   * Get notification summary with grouping
   */
  async getNotificationSummary(userId: string): Promise<SagaNotificationSummary> {
    const notifications = await this.getNotifications(userId, 100)
    return createNotificationSummary(notifications)
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', notificationId)

    if (error) {
      console.error('Error marking notification as read:', error)
      return false
    }

    return true
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(notificationIds: string[]): Promise<boolean> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .in('id', notificationIds)

    if (error) {
      console.error('Error marking notifications as read:', error)
      return false
    }

    return true
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('recipient_id', userId)
      .eq('is_read', false)

    if (error) {
      console.error('Error marking all notifications as read:', error)
      return false
    }

    return true
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (error) {
      console.error('Error deleting notification:', error)
      return false
    }

    return true
  }

  /**
   * Delete old notifications (older than 30 days)
   */
  async cleanupOldNotifications(userId: string): Promise<boolean> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { error } = await this.supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', userId)
      .lt('created_at', thirtyDaysAgo.toISOString())

    if (error) {
      console.error('Error cleaning up old notifications:', error)
      return false
    }

    return true
  }

  /**
   * Get notification settings for a user
   */
  async getNotificationSettings(userId: string, projectId?: string): Promise<SagaNotificationSettings[]> {
    let query = this.supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching notification settings:', error)
      return []
    }

    return data || []
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(
    userId: string,
    projectId: string | null,
    notificationType: SagaNotificationType,
    enabled: boolean,
    emailEnabled: boolean = false
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('notification_settings')
      .upsert({
        user_id: userId,
        project_id: projectId,
        notification_type: notificationType,
        enabled,
        email_enabled: emailEnabled,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error updating notification settings:', error)
      return false
    }

    return true
  }

  /**
   * Subscribe to real-time notifications
   */
  subscribeToNotifications(
    userId: string,
    onNotification: (notification: SagaNotification) => void
  ) {
    return this.supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`
        },
        (payload: any) => {
          onNotification(payload.new as SagaNotification)
        }
      )
      .subscribe()
  }

  /**
   * Create a manual notification (for testing or admin purposes)
   */
  async createNotification(notification: Partial<SagaNotification>): Promise<boolean> {
    const { error } = await this.supabase
      .from('notifications')
      .insert(notification)

    if (error) {
      console.error('Error creating notification:', error)
      return false
    }

    return true
  }

  /**
   * Auto-mark notifications as read when user visits the linked content
   */
  async markNotificationsAsReadByUrl(userId: string, actionUrl: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('recipient_id', userId)
      .eq('action_url', actionUrl)
      .eq('is_read', false)

    if (error) {
      console.error('Error auto-marking notifications as read:', error)
      return false
    }

    return true
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
