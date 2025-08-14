import { NotificationEventDispatcher } from './notification-event-dispatcher'

/**
 * Simplified interface for triggering notification events throughout the application
 * This provides a clean API for other services to trigger notifications without
 * needing to know about the underlying event system
 */
export class NotificationEvents {
  
  /**
   * Trigger when a new story is uploaded
   */
  static async storyUploaded(data: {
    storyId: string
    storytellerId: string
    projectId: string
    storyTitle: string
    storyDuration?: number
  }): Promise<void> {
    await NotificationEventDispatcher.triggerNewStory(data)
  }

  /**
   * Trigger when a story has been processed (transcription, etc.)
   */
  static async storyProcessed(data: {
    storyId: string
    storytellerId: string
    storyTitle: string
    processingTime?: number
  }): Promise<void> {
    await NotificationEventDispatcher.triggerStoryProcessed(data)
  }

  /**
   * Trigger when a new interaction (comment/follow-up) is added
   */
  static async interactionAdded(data: {
    interactionId: string
    storyId: string
    storytellerId: string
    facilitatorId: string
    interactionType: 'comment' | 'follow_up_question'
    content: string
  }): Promise<void> {
    await NotificationEventDispatcher.triggerNewInteraction(data)
  }

  /**
   * Trigger when an export is ready for download
   */
  static async exportReady(data: {
    exportId: string
    userId: string
    projectId: string
    exportType: string
    fileSize?: number
    downloadUrl?: string
  }): Promise<void> {
    await NotificationEventDispatcher.triggerExportReady(data)
  }

  /**
   * Trigger when an invitation is sent
   */
  static async invitationSent(data: {
    invitationId: string
    inviteeEmail: string
    facilitatorId: string
    projectId: string
    role: 'facilitator' | 'storyteller'
  }): Promise<void> {
    await NotificationEventDispatcher.triggerInvitation(data)
  }

  /**
   * Trigger subscription expiring warning
   */
  static async subscriptionExpiring(data: {
    userId: string
    projectId: string
    subscriptionId: string
    daysRemaining: number
  }): Promise<void> {
    await NotificationEventDispatcher.triggerSubscriptionWarning(data)
  }

  /**
   * Trigger when subscription has expired
   */
  static async subscriptionExpired(data: {
    userId: string
    projectId: string
    subscriptionId: string
  }): Promise<void> {
    await NotificationEventDispatcher.triggerSubscriptionExpired(data)
  }

  /**
   * Trigger when export fails
   */
  static async exportFailed(data: {
    userId: string
    projectId: string
    exportType: string
    errorMessage: string
  }): Promise<void> {
    // This would need a custom handler or extend the existing system
    console.error('Export failed notification not yet implemented:', data)
  }

  /**
   * Trigger when a project is created
   */
  static async projectCreated(data: {
    projectId: string
    creatorId: string
    projectName: string
  }): Promise<void> {
    // This could trigger welcome notifications, setup reminders, etc.
    console.log('Project created notification not yet implemented:', data)
  }

  /**
   * Trigger when a user registers
   */
  static async userRegistered(data: {
    userId: string
    userEmail: string
    userName: string
  }): Promise<void> {
    // This could trigger welcome emails, onboarding sequences, etc.
    console.log('User registered notification not yet implemented:', data)
  }

  /**
   * Generic method for custom events
   */
  static async customEvent(eventType: string, data: Record<string, any>): Promise<void> {
    console.log(`Custom event ${eventType} triggered:`, data)
    // This could be extended to support custom event types
  }
}

/**
 * Event constants for consistency across the application
 */
export const NOTIFICATION_EVENTS = {
  // Story events
  STORY_UPLOADED: 'story_uploaded',
  STORY_PROCESSED: 'story_processed',
  
  // Interaction events
  INTERACTION_ADDED: 'interaction_added',
  FOLLOW_UP_QUESTION: 'follow_up_question',
  
  // Export events
  EXPORT_READY: 'export_ready',
  EXPORT_FAILED: 'export_failed',
  
  // Invitation events
  INVITATION_SENT: 'invitation_sent',
  INVITATION_ACCEPTED: 'invitation_accepted',
  
  // Subscription events
  SUBSCRIPTION_EXPIRING: 'subscription_expiring',
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
  
  // Project events
  PROJECT_CREATED: 'project_created',
  PROJECT_ARCHIVED: 'project_archived',
  
  // User events
  USER_REGISTERED: 'user_registered'
} as const

/**
 * Type for event names
 */
export type NotificationEventName = typeof NOTIFICATION_EVENTS[keyof typeof NOTIFICATION_EVENTS]

/**
 * Helper function to validate event names
 */
export function isValidEventName(eventName: string): eventName is NotificationEventName {
  return Object.values(NOTIFICATION_EVENTS).includes(eventName as NotificationEventName)
}