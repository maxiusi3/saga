/**
 * Regression Testing Suite
 * 
 * Tests to prevent regression of previously fixed bugs and ensure stability
 */

import request from 'supertest';
import { app } from '../index';

describe('Regression Testing', () => {
  let authToken: string;
  let testProjectId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Setup test user and project
    const signupResponse = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'regression@test.com',
        password: 'TestPassword123!',
        name: 'Regression Test User',
      });

    testUserId = signupResponse.body.user.id;

    const authResponse = await request(app)
      .post('/api/auth/signin')
      .send({
        email: 'regression@test.com',
        password: 'TestPassword123!',
      });
    
    authToken = authResponse.body.accessToken;
    
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Regression Test Project'
      });
    
    testProjectId = projectResponse.body.id;
  });

  describe('Authentication Regression Tests', () => {
    it('should prevent duplicate user registration with same email', async () => {
      // Attempt to register with same email
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'regression@test.com',
          password: 'DifferentPassword123!',
          name: 'Different User',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/email.*already.*exists/i);
    });

    it('should handle case-insensitive email login', async () => {
      // Test login with different case
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'REGRESSION@TEST.COM',
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
    });

    it('should prevent SQL injection in login', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          email: "'; DROP TABLE users; --",
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should handle expired tokens gracefully', async () => {
      // Use an obviously expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';
      
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.message).toMatch(/token.*expired|invalid/i);
    });
  });

  describe('Resource Wallet Regression Tests', () => {
    it('should prevent negative wallet balances', async () => {
      // Get current wallet status
      const walletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${authToken}`);

      const currentVouchers = walletResponse.body.projectVouchers;

      // Try to consume more vouchers than available
      const consumePromises = Array.from({ length: currentVouchers + 5 }, () =>
        request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Project for Voucher Consumption'
          })
      );

      const responses = await Promise.all(consumePromises);
      
      // Only the first few should succeed
      const successfulResponses = responses.filter(r => r.status === 201);
      const failedResponses = responses.filter(r => r.status === 400);

      expect(successfulResponses.length).toBeLessThanOrEqual(currentVouchers);
      expect(failedResponses.length).toBeGreaterThan(0);
      
      // Failed responses should have appropriate error message
      failedResponses.forEach(response => {
        expect(response.body.error.message).toMatch(/insufficient.*vouchers/i);
      });
    });

    it('should handle concurrent wallet operations atomically', async () => {
      // Create multiple concurrent requests that modify wallet
      const concurrentRequests = Array.from({ length: 3 }, () =>
        request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Concurrent Test Project'
          })
      );

      const responses = await Promise.all(concurrentRequests);
      
      // Check final wallet state is consistent
      const finalWalletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${authToken}`);

      expect(finalWalletResponse.status).toBe(200);
      expect(finalWalletResponse.body.projectVouchers).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Story Management Regression Tests', () => {
    it('should prevent XSS in story content', async () => {
      const maliciousContent = '<script>alert("XSS")</script>';
      
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: maliciousContent,
          audioUrl: 'https://test-bucket.s3.amazonaws.com/xss-test.mp3',
          transcript: maliciousContent,
          audioDuration: 60,
        });

      expect(response.status).toBe(201);
      
      // Content should be sanitized
      expect(response.body.title).not.toContain('<script>');
      expect(response.body.transcript).not.toContain('<script>');
    });

    it('should handle large transcript content', async () => {
      // Create a very large transcript (10KB)
      const largeTranscript = 'A'.repeat(10000);
      
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Large Transcript Test',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/large-test.mp3',
          transcript: largeTranscript,
          audioDuration: 600,
        });

      expect(response.status).toBe(201);
      expect(response.body.transcript).toBe(largeTranscript);
    });

    it('should prevent duplicate story creation with same audio URL', async () => {
      const audioUrl = 'https://test-bucket.s3.amazonaws.com/duplicate-test.mp3';
      
      // Create first story
      const firstResponse = await request(app)
        .post(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'First Story',
          audioUrl,
          transcript: 'First story transcript',
          audioDuration: 60,
        });

      expect(firstResponse.status).toBe(201);

      // Try to create duplicate
      const duplicateResponse = await request(app)
        .post(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Duplicate Story',
          audioUrl,
          transcript: 'Duplicate story transcript',
          audioDuration: 60,
        });

      expect(duplicateResponse.status).toBe(409);
      expect(duplicateResponse.body.error.message).toMatch(/duplicate.*audio/i);
    });
  });

  describe('Search Functionality Regression Tests', () => {
    let searchTestStoryId: string;

    beforeAll(async () => {
      // Create a story for search testing
      const storyResponse = await request(app)
        .post(`/api/projects/${testProjectId}/stories`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Searchable Story Title',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/search-test.mp3',
          transcript: 'This is a unique searchable transcript with special keywords',
          audioDuration: 120,
        });

      searchTestStoryId = storyResponse.body.id;
    });

    it('should handle special characters in search queries', async () => {
      const specialQueries = [
        'search & test',
        'search | test',
        'search "exact phrase"',
        'search (parentheses)',
        'search [brackets]',
        'search {braces}',
        'search + plus',
        'search - minus',
        'search * asterisk',
        'search ? question',
      ];

      for (const query of specialQueries) {
        const response = await request(app)
          .get(`/api/projects/${testProjectId}/stories/search`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ q: query });

        expect(response.status).toBe(200);
        expect(response.body.results).toBeDefined();
        expect(Array.isArray(response.body.results)).toBe(true);
      }
    });

    it('should prevent search injection attacks', async () => {
      const maliciousQueries = [
        "'; DROP TABLE stories; --",
        "' OR '1'='1",
        "UNION SELECT * FROM users",
        "<script>alert('xss')</script>",
      ];

      for (const query of maliciousQueries) {
        const response = await request(app)
          .get(`/api/projects/${testProjectId}/stories/search`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ q: query });

        expect(response.status).toBe(200);
        expect(response.body.results).toBeDefined();
        // Should not return unexpected data or cause errors
      }
    });

    it('should handle empty and whitespace-only search queries', async () => {
      const emptyQueries = ['', '   ', '\t', '\n', '   \t\n   '];

      for (const query of emptyQueries) {
        const response = await request(app)
          .get(`/api/projects/${testProjectId}/stories/search`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ q: query });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/search.*query.*required/i);
      }
    });
  });

  describe('File Upload Regression Tests', () => {
    it('should reject files with malicious extensions', async () => {
      const maliciousExtensions = ['.exe', '.bat', '.sh', '.php', '.jsp'];

      for (const ext of maliciousExtensions) {
        const response = await request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', Buffer.from('fake content'), `malicious${ext}`);

        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/file.*type.*not.*allowed/i);
      }
    });

    it('should handle oversized file uploads', async () => {
      // Create a large buffer (simulate 100MB file)
      const largeBuffer = Buffer.alloc(100 * 1024 * 1024, 'a');

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', largeBuffer, 'large-file.mp3');

      expect(response.status).toBe(413);
      expect(response.body.error.message).toMatch(/file.*too.*large/i);
    });
  });

  describe('API Rate Limiting Regression Tests', () => {
    it('should enforce rate limits consistently', async () => {
      // Make many requests quickly
      const rapidRequests = Array.from({ length: 20 }, () =>
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(rapidRequests);
      
      // Some should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Rate limited responses should have proper headers
      rateLimitedResponses.forEach(response => {
        expect(response.headers['retry-after']).toBeDefined();
        expect(response.body.error.message).toMatch(/rate.*limit/i);
      });
    });
  });

  describe('Data Validation Regression Tests', () => {
    it('should validate email format consistently', async () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user.domain.com',
        'user@domain.',
        'user@.domain.com',
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/signup')
          .send({
            email,
            password: 'TestPassword123!',
            name: 'Test User',
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/email.*invalid/i);
      }
    });

    it('should validate password strength consistently', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'abc123',
        'Password',
        '12345678',
        'PASSWORD123',
        'password123',
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/signup')
          .send({
            email: `test-${Date.now()}@example.com`,
            password,
            name: 'Test User',
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/password.*requirements/i);
      }
    });
  });

  describe('Error Handling Regression Tests', () => {
    it('should not expose sensitive information in error messages', async () => {
      // Test various error scenarios
      const errorTests = [
        {
          request: () => request(app).get('/api/projects/non-existent-id'),
          expectedStatus: 404,
        },
        {
          request: () => request(app).get('/api/users/me').set('Authorization', 'Bearer invalid-token'),
          expectedStatus: 401,
        },
        {
          request: () => request(app).post('/api/projects').send({}),
          expectedStatus: 401,
        },
      ];

      for (const test of errorTests) {
        const response = await test.request();
        
        expect(response.status).toBe(test.expectedStatus);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.message).toBeDefined();
        
        // Should not expose sensitive information
        expect(response.body.error.message).not.toMatch(/password|secret|key|token/i);
        expect(response.body).not.toHaveProperty('stack');
        expect(response.body).not.toHaveProperty('query');
      }
    });
  });

  describe('Memory Leak Regression Tests', () => {
    it('should not leak memory during normal operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${authToken}`);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
      
      // Memory increase should be minimal
      expect(memoryIncreasePercent).toBeLessThan(25);
    });
  });

  afterAll(async () => {
    // Cleanup
    await request(app)
      .delete(`/api/projects/${testProjectId}`)
      .set('Authorization', `Bearer ${authToken}`);
  });
});