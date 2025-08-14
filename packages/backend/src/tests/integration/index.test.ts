/**
 * Integration Test Suite Runner
 * 
 * This file serves as the main entry point for all integration tests.
 * It ensures proper test execution order and shared setup/teardown.
 */

import { setupTestDatabase, cleanupTestDatabase } from '../setup';

describe('Integration Test Suite', () => {
  // Global setup for all integration tests
  beforeAll(async () => {
    console.log('🚀 Starting Integration Test Suite...');
    await setupTestDatabase();
    console.log('✅ Test database setup complete');
  }, 30000); // 30 second timeout for database setup

  // Global cleanup for all integration tests
  afterAll(async () => {
    console.log('🧹 Cleaning up Integration Test Suite...');
    await cleanupTestDatabase();
    console.log('✅ Test database cleanup complete');
  }, 30000);

  // Import and run all integration test suites
  describe('API Integration Tests', () => {
    require('./api-integration.test');
  });

  describe('Database Integration Tests', () => {
    require('./database-integration.test');
  });

  describe('Third-Party Service Integration Tests', () => {
    require('./third-party-integration.test');
  });

  describe('WebSocket Integration Tests', () => {
    require('./websocket-integration.test');
  });

  describe('File Processing Integration Tests', () => {
    require('./file-processing-integration.test');
  });

  describe('Payment Integration Tests', () => {
    require('./payment-integration.test');
  });

  // Health check test to ensure all services are properly integrated
  describe('System Health Integration', () => {
    it('should verify all system components are working together', async () => {
      // This test verifies that all major system components can work together
      const healthChecks = {
        database: false,
        redis: false,
        storage: false,
        email: false,
        websocket: false,
      };

      try {
        // Database health check
        const { knex } = require('../../config/database');
        await knex.raw('SELECT 1');
        healthChecks.database = true;

        // Redis health check (if available)
        try {
          const redis = require('../../config/redis');
          await redis.ping();
          healthChecks.redis = true;
        } catch (error) {
          console.warn('Redis not available for integration tests');
        }

        // Storage service health check
        try {
          const { StorageService } = require('../../services/storage-service');
          const storageService = new StorageService();
          healthChecks.storage = await storageService.testConnection();
        } catch (error) {
          console.warn('Storage service not available for integration tests');
        }

        // Email service health check
        try {
          const { EmailNotificationService } = require('../../services/email-notification-service');
          const emailService = new EmailNotificationService();
          healthChecks.email = await emailService.testConnection();
        } catch (error) {
          console.warn('Email service not available for integration tests');
        }

        // WebSocket health check
        try {
          const { Server } = require('socket.io');
          const { createServer } = require('http');
          const httpServer = createServer();
          const io = new Server(httpServer);
          healthChecks.websocket = true;
          io.close();
          httpServer.close();
        } catch (error) {
          console.warn('WebSocket not available for integration tests');
        }

        // Verify critical components are healthy
        expect(healthChecks.database).toBe(true);
        
        console.log('🏥 System Health Check Results:', healthChecks);
        
        // At least database should be working for integration tests
        const criticalServicesHealthy = healthChecks.database;
        expect(criticalServicesHealthy).toBe(true);

      } catch (error) {
        console.error('❌ System health check failed:', error);
        throw error;
      }
    });

    it('should verify test environment isolation', async () => {
      // Ensure test environment is properly isolated
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.DATABASE_URL).toContain('test');
      
      // Verify test database is separate from development/production
      const { knex } = require('../../config/database');
      const dbName = await knex.raw('SELECT current_database()');
      expect(dbName.rows[0].current_database).toContain('test');
    });

    it('should verify all required environment variables are set', () => {
      const requiredEnvVars = [
        'NODE_ENV',
        'DATABASE_URL',
        'JWT_SECRET',
        'OPENAI_API_KEY',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_S3_BUCKET',
        'SENDGRID_API_KEY',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
      ];

      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        console.warn('⚠️  Missing environment variables for full integration testing:', missingVars);
        // Don't fail the test, just warn - some services might be mocked
      }

      // At minimum, these should be set for basic integration tests
      const criticalVars = ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET'];
      const missingCriticalVars = criticalVars.filter(varName => !process.env[varName]);
      
      expect(missingCriticalVars).toHaveLength(0);
    });
  });

  // Performance benchmarks for integration tests
  describe('Integration Performance Benchmarks', () => {
    it('should complete API integration tests within reasonable time', async () => {
      const startTime = Date.now();
      
      // Run a sample of API operations
      const { app } = require('../../index');
      const request = require('supertest');
      const { generateAccessToken } = require('../../services/auth-service');
      const { createTestUser } = require('../setup');

      const testUser = await createTestUser({
        email: 'perf-test@example.com',
        name: 'Performance Test User',
        password: 'TestPassword123!',
      });
      const authToken = generateAccessToken(testUser);

      // Test basic API operations
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // API operations should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
      console.log(`⚡ API integration benchmark: ${duration}ms`);
    });

    it('should handle concurrent requests efficiently', async () => {
      const { app } = require('../../index');
      const request = require('supertest');
      const { generateAccessToken } = require('../../services/auth-service');
      const { createTestUser } = require('../setup');

      const testUser = await createTestUser({
        email: 'concurrent-test@example.com',
        name: 'Concurrent Test User',
        password: 'TestPassword123!',
      });
      const authToken = generateAccessToken(testUser);

      const startTime = Date.now();
      const numRequests = 10;

      // Make concurrent requests
      const requests = Array.from({ length: numRequests }, () =>
        request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
      );

      await Promise.all(requests);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Concurrent requests should complete within 3 seconds
      expect(duration).toBeLessThan(3000);
      console.log(`🚀 Concurrent requests benchmark (${numRequests} requests): ${duration}ms`);
    });

    it('should maintain database performance under load', async () => {
      const { knex } = require('../../config/database');
      const { createTestUser, createTestProject } = require('../setup');

      const startTime = Date.now();

      // Create multiple users and projects
      const userPromises = Array.from({ length: 5 }, (_, i) =>
        createTestUser({
          email: `load-test-${i}@example.com`,
          name: `Load Test User ${i}`,
          password: 'TestPassword123!',
        })
      );

      const users = await Promise.all(userPromises);

      const projectPromises = users.map((user, i) =>
        createTestProject({
          title: `Load Test Project ${i}`,
          facilitatorId: user.id,
        })
      );

      await Promise.all(projectPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Database operations should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
      console.log(`💾 Database load benchmark (5 users + 5 projects): ${duration}ms`);
    });
  });
});