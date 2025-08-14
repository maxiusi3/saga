/**
 * Push notification message templates
 * Provides consistent, localized push notification messages for all system events
 */

import type { NotificationType } from '@saga/shared/types'

/**
 * Push notification template data interface
 */
export interface PushNotificationTemplateData {
  title: string
  body: string
  data?: Record<string, any>
  badge?: number
  sound?: string
  category?: string
  priority?: 'high' | 'normal'
}

/**
 * Template context for dynamic content
 */
export interface TemplateContext {
  userName?: string
  facilitatorName?: string
  storytellerName?: string
  storyTitle?: string
  projectName?: string
  daysRemaining?: number
  exportType?: string
  interactionType?: string
  [key: string]: any
}

/**
 * Push notification templates organized by notification type
 */
export const PUSH_NOTIFICATION_TEMPLATES: Record<NotificationType, (context: TemplateContext) => PushNotificationTemplateData> = {
  
  // Story-related notifications
  story_uploaded: (context: TemplateContext) => ({
    title: 'New Story Shared',
    body: `${context.storytellerName} shared a new story${context.storyTitle ? `: "${context.storyTitle}"` : ''}`,
    data: {
      type: 'story_uploaded',
      storyId: context.storyId,
      storytellerId: context.storytellerId,
      projectId: context.projectId
    },
    badge: 1,
    sound: 'story_notification.wav',
    category: 'STORY_CATEGORY',
    priority: 'high'
  }),

  story_processed: (context: TemplateContext) => ({
    title: 'Story Ready',
    body: `Your story${context.storyTitle ? ` "${context.storyTitle}"` : ''} has been processed and is ready to view`,
    data: {
      type: 'story_processed',
      storyId: context.storyId
    },
    badge: 1,
    sound: 'default',
    category: 'STORY_CATEGORY',
    priority: 'normal'
  }),

  // Interaction notifications
  interaction_added: (context: TemplateContext) => ({
    title: 'New Comment',
    body: `${context.facilitatorName} commented on your story`,
    data: {
      type: 'interaction_added',
      interactionId: context.interactionId,
      storyId: context.storyId,
      facilitatorId: context.facilitatorId
    },
    badge: 1,
    sound: 'comment_notification.wav',
    category: 'INTERACTION_CATEGORY',
    priority: 'high'
  }),

  follow_up_question: (context: TemplateContext) => ({
    title: 'Follow-up Question',
    body: `${context.facilitatorName} asked a follow-up question about your story`,
    data: {
      type: 'follow_up_question',
      interactionId: context.interactionId,
      storyId: context.storyId,
      facilitatorId: context.facilitatorId
    },
    badge: 1,
    sound: 'question_notification.wav',
    category: 'INTERACTION_CATEGORY',
    priority: 'high'
  }),

  // Export notifications
  export_ready: (context: TemplateContext) => ({
    title: 'Export Ready',
    body: `Your ${context.exportType || 'project'} export is ready for download`,
    data: {
      type: 'export_ready',
      exportId: context.exportId,
      projectId: context.projectId,
      exportType: context.exportType
    },
    badge: 1,
    sound: 'export_ready.wav',
    category: 'EXPORT_CATEGORY',
    priority: 'normal'
  }),

  export_failed: (context: TemplateContext) => ({
    title: 'Export Failed',
    body: `Your ${context.exportType || 'project'} export failed. Please try again.`,
    data: {
      type: 'export_failed',
      projectId: context.projectId,
      exportType: context.exportType,
      errorMessage: context.errorMessage
    },
    badge: 1,
    sound: 'error_notification.wav',
    category: 'EXPORT_CATEGORY',
    priority: 'normal'
  }),

  // Invitation notifications
  invitation_received: (context: TemplateContext) => ({
    title: 'Saga Invitation',
    body: `${context.facilitatorName} invited you to join "${context.projectName}" as a ${context.role}`,
    data: {
      type: 'invitation_received',
      invitationId: context.invitationId,
      projectId: context.projectId,
      facilitatorId: context.facilitatorId,
      role: context.role
    },
    badge: 1,
    sound: 'invitation_notification.wav',
    category: 'INVITATION_CATEGORY',
    priority: 'high'
  }),

  invitation_accepted: (context: TemplateContext) => ({
    title: 'Invitation Accepted',
    body: `${context.userName} accepted your invitation to join "${context.projectName}"`,
    data: {
      type: 'invitation_accepted',
      projectId: context.projectId,
      userId: context.userId
    },
    badge: 1,
    sound: 'success_notification.wav',
    category: 'INVITATION_CATEGORY',
    priority: 'normal'
  }),

  // Subscription notifications
  subscription_expiring: (context: TemplateContext) => ({
    title: 'Subscription Expiring Soon',
    body: `Your Saga subscription expires in ${context.daysRemaining} day${context.daysRemaining !== 1 ? 's' : ''}. Renew to keep sharing stories.`,
    data: {
      type: 'subscription_expiring',
      projectId: context.projectId,
      subscriptionId: context.subscriptionId,
      daysRemaining: context.daysRemaining
    },
    badge: 1,
    sound: 'warning_notification.wav',
    category: 'SUBSCRIPTION_CATEGORY',
    priority: 'high'
  }),

  subscription_expired: (context: TemplateContext) => ({
    title: 'Subscription Expired',
    body: 'Your Saga subscription has expired. Renew now to continue sharing family stories.',
    data: {
      type: 'subscription_expired',
      projectId: context.projectId,
      subscriptionId: context.subscriptionId
    },
    badge: 1,
    sound: 'urgent_notification.wav',
    category: 'SUBSCRIPTION_CATEGORY',
    priority: 'high'
  }),

  subscription_renewed: (context: TemplateContext) => ({
    title: 'Subscription Renewed',
    body: 'Your Saga subscription has been renewed. Continue sharing your family stories!',
    data: {
      type: 'subscription_renewed',
      projectId: context.projectId,
      subscriptionId: context.subscriptionId
    },
    badge: 0, // Clear badge since this is good news
    sound: 'success_notification.wav',
    category: 'SUBSCRIPTION_CATEGORY',
    priority: 'normal'
  }),

  // Project notifications
  project_created: (context: TemplateContext) => ({
    title: 'Project Created',
    body: `Welcome to Saga! Your project "${context.projectName}" is ready for storytelling.`,
    data: {
      type: 'project_created',
      projectId: context.projectId
    },
    badge: 1,
    sound: 'welcome_notification.wav',
    category: 'PROJECT_CATEGORY',
    priority: 'normal'
  }),

  project_archived: (context: TemplateContext) => ({
    title: 'Project Archived',
    body: `Your project "${context.projectName}" has been archived. Stories remain accessible for viewing and export.`,
    data: {
      type: 'project_archived',
      projectId: context.projectId
    },
    badge: 1,
    sound: 'info_notification.wav',
    category: 'PROJECT_CATEGORY',
    priority: 'normal'
  }),

  // User notifications
  user_registered: (context: TemplateContext) => ({
    title: 'Welcome to Saga',
    body: `Welcome ${context.userName}! Start capturing your family's stories today.`,
    data: {
      type: 'user_registered',
      userId: context.userId
    },
    badge: 1,
    sound: 'welcome_notification.wav',
    category: 'USER_CATEGORY',
    priority: 'normal'
  }),

  user_profile_updated: (context: TemplateContext) => ({
    title: 'Profile Updated',
    body: 'Your profile has been successfully updated.',
    data: {
      type: 'user_profile_updated',
      userId: context.userId
    },
    badge: 0,
    sound: 'success_notification.wav',
    category: 'USER_CATEGORY',
    priority: 'normal'
  }),

  // Generic notifications
  system_maintenance: (context: TemplateContext) => ({
    title: 'System Maintenance',
    body: context.message || 'Saga will be undergoing maintenance. We\'ll be back shortly.',
    data: {
      type: 'system_maintenance',
      maintenanceStart: context.maintenanceStart,
      maintenanceEnd: context.maintenanceEnd
    },
    badge: 1,
    sound: 'info_notification.wav',
    category: 'SYSTEM_CATEGORY',
    priority: 'normal'
  }),

  reminder: (context: TemplateContext) => ({
    title: context.reminderTitle || 'Reminder',
    body: context.reminderMessage || 'You have a pending reminder from Saga.',
    data: {
      type: 'reminder',
      reminderId: context.reminderId,
      reminderType: context.reminderType
    },
    badge: 1,
    sound: 'reminder_notification.wav',
    category: 'REMINDER_CATEGORY',
    priority: 'normal'
  })
}

