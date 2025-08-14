/**
 * Comprehensive unit tests for NotificationService
 * Tests all notification functionality with mocked external providers
 */

import { NotificationService } from '../services/notification-service'
import { PushNotificationService } from '../services/push-notification-service'
import { EmailNotificationService } from '../services/email-notification-service'
import { NotificationModel } from '../models/notification'
import { NotificationPreferencesModel } from '../models/notification-preferences'
import { DeviceTokenModel } from '../models/device-token'
import type { 
  CreateNotificationInput, 
  NotificationDeliveryMethod,
  NotificationType 
} from '@saga/shared/types'

// Mock external services
jest.mock('../services/push-notification-service')
jest.mock('../services/email-notification-service')
jest.mock('../models/notification')
jest.mock('../models/notification-preferences')
jest.mock('../models/device-token')

const mockPushService = PushNotificationService as jest.Mocked<typeof PushNotificationService>
const mockEmailService = EmailNotificationService as jest.Mocked<typeof EmailNotificationService>
const mockNotificationModel = NotificationModel as jest.Mocked<typeof NotificationModel>
const mockPreferencesModel = NotificationPreferencesModel as jest.Mocked<typeof NotificationPreferencesModel>
const mockDeviceTokenModel = DeviceTokenModel as jest.Mocked<typeof DeviceTokenModel>

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mocks
    mockNotificationModel.create.mockResolvedValue({
      id: 'notification-1',
      userId: 'user-1',
      type: 'story_uploaded',
      title: 'Test Notification',
      body: 'Test notification body',
      status: 'pending',
      deliveryMethod: ['push', 'email'],
      createdAt: new Date(),
      updatedAt: new Date()
    })

    mockPreferencesModel.getDeliveryMethods.mockResolvedValue(['push', 'email'])
    mockPreferencesModel.isInQuietHours.mockResolvedValue(false)
    
    mockDeviceTokenModel.findActiveByUserId.mockResolvedValue([
      {
        id: 'token-1',
        userId: 'user-1',
        token: 'device-token-123',
        platform: 'ios',
        isActive: true,
        lastUsedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ])

    mockPushService.sendNotification.mockResolvedValue({
      success: true,
      messageId: 'push-message-123'
    })

    mockEmailService.sendNotification.mockResolvedValue({
      success: true,
      messageId: 'email-message-123'
    })
  })

  describe('createAndSendNotification', () => {
    const validNotificationInput: CreateNotificationInput = {
      userId: 'user-1',
      type: 'story_uploaded',
      title: 'New Story',
      body: 'A new story has been uploaded',
      data: { storyId: 'story-1' }
    }

    it('should create and send notification successfully', async () => {
      const result = await NotificationService.createAndSendNotification(validNotificationInput)

      expect(result.success).toBe(true)
      expect(mockNotificationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: 'story_uploaded',
          title: 'New Story',
          body: 'A new story has been uploaded'
        })
      )
    })

    it('should respect user notification preferences', async () => {
      mockPreferencesModel.getDeliveryMethods.mockResolvedValue(['push'])

      await NotificationService.createAndSendNotification(validNotificationInput)

      expect(mockPushService.sendNotification).toHaveBeenCalled()
      expect(mockEmailService.sendNotification).not.toHaveBeenCalled()
    })

    it('should skip notifications during quiet hours', async () => {
      mockPreferencesModel.isInQuietHours.mockResolvedValue(true)

      const result = await NotificationService.createAndSendNotification(validNotificationInput)

      expect(result.success).toBe(true)
      expect(result.skippedReason).toBe('quiet_hours')
      expect(mockPushService.sendNotification).not.toHaveBeenCalled()
      expect(mockEmailService.sendNotification).not.toHaveBeenCalled()
    })

    it('should handle push notification failures gracefully', async () => {
      mockPushService.sendNotification.mockResolvedValue({
        success: false,
        error: 'Push service unavailable'
      })

      const result = await NotificationService.createAndSendNotification(validNotificationInput)

      expect(result.success).toBe(true) // Overall success even if one method fails
      expect(result.deliveryResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: 'push',
            success: false,
            error: 'Push service unavailable'
          })
        ])
      )
    })

    it('should handle email notification failures gracefully', async () => {
      mockEmailService.sendNotification.mockResolvedValue({
        success: false,
        error: 'Email service unavailable'
      })

      const result = await NotificationService.createAndSendNotification(validNotificationInput)

      expect(result.success).toBe(true)
      expect(result.deliveryResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: 'email',
            success: false,
            error: 'Email service unavailable'
          })
        ])
      )
    })

    it('should validate notification input', async () => {
      const invalidInput = {
        userId: '',
        type: 'invalid_type' as NotificationType,
        title: '',
        body: ''
      }

      await expect(
        NotificationService.createAndSendNotification(invalidInput)
      ).rejects.toThrow('Invalid notification input')
    })

    it('should handle missing device tokens', async () => {
      mockDeviceTokenModel.findActiveByUserId.mockResolvedValue([])

      const result = await NotificationService.createAndSendNotification(validNotificationInput)

      expect(result.deliveryResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: 'push',
            success: false,
            error: 'No active device tokens found'
          })
        ])
      )
    })

    it('should override delivery methods when specified', async () => {
      const inputWithDeliveryMethod = {
        ...validNotificationInput,
        deliveryMethod: ['email'] as NotificationDeliveryMethod[]
      }

      await NotificationService.createAndSendNotification(inputWithDeliveryMethod)

      expect(mockEmailService.sendNotification).toHaveBeenCalled()
      expect(mockPushService.sendNotification).not.toHaveBeenCalled()
    })
  })

  describe('sendBulkNotifications', () => {
    it('should send notifications to multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3']
      
      mockPreferencesModel.getDeliveryMethods.mockResolvedValue(['push'])
      mockDeviceTokenModel.findActiveByUserId.mockResolvedValue([
        {
          id: 'token-1',
          userId: 'user-1',
          token: 'device-token-123',
          platform: 'ios',
          isActive: true,
          lastUsedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      const result = await NotificationService.sendBulkNotifications({
        userIds,
        type: 'system_maintenance',
        title: 'System Maintenance',
        body: 'System will be down for maintenance'
      })

      expect(result.totalSent).toBe(3)
      expect(result.successful).toBe(3)
      expect(result.failed).toBe(0)
      expect(mockNotificationModel.create).toHaveBeenCalledTimes(3)
    })

    it('should handle partial failures in bulk notifications', async () => {
      const userIds = ['user-1', 'user-2']
      
      mockNotificationModel.create
        .mockResolvedValueOnce({
          id: 'notification-1',
          userId: 'user-1',
          type: 'system_maintenance',
          title: 'System Maintenance',
          body: 'System will be down for maintenance',
          status: 'pending',
          deliveryMethod: ['push'],
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockRejectedValueOnce(new Error('Database error'))

      const result = await NotificationService.sendBulkNotifications({
        userIds,
        type: 'system_maintenance',
        title: 'System Maintenance',
        body: 'System will be down for maintenance'
      })

      expect(result.totalSent).toBe(2)
      expect(result.successful).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockNotificationModel.update.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        type: 'story_uploaded',
        title: 'Test Notification',
        body: 'Test notification body',
        status: 'read',
        deliveryMethod: ['push'],
        readAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const result = await NotificationService.markAsRead('notification-1')

      expect(result).toBeTruthy()
      expect(mockNotificationModel.update).toHaveBeenCalledWith(
        'notification-1',
        expect.objectContaining({
          status: 'read',
          readAt: expect.any(Date)
        })
      )
    })

    it('should handle non-existent notification', async () => {
      mockNotificationModel.update.mockResolvedValue(null)

      const result = await NotificationService.markAsRead('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getUserNotifications', () => {
    it('should retrieve user notifications with pagination', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          userId: 'user-1',
          type: 'story_uploaded',
          title: 'New Story',
          body: 'A new story has been uploaded',
          status: 'sent',
          deliveryMethod: ['push'],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      mockNotificationModel.findByUserId.mockResolvedValue(mockNotifications)

      const result = await NotificationService.getUserNotifications('user-1', {
        limit: 10,
        offset: 0
      })

      expect(result).toEqual(mockNotifications)
      expect(mockNotificationModel.findByUserId).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          limit: 10,
          offset: 0
        })
      )
    })

    it('should filter notifications by type', async () => {
      await NotificationService.getUserNotifications('user-1', {
        type: 'story_uploaded',
        limit: 10
      })

      expect(mockNotificationModel.findByUserId).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          type: 'story_uploaded'
        })
      )
    })

    it('should filter notifications by status', async () => {
      await NotificationService.getUserNotifications('user-1', {
        status: 'unread',
        limit: 10
      })

      expect(mockNotificationModel.findByUserId).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          status: 'unread'
        })
      )
    })
  })

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      mockNotificationModel.getUnreadCount.mockResolvedValue(5)

      const count = await NotificationService.getUnreadCount('user-1')

      expect(count).toBe(5)
      expect(mockNotificationModel.getUnreadCount).toHaveBeenCalledWith('user-1')
    })
  })

  describe('scheduleNotification', () => {
    it('should schedule notification for future delivery', async () => {
      const scheduledAt = new Date(Date.now() + 3600000) // 1 hour from now
      
      const input: CreateNotificationInput = {
        userId: 'user-1',
        type: 'reminder',
        title: 'Reminder',
        body: 'This is a scheduled reminder',
        scheduledAt
      }

      const result = await NotificationService.scheduleNotification(input)

      expect(result.success).toBe(true)
      expect(mockNotificationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledAt,
          status: 'pending'
        })
      )
    })

    it('should reject past scheduled times', async () => {
      const pastTime = new Date(Date.now() - 3600000) // 1 hour ago
      
      const input: CreateNotificationInput = {
        userId: 'user-1',
        type: 'reminder',
        title: 'Reminder',
        body: 'This is a scheduled reminder',
        scheduledAt: pastTime
      }

      await expect(
        NotificationService.scheduleNotification(input)
      ).rejects.toThrow('Cannot schedule notification in the past')
    })
  })

  describe('cancelScheduledNotification', () => {
    it('should cancel scheduled notification', async () => {
      mockNotificationModel.findById.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        type: 'reminder',
        title: 'Reminder',
        body: 'Scheduled reminder',
        status: 'pending',
        deliveryMethod: ['push'],
        scheduledAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date()
      })

      mockNotificationModel.delete.mockResolvedValue(true)

      const result = await NotificationService.cancelScheduledNotification('notification-1')

      expect(result).toBe(true)
      expect(mockNotificationModel.delete).toHaveBeenCalledWith('notification-1')
    })

    it('should not cancel already sent notifications', async () => {
      mockNotificationModel.findById.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        type: 'reminder',
        title: 'Reminder',
        body: 'Scheduled reminder',
        status: 'sent',
        deliveryMethod: ['push'],
        sentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })

      await expect(
        NotificationService.cancelScheduledNotification('notification-1')
      ).rejects.toThrow('Cannot cancel notification that has already been sent')
    })
  })

  describe('validateNotificationInput', () => {
    it('should validate valid notification input', () => {
      const validInput: CreateNotificationInput = {
        userId: 'user-1',
        type: 'story_uploaded',
        title: 'Valid Title',
        body: 'Valid body content'
      }

      expect(() => {
        NotificationService.validateNotificationInput(validInput)
      }).not.toThrow()
    })

    it('should reject empty userId', () => {
      const invalidInput: CreateNotificationInput = {
        userId: '',
        type: 'story_uploaded',
        title: 'Valid Title',
        body: 'Valid body content'
      }

      expect(() => {
        NotificationService.validateNotificationInput(invalidInput)
      }).toThrow('User ID is required')
    })

    it('should reject empty title', () => {
      const invalidInput: CreateNotificationInput = {
        userId: 'user-1',
        type: 'story_uploaded',
        title: '',
        body: 'Valid body content'
      }

      expect(() => {
        NotificationService.validateNotificationInput(invalidInput)
      }).toThrow('Title is required')
    })

    it('should reject empty body', () => {
      const invalidInput: CreateNotificationInput = {
        userId: 'user-1',
        type: 'story_uploaded',
        title: 'Valid Title',
        body: ''
      }

      expect(() => {
        NotificationService.validateNotificationInput(invalidInput)
      }).toThrow('Body is required')
    })

    it('should reject invalid notification type', () => {
      const invalidInput: CreateNotificationInput = {
        userId: 'user-1',
        type: 'invalid_type' as NotificationType,
        title: 'Valid Title',
        body: 'Valid body content'
      }

      expect(() => {
        NotificationService.validateNotificationInput(invalidInput)
      }).toThrow('Invalid notification type')
    })

    it('should reject overly long title', () => {
      const invalidInput: CreateNotificationInput = {
        userId: 'user-1',
        type: 'story_uploaded',
        title: 'A'.repeat(256), // Too long
        body: 'Valid body content'
      }

      expect(() => {
        NotificationService.validateNotificationInput(invalidInput)
      }).toThrow('Title is too long')
    })

    it('should reject overly long body', () => {
      const invalidInput: CreateNotificationInput = {
        userId: 'user-1',
        type: 'story_uploaded',
        title: 'Valid Title',
        body: 'A'.repeat(1001) // Too long
      }

      expect(() => {
        NotificationService.validateNotificationInput(invalidInput)
      }).toThrow('Body is too long')
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockNotificationModel.create.mockRejectedValue(new Error('Database connection failed'))

      const result = await NotificationService.createAndSendNotification({
        userId: 'user-1',
        type: 'story_uploaded',
        title: 'Test',
        body: 'Test body'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Database connection failed')
    })

    it('should handle external service timeouts', async () => {
      mockPushService.sendNotification.mockRejectedValue(new Error('Request timeout'))

      const result = await NotificationService.createAndSendNotification({
        userId: 'user-1',
        type: 'story_uploaded',
        title: 'Test',
        body: 'Test body'
      })

      expect(result.deliveryResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: 'push',
            success: false,
            error: expect.stringContaining('Request timeout')
          })
        ])
      )
    })
  })

  describe('performance', () => {
    it('should handle concurrent notifications efficiently', async () => {
      const notifications = Array.from({ length: 100 }, (_, i) => ({
        userId: `user-${i}`,
        type: 'story_uploaded' as NotificationType,
        title: `Notification ${i}`,
        body: `Body ${i}`
      }))

      const startTime = Date.now()
      
      const promises = notifications.map(notification =>
        NotificationService.createAndSendNotification(notification)
      )
      
      const results = await Promise.all(promises)
      const endTime = Date.now()

      expect(results).toHaveLength(100)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
      
      // All notifications should be successful
      results.forEach(result => {
        expect(result.success).toBe(true)
      })
    })
  })
})