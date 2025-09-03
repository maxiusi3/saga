import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { notificationService } from '@/lib/notifications'
import {
  SagaNotification,
  SagaNotificationSummary,
  SagaNotificationSettings,
  SagaNotificationType
} from '@saga/shared'

interface UseNotificationsReturn {
  notifications: SagaNotification[]
  unreadCount: number
  summary: SagaNotificationSummary | null
  loading: boolean
  error: string | null
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Hook for managing user notifications
 */
export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState<SagaNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [summary, setSummary] = useState<SagaNotificationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      setNotifications([])
      setUnreadCount(0)
      setSummary(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const [notificationsData, unreadCountData, summaryData] = await Promise.all([
        notificationService.getNotifications(user.id),
        notificationService.getUnreadCount(user.id),
        notificationService.getNotificationSummary(user.id)
      ])

      setNotifications(notificationsData)
      setUnreadCount(unreadCountData)
      setSummary(summaryData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user?.id) return

    try {
      const success = await notificationService.markAsRead(notificationId)
      if (success) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId 
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read')
    }
  }, [user?.id])

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return

    try {
      const success = await notificationService.markAllAsRead(user.id)
      if (success) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        )
        setUnreadCount(0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all notifications as read')
    }
  }, [user?.id])

  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user?.id) return

    try {
      const success = await notificationService.deleteNotification(notificationId)
      if (success) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        // Update unread count if the deleted notification was unread
        const deletedNotification = notifications.find(n => n.id === notificationId)
        if (deletedNotification && !deletedNotification.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notification')
    }
  }, [user?.id, notifications])

  // Set up real-time subscription
  useEffect(() => {
    if (!user?.id) return

    const subscription = notificationService.subscribeToNotifications(
      user.id,
      (newNotification) => {
        setNotifications(prev => [newNotification, ...prev])
        setUnreadCount(prev => prev + 1)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [user?.id])

  // Initial fetch
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    summary,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications
  }
}

interface UseNotificationSettingsReturn {
  settings: SagaNotificationSettings[]
  loading: boolean
  error: string | null
  updateSetting: (
    projectId: string | null,
    notificationType: SagaNotificationType,
    enabled: boolean,
    emailEnabled?: boolean
  ) => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Hook for managing notification settings
 */
export function useNotificationSettings(projectId?: string): UseNotificationSettingsReturn {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<SagaNotificationSettings[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      setError(null)
      const settingsData = await notificationService.getNotificationSettings(user.id, projectId)
      setSettings(settingsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notification settings')
    } finally {
      setLoading(false)
    }
  }, [user?.id, projectId])

  const updateSetting = useCallback(async (
    projectId: string | null,
    notificationType: SagaNotificationType,
    enabled: boolean,
    emailEnabled: boolean = false
  ) => {
    if (!user?.id) return

    try {
      const success = await notificationService.updateNotificationSettings(
        user.id,
        projectId,
        notificationType,
        enabled,
        emailEnabled
      )
      
      if (success) {
        await fetchSettings() // Refresh settings
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification settings')
    }
  }, [user?.id, fetchSettings])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  return {
    settings,
    loading,
    error,
    updateSetting,
    refresh: fetchSettings
  }
}

/**
 * Hook for auto-marking notifications as read when visiting linked content
 */
export function useAutoMarkNotificationsRead(actionUrl: string) {
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user?.id || !actionUrl) return

    const markAsRead = async () => {
      try {
        await notificationService.markNotificationsAsReadByUrl(user.id, actionUrl)
      } catch (err) {
        console.error('Failed to auto-mark notifications as read:', err)
      }
    }

    // Mark as read after a short delay to ensure the page has loaded
    const timer = setTimeout(markAsRead, 1000)
    return () => clearTimeout(timer)
  }, [user?.id, actionUrl])
}
