/**
 * Accessibility Tests
 * 
 * Tests WCAG 2.1 AA compliance and accessibility features
 */

import request from 'supertest';
import { app } from '../index';

describe('Accessibility Compliance Tests', () => {
  let authToken: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Setup test user and project
    const authResponse = await request(app)
      .post('/api/auth/signin')
      .send({
        email: 'accessibility@test.com',
        password: 'testpassword123'
      });
    
    authToken = authResponse.body.accessToken;
    
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Accessibility Test Project'
      });
    
    testProjectId = projectResponse.body.id;
  });

  describe('API Accessibility Features', () => {
    it('should provide audio URLs for AI prompts', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/next-prompt`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.prompt).toBeDefined();
      
      // Check if audio URL is provided for accessibility
      if (response.body.prompt.audioUrl) {
        expect(response.body.prompt.audioUrl).toMatch(/^https?:\/\/.+\.(mp3|wav|m4a)$/);
      }
    });

    it('should support text alternatives for audio content', async () => {
      // Create a test story
      const storyResponse = await request(app)
        .post(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Accessibility Test Story',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/accessibility-test.mp3',
          transcript: 'This is a test transcript for accessibility compliance.',
          audioDuration: 60
        });
      
      expect(storyResponse.status).toBe(201);
      
      // Verify transcript is available as text alternative
      const story = storyResponse.body;
      expect(story.transcript).toBeDefined();
      expect(story.transcript).toBe('This is a test transcript for accessibility compliance.');
    });

    it('should provide structured data for screen readers', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });
      
      expect(response.status).toBe(200);
      expect(response.body.stories).toBeDefined();
      
      // Check that stories have proper structure for screen readers
      if (response.body.stories.length > 0) {
        const story = response.body.stories[0];
        expect(story.title).toBeDefined();
        expect(story.createdAt).toBeDefined();
        expect(story.audioDuration).toBeDefined();
        
        // Verify semantic information is available
        expect(typeof story.title).toBe('string');
        expect(typeof story.audioDuration).toBe('number');
      }
    });
  });

  describe('Content Accessibility', () => {
    it('should provide meaningful error messages', async () => {
      // Test with invalid project ID
      const response = await request(app)
        .get('/api/projects/invalid-id/stories')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBeDefined();
      expect(response.body.error.message).toMatch(/project.*not found/i);
    });

    it('should provide clear validation messages', async () => {
      // Test with missing required fields
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBeDefined();
      
      // Error message should be descriptive
      expect(response.body.error.message.length).toBeGreaterThan(10);
    });

    it('should support keyboard navigation patterns in API responses', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });
      
      expect(response.status).toBe(200);
      
      // Check pagination metadata for keyboard navigation
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.currentPage).toBeDefined();
      expect(response.body.pagination.totalPages).toBeDefined();
      expect(response.body.pagination.hasNext).toBeDefined();
      expect(response.body.pagination.hasPrevious).toBeDefined();
    });
  });

  describe('Internationalization Support', () => {
    it('should handle different character encodings', async () => {
      const unicodeText = 'Test with émojis 🎉 and spëcial chäractërs';
      
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: unicodeText,
          audioUrl: 'https://test-bucket.s3.amazonaws.com/unicode-test.mp3',
          transcript: unicodeText,
          audioDuration: 30
        });
      
      expect(response.status).toBe(201);
      expect(response.body.title).toBe(unicodeText);
      expect(response.body.transcript).toBe(unicodeText);
    });

    it('should support RTL text content', async () => {
      const rtlText = 'هذا نص تجريبي باللغة العربية';
      
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'RTL Test Story',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/rtl-test.mp3',
          transcript: rtlText,
          audioDuration: 45
        });
      
      expect(response.status).toBe(201);
      expect(response.body.transcript).toBe(rtlText);
    });
  });

  describe('Time-based Media Accessibility', () => {
    it('should provide duration information for audio content', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Duration Test Story',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/duration-test.mp3',
          transcript: 'This story has duration information for accessibility.',
          audioDuration: 120
        });
      
      expect(response.status).toBe(201);
      expect(response.body.audioDuration).toBe(120);
      
      // Duration should be in seconds for consistent accessibility
      expect(typeof response.body.audioDuration).toBe('number');
      expect(response.body.audioDuration).toBeGreaterThan(0);
    });

    it('should support transcript editing for accuracy', async () => {
      // Create a story first
      const storyResponse = await request(app)
        .post(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Transcript Edit Test',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/transcript-test.mp3',
          transcript: 'Original transcript text.',
          audioDuration: 60
        });
      
      const storyId = storyResponse.body.id;
      
      // Edit the transcript for accessibility improvement
      const editResponse = await request(app)
        .put(`/api/stories/${storyId}/transcript`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transcript: 'Corrected transcript text for better accessibility.'
        });
      
      expect(editResponse.status).toBe(200);
      expect(editResponse.body.transcript).toBe('Corrected transcript text for better accessibility.');
    });
  });

  describe('Cognitive Accessibility', () => {
    it('should provide consistent API response structure', async () => {
      // Test multiple endpoints for consistent structure
      const endpoints = [
        `/api/projects/${testProjectId}/stories`,
        `/api/projects/${testProjectId}/next-prompt`,
        '/api/users/me/wallet'
      ];
      
      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`);
        
        // All responses should have consistent error handling
        if (response.status >= 400) {
          expect(response.body.error).toBeDefined();
          expect(response.body.error.code).toBeDefined();
          expect(response.body.error.message).toBeDefined();
        }
        
        // All responses should have timestamp for context
        expect(response.headers['date']).toBeDefined();
      }
    });

    it('should provide clear progress indicators for long operations', async () => {
      // Test export request which is a long operation
      const exportResponse = await request(app)
        .post(`/api/projects/${testProjectId}/export`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(exportResponse.status).toBe(202); // Accepted for processing
      expect(exportResponse.body.exportId).toBeDefined();
      expect(exportResponse.body.status).toBe('pending');
      
      // Should provide way to check progress
      const statusResponse = await request(app)
        .get(`/api/exports/${exportResponse.body.exportId}/status`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBeDefined();
    });
  });

  describe('Mobile Accessibility Support', () => {
    it('should provide appropriate response sizes for mobile', async () => {
      // Test with mobile-appropriate pagination
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
        .query({ page: 1, limit: 5 }); // Smaller limit for mobile
      
      expect(response.status).toBe(200);
      expect(response.body.stories.length).toBeLessThanOrEqual(5);
    });

    it('should support touch-friendly interaction patterns', async () => {
      // Test that API supports the interaction patterns needed for touch interfaces
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });
      
      expect(response.status).toBe(200);
      
      // Should provide data needed for touch-friendly UI elements
      if (response.body.stories.length > 0) {
        const story = response.body.stories[0];
        expect(story.id).toBeDefined(); // For touch target identification
        expect(story.title).toBeDefined(); // For accessible labels
        expect(story.createdAt).toBeDefined(); // For context
      }
    });
  });
});