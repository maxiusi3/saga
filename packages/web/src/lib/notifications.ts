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

  // 统一的鉴权 fetch：自动附带 Supabase access token 与 cookies
  private async authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const { data: { session } } = await this.supabase.auth.getSession()
    const headers = new Headers(init.headers || {})
    // 仅在未显式设置时添加 Content-Type
    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json')
    }
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`)
    }
    return fetch(input, { ...init, headers, credentials: 'include' })
  }

  /**
   * Get all notifications for a user
   */
  async getNotifications(userId: string, limit = 50): Promise<SagaNotification[]> {
    try {
      const response = await this.authFetch(`/api/notifications?limit=${limit}`)
      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching notifications:', error)
      return []
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const response = await this.authFetch('/api/notifications/unread-count')
      if (!response.ok) {
        throw new Error('Failed to fetch unread count')
      }
      const data = await response.json()
      return data.unread_count || 0
    } catch (error) {
      console.error('Error fetching unread count:', error)
      return 0
    }
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
    try {
      const response = await this.authFetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'mark_as_read',
          notification_ids: [notificationId]
        })
      })

      if (!response.ok) {
        throw new Error('Failed to mark notification as read')
      }

      return true
    } catch (error) {
      console.error('Error marking notification as read:', error)
      return false
    }
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
    try {
      const response = await this.authFetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'mark_as_read'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read')
      }

      return true
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      return false
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const response = await this.authFetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete notification')
      }

      return true
    } catch (error) {
      console.error('Error deleting notification:', error)
      return false
    }
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
    // 兜底策略：若 WebSocket/SSL 失败，降级为轮询，避免影响功能
    let pollTimer: NodeJS.Timeout | null = null
    const startPolling = () => {
      if (pollTimer) return
      let lastSeenId: string | null = null
      pollTimer = setInterval(async () => {
        try {
          // 先取未读数量，减少压力；若有变化再取列表
          const unread = await this.getUnreadCount(userId)
          if (unread > 0) {
            const list = await this.getNotifications(userId)
            if (list && list.length > 0) {
              // 寻找新的通知（简单按 id 去重）
              for (const n of list) {
                if (n.id !== lastSeenId) {
                  onNotification(n)
                } else {
                  break
                }
              }
              lastSeenId = list[0]?.id || lastSeenId
            }
          }
        } catch (e) {
          // 轮询失败时静默，避免打扰用户
          console.warn('Notifications polling failed (fallback):', e)
        }
      }, 15000) // 每15秒轮询
    }
    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    try {
      const channel = this.supabase
        .channel(`notifications-${userId}`)
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

      // 订阅并监听状态，失败则降级轮询
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // 成功，若之前有轮询则停掉
          stopPolling()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('Realtime subscription issue, falling back to polling:', status)
          startPolling()
        }
      })

      return {
        unsubscribe: () => {
          try {
            channel.unsubscribe()
          } catch (e) {
            // 忽略
          }
          stopPolling()
        }
      }
    } catch (e) {
      console.warn('Realtime subscribe failed, fallback to polling:', e)
      startPolling()
      return { unsubscribe: stopPolling }
    }
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
