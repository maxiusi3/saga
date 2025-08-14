import { NotificationService } from './notification-service'
import { UserModel } from '../models/user'
import { ProjectModel } from '../models/project'
import type { NotificationType } from '@saga/shared/types'

/**
 * Base interface for all notification events
 */
export interface BaseNotificationEvent {
  eventType: NotificationType
  timestamp: Date
  metadata?: Record<string, any>
}

/**
 * System event types that can trigger notifications
 */
export enum SystemEventType {
  // Story events
  NEW_STORY = 'NEW_STORY',
  STORY_PROCESSED = 'STORY_PROCESSED',
  
  // Interaction events
  NEW_INTERACTION = 'NEW_INTERACTION',
  NEW_FOLLOW_UP_QUESTION = 'NEW_FOLLOW_UP_QUESTION',
  
  // Export events
  EXPORT_READY = 'EXPORT_READY',
  EXPORT_FAILED = 'EXPORT_FAILED',
  
  // Invitation events
  INVITATION_SENT = 'INVITATION_SENT',
  INVITATION_ACCEPTED = 'INVITATION_ACCEPTED',
  
  // Subscription events
  SUBSCRIPTION_WARNING = 'SUBSCRIPTION_WARNING',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_RENEWED = 'SUBSCRIPTION_RENEWED',
  
  // Project events
  PROJECT_CREATED = 'PROJECT_CREATED',
  PROJECT_ARCHIVED = 'PROJECT_ARCHIVED',
  
  // User events
  USER_REGISTERED = 'USER_REGISTERED',
  USER_PROFILE_UPDATED = 'USER_PROFILE_UPDATED'
}

/**
 * Event data interfaces for type safety
 */
export interface NewStoryEvent extends BaseNotificationEvent {
  eventType: 'story_uploaded'
  storyId: string
  storytellerId: string
  projectId: string
  storyTitle: string
  storyDuration?: number
}

export interface StoryProcessedEvent extends BaseNotificationEvent {
  eventType: 'story_processed'
  storyId: string
  storytellerId: string
  storyTitle: string
  processingTime?: number
}

export interface NewInteractionEvent extends BaseNotificationEvent {
  eventType: 'interaction_added' | 'follow_up_question'
  interactionId: string
  storyId: string
  storytellerId: string
  facilitatorId: string
  interactionType: 'comment' | 'follow_up_question'
  content: string
}

export interface ExportReadyEvent extends BaseNotificationEvent {
  eventType: 'export_ready'
  exportId: string
  userId: string
  projectId: string
  exportType: string
  fileSize?: number
  downloadUrl?: string
}

export interface InvitationEvent extends BaseNotificationEvent {
  eventType: 'invitation_received'
  invitationId: string
  inviteeEmail: string
  facilitatorId: string
  projectId: string
  role: 'facilitator' | 'storyteller'
}

export interface SubscriptionEvent extends BaseNotificationEvent {
  eventType: 'subscription_expiring' | 'subscription_expired'
  userId: string
  projectId: string
  daysRemaining?: number
  subscriptionId: string
}

/**
 * Union type for all possible events
 */
export type NotificationEvent = 
  | NewStoryEvent 
  | StoryProcessedEvent 
  | NewInteractionEvent 
  | ExportReadyEvent 
  | InvitationEvent 
  | SubscriptionEvent

/**
 * Event handler interface
 */
export interface NotificationEventHandler<T extends NotificationEvent = NotificationEvent> {
  canHandle(event: NotificationEvent): event is T
  handle(event: T): Promise<void>
}

/**
 * Main notification event dispatcher
 */
export class NotificationEventDispatcher {
  private static handlers: NotificationEventHandler[] = []

  /**
   * Register an event handler
   */
  static registerHandler(handler: NotificationEventHandler): void {
    this.handlers.push(handler)
  }

  /**
   * Dispatch an event to all registered handlers
   */
  static async dispatch(event: NotificationEvent): Promise<void> {
    const applicableHandlers = this.handlers.filter(handler => handler.canHandle(event))
    
    if (applicableHandlers.length === 0) {
      console.warn(`No handlers found for event type: ${event.eventType}`)
      return
    }

    // Process handlers in parallel for better performance
    const promises = applicableHandlers.map(handler => 
      handler.handle(event as any).catch(error => {
        console.error(`Error in notification handler for ${event.eventType}:`, error)
      })
    )

    await Promise.allSettled(promises)
  }

