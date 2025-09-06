export type SagaNotificationType =
  | 'new_story'
  | 'new_comment'
  | 'new_follow_up_question'
  | 'story_response'
  | 'project_invitation'
  | 'member_joined'

export interface SagaNotification {
  id: string
  recipient_id: string
  sender_id?: string
  project_id: string
  story_id?: string
  comment_id?: string
  notification_type: SagaNotificationType
  title: string
  message: string
  preview_text?: string
  action_url?: string
  is_read: boolean
  read_at?: string
  created_at: string
  updated_at: string
  
  // Joined data
  sender_name?: string
  sender_avatar?: string
  project_title?: string
  story_title?: string
}

export interface SagaNotificationSettings {
  id: string
  user_id: string
  project_id?: string
  notification_type: SagaNotificationType
  enabled: boolean
  email_enabled: boolean
  created_at: string
  updated_at: string
}

export interface SagaNotificationGroup {
  type: SagaNotificationType
  count: number
  latest_notification: SagaNotification
  notifications: SagaNotification[]
}

export interface SagaNotificationSummary {
  total_unread: number
  groups: SagaNotificationGroup[]
  recent_notifications: SagaNotification[]
}

/**
 * Get notification display information
 */
export function getNotificationDisplayInfo(type: SagaNotificationType) {
  switch (type) {
    case 'new_story':
      return {
        icon: '📖',
        color: 'text-primary',
        bgColor: 'bg-primary/10',
        label: 'New Story'
      }
    case 'new_comment':
      return {
        icon: '💬',
        color: 'text-secondary',
        bgColor: 'bg-secondary/10',
        label: 'New Comment'
      }
    case 'new_follow_up_question':
      return {
        icon: '❓',
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
        label: 'Follow-up Question'
      }
    case 'story_response':
      return {
        icon: '💭',
        color: 'text-primary',
        bgColor: 'bg-primary/10',
        label: 'Story Activity'
      }
    case 'project_invitation':
      return {
        icon: '📨',
        color: 'text-secondary',
        bgColor: 'bg-secondary/10',
        label: 'Project Invitation'
      }
    case 'member_joined':
      return {
        icon: '👋',
        color: 'text-success',
        bgColor: 'bg-success/10',
        label: 'New Member'
      }
    default:
      return {
        icon: '🔔',
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
        label: 'Notification'
      }
  }
}

/**
 * Format notification time
 */
export function formatNotificationTime(timestamp: string): string {
  const now = new Date()
  const notificationTime = new Date(timestamp)
  const diffInMinutes = Math.floor((now.getTime() - notificationTime.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) {
    return 'Just now'
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  } else if (diffInMinutes < 1440) { // 24 hours
    const hours = Math.floor(diffInMinutes / 60)
    return `${hours}h ago`
  } else if (diffInMinutes < 10080) { // 7 days
    const days = Math.floor(diffInMinutes / 1440)
    return `${days}d ago`
  } else {
    return notificationTime.toLocaleDateString()
  }
}

/**
 * Group notifications by type and recency
 */
export function groupNotifications(notifications: SagaNotification[]): SagaNotificationGroup[] {
  const groups = new Map<SagaNotificationType, SagaNotificationGroup>()

  notifications.forEach(notification => {
    const existing = groups.get(notification.notification_type)
    
    if (existing) {
      existing.count++
      existing.notifications.push(notification)
      // Keep the latest notification as the representative
      if (new Date(notification.created_at) > new Date(existing.latest_notification.created_at)) {
        existing.latest_notification = notification
      }
    } else {
      groups.set(notification.notification_type, {
        type: notification.notification_type,
        count: 1,
        latest_notification: notification,
        notifications: [notification]
      })
    }
  })

  return Array.from(groups.values()).sort((a, b) => 
    new Date(b.latest_notification.created_at).getTime() - 
    new Date(a.latest_notification.created_at).getTime()
  )
}

/**
 * Create notification summary
 */
export function createNotificationSummary(notifications: SagaNotification[]): SagaNotificationSummary {
  const unreadNotifications = notifications.filter(n => !n.is_read)
  const recentNotifications = notifications
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  return {
    total_unread: unreadNotifications.length,
    groups: groupNotifications(unreadNotifications),
    recent_notifications: recentNotifications
  }
}

/**
 * Generate notification message based on type and context
 */
export function generateNotificationMessage(
  type: SagaNotificationType,
  context: {
    senderName?: string
    storyTitle?: string
    projectTitle?: string
    commentPreview?: string
  }
): { title: string; message: string } {
  const { senderName, storyTitle, projectTitle, commentPreview } = context

  switch (type) {
    case 'new_story':
      return {
        title: 'New story recorded',
        message: `${senderName} recorded a new story "${storyTitle}" in ${projectTitle}`
      }
    case 'new_comment':
      return {
        title: 'New comment on your story',
        message: `${senderName} commented on "${storyTitle}"`
      }
    case 'new_follow_up_question':
      return {
        title: 'New follow-up question',
        message: `${senderName} asked a follow-up question on "${storyTitle}"`
      }
    case 'story_response':
      return {
        title: 'New activity on story',
        message: `New activity on "${storyTitle}" in ${projectTitle}`
      }
    case 'project_invitation':
      return {
        title: 'Project invitation',
        message: `${senderName} invited you to join "${projectTitle}"`
      }
    case 'member_joined':
      return {
        title: 'New member joined',
        message: `${senderName} joined "${projectTitle}"`
      }
    default:
      return {
        title: 'Notification',
        message: 'You have a new notification'
      }
  }
}

/**
 * Check if user should receive notification based on their role and settings
 */
export function shouldReceiveNotification(
  notificationType: SagaNotificationType,
  userRole: string,
  isProjectOwner: boolean,
  isStoryteller: boolean,
  settings?: SagaNotificationSettings[]
): boolean {
  // Check user settings first
  const setting = settings?.find(s => s.notification_type === notificationType)
  if (setting && !setting.enabled) {
    return false
  }

  // Role-based notification rules
  switch (notificationType) {
    case 'new_story':
      // Facilitators and co-facilitators receive new story notifications
      return userRole === 'facilitator' || userRole === 'co_facilitator' || isProjectOwner
    
    case 'new_comment':
    case 'new_follow_up_question':
      // Storytellers receive notifications for comments on their stories
      // This is handled at the database level by checking story ownership
      return true
    
    case 'story_response':
      // Facilitators and co-facilitators receive story activity notifications
      return userRole === 'facilitator' || userRole === 'co_facilitator' || isProjectOwner
    
    case 'project_invitation':
    case 'member_joined':
      // All project members receive these notifications
      return true
    
    default:
      return true
  }
}
