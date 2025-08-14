/**
 * Load Testing Suite
 * 
 * Tests system behavior under concurrent load and stress conditions
 */

import request from 'supertest';
import { app } from '../../index';
import { performance } from 'perf_hooks';

describe('Load Testing', () => {
  let authTokens: string[] = [];
  let testProjectIds: string[] = [];

  beforeAll(async () => {
    // Create multiple test users for load testing
    const userPromises = [];
    for (let i = 0; i < 10; i++) {
      userPromises.push(
        request(app)
          .post('/api/auth/signup')
          .send({
            email: `loadtest${i}@test.com`,
            password: 'testpassword123',
            name: `Load Test User ${i}`
          })
          .then(response => response.body.accessToken)
      );
    }
    
    authTokens = await Promise.all(userPromises);
    
    // Create test projects for each user
    const projectPromises = authTokens.map((token, index) =>
      request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Load Test Project ${index}`
        })
        .then(response => response.body.id)
    );
    
    testProjectIds = await Promise.all(projectPromises);
  });

  describe('Concurrent User Load', () => {
    it('should handle 50 concurrent authentication requests', async () => {
      const concurrentUsers = 50;
      const promises = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < concurrentUsers; i++) {
        promises.push(
          request(app)
            .post('/api/auth/signin')
            .send({
              email: `loadtest${i % 10}@test.com`,
              password: 'testpassword123'
            })
        );
      }
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Check that all requests succeeded
      const successfulRequests = responses.filter(r => r.status === 200).length;
      const successRate = (successfulRequests / concurrentUsers) * 100;
      
      expect(successRate).toBeGreaterThan(95); // 95% success rate minimum
      
      const averageResponseTime = totalTime / concurrentUsers;
      expect(averageResponseTime).toBeLessThan(1000); // Average under 1 second
      
      console.log(`Concurrent auth - Success rate: ${successRate}%, Average time: ${averageResponseTime.toFixed(2)}ms`);
    });

    it('should handle concurrent story uploads', async () => {
      const concurrentUploads = 20;
      const promises = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < concurrentUploads; i++) {
        const tokenIndex = i % authTokens.length;
        const projectIndex = i % testProjectIds.length;
        
        promises.push(
          request(app)
            .post(`/api/projects/${testProjectIds[projectIndex]}/stories`)
            .set('Authorization', `Bearer ${authTokens[tokenIndex]}`)
            .send({
              title: `Concurrent Upload Test ${i}`,
              audioUrl: `https://test-bucket.s3.amazonaws.com/concurrent-${i}.mp3`,
              transcript: `This is a concurrent upload test story number ${i}`,
              audioDuration: 60
            })
        );
      }
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const successfulUploads = responses.filter(r => r.status === 201).length;
      const successRate = (successfulUploads / concurrentUploads) * 100;
      
      expect(successRate).toBeGreaterThan(90); // 90% success rate for uploads
      
      const averageResponseTime = totalTime / concurrentUploads;
      expect(averageResponseTime).toBeLessThan(3000); // Average under 3 seconds
      
      console.log(`Concurrent uploads - Success rate: ${successRate}%, Average time: ${averageResponseTime.toFixed(2)}ms`);
    });
  });

  describe('Database Load Testing', () => {
    it('should handle concurrent database reads', async () => {
      const concurrentReads = 100;
      const promises = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < concurrentReads; i++) {
        const tokenIndex = i % authTokens.length;
        const projectIndex = i % testProjectIds.length;
        
        promises.push(
          request(app)
            .get(`/api/projects/${testProjectIds[projectIndex]}/stories`)
            .set('Authorization', `Bearer ${authTokens[tokenIndex]}`)
            .query({ page: 1, limit: 10 })
        );
      }
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const successfulReads = responses.filter(r => r.status === 200).length;
      const successRate = (successfulReads / concurrentReads) * 100;
      
      expect(successRate).toBeGreaterThan(98); // Very high success rate for reads
      
      const averageResponseTime = totalTime / concurrentReads;
      expect(averageResponseTime).toBeLessThan(500); // Fast read responses
      
      console.log(`Concurrent reads - Success rate: ${successRate}%, Average time: ${averageResponseTime.toFixed(2)}ms`);
    });

    it('should handle mixed read/write operations', async () => {
      const totalOperations = 50;
      const promises = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < totalOperations; i++) {
        const tokenIndex = i % authTokens.length;
        const projectIndex = i % testProjectIds.length;
        
        if (i % 3 === 0) {
          // Write operation (create story)
          promises.push(
            request(app)
              .post(`/api/projects/${testProjectIds[projectIndex]}/stories`)
              .set('Authorization', `Bearer ${authTokens[tokenIndex]}`)
              .send({
                title: `Mixed Operation Story ${i}`,
                audioUrl: `https://test-bucket.s3.amazonaws.com/mixed-${i}.mp3`,
                transcript: `Mixed operation test story ${i}`,
                audioDuration: 45
              })
          );
        } else {
          // Read operation (get stories)
          promises.push(
            request(app)
              .get(`/api/projects/${testProjectIds[projectIndex]}/stories`)
              .set('Authorization', `Bearer ${authTokens[tokenIndex]}`)
              .query({ page: 1, limit: 5 })
          );
        }
      }
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const successfulOperations = responses.filter(r => r.status === 200 || r.status === 201).length;
      const successRate = (successfulOperations / totalOperations) * 100;
      
      expect(successRate).toBeGreaterThan(95);
      
      const averageResponseTime = totalTime / totalOperations;
      expect(averageResponseTime).toBeLessThan(1000);
      
      console.log(`Mixed operations - Success rate: ${successRate}%, Average time: ${averageResponseTime.toFixed(2)}ms`);
    });
  });

  describe('Resource Wallet Load Testing', () => {
    it('should handle concurrent wallet operations', async () => {
      const concurrentOperations = 30;
      const promises = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < concurrentOperations; i++) {
        const tokenIndex = i % authTokens.length;
        
        if (i % 2 === 0) {
          // Check wallet balance
          promises.push(
            request(app)
              .get('/api/users/me/wallet')
              .set('Authorization', `Bearer ${authTokens[tokenIndex]}`)
          );
        } else {
          // Get transaction history
          promises.push(
            request(app)
              .get('/api/users/me/transactions')
              .set('Authorization', `Bearer ${authTokens[tokenIndex]}`)
          );
        }
      }
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const successfulOperations = responses.filter(r => r.status === 200).length;
      const successRate = (successfulOperations / concurrentOperations) * 100;
      
      expect(successRate).toBeGreaterThan(98);
      
      const averageResponseTime = totalTime / concurrentOperations;
      expect(averageResponseTime).toBeLessThan(200);
      
      console.log(`Wallet operations - Success rate: ${successRate}%, Average time: ${averageResponseTime.toFixed(2)}ms`);
    });
  });

  describe('Search Load Testing', () => {
    beforeAll(async () => {
      // Create stories with searchable content
      const storyPromises = [];
      for (let i = 0; i < 50; i++) {
        const tokenIndex = i % authTokens.length;
        const projectIndex = i % testProjectIds.length;
        
        storyPromises.push(
          request(app)
            .post(`/api/projects/${testProjectIds[projectIndex]}/stories`)
            .set('Authorization', `Bearer ${authTokens[tokenIndex]}`)
            .send({
              title: `Searchable Story ${i}`,
              audioUrl: `https://test-bucket.s3.amazonaws.com/search-${i}.mp3`,
              transcript: `This is a searchable story about family memories, childhood experiences, and life lessons. Story number ${i} contains unique keywords like adventure${i} and memory${i}.`,
              audioDuration: 90
            })
        );
      }
      
      await Promise.all(storyPromises);
    });

    it('should handle concurrent search requests', async () => {
      const concurrentSearches = 25;
      const searchTerms = ['family', 'childhood', 'memories', 'adventure', 'story', 'experiences'];
      const promises = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < concurrentSearches; i++) {
        const tokenIndex = i % authTokens.length;
        const projectIndex = i % testProjectIds.length;
        const searchTerm = searchTerms[i % searchTerms.length];
        
        promises.push(
          request(app)
            .get(`/api/projects/${testProjectIds[projectIndex]}/search`)
            .set('Authorization', `Bearer ${authTokens[tokenIndex]}`)
            .query({ q: searchTerm })
        );
      }
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const successfulSearches = responses.filter(r => r.status === 200).length;
      const successRate = (successfulSearches / concurrentSearches) * 100;
      
      expect(successRate).toBeGreaterThan(95);
      
      const averageResponseTime = totalTime / concurrentSearches;
      expect(averageResponseTime).toBeLessThan(800);
      
      console.log(`Concurrent searches - Success rate: ${successRate}%, Average time: ${averageResponseTime.toFixed(2)}ms`);
    });
  });

  describe('System Stability Under Load', () => {
    it('should maintain stability during sustained load', async () => {
      const duration = 30000; // 30 seconds
      const requestInterval = 100; // Request every 100ms
      const startTime = Date.now();
      
      let requestCount = 0;
      let successCount = 0;
      let errorCount = 0;
      
      const makeRequest = async () => {
        try {
          const tokenIndex = requestCount % authTokens.length;
          const projectIndex = requestCount % testProjectIds.length;
          
          const response = await request(app)
            .get(`/api/projects/${testProjectIds[projectIndex]}/stories`)
            .set('Authorization', `Bearer ${authTokens[tokenIndex]}`)
            .query({ page: 1, limit: 5 });
          
          if (response.status === 200) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
        
        requestCount++;
      };
      
      // Start sustained load
      const intervalId = setInterval(makeRequest, requestInterval);
      
      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, duration));
      
      // Stop the load
      clearInterval(intervalId);
      
      const totalTime = Date.now() - startTime;
      const successRate = (successCount / requestCount) * 100;
      const requestsPerSecond = (requestCount / totalTime) * 1000;
      
      expect(successRate).toBeGreaterThan(95);
      expect(requestsPerSecond).toBeGreaterThan(5); // At least 5 RPS
      
      console.log(`Sustained load - Requests: ${requestCount}, Success rate: ${successRate.toFixed(2)}%, RPS: ${requestsPerSecond.toFixed(2)}`);
    });
  });
});