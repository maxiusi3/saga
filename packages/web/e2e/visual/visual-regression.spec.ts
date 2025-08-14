import { test, expect } from '@playwright/test';

test.describe('Visual Regression Testing', () => {
  test('Homepage visual consistency', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take full page screenshot
    await expect(page).toHaveScreenshot('homepage-full.png', {
      fullPage: true,
      animations: 'disabled',
    });

    // Take viewport screenshot
    await expect(page).toHaveScreenshot('homepage-viewport.png', {
      animations: 'disabled',
    });
  });

  test('Authentication pages visual consistency', async ({ page }) => {
    // Sign-in page
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('signin-page.png', {
      animations: 'disabled',
    });

    // Sign-up page
    await page.goto('/auth/signup');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('signup-page.png', {
      animations: 'disabled',
    });
  });

  test('Dashboard visual consistency', async ({ page }) => {
    // Login first
    await page.goto('/auth/signin');
    await page.fill('[data-testid="email-input"]', 'facilitator@test.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="signin-button"]');
    await page.waitForURL('/dashboard');

    await expect(page).toHaveScreenshot('dashboard-main.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('Project pages visual consistency', async ({ page }) => {
    // Login
    await page.goto('/auth/signin');
    await page.fill('[data-testid="email-input"]', 'facilitator@test.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="signin-button"]');
    await page.waitForURL('/dashboard');

    // Projects list
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('projects-list.png', {
      fullPage: true,
      animations: 'disabled',
    });

    // Project creation page
    await page.goto('/dashboard/projects/new');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('project-creation.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('Stories pages visual consistency', async ({ page }) => {
    // Login
    await page.goto('/auth/signin');
    await page.fill('[data-testid="email-input"]', 'facilitator@test.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="signin-button"]');
    await page.waitForURL('/dashboard');

    // Stories list
    await page.goto('/dashboard/stories');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('stories-list.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('Component visual consistency', async ({ page }) => {
    await page.goto('/');
    
    // Test individual components
    const header = page.locator('header');
    if (await header.isVisible()) {
      await expect(header).toHaveScreenshot('header-component.png');
    }

    const footer = page.locator('footer');
    if (await footer.isVisible()) {
      await expect(footer).toHaveScreenshot('footer-component.png');
    }

    // Test navigation
    const nav = page.locator('nav');
    if (await nav.isVisible()) {
      await expect(nav).toHaveScreenshot('navigation-component.png');
    }
  });

  test('Form visual consistency', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Test form in different states
    await expect(page.locator('form')).toHaveScreenshot('signin-form-empty.png');

    // Fill form
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    
    await expect(page.locator('form')).toHaveScreenshot('signin-form-filled.png');

    // Test validation state (trigger validation)
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await page.click('[data-testid="signin-button"]');
    
    // Wait for validation message
    await page.waitForTimeout(1000);
    
    await expect(page.locator('form')).toHaveScreenshot('signin-form-validation.png');
  });

  test('Responsive design visual consistency', async ({ page }) => {
    await page.goto('/');

    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page).toHaveScreenshot('homepage-desktop.png');

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page).toHaveScreenshot('homepage-tablet.png');

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('homepage-mobile.png');
  });

  test('Dark mode visual consistency', async ({ page }) => {
    // Enable dark mode (if supported)
    await page.emulateMedia({ colorScheme: 'dark' });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('homepage-dark-mode.png', {
      animations: 'disabled',
    });

    // Test auth pages in dark mode
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('signin-dark-mode.png', {
      animations: 'disabled',
    });
  });

  test('Loading states visual consistency', async ({ page }) => {
    // Intercept API calls to simulate loading states
    await page.route('**/api/**', route => {
      // Delay response to capture loading state
      setTimeout(() => route.continue(), 2000);
    });

    await page.goto('/auth/signin');
    await page.fill('[data-testid="email-input"]', 'facilitator@test.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    
    // Click submit and immediately capture loading state
    await page.click('[data-testid="signin-button"]');
    
    // Wait a bit for loading state to appear
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('signin-loading-state.png');
  });

  test('Error states visual consistency', async ({ page }) => {
    // Test 404 page
    await page.goto('/non-existent-page');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('404-page.png');

    // Test form error states
    await page.goto('/auth/signin');
    
    // Submit empty form to trigger validation
    await page.click('[data-testid="signin-button"]');
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('signin-form-errors.png');
  });

  test('Interactive states visual consistency', async ({ page }) => {
    await page.goto('/');
    
    // Test button hover states
    const button = page.locator('button').first();
    if (await button.isVisible()) {
      await button.hover();
      await expect(button).toHaveScreenshot('button-hover-state.png');
    }

    // Test focus states
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    if (await focusedElement.isVisible()) {
      await expect(focusedElement).toHaveScreenshot('focused-element.png');
    }
  });

  test('Animation consistency', async ({ page }) => {
    await page.goto('/');
    
    // Test with animations enabled
    await expect(page).toHaveScreenshot('homepage-with-animations.png', {
      animations: 'allow',
    });

    // Test with animations disabled
    await expect(page).toHaveScreenshot('homepage-no-animations.png', {
      animations: 'disabled',
    });
  });

  test('Print styles visual consistency', async ({ page }) => {
    await page.goto('/');
    
    // Emulate print media
    await page.emulateMedia({ media: 'print' });
    
    await expect(page).toHaveScreenshot('homepage-print-styles.png', {
      fullPage: true,
    });
  });

  test('High contrast mode visual consistency', async ({ page }) => {
    // Simulate high contrast mode
    await page.addStyleTag({
      content: `
        @media (prefers-contrast: high) {
          * {
            filter: contrast(2) !important;
          }
        }
      `
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('homepage-high-contrast.png');
  });

  test('Cross-browser visual consistency', async ({ page, browserName }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take browser-specific screenshots
    await expect(page).toHaveScreenshot(`homepage-${browserName}.png`, {
      animations: 'disabled',
    });

    // Test auth page across browsers
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot(`signin-${browserName}.png`, {
      animations: 'disabled',
    });
  });
});