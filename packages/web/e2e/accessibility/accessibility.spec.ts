import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Testing', () => {
  test('Homepage accessibility', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Authentication pages accessibility', async ({ page }) => {
    // Test sign-in page
    await page.goto('/auth/signin');
    
    let accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);

    // Test sign-up page
    await page.goto('/auth/signup');
    
    accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Dashboard accessibility', async ({ page }) => {
    // Login first
    await page.goto('/auth/signin');
    await page.fill('[data-testid="email-input"]', 'facilitator@test.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="signin-button"]');
    await page.waitForURL('/dashboard');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Project pages accessibility', async ({ page }) => {
    // Login and navigate to projects
    await page.goto('/auth/signin');
    await page.fill('[data-testid="email-input"]', 'facilitator@test.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="signin-button"]');
    await page.waitForURL('/dashboard');

    // Test projects list page
    await page.goto('/dashboard/projects');
    
    let accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);

    // Test project creation page
    await page.goto('/dashboard/projects/new');
    
    accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Stories pages accessibility', async ({ page }) => {
    // Login and navigate to stories
    await page.goto('/auth/signin');
    await page.fill('[data-testid="email-input"]', 'facilitator@test.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="signin-button"]');
    await page.waitForURL('/dashboard');

    await page.goto('/dashboard/stories');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    let focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Continue tabbing through interactive elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      focusedElement = await page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    }

    // Test reverse tab navigation
    await page.keyboard.press('Shift+Tab');
    focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('Screen reader compatibility', async ({ page }) => {
    await page.goto('/');
    
    // Check for proper heading structure
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);

    // Check for alt text on images
    const images = await page.locator('img').all();
    for (const image of images) {
      const alt = await image.getAttribute('alt');
      expect(alt).toBeTruthy();
    }

    // Check for form labels
    const inputs = await page.locator('input[type="text"], input[type="email"], input[type="password"], textarea').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      if (id) {
        const label = await page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }

    // Check for ARIA labels on buttons without text
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const text = await button.textContent();
      if (!text?.trim()) {
        const ariaLabel = await button.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
      }
    }
  });

  test('Color contrast compliance', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('*')
      .analyze();

    // Filter for color contrast violations
    const colorContrastViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'color-contrast'
    );

    expect(colorContrastViolations).toEqual([]);
  });

  test('Focus management', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Test focus trap in modal (if any)
    // Test focus restoration after modal close
    // Test skip links functionality
    
    // For now, test basic focus visibility
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus');
    
    // Check if focused element has visible focus indicator
    const focusStyles = await focusedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el, ':focus');
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        outlineStyle: styles.outlineStyle,
        outlineColor: styles.outlineColor,
        boxShadow: styles.boxShadow,
      };
    });

    // Should have some form of focus indicator
    const hasFocusIndicator = 
      focusStyles.outline !== 'none' ||
      focusStyles.outlineWidth !== '0px' ||
      focusStyles.boxShadow !== 'none';

    expect(hasFocusIndicator).toBeTruthy();
  });

  test('Mobile accessibility', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Test touch target sizes (minimum 44x44px)
    const interactiveElements = await page.locator('button, a, input, [role="button"]').all();
    
    for (const element of interactiveElements) {
      const boundingBox = await element.boundingBox();
      if (boundingBox) {
        expect(boundingBox.width).toBeGreaterThanOrEqual(44);
        expect(boundingBox.height).toBeGreaterThanOrEqual(44);
      }
    }

    // Run accessibility scan on mobile
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('High contrast mode', async ({ page }) => {
    // Simulate high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    
    // Test that content is still visible and accessible
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Reduced motion preferences', async ({ page }) => {
    // Simulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    
    // Verify animations are reduced or disabled
    // This would need specific implementation based on your CSS
    const animatedElements = await page.locator('[class*="animate"], [class*="transition"]').all();
    
    for (const element of animatedElements) {
      const styles = await element.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          animationDuration: computed.animationDuration,
          transitionDuration: computed.transitionDuration,
        };
      });

      // In reduced motion mode, animations should be very short or disabled
      expect(
        styles.animationDuration === '0s' || 
        styles.animationDuration === '0.01s' ||
        styles.transitionDuration === '0s' ||
        styles.transitionDuration === '0.01s'
      ).toBeTruthy();
    }
  });
});