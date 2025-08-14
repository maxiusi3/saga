/**
 * Load Testing Suite
 * 
 * Tests system performance under concurrent load scenarios
 */

import request from 'supertest';
import { app } from '../index';
import { performance } from 'perf_hooks';

describe('Load Testing', () => {
  let authTokens: string[] = [];
  let testProjectIds: string[] = [];

  beforeAll(async () => {
    // Create multiple test users for concurrent testing
    const userPromises = Array.from({ length: 10 }, async (_, index) => {
      const userResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `loadtest${index}@test.com`,
          password: 'TestPassword123!',
          name: `Load Test User ${index}`,
        });

      const signInResponse = await request(app)
        .post('/api/auth/signin')
        .send({
          email: `loadtest${index}@test.com`,
          password: 'TestPassword123!',
        });

      return signInResponse.body.accessToken;
    });

    authTokens = await Promise.all(userPromises);

    // Create test projects for each user
    const projectPromises = authTokens.map(async (token, index) => {
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Load Test Project ${index}`,
        });

      return projectResponse.body.id;
    });

    testProjectIds = await Promise.all(projectPromises);
  });

  describe('Concurrent User Authentication', () => {
    it('should handle 50 concurrent login requests', async () => {
      const startTime = performance.now();
      
      const loginPromises = Array.from({ length: 50 }, async (_, index) => {
        const userIndex = index % authTokens.length;
        return request(app)
          .post('/api/auth/signin')
          .send({
            email: `loadtest${userIndex}@test.com`,
            password: 'TestPassword123!',
          });
      });

      const responses = await Promise.all(loginPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.accessToken).toBeDefined();
      });

      // Should complete within reasonable time (5 seconds for 50 requests)
      expect(duration).toBeLessThan(5000);
      
      // Average response time should be under 100ms
      const avgResponseTime = duration / responses.length;
      expect(avgResponseTime).toBeLessThan(100);
    });

    it('should handle concurrent token refresh requests', async () => {
      const refreshPromises = authTokens.map(async (token) => {
        return request(app)
          .post('/api/auth/refresh')
          .set('Authorization', `Bearer ${token}`);
      });

      const responses = await Promise.all(refreshPromises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.accessToken).toBeDefined();
      });
    });
  });

  describe('Concurrent Story Operations', () => {
    it('should handle concurrent story creation', async () => {
      const startTime = performance.now();
      
      const storyPromises = authTokens.map(async (token, index) => {
        const projectId = testProjectIds[index];
        return request(app)
          .post(`/api/projects/${projectId}/stories`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: `Load Test Story ${index}`,
            audioUrl: `https://test-bucket.s3.amazonaws.com/load-test-${index}.mp3`,
            transcript: `This is a load test story transcript ${index}`,
            audioDuration: 60 + index,
          });
      });

      const responses = await Promise.all(storyPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All story creations should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.title).toBe(`Load Test Story ${index}`);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(3000);
    });

    it('should handle concurrent story retrieval', async () => {
      const startTime = performance.now();
      
      const retrievalPromises = authTokens.map(async (token, index) => {
        const projectId = testProjectIds[index];
        return request(app)
          .get(`/api/projects/${projectId}/stories`)
          .set('Authorization', `Bearer ${token}`)
          .query({ page: 1, limit: 10 });
      });

      const responses = await Promise.all(retrievalPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All retrievals should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.stories).toBeDefined();
        expect(Array.isArray(response.body.stories)).toBe(true);
      });

      // Should complete quickly for read operations
      expect(duration).toBeLessThan(2000);
    });

    it('should handle concurrent story search requests', async () => {
      const searchPromises = authTokens.map(async (token, index) => {
        const projectId = testProjectIds[index];
        return request(app)
          .get(`/api/projects/${projectId}/stories/search`)
          .set('Authorization', `Bearer ${token}`)
          .query({ q: 'load test', limit: 5 });
      });

      const responses = await Promise.all(searchPromises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.results).toBeDefined();
      });
    });
  });

  describe('Concurrent Interaction Operations', () => {
    let storyIds: string[] = [];

    beforeAll(async () => {
      // Create stories for interaction testing
      const storyPromises = authTokens.map(async (token, index) => {
        const projectId = testProjectIds[index];
        const response = await request(app)
          .post(`/api/projects/${projectId}/stories`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: `Interaction Test Story ${index}`,
            audioUrl: `https://test-bucket.s3.amazonaws.com/interaction-test-${index}.mp3`,
            transcript: `This is an interaction test story ${index}`,
            audioDuration: 90,
          });
        return response.body.id;
      });

      storyIds = await Promise.all(storyPromises);
    });

    it('should handle concurrent comment creation', async () => {
      const commentPromises = authTokens.map(async (token, index) => {
        const storyId = storyIds[index];
        return request(app)
          .post(`/api/stories/${storyId}/interactions`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            type: 'comment',
            content: `Load test comment ${index}`,
          });
      });

      const responses = await Promise.all(commentPromises);

      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.content).toBe(`Load test comment ${index}`);
      });
    });

    it('should handle concurrent follow-up question creation', async () => {
      const questionPromises = authTokens.map(async (token, index) => {
        const storyId = storyIds[index];
        return request(app)
          .post(`/api/stories/${storyId}/interactions`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            type: 'follow_up_question',
            content: `Load test question ${index}?`,
          });
      });

      const responses = await Promise.all(questionPromises);

      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.content).toBe(`Load test question ${index}?`);
      });
    });
  });

  describe('Database Performance Under Load', () => {
    it('should maintain query performance with concurrent reads', async () => {
      const startTime = performance.now();
      
      // Create 100 concurrent read requests
      const readPromises = Array.from({ length: 100 }, async (_, index) => {
        const tokenIndex = index % authTokens.length;
        const projectIndex = index % testProjectIds.length;
        
        return request(app)
          .get(`/api/projects/${testProjectIds[projectIndex]}/stories`)
          .set('Authorization', `Bearer ${authTokens[tokenIndex]}`)
          .query({ page: 1, limit: 5 });
      });

      const responses = await Promise.all(readPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All reads should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should handle 100 concurrent reads within 5 seconds
      expect(duration).toBeLessThan(5000);
      
      // Average response time should be reasonable
      const avgResponseTime = duration / responses.length;
      expect(avgResponseTime).toBeLessThan(50);
    });

    it('should handle mixed read/write operations', async () => {
      const operations = [];
      
      // Mix of read and write operations
      for (let i = 0; i < 50; i++) {
        const tokenIndex = i % authTokens.length;
        const projectIndex = i % testProjectIds.length;
        
        if (i % 3 === 0) {
          // Write operation - create story
          operations.push(
            request(app)
              .post(`/api/projects/${testProjectIds[projectIndex]}/stories`)
              .set('Authorization', `Bearer ${authTokens[tokenIndex]}`)
              .send({
                title: `Mixed Load Story ${i}`,
                audioUrl: `https://test-bucket.s3.amazonaws.com/mixed-${i}.mp3`,
                transcript: `Mixed load test transcript ${i}`,
                audioDuration: 30,
              })
          );
        } else {
          // Read operation - get stories
          operations.push(
            request(app)
              .get(`/api/projects/${testProjectIds[projectIndex]}/stories`)
              .set('Authorization', `Bearer ${authTokens[tokenIndex]}`)
              .query({ page: 1, limit: 5 })
          );
        }
      }

      const startTime = performance.now();
      const responses = await Promise.all(operations);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All operations should succeed
      responses.forEach(response => {
        expect([200, 201]).toContain(response.status);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(8000);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during concurrent operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform intensive operations
      const intensivePromises = Array.from({ length: 200 }, async (_, index) => {
        const tokenIndex = index % authTokens.length;
        const projectIndex = index % testProjectIds.length;
        
        return request(app)
          .get(`/api/projects/${testProjectIds[projectIndex]}/stories`)
          .set('Authorization', `Bearer ${authTokens[tokenIndex]}`)
          .query({ page: 1, limit: 10 });
      });

      await Promise.all(intensivePromises);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase dramatically
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
      
      // Memory increase should be less than 50%
      expect(memoryIncreasePercent).toBeLessThan(50);
    });
  });

  describe('Error Handling Under Load', () => {
    it('should handle invalid requests gracefully under load', async () => {
      const invalidPromises = Array.from({ length: 50 }, async () => {
        return request(app)
          .get('/api/projects/invalid-id/stories')
          .set('Authorization', 'Bearer invalid-token');
      });

      const responses = await Promise.all(invalidPromises);

      // All should return appropriate error codes
      responses.forEach(response => {
        expect([401, 404]).toContain(response.status);
        expect(response.body.error).toBeDefined();
      });
    });

    it('should maintain rate limiting under concurrent requests', async () => {
      // Create many requests from the same user to test rate limiting
      const rateLimitPromises = Array.from({ length: 100 }, async () => {
        return request(app)
          .get(`/api/projects/${testProjectIds[0]}/stories`)
          .set('Authorization', `Bearer ${authTokens[0]}`);
      });

      const responses = await Promise.all(rateLimitPromises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const successfulResponses = responses.filter(r => r.status === 200);
      
      // Should have both successful and rate-limited responses
      expect(successfulResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('WebSocket Performance Under Load', () => {
    it('should handle concurrent WebSocket connections', async () => {
      // This would require WebSocket client setup
      // For now, test the HTTP endpoints that support real-time features
      
      const realtimePromises = authTokens.map(async (token, index) => {
        const projectId = testProjectIds[index];
        return request(app)
          .get(`/api/projects/${projectId}/realtime-status`)
          .set('Authorization', `Bearer ${token}`);
      });

      const responses = await Promise.all(realtimePromises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  afterAll(async () => {
    // Cleanup test data
    const cleanupPromises = testProjectIds.map(async (projectId, index) => {
      return request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authTokens[index]}`);
    });

    await Promise.all(cleanupPromises);
  });
});