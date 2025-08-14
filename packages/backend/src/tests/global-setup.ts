/**
 * Global Test Setup
 * 
 * This file runs once before all tests start.
 * It sets up the test environment and ensures all services are ready.
 */

const { config } = require('dotenv');
const path = require('path');

async function globalSetup() {
  console.log('🔧 Setting up global test environment...');

  // Load test environment variables
  config({ path: path.resolve(__dirname, '../../.env.test') });

  // Ensure we're in test environment
  process.env.NODE_ENV = 'test';

  // Set test-specific configurations
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  process.env.DISABLE_RATE_LIMITING = 'true'; // Disable rate limiting for tests
  process.env.SKIP_EMAIL_VERIFICATION = 'true'; // Skip email verification in tests

  // Database configuration for tests
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/saga_test';
  }

  // Redis configuration for tests (if available)
  if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = 'redis://localhost:6379/1'; // Use database 1 for tests
  }

  // Mock external service URLs for tests
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
  process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'test-aws-key';
  process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'test-aws-secret';
  process.env.AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || 'test-saga-bucket';
  process.env.SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'test-sendgrid-key';
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
  process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mock';
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'test-firebase-project';

  // JWT configuration for tests
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-integration-tests';
  process.env.JWT_EXPIRES_IN = '1h'; // Shorter expiration for tests

  // File upload limits for tests
  process.env.MAX_FILE_SIZE = '10MB'; // Smaller limit for tests
  process.env.MAX_AUDIO_DURATION = '300'; // 5 minutes for tests

  // WebSocket configuration
  process.env.WEBSOCKET_CORS_ORIGIN = 'http://localhost:3000';

  console.log('✅ Global test environment setup complete');
  console.log(`📊 Test Database: ${process.env.DATABASE_URL}`);
  console.log(`🔑 JWT Secret: ${process.env.JWT_SECRET ? 'Set' : 'Not Set'}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
}

module.exports = globalSetup;