  /**
   * Convenience method to trigger story uploaded event
   */
  static async triggerNewStory(data: Omit<NewStoryEvent, 'eventType' | 'timestamp'>): Promise<void> {
    const event: NewStoryEvent = {
      ...data,
      eventType: 'story_uploaded',
      timestamp: new Date()
    }
    await this.dispatch(event)
  }

  /**
   * Convenience method to trigger story processed event
   */
  static async triggerStoryProcessed(data: Omit<StoryProcessedEvent, 'eventType' | 'timestamp'>): Promise<void> {
    const event: StoryProcessedEvent = {
      ...data,
      eventType: 'story_processed',
      timestamp: new Date()
    }
    await this.dispatch(event)
  }

  /**
   * Convenience method to trigger interaction event
   */
  static async triggerNewInteraction(data: Omit<NewInteractionEvent, 'eventType' | 'timestamp'>): Promise<void> {
    const event: NewInteractionEvent = {
      ...data,
      eventType: data.interactionType === 'follow_up_question' ? 'follow_up_question' : 'interaction_added',
      timestamp: new Date()
    }
    await this.dispatch(event)
  }

  /**
   * Convenience method to trigger export ready event
   */
  static async triggerExportReady(data: Omit<ExportReadyEvent, 'eventType' | 'timestamp'>): Promise<void> {
    const event: ExportReadyEvent = {
      ...data,
      eventType: 'export_ready',
      timestamp: new Date()
    }
    await this.dispatch(event)
  }

  /**
   * Convenience method to trigger invitation event
   */
  static async triggerInvitation(data: Omit<InvitationEvent, 'eventType' | 'timestamp'>): Promise<void> {
    const event: InvitationEvent = {
      ...data,
      eventType: 'invitation_received',
      timestamp: new Date()
    }
    await this.dispatch(event)
  }

  /**
   * Convenience method to trigger subscription events
   */
  static async triggerSubscriptionWarning(data: Omit<SubscriptionEvent, 'eventType' | 'timestamp'>): Promise<void> {
    const event: SubscriptionEvent = {
      ...data,
      eventType: 'subscription_expiring',
      timestamp: new Date()
    }
    await this.dispatch(event)
  }

  static async triggerSubscriptionExpired(data: Omit<SubscriptionEvent, 'eventType' | 'timestamp' | 'daysRemaining'>): Promise<void> {
    const event: SubscriptionEvent = {
      ...data,
      eventType: 'subscription_expired',
      timestamp: new Date()
    }
    await this.dispatch(event)
  }

  /**
   * Generic event trigger for custom events
   */
  static async triggerCustomEvent(event: NotificationEvent): Promise<void> {
    await this.dispatch(event)
  }
}

/**
 * Default notification handlers
 */

/**
 * Story notification handler
 */
export class StoryNotificationHandler implements NotificationEventHandler<NewStoryEvent | StoryProcessedEvent> {
  canHandle(event: NotificationEvent): event is NewStoryEvent | StoryProcessedEvent {
    return event.eventType === 'story_uploaded' || event.eventType === 'story_processed'
  }

  async handle(event: NewStoryEvent | StoryProcessedEvent): Promise<void> {
    try {
      if (event.eventType === 'story_uploaded') {
        await this.handleNewStory(event as NewStoryEvent)
      } else if (event.eventType === 'story_processed') {
        await this.handleStoryProcessed(event as StoryProcessedEvent)
      }
    } catch (error) {
      console.error('Error handling story notification:', error)
      throw error
    }
  }

  private async handleNewStory(event: NewStoryEvent): Promise<void> {
    // Get project facilitators to notify
    const { ProjectRoleModel } = require('../models/project-role')
    const facilitators = await ProjectRoleModel.getProjectUsers(event.projectId, 'facilitator')
    const storyteller = await UserModel.findById(event.storytellerId)

    if (!storyteller) {
      console.error('Storyteller not found for story upload notification')
      return
    }

    // Notify all facilitators except the storyteller (if they're also a facilitator)
    for (const facilitatorRole of facilitators) {
      if (facilitatorRole.user.id !== event.storytellerId) {
        await NotificationService.createAndSendNotification({
          userId: facilitatorRole.user.id,
          type: 'story_uploaded',
          title: 'New Story Uploaded',
          body: `${storyteller.name} shared a new story: "${event.storyTitle}"`,
          data: {
            storyId: event.storyId,
            storytellerId: event.storytellerId,
            storytellerName: storyteller.name,
            projectId: event.projectId,
            storyTitle: event.storyTitle,
            storyDuration: event.storyDuration,
            timestamp: event.timestamp.toISOString()
          }
        })
      }
    }
  }

