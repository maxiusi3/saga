/**
 * API Performance Tests
 * 
 * Tests API response times and throughput under various load conditions
 */

import request from 'supertest';
import { app } from '../../index';
import { performance } from 'perf_hooks';

describe('API Performance Tests', () => {
  const PERFORMANCE_THRESHOLDS = {
    AUTH_RESPONSE_TIME: 200, // ms
    STORY_FEED_RESPONSE_TIME: 2000, // ms
    SEARCH_RESPONSE_TIME: 500, // ms
    UPLOAD_RESPONSE_TIME: 5000, // ms
  };

  let authToken: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Setup test user and project for performance tests
    const authResponse = await request(app)
      .post('/api/auth/signin')
      .send({
        email: 'performance@test.com',
        password: 'testpassword123'
      });
    
    authToken = authResponse.body.accessToken;
    
    // Create test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Performance Test Project'
      });
    
    testProjectId = projectResponse.body.id;
  });

  describe('Authentication Performance', () => {
    it('should authenticate users within 200ms', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'performance@test.com',
          password: 'testpassword123'
        });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.AUTH_RESPONSE_TIME);
      
      console.log(`Authentication response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should handle concurrent authentication requests', async () => {
      const concurrentRequests = 10;
      const promises = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .post('/api/auth/signin')
            .send({
              email: 'performance@test.com',
              password: 'testpassword123'
            })
        );
      }
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      const averageTime = totalTime / concurrentRequests;
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.AUTH_RESPONSE_TIME * 2);
      
      console.log(`Concurrent auth average time: ${averageTime.toFixed(2)}ms`);
    });
  });

  describe('Story Feed Performance', () => {
    beforeAll(async () => {
      // Create multiple test stories for performance testing
      const storyPromises = [];
      for (let i = 0; i < 20; i++) {
        storyPromises.push(
          request(app)
            .post(`/api/projects/${testProjectId}/stories`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              title: `Performance Test Story ${i}`,
              audioUrl: `https://test-bucket.s3.amazonaws.com/story-${i}.mp3`,
              transcript: `This is a test story transcript for performance testing. Story number ${i}.`,
              audioDuration: 120
            })
        );
      }
      
      await Promise.all(storyPromises);
    });

    it('should load story feed within 2 seconds', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(response.body.stories).toBeDefined();
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STORY_FEED_RESPONSE_TIME);
      
      console.log(`Story feed response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should handle paginated story requests efficiently', async () => {
      const pageRequests = [];
      const startTime = performance.now();
      
      // Request multiple pages simultaneously
      for (let page = 1; page <= 5; page++) {
        pageRequests.push(
          request(app)
            .get(`/api/projects/${testProjectId}/stories`)
            .set('Authorization', `Bearer ${authToken}`)
            .query({ page, limit: 5 })
        );
      }
      
      const responses = await Promise.all(pageRequests);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.stories).toBeDefined();
      });
      
      const averageTime = totalTime / pageRequests.length;
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STORY_FEED_RESPONSE_TIME);
      
      console.log(`Paginated requests average time: ${averageTime.toFixed(2)}ms`);
    });
  });

  describe('Search Performance', () => {
    it('should return search results within 500ms', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/search`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'test story' });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE_TIME);
      
      console.log(`Search response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should handle complex search queries efficiently', async () => {
      const complexQueries = [
        'performance test story transcript',
        'story number 5',
        'test transcript performance',
        'story audio duration'
      ];
      
      const searchPromises = complexQueries.map(query => {
        const startTime = performance.now();
        return request(app)
          .get(`/api/projects/${testProjectId}/search`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ q: query })
          .then(response => ({
            response,
            responseTime: performance.now() - startTime
          }));
      });
      
      const results = await Promise.all(searchPromises);
      
      results.forEach(({ response, responseTime }) => {
        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE_TIME);
      });
      
      const averageTime = results.reduce((sum, { responseTime }) => sum + responseTime, 0) / results.length;
      console.log(`Complex search average time: ${averageTime.toFixed(2)}ms`);
    });
  });

  describe('Database Query Performance', () => {
    it('should execute user queries efficiently', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100); // Database queries should be very fast
      
      console.log(`User query response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should handle resource wallet queries efficiently', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${authToken}`);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(150);
      
      console.log(`Wallet query response time: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during repeated requests', async () => {
      const initialMemory = process.memoryUsage();
      
      // Make 100 requests to test for memory leaks
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .get(`/api/projects/${testProjectId}/stories`)
            .set('Authorization', `Bearer ${authToken}`)
            .query({ page: 1, limit: 5 })
        );
      }
      
      await Promise.all(requests);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});