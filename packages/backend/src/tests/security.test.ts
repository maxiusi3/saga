import request from 'supertest';
import { app } from '../index';
import { setupTestDatabase, cleanupTestDatabase } from './setup';

describe('Security Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for security headers
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['permissions-policy']).toBeDefined();
      expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
      expect(response.headers['cross-origin-embedder-policy']).toBe('require-corp');
      expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    });

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should apply general rate limiting', async () => {
      // Make multiple requests to trigger rate limiting
      const requests = Array(150).fill(null).map(() => 
        request(app).get('/api/health')
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should apply strict rate limiting to auth endpoints', async () => {
      // Make multiple failed login attempts
      const requests = Array(10).fill(null).map(() => 
        request(app)
          .post('/api/auth/signin')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(requests);
      
      // Later requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should apply rate limiting to password reset', async () => {
      // Make multiple password reset requests
      const requests = Array(5).fill(null).map(() => 
        request(app)
          .post('/api/auth/reset-password')
          .send({
            email: 'test@example.com'
          })
      );

      const responses = await Promise.all(requests);
      
      // Later requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation', () => {
    it('should reject SQL injection attempts', async () => {
      const sqlPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
        "admin'--",
        "admin' #"
      ];

      for (const payload of sqlPayloads) {
        const response = await request(app)
          .post('/api/auth/signin')
          .send({
            email: payload,
            password: 'test'
          });

        // Should not return 500 (internal server error)
        expect(response.status).not.toBe(500);
        
        // Should return validation error
        expect([400, 401, 422]).toContain(response.status);
      }
    });

    it('should sanitize XSS attempts', async () => {
      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "javascript:alert('XSS')",
        "<img src=x onerror=alert('XSS')>",
        "';alert('XSS');//"
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/auth/signup')
          .send({
            email: 'test@example.com',
            password: 'ValidPassword123!',
            firstName: payload,
            lastName: 'Test'
          });

        // Response should not contain the raw payload
        expect(response.text).not.toContain('<script>');
        expect(response.text).not.toContain('javascript:');
        expect(response.text).not.toContain('onerror=');
      }
    });

    it('should validate email format', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test..test@example.com',
        'test@example',
        ''
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/signin')
          .send({
            email,
            password: 'test'
          });

        expect([400, 422]).toContain(response.status);
      }
    });

    it('should enforce password complexity', async () => {
      const weakPasswords = [
        '123',
        'password',
        '12345678',
        'abcdefgh',
        'ABCDEFGH',
        '!@#$%^&*'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/signup')
          .send({
            email: 'test@example.com',
            password,
            firstName: 'Test',
            lastName: 'User'
          });

        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('Authentication Security', () => {
    it('should not expose user enumeration via login', async () => {
      // Test with non-existent user
      const response1 = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });

      // Test with existing user but wrong password
      const response2 = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'existing@example.com',
          password: 'wrongpassword'
        });

      // Both should return similar responses
      expect(response1.status).toBe(response2.status);
      expect(response1.body.error).toBe(response2.body.error);
    });

    it('should not expose user enumeration via password reset', async () => {
      // Test with non-existent user
      const response1 = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: 'nonexistent@example.com'
        });

      // Test with existing user
      const response2 = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: 'existing@example.com'
        });

      // Both should return similar responses
      expect(response1.status).toBe(response2.status);
      expect(response1.body.message).toBe(response2.body.message);
    });

    it('should require authentication for protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/auth/profile' },
        { method: 'post', path: '/api/auth/signout' },
        { method: 'post', path: '/api/auth/change-password' },
        { method: 'get', path: '/api/projects' },
        { method: 'post', path: '/api/projects' },
        { method: 'get', path: '/api/stories' },
        { method: 'post', path: '/api/stories' }
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });

    it('should invalidate tokens on logout', async () => {
      // First, sign up and sign in to get a token
      await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'logout-test@example.com',
          password: 'ValidPassword123!',
          firstName: 'Test',
          lastName: 'User'
        });

      const loginResponse = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'logout-test@example.com',
          password: 'ValidPassword123!'
        });

      const token = loginResponse.body.token;
      expect(token).toBeDefined();

      // Use the token to access a protected endpoint
      const protectedResponse1 = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(protectedResponse1.status).toBe(200);

      // Logout
      await request(app)
        .post('/api/auth/signout')
        .set('Authorization', `Bearer ${token}`);

      // Try to use the token again
      const protectedResponse2 = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(protectedResponse2.status).toBe(401);
    });
  });

  describe('File Upload Security', () => {
    it('should reject malicious file types', async () => {
      const maliciousFiles = [
        { name: 'test.php', content: '<?php system($_GET["cmd"]); ?>' },
        { name: 'test.jsp', content: '<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>' },
        { name: 'test.exe', content: 'MZ\x90\x00' },
        { name: 'test.sh', content: '#!/bin/bash\nrm -rf /' }
      ];

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/uploads')
          .attach('file', Buffer.from(file.content), file.name);

        expect([400, 415, 422]).toContain(response.status);
      }
    });

    it('should enforce file size limits', async () => {
      // Create a large buffer (simulate large file)
      const largeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB

      const response = await request(app)
        .post('/api/uploads')
        .attach('file', largeBuffer, 'largefile.txt');

      expect([413, 400]).toContain(response.status);
    });
  });

  describe('CORS Security', () => {
    it('should enforce CORS policy', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-site.com');

      // Should not allow requests from unauthorized origins
      expect(response.headers['access-control-allow-origin']).not.toBe('https://malicious-site.com');
    });

    it('should allow requests from authorized origins', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });

  describe('HTTP Method Security', () => {
    it('should not allow TRACE method', async () => {
      const response = await request(app)
        .trace('/api/health');

      expect([405, 501]).toContain(response.status);
    });

    it('should handle OPTIONS method securely', async () => {
      const response = await request(app)
        .options('/api/auth/signin');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose stack traces in production', async () => {
      // Force an error by sending invalid JSON
      const response = await request(app)
        .post('/api/auth/signin')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
      expect(response.text).not.toContain('at ');
      expect(response.text).not.toContain('Error:');
      expect(response.text).not.toContain('stack');
    });

    it('should return generic error messages', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.text).not.toContain('ENOENT');
      expect(response.text).not.toContain('file not found');
    });
  });

  describe('Session Security', () => {
    it('should use secure session configuration', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123!'
        });

      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader) {
        const cookieString = setCookieHeader.join('; ');
        expect(cookieString).toContain('HttpOnly');
        expect(cookieString).toContain('Secure');
        expect(cookieString).toContain('SameSite');
      }
    });
  });
});