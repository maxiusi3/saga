import { createClientSupabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'

export class NotificationTester {
  private supabase = createClientSupabase()

  /**
   * Test notification creation directly
   */
  async createTestNotification(userId: string, type: string = 'test'): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .insert({
          recipient_id: userId,
          sender_id: userId, // Self-notification for testing
          notification_type: type,
          title: 'Test Notification',
          message: 'This is a test notification to verify the system is working.',
          preview_text: 'Test notification preview',
          action_url: '/dashboard',
          created_at: new Date().toISOString()
        })
        .select()

      if (error) {
        console.error('Error creating test notification:', error)
        toast.error(`Failed to create test notification: ${error.message}`)
        return false
      }

      console.log('Test notification created:', data)
      toast.success('Test notification created successfully!')
      return true
    } catch (error) {
      console.error('Error creating test notification:', error)
      toast.error('Failed to create test notification')
      return false
    }
  }

  /**
   * Test story creation notification trigger
   */
  async testStoryNotificationTrigger(projectId: string, userId: string): Promise<boolean> {
    try {
      // Create a test story to trigger the notification
      const { data: story, error: storyError } = await this.supabase
        .from('stories')
        .insert({
          project_id: projectId,
          storyteller_id: userId,
          title: 'Test Story for Notification',
          content: 'This is a test story to verify notification triggers are working.',
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (storyError) {
        console.error('Error creating test story:', storyError)
        toast.error(`Failed to create test story: ${storyError.message}`)
        return false
      }

      console.log('Test story created:', story)
      toast.success('Test story created! Check for notifications.')
      
      // Wait a moment for triggers to fire
      setTimeout(() => {
        this.checkForNewNotifications(userId)
      }, 2000)

      return true
    } catch (error) {
      console.error('Error testing story notification trigger:', error)
      toast.error('Failed to test story notification trigger')
      return false
    }
  }

  /**
   * Check for new notifications
   */
  async checkForNewNotifications(userId: string): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        console.error('Error checking notifications:', error)
        toast.error('Failed to check notifications')
        return
      }

      console.log('Recent notifications:', data)
      
      if (data && data.length > 0) {
        const latestNotification = data[0]
        const createdAt = new Date(latestNotification.created_at)
        const now = new Date()
        const timeDiff = now.getTime() - createdAt.getTime()
        
        // If notification was created in the last 30 seconds
        if (timeDiff < 30000) {
          toast.success(`New notification found: ${latestNotification.title}`)
        } else {
          toast.info(`Latest notification: ${latestNotification.title} (${Math.round(timeDiff / 1000)}s ago)`)
        }
      } else {
        toast.info('No notifications found')
      }
    } catch (error) {
      console.error('Error checking notifications:', error)
      toast.error('Failed to check notifications')
    }
  }

  /**
   * Test real-time notification subscription
   */
  async testRealtimeSubscription(userId: string): Promise<() => void> {
    console.log('Setting up real-time notification subscription for user:', userId)
    
    const channel = this.supabase
      .channel('test-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          console.log('Real-time notification received:', payload)
          toast.success(`Real-time notification: ${payload.new.title}`)
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          toast.success('Real-time notifications enabled!')
        } else if (status === 'CHANNEL_ERROR') {
          toast.error('Failed to enable real-time notifications')
        }
      })

    // Return cleanup function
    return () => {
      console.log('Cleaning up real-time subscription')
      channel.unsubscribe()
    }
  }

  /**
   * Test notification database triggers
   */
  async testDatabaseTriggers(userId: string): Promise<void> {
    try {
      console.log('Testing database triggers...')
      
      // Check if triggers exist
      const { data: triggers, error: triggerError } = await this.supabase
        .rpc('get_triggers_info')
        .select()

      if (triggerError) {
        console.log('Could not check triggers (this is normal if RPC function does not exist)')
      } else {
        console.log('Database triggers:', triggers)
      }

      // Test by creating a notification manually
      await this.createTestNotification(userId, 'trigger_test')
      
    } catch (error) {
      console.error('Error testing database triggers:', error)
      toast.error('Failed to test database triggers')
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId: string): Promise<void> {
    try {
      const { data: notifications, error } = await this.supabase
        .from('notifications')
        .select('notification_type, created_at, is_read')
        .eq('recipient_id', userId)

      if (error) {
        console.error('Error getting notification stats:', error)
        toast.error('Failed to get notification stats')
        return
      }

      const stats = {
        total: notifications?.length || 0,
        unread: notifications?.filter(n => !n.is_read).length || 0,
        byType: notifications?.reduce((acc: any, n) => {
          acc[n.notification_type] = (acc[n.notification_type] || 0) + 1
          return acc
        }, {}) || {}
      }

      console.log('Notification statistics:', stats)
      toast.success(`Found ${stats.total} notifications (${stats.unread} unread)`)
      
      return stats
    } catch (error) {
      console.error('Error getting notification stats:', error)
      toast.error('Failed to get notification stats')
    }
  }

  /**
   * Clean up test notifications
   */
  async cleanupTestNotifications(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .delete()
        .eq('recipient_id', userId)
        .in('notification_type', ['test', 'trigger_test'])

      if (error) {
        console.error('Error cleaning up test notifications:', error)
        toast.error('Failed to clean up test notifications')
        return
      }

      toast.success('Test notifications cleaned up')
    } catch (error) {
      console.error('Error cleaning up test notifications:', error)
      toast.error('Failed to clean up test notifications')
    }
  }
}

// Export singleton instance
export const notificationTester = new NotificationTester()
