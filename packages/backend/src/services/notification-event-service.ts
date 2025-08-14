import { NotificationService } from './notification-service'
import { NotificationEvents } from './notification-events'
import { UserModel } from '../models/user'
import { ProjectModel } from '../models/project'
import type { NotificationType } from '@saga/shared/types'

export interface NotificationEventData {
  [key: string]: any
}

/**
 * @deprecated Use NotificationEvents instead for new implementations
 * This service is maintained for backward compatibility
 */
export class NotificationEventService {
  /**
   * Trigger story uploaded notification
   * @deprecated Use NotificationEvents.storyUploaded() instead
   */
  static async triggerStoryUploaded(data: {
    storyId: string
    storytellerId: string
    projectId: string
    storyTitle: string
  }): Promise<void> {
    // Use the new event system
    await NotificationEvents.storyUploaded(data)
  }

  /**
   * Trigger story processed notification
   * @deprecated Use NotificationEvents.storyProcessed() instead
   */
  static async triggerStoryProcessed(data: {
    storyId: string
    storytellerId: string
    storyTitle: string
  }): Promise<void> {
    // Use the new event system
    await NotificationEvents.storyProcessed(data)
  }

  /**
   * Trigger interaction added notification
   */
  static async triggerInteractionAdded(data: {
    interactionId: string
    storyId: string
    storytellerId: string
    facilitatorId: string
    interactionType: 'comment' | 'follow_up_question'
    content: string
  }): Promise<void> {
    try {
      const facilitator = await UserModel.findById(data.facilitatorId)
      
      if (!facilitator) {
        console.error('Facilitator not found for interaction notification')
        return
      }

      const notificationType: NotificationType = data.interactionType === 'follow_up_question' 
        ? 'follow_up_question' 
        : 'interaction_added'

      const title = data.interactionType === 'follow_up_question' 
        ? 'Follow-up Question' 
        : 'New Comment'

      const body = data.interactionType === 'follow_up_question'
        ? `${facilitator.name} asked a follow-up question`
        : `${facilitator.name} commented on your story`

      await NotificationService.createAndSendNotification({
        userId: data.storytellerId,
        type: notificationType,
        title,
        body,
        data: {
          interactionId: data.interactionId,
          storyId: data.storyId,
          facilitatorId: data.facilitatorId,
          facilitatorName: facilitator.name,
          interactionType: data.interactionType,
          content: data.content,
        },
      })
    } catch (error) {
      console.error('Error triggering interaction added notification:', error)
    }
  }

  /**
   * Trigger export ready notification
   */
  static async triggerExportReady(data: {
    exportId: string
    userId: string
    projectId: string
    exportType: string
  }): Promise<void> {
    try {
      await NotificationService.createAndSendNotification({
        userId: data.userId,
        type: 'export_ready',
        title: 'Export Ready',
        body: `Your ${data.exportType} export is ready for download`,
        data: {
          exportId: data.exportId,
          projectId: data.projectId,
          exportType: data.exportType,
        },
      })
    } catch (error) {
      console.error('Error triggering export ready notification:', error)
    }
  }

  /**
   * Trigger invitation received notification
   */
  static async triggerInvitationReceived(data: {
    invitationId: string
    inviteeEmail: string
    facilitatorId: string
    projectId: string
    role: 'facilitator' | 'storyteller'
  }): Promise<void> {
    try {
      const facilitator = await UserModel.findById(data.facilitatorId)
      const project = await ProjectModel.findById(data.projectId)

      if (!facilitator || !project) {
        console.error('Facilitator or project not found for invitation notification')
        return
      }

      // Check if invitee already has an account
      const existingUser = await UserModel.findByEmail(data.inviteeEmail)

      if (existingUser) {
        // Send in-app notification
        await NotificationService.createAndSendNotification({
          userId: existingUser.id,
          type: 'invitation_received',
          title: 'Invitation to Share Stories',
          body: `${facilitator.name} invited you to share your family stories in "${project.name}"`,
          data: {
            invitationId: data.invitationId,
            facilitatorId: data.facilitatorId,
            facilitatorName: facilitator.name,
            projectId: data.projectId,
            projectName: project.name,
            role: data.role,
          },
        })
      }

      // Always send email invitation (whether user exists or not)
      // This will be handled by the email service directly
    } catch (error) {
      console.error('Error triggering invitation received notification:', error)
    }
  }

  /**
   * Trigger subscription expiring notification
   */
  static async triggerSubscriptionExpiring(data: {
    userId: string
    projectId: string
    daysRemaining: number
  }): Promise<void> {
    try {
      await NotificationService.createAndSendNotification({
        userId: data.userId,
        type: 'subscription_expiring',
        title: 'Subscription Expiring Soon',
        body: `Your Saga subscription expires in ${data.daysRemaining} days`,
        data: {
          projectId: data.projectId,
          daysRemaining: data.daysRemaining,
        },
        // Schedule email delivery for better visibility
        deliveryMethod: ['email', 'push'],
      })
    } catch (error) {
      console.error('Error triggering subscription expiring notification:', error)
    }
  }

  /**
   * Trigger subscription expired notification
   */
  static async triggerSubscriptionExpired(data: {
    userId: string
    projectId: string
  }): Promise<void> {
    try {
      await NotificationService.createAndSendNotification({
        userId: data.userId,
        type: 'subscription_expired',
        title: 'Subscription Expired',
        body: 'Your Saga subscription has expired. Renew to continue sharing stories.',
        data: {
          projectId: data.projectId,
        },
        // Ensure email delivery for important notifications
        deliveryMethod: ['email', 'push'],
      })
    } catch (error) {
      console.error('Error triggering subscription expired notification:', error)
    }
  }

  /**
   * Generic event trigger for extensibility
   */
  static async triggerCustomEvent(
    eventType: NotificationType,
    userId: string,
    title: string,
    body: string,
    data?: NotificationEventData
  ): Promise<void> {
    try {
      await NotificationService.createAndSendNotification({
        userId,
        type: eventType,
        title,
        body,
        data,
      })
    } catch (error) {
      console.error(`Error triggering custom event ${eventType}:`, error)
    }
  }

  /**
   * Bulk event trigger for multiple users
   */
  static async triggerBulkEvent(
    eventType: NotificationType,
    userIds: string[],
    title: string,
    body: string,
    data?: NotificationEventData
  ): Promise<void> {
    try {
      await NotificationService.sendBulkNotification({
        userIds,
        type: eventType,
        title,
        body,
        data,
      })
    } catch (error) {
      console.error(`Error triggering bulk event ${eventType}:`, error)
    }
  }
}

// Event type definitions for better type safety
export interface StoryUploadedEvent {
  storyId: string
  storytellerId: string
  projectId: string
  storyTitle: string
}

export interface StoryProcessedEvent {
  storyId: string
  storytellerId: string
  storyTitle: string
}

export interface InteractionAddedEvent {
  interactionId: string
  storyId: string
  storytellerId: string
  facilitatorId: string
  interactionType: 'comment' | 'follow_up_question'
  content: string
}

export interface ExportReadyEvent {
  exportId: string
  userId: string
  projectId: string
  exportType: string
}

export interface InvitationReceivedEvent {
  invitationId: string
  inviteeEmail: string
  facilitatorId: string
  projectId: string
  role: 'facilitator' | 'storyteller'
}

export interface SubscriptionExpiringEvent {
  userId: string
  projectId: string
  daysRemaining: number
}

export interface SubscriptionExpiredEvent {
  userId: string
  projectId: string
}