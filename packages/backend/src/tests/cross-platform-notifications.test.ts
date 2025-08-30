/**
 * Cross-Platform Notification Testing
 * 
 * Tests notification delivery across web, iOS, and Android platforms
 * ensuring consistent behavior and proper platform-specific handling
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../index';
import { setupTestDatabase, cleanupTestDatabase } from './setup';
import { NotificationService } from '../services/notification-service';
import { PushNotificationService } from '../services/push-notification-service';
import { EmailNotificationService } from '../services/email-notification-service';

// Mock external services
jest.mock('../services/push-notification-service');
jest.mock('../services/email-notification-service');

describe('Cross-Platform Notification Testing', () => {
  let testUserId: string;
  let testProjectId: string;
  let authToken: string;
  let notificationService: NotificationService;

  beforeAll(async () => {
    await setupTestDatabase();
    notificationService = new NotificationService();
    
    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'notifications@test.com',
        password: 'TestPassword123!',
        name: 'Notification Test User'
      });
    
    testUserId = userResponse.body.user.id;
    authToken = userResponse.body.token;

    // Create test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Notification Test Project',
        description: 'Test project for notification validation'
      });
    
    testProjectId = projectResponse.body.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('iOS Push Notifications', () => {
    test('should send push notification to iOS devices', async () => {
      // Register iOS device token
      await request(app)
        .post('/api/device-tokens')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: 'ios-device-token-123456',
          platform: 'ios',
          deviceId: 'ios-device-123'
        });

      // Mock iOS push notification success
      const mockPushService = PushNotificationService as jest.MockedClass<typeof PushNotificationService>;
      mockPushService.prototype.sendToDevice = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'ios-message-123'
      });

      // Send notification
      const response = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'story_created',
          projectId: testProjectId,
          title: 'New Story Available',
          body: 'A new story has been shared in your project',
          data: {
            storyId: 'test-story-id',
            projectId: testProjectId
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.sent).toBeGreaterThan(0);
      expect(mockPushService.prototype.sendToDevice).toHaveBeenCalledWith(
        'ios-device-token-123456',
        expect.objectContaining({
          title: 'New Story Available',
          body: 'A new story has been shared in your project',
          platform: 'ios'
        })
      );
    });

    test('should handle iOS notification with custom sound', async () => {
      await request(app)
        .post('/api/device-tokens')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: 'ios-device-token-sound',
          platform: 'ios'
        });

      const mockPushService = PushNotificationService as jest.MockedClass<typeof PushNotificationService>;
      mockPushService.prototype.sendToDevice = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'ios-sound-message'
      });

      await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'interaction_received',
          projectId: testProjectId,
          title: 'New Comment',
          body: 'Someone commented on your story',
          sound: 'notification.wav'
        });

      expect(mockPushService.prototype.sendToDevice).toHaveBeenCalledWith(
        'ios-device-token-sound',
        expect.objectContaining({
          sound: 'notification.wav',
          platform: 'ios'
        })
      );
    });
  });

  describe('Android Push Notifications', () => {
    test('should send push notification to Android devices', async () => {
      // Register Android device token
      await request(app)
        .post('/api/device-tokens')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: 'android-device-token-123456',
          platform: 'android',
          deviceId: 'android-device-123'
        });

      const mockPushService = PushNotificationService as jest.MockedClass<typeof PushNotificationService>;
      mockPushService.prototype.sendToDevice = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'android-message-123'
      });

      const response = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'story_created',
          projectId: testProjectId,
          title: 'New Story Available',
          body: 'A new story has been shared in your project',
          data: {
            storyId: 'test-story-id',
            projectId: testProjectId
          }
        });

      expect(response.status).toBe(200);
      expect(mockPushService.prototype.sendToDevice).toHaveBeenCalledWith(
        'android-device-token-123456',
        expect.objectContaining({
          title: 'New Story Available',
          body: 'A new story has been shared in your project',
          platform: 'android'
        })
      );
    });

    test('should handle Android notification channels', async () => {
      await request(app)
        .post('/api/device-tokens')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: 'android-device-token-channel',
          platform: 'android'
        });

      const mockPushService = PushNotificationService as jest.MockedClass<typeof PushNotificationService>;
      mockPushService.prototype.sendToDevice = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'android-channel-message'
      });

      await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'export_ready',
          projectId: testProjectId,
          title: 'Export Ready',
          body: 'Your project export is ready for download',
          channel: 'exports'
        });

      expect(mockPushService.prototype.sendToDevice).toHaveBeenCalledWith(
        'android-device-token-channel',
        expect.objectContaining({
          channel: 'exports',
          platform: 'android'
        })
      );
    });
  });

  describe('Email Notifications', () => {
    test('should send email notifications consistently', async () => {
      const mockEmailService = EmailNotificationService as jest.MockedClass<typeof EmailNotificationService>;
      mockEmailService.prototype.sendEmail = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'email-message-123'
      });

      const response = await request(app)
        .post('/api/notifications/email')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'export_ready',
          projectId: testProjectId,
          subject: 'Your Saga Export is Ready',
          template: 'export-ready'
        });

      expect(response.status).toBe(200);
      expect(mockEmailService.prototype.sendEmail).toHaveBeenCalledWith(
        'notifications@test.com',
        'Your Saga Export is Ready',
        expect.stringContaining('export-ready'),
        expect.any(Object)
      );
    });
  });

  describe('Cross-Platform Notification Preferences', () => {
    test('should respect user notification preferences across platforms', async () => {
      // Set notification preferences
      await request(app)
        .put('/api/users/notification-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: true,
          push: false,
          storyNotifications: true,
          exportNotifications: false
        });

      // Register devices
      await request(app)
        .post('/api/device-tokens')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: 'ios-device-preferences',
          platform: 'ios'
        });

      const mockPushService = PushNotificationService as jest.MockedClass<typeof PushNotificationService>;
      const mockEmailService = EmailNotificationService as jest.MockedClass<typeof EmailNotificationService>;
      
      mockPushService.prototype.sendToDevice = jest.fn().mockResolvedValue({ success: true });
      mockEmailService.prototype.sendEmail = jest.fn().mockResolvedValue({ success: true });

      // Send story notification (should be sent via email only)
      await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'story_created',
          projectId: testProjectId,
          title: 'New Story',
          body: 'A new story is available'
        });

      expect(mockEmailService.prototype.sendEmail).toHaveBeenCalled();
      expect(mockPushService.prototype.sendToDevice).not.toHaveBeenCalled();
    });
  });

  describe('Notification Delivery Reliability', () => {
    test('should handle failed push notifications gracefully', async () => {
      await request(app)
        .post('/api/device-tokens')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: 'failing-device-token',
          platform: 'ios'
        });

      const mockPushService = PushNotificationService as jest.MockedClass<typeof PushNotificationService>;
      mockPushService.prototype.sendToDevice = jest.fn().mockRejectedValue(
        new Error('Invalid device token')
      );

      const response = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'story_created',
          projectId: testProjectId,
          title: 'New Story',
          body: 'A new story is available'
        });

      // Should still return success but log the failure
      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    test('should retry failed notifications', async () => {
      await request(app)
        .post('/api/device-tokens')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: 'retry-device-token',
          platform: 'android'
        });

      const mockPushService = PushNotificationService as jest.MockedClass<typeof PushNotificationService>;
      mockPushService.prototype.sendToDevice = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ success: true, messageId: 'retry-success' });

      const response = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'story_created',
          projectId: testProjectId,
          title: 'New Story',
          body: 'A new story is available',
          retry: true
        });

      expect(response.status).toBe(200);
      expect(mockPushService.prototype.sendToDevice).toHaveBeenCalledTimes(2);
    });
  });
});