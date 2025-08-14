import { BaseModel } from './base'
import type { 
  Notification, 
  CreateNotificationInput, 
  UpdateNotificationInput,
  NotificationType,
  NotificationStatus 
} from '@saga/shared/types'

export class NotificationModel extends BaseModel {
  static tableName = 'notifications'

  private static transformNotification(notification: any): Notification {
    return {
      id: notification.id,
      userId: notification.user_id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      status: notification.status,
      deliveryMethod: notification.delivery_method || [],
      scheduledAt: notification.scheduled_at,
      sentAt: notification.sent_at,
      readAt: notification.read_at,
      createdAt: notification.created_at,
      updatedAt: notification.updated_at,
    }
  }

  static async create(data: CreateNotificationInput): Promise<Notification> {
    const [notification] = await this.db(this.tableName)
      .insert({
        user_id: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        data: data.data ? JSON.stringify(data.data) : null,
        delivery_method: data.deliveryMethod || ['push'],
        scheduled_at: data.scheduledAt,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*')

    return this.transformNotification(notification)
  }

  static async findByUserId(
    userId: string, 
    options: {
      limit?: number
      offset?: number
      status?: NotificationStatus
      type?: NotificationType
    } = {}
  ): Promise<Notification[]> {
    const { limit = 20, offset = 0, status, type } = options

    let query = this.db(this.tableName)
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)

    if (status) {
      query = query.where('status', status)
    }

    if (type) {
      query = query.where('type', type)
    }

    const notifications = await query
    return notifications.map(this.transformNotification)
  }

  static async findPendingNotifications(limit = 100): Promise<Notification[]> {
    const notifications = await this.db(this.tableName)
      .where('status', 'pending')
      .where(function() {
        this.whereNull('scheduled_at')
          .orWhere('scheduled_at', '<=', new Date())
      })
      .orderBy('created_at', 'asc')
      .limit(limit)

    return notifications.map(this.transformNotification)
  }

  static async update(id: string, data: UpdateNotificationInput): Promise<Notification | null> {
    const updateData: any = {
      updated_at: new Date(),
    }

    if (data.status) updateData.status = data.status
    if (data.sentAt) updateData.sent_at = data.sentAt
    if (data.readAt) updateData.read_at = data.readAt

    const [notification] = await this.db(this.tableName)
      .where('id', id)
      .update(updateData)
      .returning('*')

    return notification ? this.transformNotification(notification) : null
  }

  static async markAsRead(id: string): Promise<Notification | null> {
    return this.update(id, {
      status: 'read',
      readAt: new Date(),
    })
  }

  static async markAllAsRead(userId: string): Promise<number> {
    const updatedCount = await this.db(this.tableName)
      .where('user_id', userId)
      .where('status', '!=', 'read')
      .update({
        status: 'read',
        read_at: new Date(),
        updated_at: new Date(),
      })

    return updatedCount
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const result = await this.db(this.tableName)
      .where('user_id', userId)
      .whereIn('status', ['pending', 'sent', 'delivered'])
      .count('* as count')
      .first()

    return parseInt(result?.count as string) || 0
  }

  static async deleteOldNotifications(daysOld = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const deletedCount = await this.db(this.tableName)
      .where('created_at', '<', cutoffDate)
      .del()

    return deletedCount
  }

  static async findByIds(ids: string[]): Promise<Notification[]> {
    const notifications = await this.db(this.tableName)
      .whereIn('id', ids)

    return notifications.map(this.transformNotification)
  }

  static async bulkUpdateStatus(ids: string[], status: NotificationStatus): Promise<number> {
    const updateData: any = {
      status,
      updated_at: new Date(),
    }

    if (status === 'sent') {
      updateData.sent_at = new Date()
    } else if (status === 'read') {
      updateData.read_at = new Date()
    }

    const updatedCount = await this.db(this.tableName)
      .whereIn('id', ids)
      .update(updateData)

    return updatedCount
  }
}