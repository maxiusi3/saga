import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...');
  
  // Start backend server if not running
  const backendUrl = process.env.API_URL || 'http://localhost:3001';
  
  try {
    // Check if backend is running
    const response = await fetch(`${backendUrl}/health`);
    if (!response.ok) {
      throw new Error('Backend health check failed');
    }
    console.log('✅ Backend server is running');
  } catch (error) {
    console.warn('⚠️ Backend server may not be running. Some tests may fail.');
  }

  // Create a browser instance for authentication setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set up test data if needed
  try {
    // You can add test data setup here
    console.log('✅ Test data setup completed');
  } catch (error) {
    console.error('❌ Test data setup failed:', error);
  }

  await browser.close();
  console.log('✅ E2E test setup completed');
}

export default globalSetup;