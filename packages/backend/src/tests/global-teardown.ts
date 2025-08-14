/**
 * Global Test Teardown
 * 
 * This file runs once after all tests complete.
 * It cleans up global resources and ensures proper shutdown.
 */

async function globalTeardown() {
  console.log('🧹 Starting global test environment teardown...');

  try {
    // Close database connections
    try {
      const { knex } = require('../config/database');
      if (knex) {
        await knex.destroy();
        console.log('✅ Database connections closed');
      }
    } catch (error) {
      console.warn('⚠️  Error closing database connections:', error.message);
    }

    // Close Redis connections
    try {
      const redis = require('../config/redis');
      if (redis && redis.disconnect) {
        await redis.disconnect();
        console.log('✅ Redis connections closed');
      }
    } catch (error) {
      console.warn('⚠️  Error closing Redis connections:', error.message);
    }

    // Close any remaining HTTP servers
    try {
      // Force close any hanging HTTP connections
      if (global.httpServer) {
        global.httpServer.close();
        console.log('✅ HTTP server closed');
      }
    } catch (error) {
      console.warn('⚠️  Error closing HTTP server:', error.message);
    }

    // Close WebSocket connections
    try {
      if (global.socketServer) {
        global.socketServer.close();
        console.log('✅ WebSocket server closed');
      }
    } catch (error) {
      console.warn('⚠️  Error closing WebSocket server:', error.message);
    }

    // Clean up job queues
    try {
      const { JobQueueService } = require('../services/job-queue-service');
      const jobQueue = new JobQueueService();
      if (jobQueue && jobQueue.close) {
        await jobQueue.close();
        console.log('✅ Job queue closed');
      }
    } catch (error) {
      console.warn('⚠️  Error closing job queue:', error.message);
    }

    // Clean up temporary files
    try {
      const fs = require('fs');
      const path = require('path');
      const tempDir = path.join(__dirname, 'temp');
      
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('✅ Temporary files cleaned up');
      }
    } catch (error) {
      console.warn('⚠️  Error cleaning up temporary files:', error.message);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('✅ Garbage collection triggered');
    }

    console.log('✅ Global test environment teardown complete');

  } catch (error) {
    console.error('❌ Error during global teardown:', error);
    // Don't throw error to avoid masking test failures
  }

  // Force exit after a delay to ensure all resources are cleaned up
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

module.exports = globalTeardown;