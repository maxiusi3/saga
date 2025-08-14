import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test teardown...');
  
  // Clean up test data if needed
  try {
    // You can add cleanup logic here
    console.log('✅ Test data cleanup completed');
  } catch (error) {
    console.error('❌ Test data cleanup failed:', error);
  }

  console.log('✅ E2E test teardown completed');
}

export default globalTeardown;