/**
 * Get push notification template for a specific notification type
 */
export function getPushNotificationTemplate(
  type: NotificationType, 
  context: TemplateContext = {}
): PushNotificationTemplateData {
  const template = PUSH_NOTIFICATION_TEMPLATES[type]
  
  if (!template) {
    console.warn(`No push notification template found for type: ${type}`)
    return {
      title: 'Saga Notification',
      body: 'You have a new notification from Saga.',
      data: { type },
      priority: 'normal'
    }
  }

  return template(context)
}

/**
 * Validate push notification data
 */
export function validatePushNotificationData(data: PushNotificationTemplateData): boolean {
  if (!data.title || !data.body) {
    console.error('Push notification must have title and body')
    return false
  }

  if (data.title.length > 100) {
    console.warn('Push notification title is too long (>100 characters)')
  }

  if (data.body.length > 200) {
    console.warn('Push notification body is too long (>200 characters)')
  }

  return true
}

/**
 * Platform-specific push notification categories for iOS
 */
export const IOS_NOTIFICATION_CATEGORIES = {
  STORY_CATEGORY: {
    identifier: 'STORY_CATEGORY',
    actions: [
      {
        identifier: 'VIEW_STORY',
        title: 'View Story',
        options: ['foreground']
      },
      {
        identifier: 'DISMISS',
        title: 'Dismiss',
        options: ['destructive']
      }
    ]
  },
  
  INTERACTION_CATEGORY: {
    identifier: 'INTERACTION_CATEGORY',
    actions: [
      {
        identifier: 'REPLY',
        title: 'Reply',
        options: ['foreground']
      },
      {
        identifier: 'VIEW_STORY',
        title: 'View Story',
        options: ['foreground']
      }
    ]
  },
  
  INVITATION_CATEGORY: {
    identifier: 'INVITATION_CATEGORY',
    actions: [
      {
        identifier: 'ACCEPT_INVITATION',
        title: 'Accept',
        options: ['foreground']
      },
      {
        identifier: 'VIEW_INVITATION',
        title: 'View Details',
        options: ['foreground']
      }
    ]
  },
  
  EXPORT_CATEGORY: {
    identifier: 'EXPORT_CATEGORY',
    actions: [
      {
        identifier: 'DOWNLOAD_EXPORT',
        title: 'Download',
        options: ['foreground']
      }
    ]
  },
  
  SUBSCRIPTION_CATEGORY: {
    identifier: 'SUBSCRIPTION_CATEGORY',
    actions: [
      {
        identifier: 'RENEW_SUBSCRIPTION',
        title: 'Renew',
        options: ['foreground']
      },
      {
        identifier: 'VIEW_SUBSCRIPTION',
        title: 'View Details',
        options: ['foreground']
      }
    ]
  }
}

