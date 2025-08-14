import { test as base, expect, Page } from '@playwright/test';

// Test user credentials
export const TEST_USERS = {
  facilitator: {
    email: 'facilitator@test.com',
    password: 'TestPassword123!',
    name: 'Test Facilitator',
  },
  storyteller: {
    email: 'storyteller@test.com',
    password: 'TestPassword123!',
    name: 'Test Storyteller',
  },
};

// Extend base test with authentication fixtures
export const test = base.extend<{
  authenticatedPage: Page;
  facilitatorPage: Page;
  storytellerPage: Page;
}>({
  // Generic authenticated page
  authenticatedPage: async ({ page }, use) => {
    await loginUser(page, TEST_USERS.facilitator);
    await use(page);
  },

  // Facilitator-specific authenticated page
  facilitatorPage: async ({ page }, use) => {
    await loginUser(page, TEST_USERS.facilitator);
    await use(page);
  },

  // Storyteller-specific authenticated page
  storytellerPage: async ({ page }, use) => {
    await loginUser(page, TEST_USERS.storyteller);
    await use(page);
  },
});

// Helper function to login a user
async function loginUser(page: Page, user: typeof TEST_USERS.facilitator) {
  await page.goto('/auth/signin');
  
  // Fill in login form
  await page.fill('[data-testid="email-input"]', user.email);
  await page.fill('[data-testid="password-input"]', user.password);
  
  // Submit form
  await page.click('[data-testid="signin-button"]');
  
  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard');
  
  // Verify user is logged in
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
}

// Helper function to logout
export async function logoutUser(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/auth/signin');
}

// Helper function to create test user via API
export async function createTestUser(userType: 'facilitator' | 'storyteller') {
  const user = TEST_USERS[userType];
  
  const response = await fetch(`${process.env.API_URL || 'http://localhost:3001'}/api/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      name: user.name,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.warn(`Failed to create test user ${userType}:`, error);
  }

  return response.ok;
}

export { expect };