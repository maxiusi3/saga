const { device, expect, element, by, waitFor } = require('detox');

describe('Example', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });
});

// Global test utilities
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

global.waitForElementToBeVisible = async (elementMatcher, timeout = 10000) => {
  await waitFor(element(elementMatcher))
    .toBeVisible()
    .withTimeout(timeout);
};

global.waitForElementToExist = async (elementMatcher, timeout = 10000) => {
  await waitFor(element(elementMatcher))
    .toExist()
    .withTimeout(timeout);
};

// Test data helpers
global.generateTestUser = () => ({
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Test User',
});

global.generateTestStory = () => ({
  title: `Test Story ${Date.now()}`,
  content: 'This is a test story for E2E testing purposes.',
});