/**
 * Android notification channels
 */
export const ANDROID_NOTIFICATION_CHANNELS = {
  STORIES: {
    id: 'stories',
    name: 'Stories',
    description: 'Notifications about new stories and story processing',
    importance: 'high',
    sound: 'story_notification'
  },
  
  INTERACTIONS: {
    id: 'interactions',
    name: 'Comments & Questions',
    description: 'Notifications about comments and follow-up questions',
    importance: 'high',
    sound: 'comment_notification'
  },
  
  EXPORTS: {
    id: 'exports',
    name: 'Exports',
    description: 'Notifications about export status',
    importance: 'default',
    sound: 'export_ready'
  },
  
  INVITATIONS: {
    id: 'invitations',
    name: 'Invitations',
    description: 'Notifications about project invitations',
    importance: 'high',
    sound: 'invitation_notification'
  },
  
  SUBSCRIPTIONS: {
    id: 'subscriptions',
    name: 'Subscription',
    description: 'Notifications about subscription status',
    importance: 'high',
    sound: 'warning_notification'
  },
  
  SYSTEM: {
    id: 'system',
    name: 'System',
    description: 'System notifications and maintenance alerts',
    importance: 'default',
    sound: 'info_notification'
  }
}

/**
 * Helper function to get appropriate notification channel for Android
 */
export function getAndroidNotificationChannel(type: NotificationType): string {
  switch (type) {
    case 'story_uploaded':
    case 'story_processed':
      return ANDROID_NOTIFICATION_CHANNELS.STORIES.id
      
    case 'interaction_added':
    case 'follow_up_question':
      return ANDROID_NOTIFICATION_CHANNELS.INTERACTIONS.id
      
    case 'export_ready':
    case 'export_failed':
      return ANDROID_NOTIFICATION_CHANNELS.EXPORTS.id
      
    case 'invitation_received':
    case 'invitation_accepted':
      return ANDROID_NOTIFICATION_CHANNELS.INVITATIONS.id
      
    case 'subscription_expiring':
    case 'subscription_expired':
    case 'subscription_renewed':
      return ANDROID_NOTIFICATION_CHANNELS.SUBSCRIPTIONS.id
      
    default:
      return ANDROID_NOTIFICATION_CHANNELS.SYSTEM.id
  }
}