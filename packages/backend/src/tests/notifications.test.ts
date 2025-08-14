import request from 'supertest'
import { app } from '../index'
import { NotificationModel } from '../models/notification'
import { NotificationPreferencesModel } from '../models/notification-preferences'
import { DeviceTokenModel } from '../models/device-token'
import { UserModel } from '../models/user'
import { NotificationService } from '../services/notification-service'
import { setupTestDatabase, cleanupTestDatabase } from './setup'

// Mock Firebase and SendGrid
jest.mock('../config/firebase', () => ({
  firebaseAdmin: {
    messaging: () => ({
      sendEachForMulticast: jest.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true, messageId: 'test-message-id' }],
      }),
    }),
  },
  validateFirebaseConfig: jest.fn().mockReturnValue(true),
}))

jest.mock('../config/sendgrid', () => ({
  sendgrid: {
    send: jest.fn().mockResolvedValue([{
      headers: { 'x-message-id': 'test-email-id' },
    }]),
  },
  validateSendGridConfig: jest.fn().mockReturnValue(true),
  SENDGRID_CONFIG: {
    fromEmail: 'test@saga.app',
    fromName: 'Saga Test',
    replyToEmail: 'support@saga.app',
  },
}))

describe('Notification System', () => {
  let testUser: any
  let authToken: string

  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(async () => {
    // Create test user
    testUser = await UserModel.create({
      email: 'test@example.com',
      name: 'Test User',
    })

    // Get auth token
    const authResponse = await request(app)
      .post('/api/auth/signin')
      .send({
        email: 'test@example.com',
        password: 'password123',
      })
    authToken = authResponse.body.accessToken
  })

  afterEach(async () => {
    // Clean up test data
    await NotificationModel.db('notifications').del()
    await NotificationPreferencesModel.db('notification_preferences').del()
    await DeviceTokenModel.db('device_tokens').del()
    await UserModel.db('users').del()
  })

  describe('Notification API', () => {
    describe('GET /api/notifications', () => {
      it('should get user notifications', async () => {
        // Create test notification
        await NotificationModel.create({
          userId: testUser.id,
          type: 'story_uploaded',
          title: 'Test Notification',
          body: 'Test notification body',
        })

        const response = await request(app)
          .get('/api/notifications')
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(200)
        expect(response.body.data.notifications).toHaveLength(1)
        expect(response.body.data.notifications[0].title).toBe('Test Notification')
        expect(response.body.data.unreadCount).toBe(1)
      })

      it('should filter notifications by status', async () => {
        await NotificationModel.create({
          userId: testUser.id,
          type: 'story_uploaded',
          title: 'Unread Notification',
          body: 'Test body',
        })

        const readNotification = await NotificationModel.create({
          userId: testUser.id,
          type: 'interaction_added',
          title: 'Read Notification',
          body: 'Test body',
        })

        await NotificationModel.markAsRead(readNotification.id)

        const response = await request(app)
          .get('/api/notifications?status=pending')
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(200)
        expect(response.body.data.notifications).toHaveLength(1)
        expect(response.body.data.notifications[0].title).toBe('Unread Notification')
      })

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/notifications')

        expect(response.status).toBe(401)
      })
    })

    describe('PATCH /api/notifications/:id/read', () => {
      it('should mark notification as read', async () => {
        const notification = await NotificationModel.create({
          userId: testUser.id,
          type: 'story_uploaded',
          title: 'Test Notification',
          body: 'Test body',
        })

        const response = await request(app)
          .patch(`/api/notifications/${notification.id}/read`)
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(200)
        expect(response.body.data.status).toBe('read')
        expect(response.body.data.readAt).toBeTruthy()
      })

      it('should not allow marking other users notifications', async () => {
        const otherUser = await UserModel.create({
          email: 'other@example.com',
          name: 'Other User',
        })

        const notification = await NotificationModel.create({
          userId: otherUser.id,
          type: 'story_uploaded',
          title: 'Other User Notification',
          body: 'Test body',
        })

        const response = await request(app)
          .patch(`/api/notifications/${notification.id}/read`)
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(403)
      })
    })

    describe('PATCH /api/notifications/read-all', () => {
      it('should mark all notifications as read', async () => {
        await NotificationModel.create({
          userId: testUser.id,
          type: 'story_uploaded',
          title: 'Notification 1',
          body: 'Test body',
        })

        await NotificationModel.create({
          userId: testUser.id,
          type: 'interaction_added',
          title: 'Notification 2',
          body: 'Test body',
        })

        const response = await request(app)
          .patch('/api/notifications/read-all')
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(200)
        expect(response.body.data.updatedCount).toBe(2)

        // Verify unread count is now 0
        const unreadCount = await NotificationModel.getUnreadCount(testUser.id)
        expect(unreadCount).toBe(0)
      })
    })
  })

  describe('Notification Preferences API', () => {
    describe('GET /api/notifications/preferences', () => {
      it('should get user preferences', async () => {
        const response = await request(app)
          .get('/api/notifications/preferences')
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(200)
        expect(response.body.data).toHaveProperty('storyUploaded')
        expect(response.body.data).toHaveProperty('emailEnabled')
        expect(response.body.data).toHaveProperty('pushEnabled')
      })

      it('should create default preferences if none exist', async () => {
        const response = await request(app)
          .get('/api/notifications/preferences')
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(200)
        expect(response.body.data.emailEnabled).toBe(true)
        expect(response.body.data.pushEnabled).toBe(true)
      })
    })

    describe('PUT /api/notifications/preferences', () => {
      it('should update notification preferences', async () => {
        const response = await request(app)
          .put('/api/notifications/preferences')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            emailEnabled: false,
            pushEnabled: true,
            storyUploaded: ['push'],
            quietHoursStart: '22:00',
            quietHoursEnd: '08:00',
          })

        expect(response.status).toBe(200)
        expect(response.body.data.emailEnabled).toBe(false)
        expect(response.body.data.storyUploaded).toEqual(['push'])
        expect(response.body.data.quietHoursStart).toBe('22:00')
      })

      it('should validate preference data', async () => {
        const response = await request(app)
          .put('/api/notifications/preferences')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            emailEnabled: 'invalid',
            storyUploaded: ['invalid_method'],
          })

        expect(response.status).toBe(400)
      })
    })
  })

  describe('Device Token API', () => {
    describe('POST /api/notifications/device-tokens', () => {
      it('should register device token', async () => {
        const response = await request(app)
          .post('/api/notifications/device-tokens')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            token: 'test-device-token',
            platform: 'ios',
            deviceId: 'test-device-id',
          })

        expect(response.status).toBe(201)
        expect(response.body.data.token).toBe('test-device-token')
        expect(response.body.data.platform).toBe('ios')
        expect(response.body.data.isActive).toBe(true)
      })

      it('should validate device token data', async () => {
        const response = await request(app)
          .post('/api/notifications/device-tokens')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            token: '',
            platform: 'invalid',
          })

        expect(response.status).toBe(400)
      })
    })

    describe('GET /api/notifications/device-tokens', () => {
      it('should get user device tokens', async () => {
        await DeviceTokenModel.create({
          userId: testUser.id,
          token: 'test-token-1',
          platform: 'ios',
        })

        await DeviceTokenModel.create({
          userId: testUser.id,
          token: 'test-token-2',
          platform: 'android',
        })

        const response = await request(app)
          .get('/api/notifications/device-tokens')
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(200)
        expect(response.body.data).toHaveLength(2)
      })
    })

    describe('DELETE /api/notifications/device-tokens', () => {
      it('should deactivate device token', async () => {
        const deviceToken = await DeviceTokenModel.create({
          userId: testUser.id,
          token: 'test-token-to-delete',
          platform: 'ios',
        })

        const response = await request(app)
          .delete('/api/notifications/device-tokens')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            token: 'test-token-to-delete',
          })

        expect(response.status).toBe(200)
        expect(response.body.data.success).toBe(true)

        // Verify token is deactivated
        const updatedToken = await DeviceTokenModel.findByToken('test-token-to-delete')
        expect(updatedToken).toBeNull() // Should not find active token
      })
    })
  })

  describe('NotificationService', () => {
    describe('createAndSendNotification', () => {
      it('should create and send notification', async () => {
        // Register device token for push notifications
        await DeviceTokenModel.create({
          userId: testUser.id,
          token: 'test-push-token',
          platform: 'ios',
        })

        const result = await NotificationService.createAndSendNotification({
          userId: testUser.id,
          type: 'story_uploaded',
          title: 'Test Story Uploaded',
          body: 'A new story has been uploaded',
          data: { storyId: 'test-story-id' },
        })

        expect(result.notification).toBeTruthy()
        expect(result.notification.title).toBe('Test Story Uploaded')
        expect(result.deliveryResults).toHaveLength(2) // push and email
        expect(result.deliveryResults.some(r => r.method === 'push' && r.success)).toBe(true)
        expect(result.deliveryResults.some(r => r.method === 'email' && r.success)).toBe(true)
      })

      it('should respect user preferences', async () => {
        // Set user preferences to only email
        await NotificationPreferencesModel.create({
          userId: testUser.id,
          storyUploaded: ['email'],
          pushEnabled: false,
        })

        const result = await NotificationService.createAndSendNotification({
          userId: testUser.id,
          type: 'story_uploaded',
          title: 'Test Story Uploaded',
          body: 'A new story has been uploaded',
        })

        expect(result.deliveryResults).toHaveLength(1)
        expect(result.deliveryResults[0].method).toBe('email')
      })
    })

    describe('getNotificationTemplate', () => {
      it('should return correct template for story_uploaded', async () => {
        const template = NotificationService.getNotificationTemplate('story_uploaded', {
          storytellerName: 'John Doe',
          storyTitle: 'My Childhood',
        })

        expect(template.title).toBe('New Story Uploaded')
        expect(template.body).toContain('John Doe')
        expect(template.body).toContain('My Childhood')
      })

      it('should return default template for unknown type', async () => {
        const template = NotificationService.getNotificationTemplate('unknown_type' as any)

        expect(template.title).toBe('Notification')
        expect(template.body).toBe('You have a new notification')
      })
    })
  })
})