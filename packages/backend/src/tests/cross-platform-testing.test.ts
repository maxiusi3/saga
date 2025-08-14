/**
 * Cross-Platform Testing Suite
 * 
 * This test suite validates functionality across all supported platforms and devices,
 * ensuring consistent behavior and performance across web, iOS, and Android platforms.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../index';
import { setupTestDatabase, cleanupTestDatabase } from './setup';
import { WebSocketClient } from '../utils/websocket-client';

describe('Cross-Platform Testing Suite', () => {
  let testUserId: string;
  let testProjectId: string;
  let authToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create test user and project
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'crossplatform@test.com',
        password: 'TestPassword123!',
        name: 'Cross Platform Test User'
      });
    
    testUserId = userResponse.body.user.id;
    authToken = userResponse.body.token;

    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Cross Platform Test Project',
        description: 'Test project for cross-platform validation'
      });
    
    testProjectId = projectResponse.body.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Web Application Browser Compatibility', () => {
    test('should handle API requests consistently across browsers', async () => {
      // Test core API endpoints that web browsers will use
      const endpoints = [
        '/api/projects',
        '/api/stories',
        '/api/prompts',
        '/api/users/profile'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        expect(response.status).toBeLessThan(500);
        expect(response.headers['content-type']).toMatch(/json/);
      }
    });

    test('should return proper CORS headers for web clients', async () => {
      const response = await request(app)
        .options('/api/projects')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    test('should handle different content-type headers', async () => {
      const contentTypes = [
        'application/json',
        'application/json; charset=utf-8',
        'multipart/form-data'
      ];

      for (const contentType of contentTypes) {
        const response = await request(app)
          .post('/api/stories')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', contentType)
          .send({ projectId: testProjectId, transcript: 'Test story' });

        // Should either succeed or fail gracefully
        expect([200, 201, 400, 415]).toContain(response.status);
      }
    });
  });

  describe('Mobile Application Platform Compatibility', () => {
    test('should handle iOS-specific headers and requests', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'SagaApp/1.0 (iPhone; iOS 15.0; Scale/3.00)')
        .set('X-Platform', 'ios');

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    test('should handle Android-specific headers and requests', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'SagaApp/1.0 (Android 12; SM-G991B)')
        .set('X-Platform', 'android');

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    test('should handle mobile-specific file upload formats', async () => {
      const mobileFormats = [
        { format: 'audio/mp4', extension: 'm4a' },
        { format: 'audio/mpeg', extension: 'mp3' },
        { format: 'audio/wav', extension: 'wav' }
      ];

      for (const { format, extension } of mobileFormats) {
        const response = await request(app)
          .post('/api/stories/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', Buffer.from('fake audio data'), `test.${extension}`)
          .field('projectId', testProjectId);

        // Should either accept or reject gracefully
        expect([200, 201, 400, 415]).toContain(response.status);
      }
    });
  });

  describe('Cross-Platform Data Synchronization', () => {
    test('should maintain data consistency across platforms', async () => {
      // Create data from "web" platform
      const webStoryResponse = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Platform', 'web')
        .send({
          projectId: testProjectId,
          transcript: 'Web platform story',
          duration: 120
        });

      const storyId = webStoryResponse.body.id;

      // Verify data is accessible from "mobile" platform
      const mobileResponse = await request(app)
        .get(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Platform', 'mobile');

      expect(mobileResponse.status).toBe(200);
      expect(mobileResponse.body.transcript).toBe('Web platform story');

      // Update from mobile platform
      await request(app)
        .put(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Platform', 'mobile')
        .send({
          transcript: 'Updated from mobile'
        });

      // Verify update is visible on web platform
      const webVerifyResponse = await request(app)
        .get(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Platform', 'web');

      expect(webVerifyResponse.body.transcript).toBe('Updated from mobile');
    });

    test('should handle concurrent updates from different platforms', async () => {
      const storyResponse = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId: testProjectId,
          transcript: 'Original story',
          duration: 60
        });

      const storyId = storyResponse.body.id;

      // Simulate concurrent updates from different platforms
      const webUpdate = request(app)
        .put(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Platform', 'web')
        .send({ transcript: 'Web update' });

      const mobileUpdate = request(app)
        .put(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Platform', 'mobile')
        .send({ transcript: 'Mobile update' });

      const [webResult, mobileResult] = await Promise.all([webUpdate, mobileUpdate]);

      // At least one should succeed
      expect([webResult.status, mobileResult.status]).toContain(200);
    });
  });

  describe('Real-Time Features Cross-Platform', () => {
    test('should handle WebSocket connections from different platforms', async () => {
      const webClient = new WebSocketClient('ws://localhost:8080');
      const mobileClient = new WebSocketClient('ws://localhost:8080');

      await Promise.all([
        webClient.connect(authToken, 'web'),
        mobileClient.connect(authToken, 'mobile')
      ]);

      // Test message broadcasting
      const messagePromise = new Promise((resolve) => {
        mobileClient.on('story_created', resolve);
      });

      webClient.emit('story_created', {
        projectId: testProjectId,
        storyId: 'test-story-id'
      });

      const receivedMessage = await messagePromise;
      expect(receivedMessage).toBeDefined();

      await Promise.all([
        webClient.disconnect(),
        mobileClient.disconnect()
      ]);
    });

    test('should maintain real-time sync during platform switches', async () => {
      // Simulate user switching from mobile to web
      const mobileClient = new WebSocketClient('ws://localhost:8080');
      await mobileClient.connect(authToken, 'mobile');

      // Create interaction from mobile
      await request(app)
        .post('/api/interactions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Platform', 'mobile')
        .send({
          storyId: 'test-story-id',
          type: 'comment',
          content: 'Mobile comment'
        });

      // Switch to web client
      const webClient = new WebSocketClient('ws://localhost:8080');
      await webClient.connect(authToken, 'web');

      // Should receive sync data
      const syncPromise = new Promise((resolve) => {
        webClient.on('sync_complete', resolve);
      });

      const syncData = await syncPromise;
      expect(syncData).toBeDefined();

      await Promise.all([
        mobileClient.disconnect(),
        webClient.disconnect()
      ]);
    });
  });

  describe('Notification Delivery Cross-Platform', () => {
    test('should deliver push notifications to mobile platforms', async () => {
      // Register device tokens for different platforms
      await request(app)
        .post('/api/device-tokens')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: 'ios-device-token-123',
          platform: 'ios'
        });

      await request(app)
        .post('/api/device-tokens')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: 'android-device-token-456',
          platform: 'android'
        });

      // Trigger notification
      const response = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'story_created',
          projectId: testProjectId,
          message: 'New story available'
        });

      expect(response.status).toBe(200);
      expect(response.body.sent).toBeGreaterThan(0);
    });

    test('should handle email notifications consistently', async () => {
      const response = await request(app)
        .post('/api/notifications/email')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'export_ready',
          projectId: testProjectId
        });

      expect(response.status).toBe(200);
      expect(response.body.emailSent).toBe(true);
    });
  });

  describe('Offline Functionality and Sync Recovery', () => {
    test('should handle offline data queuing', async () => {
      // Simulate offline actions
      const offlineActions = [
        {
          type: 'CREATE_STORY',
          data: { projectId: testProjectId, transcript: 'Offline story 1' },
          timestamp: Date.now()
        },
        {
          type: 'UPDATE_STORY',
          data: { storyId: 'existing-story', transcript: 'Updated offline' },
          timestamp: Date.now() + 1000
        }
      ];

      const response = await request(app)
        .post('/api/sync/offline-actions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ actions: offlineActions });

      expect(response.status).toBe(200);
      expect(response.body.processed).toBe(offlineActions.length);
    });

    test('should resolve sync conflicts appropriately', async () => {
      // Create conflicting changes
      const storyResponse = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId: testProjectId,
          transcript: 'Original',
          lastModified: Date.now()
        });

      const storyId = storyResponse.body.id;

      // Simulate conflict resolution
      const conflictResponse = await request(app)
        .post('/api/sync/resolve-conflict')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          storyId,
          localVersion: { transcript: 'Local change', lastModified: Date.now() + 1000 },
          serverVersion: { transcript: 'Server change', lastModified: Date.now() + 2000 },
          resolution: 'server_wins'
        });

      expect(conflictResponse.status).toBe(200);
      expect(conflictResponse.body.resolved).toBe(true);
    });
  });

  describe('Responsive Design Validation', () => {
    test('should return appropriate data for different screen sizes', async () => {
      const screenSizes = [
        { width: 320, height: 568, type: 'mobile' },
        { width: 768, height: 1024, type: 'tablet' },
        { width: 1920, height: 1080, type: 'desktop' }
      ];

      for (const screen of screenSizes) {
        const response = await request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .set('X-Screen-Width', screen.width.toString())
          .set('X-Screen-Height', screen.height.toString())
          .set('X-Device-Type', screen.type);

        expect(response.status).toBe(200);
        expect(response.body).toBeDefined();
      }
    });
  });

  describe('Accessibility Features Cross-Platform', () => {
    test('should provide accessibility metadata in API responses', async () => {
      const response = await request(app)
        .get('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Accessibility-Mode', 'true');

      expect(response.status).toBe(200);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('accessibilityLabel');
        expect(response.body[0]).toHaveProperty('accessibilityHint');
      }
    });

    test('should handle high contrast mode requests', async () => {
      const response = await request(app)
        .get('/api/ui/theme')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-High-Contrast', 'true');

      expect(response.status).toBe(200);
      expect(response.body.theme).toBe('high-contrast');
    });
  });

  describe('Performance Validation Across Devices', () => {
    test('should respond within acceptable time limits', async () => {
      const endpoints = [
        '/api/projects',
        '/api/stories',
        '/api/prompts/next'
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();
        
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`);

        const responseTime = Date.now() - startTime;

        expect(response.status).toBeLessThan(500);
        expect(responseTime).toBeLessThan(2000); // 2 second max response time
      }
    });

    test('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const totalTime = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should handle 10 concurrent requests in under 5 seconds
      expect(totalTime).toBeLessThan(5000);
    });
  });
});