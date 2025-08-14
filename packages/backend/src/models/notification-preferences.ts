import { BaseModel } from './base'
import type { 
  NotificationPreferences, 
  CreateNotificationPreferencesInput, 
  UpdateNotificationPreferencesInput,
  NotificationDeliveryMethod
} from '@saga/shared/types'

export class NotificationPreferencesModel extends BaseModel {
  static tableName = 'notification_preferences'

  private static transformPreferences(preferences: any): NotificationPreferences {
    return {
      id: preferences.id,
      userId: preferences.user_id,
      storyUploaded: preferences.story_uploaded || [],
      storyProcessed: preferences.story_processed || [],
      interactionAdded: preferences.interaction_added || [],
      followUpQuestion: preferences.follow_up_question || [],
      exportReady: preferences.export_ready || [],
      invitationReceived: preferences.invitation_received || [],
      subscriptionExpiring: preferences.subscription_expiring || [],
      subscriptionExpired: preferences.subscription_expired || [],
      emailEnabled: preferences.email_enabled,
      pushEnabled: preferences.push_enabled,
      quietHoursStart: preferences.quiet_hours_start,
      quietHoursEnd: preferences.quiet_hours_end,
      timezone: preferences.timezone,
      createdAt: preferences.created_at,
      updatedAt: preferences.updated_at,
    }
  }

  static async create(data: CreateNotificationPreferencesInput): Promise<NotificationPreferences> {
    const [preferences] = await this.db(this.tableName)
      .insert({
        user_id: data.userId,
        story_uploaded: data.storyUploaded || ['push', 'email'],
        story_processed: data.storyProcessed || ['push'],
        interaction_added: data.interactionAdded || ['push', 'email'],
        follow_up_question: data.followUpQuestion || ['push', 'email'],
        export_ready: data.exportReady || ['push', 'email'],
        invitation_received: data.invitationReceived || ['push', 'email'],
        subscription_expiring: data.subscriptionExpiring || ['push', 'email'],
        subscription_expired: data.subscriptionExpired || ['push', 'email'],
        email_enabled: data.emailEnabled !== undefined ? data.emailEnabled : true,
        push_enabled: data.pushEnabled !== undefined ? data.pushEnabled : true,
        quiet_hours_start: data.quietHoursStart,
        quiet_hours_end: data.quietHoursEnd,
        timezone: data.timezone || 'UTC',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*')

    return this.transformPreferences(preferences)
  }

  static async findByUserId(userId: string): Promise<NotificationPreferences | null> {
    const preferences = await this.db(this.tableName)
      .where('user_id', userId)
      .first()

    return preferences ? this.transformPreferences(preferences) : null
  }

  static async findOrCreateByUserId(userId: string): Promise<NotificationPreferences> {
    let preferences = await this.findByUserId(userId)
    
    if (!preferences) {
      preferences = await this.create({ userId })
    }

    return preferences
  }

  static async update(userId: string, data: UpdateNotificationPreferencesInput): Promise<NotificationPreferences | null> {
    const updateData: any = {
      updated_at: new Date(),
    }

    if (data.storyUploaded !== undefined) updateData.story_uploaded = data.storyUploaded
    if (data.storyProcessed !== undefined) updateData.story_processed = data.storyProcessed
    if (data.interactionAdded !== undefined) updateData.interaction_added = data.interactionAdded
    if (data.followUpQuestion !== undefined) updateData.follow_up_question = data.followUpQuestion
    if (data.exportReady !== undefined) updateData.export_ready = data.exportReady
    if (data.invitationReceived !== undefined) updateData.invitation_received = data.invitationReceived
    if (data.subscriptionExpiring !== undefined) updateData.subscription_expiring = data.subscriptionExpiring
    if (data.subscriptionExpired !== undefined) updateData.subscription_expired = data.subscriptionExpired
    if (data.emailEnabled !== undefined) updateData.email_enabled = data.emailEnabled
    if (data.pushEnabled !== undefined) updateData.push_enabled = data.pushEnabled
    if (data.quietHoursStart !== undefined) updateData.quiet_hours_start = data.quietHoursStart
    if (data.quietHoursEnd !== undefined) updateData.quiet_hours_end = data.quietHoursEnd
    if (data.timezone !== undefined) updateData.timezone = data.timezone

    const [preferences] = await this.db(this.tableName)
      .where('user_id', userId)
      .update(updateData)
      .returning('*')

    return preferences ? this.transformPreferences(preferences) : null
  }

  static async getDeliveryMethods(userId: string, notificationType: string): Promise<NotificationDeliveryMethod[]> {
    const preferences = await this.findOrCreateByUserId(userId)
    
    // Map notification types to preference fields
    const typeMap: Record<string, keyof NotificationPreferences> = {
      story_uploaded: 'storyUploaded',
      story_processed: 'storyProcessed',
      interaction_added: 'interactionAdded',
      follow_up_question: 'followUpQuestion',
      export_ready: 'exportReady',
      invitation_received: 'invitationReceived',
      subscription_expiring: 'subscriptionExpiring',
      subscription_expired: 'subscriptionExpired',
    }

    const preferenceField = typeMap[notificationType]
    if (!preferenceField) {
      return ['push'] // Default fallback
    }

    const methods = preferences[preferenceField] as NotificationDeliveryMethod[]
    
    // Filter based on global preferences
    return methods.filter(method => {
      if (method === 'email' && !preferences.emailEnabled) return false
      if (method === 'push' && !preferences.pushEnabled) return false
      return true
    })
  }

  static async isInQuietHours(userId: string): Promise<boolean> {
    const preferences = await this.findByUserId(userId)
    
    if (!preferences || !preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false
    }

    const now = new Date()
    const userTimezone = preferences.timezone || 'UTC'
    
    // Convert current time to user's timezone
    const userTime = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    }).format(now)

    const currentTime = userTime.replace(':', '')
    const quietStart = preferences.quietHoursStart.replace(':', '')
    const quietEnd = preferences.quietHoursEnd.replace(':', '')

    // Handle quiet hours that span midnight
    if (quietStart > quietEnd) {
      return currentTime >= quietStart || currentTime <= quietEnd
    } else {
      return currentTime >= quietStart && currentTime <= quietEnd
    }
  }
}