  private async handleStoryProcessed(event: StoryProcessedEvent): Promise<void> {
    await NotificationService.createAndSendNotification({
      userId: event.storytellerId,
      type: 'story_processed',
      title: 'Story Ready',
      body: `Your story "${event.storyTitle}" has been processed and is ready to view`,
      data: {
        storyId: event.storyId,
        storyTitle: event.storyTitle,
        processingTime: event.processingTime,
        timestamp: event.timestamp.toISOString()
      }
    })
  }
}

/**
 * Interaction notification handler
 */
export class InteractionNotificationHandler implements NotificationEventHandler<NewInteractionEvent> {
  canHandle(event: NotificationEvent): event is NewInteractionEvent {
    return event.eventType === 'interaction_added' || event.eventType === 'follow_up_question'
  }

  async handle(event: NewInteractionEvent): Promise<void> {
    try {
      const facilitator = await UserModel.findById(event.facilitatorId)
      
      if (!facilitator) {
        console.error('Facilitator not found for interaction notification')
        return
      }

      const title = event.interactionType === 'follow_up_question' 
        ? 'Follow-up Question' 
        : 'New Comment'

      const body = event.interactionType === 'follow_up_question'
        ? `${facilitator.name} asked a follow-up question`
        : `${facilitator.name} commented on your story`

      await NotificationService.createAndSendNotification({
        userId: event.storytellerId,
        type: event.eventType,
        title,
        body,
        data: {
          interactionId: event.interactionId,
          storyId: event.storyId,
          facilitatorId: event.facilitatorId,
          facilitatorName: facilitator.name,
          interactionType: event.interactionType,
          content: event.content,
          timestamp: event.timestamp.toISOString()
        }
      })
    } catch (error) {
      console.error('Error handling interaction notification:', error)
      throw error
    }
  }
}

/**
 * Export notification handler
 */
export class ExportNotificationHandler implements NotificationEventHandler<ExportReadyEvent> {
  canHandle(event: NotificationEvent): event is ExportReadyEvent {
    return event.eventType === 'export_ready'
  }

  async handle(event: ExportReadyEvent): Promise<void> {
    try {
      await NotificationService.createAndSendNotification({
        userId: event.userId,
        type: 'export_ready',
        title: 'Export Ready',
        body: `Your ${event.exportType} export is ready for download`,
        data: {
          exportId: event.exportId,
          projectId: event.projectId,
          exportType: event.exportType,
          fileSize: event.fileSize,
          downloadUrl: event.downloadUrl,
          timestamp: event.timestamp.toISOString()
        },
        // Ensure email delivery for important notifications
        deliveryMethod: ['email', 'push']
      })
    } catch (error) {
      console.error('Error handling export notification:', error)
      throw error
    }
  }
}

/**
 * Subscription notification handler
 */
export class SubscriptionNotificationHandler implements NotificationEventHandler<SubscriptionEvent> {
  canHandle(event: NotificationEvent): event is SubscriptionEvent {
    return event.eventType === 'subscription_expiring' || event.eventType === 'subscription_expired'
  }

  async handle(event: SubscriptionEvent): Promise<void> {
    try {
      const title = event.eventType === 'subscription_expiring' 
        ? 'Subscription Expiring Soon'
        : 'Subscription Expired'

      const body = event.eventType === 'subscription_expiring'
        ? `Your Saga subscription expires in ${event.daysRemaining} days`
        : 'Your Saga subscription has expired. Renew to continue sharing stories.'

      await NotificationService.createAndSendNotification({
        userId: event.userId,
        type: event.eventType,
        title,
        body,
        data: {
          projectId: event.projectId,
          subscriptionId: event.subscriptionId,
          daysRemaining: event.daysRemaining,
          timestamp: event.timestamp.toISOString()
        },
        // Ensure email delivery for critical notifications
        deliveryMethod: ['email', 'push']
      })
    } catch (error) {
      console.error('Error handling subscription notification:', error)
      throw error
    }
  }
}

// Register default handlers
NotificationEventDispatcher.registerHandler(new StoryNotificationHandler())
NotificationEventDispatcher.registerHandler(new InteractionNotificationHandler())
NotificationEventDispatcher.registerHandler(new ExportNotificationHandler())
NotificationEventDispatcher.registerHandler(new SubscriptionNotificationHandler())