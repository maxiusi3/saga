import { test, expect } from '../fixtures/auth';
import { generateTestProject, TestDataAPI, measurePageLoad } from '../utils/test-data';

test.describe('Facilitator Complete User Journey', () => {
  let testDataAPI: TestDataAPI;
  let createdProjectId: string;

  test.beforeEach(async () => {
    testDataAPI = new TestDataAPI();
  });

  test.afterEach(async () => {
    // Clean up created test data
    if (createdProjectId) {
      try {
        await testDataAPI.deleteProject(createdProjectId);
      } catch (error) {
        console.warn('Failed to clean up test project:', error);
      }
    }
  });

  test('Complete facilitator flow: signup → project creation → payment → invitation → story management', async ({ 
    page 
  }) => {
    // Step 1: User Registration
    await test.step('User signs up for new account', async () => {
      await page.goto('/auth/signup');
      
      await page.fill('[data-testid="name-input"]', 'Test Facilitator');
      await page.fill('[data-testid="email-input"]', `facilitator-${Date.now()}@test.com`);
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.fill('[data-testid="confirm-password-input"]', 'TestPassword123!');
      
      await page.click('[data-testid="signup-button"]');
      
      // Should redirect to dashboard
      await page.waitForURL('/dashboard');
      await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
    });

    // Step 2: Project Creation
    await test.step('Creates new Saga project', async () => {
      // Should see "Create a New Saga" CTA for new users
      await expect(page.locator('[data-testid="create-saga-cta"]')).toBeVisible();
      
      await page.click('[data-testid="create-saga-cta"]');
      await page.waitForURL('/dashboard/projects/new');
      
      // Fill project details
      const projectData = generateTestProject();
      await page.fill('[data-testid="project-title-input"]', projectData.title);
      await page.fill('[data-testid="project-description-input"]', projectData.description!);
      
      await page.click('[data-testid="continue-to-payment"]');
    });

    // Step 3: Payment Processing
    await test.step('Completes payment for Saga Package', async () => {
      await page.waitForURL('/dashboard/projects/new/payment');
      
      // Should see Saga Package pricing
      await expect(page.locator('[data-testid="saga-package-price"]')).toBeVisible();
      await expect(page.locator('[data-testid="package-features"]')).toBeVisible();
      
      // Mock Stripe payment (in real tests, you'd use Stripe test mode)
      await page.click('[data-testid="pay-with-stripe"]');
      
      // Fill mock payment details
      await page.fill('[data-testid="card-number"]', '4242424242424242');
      await page.fill('[data-testid="card-expiry"]', '12/25');
      await page.fill('[data-testid="card-cvc"]', '123');
      
      await page.click('[data-testid="complete-payment"]');
      
      // Should redirect to project setup
      await page.waitForURL(/\/dashboard\/projects\/[^\/]+$/);
      
      // Extract project ID from URL
      const url = page.url();
      createdProjectId = url.split('/').pop()!;
    });

    // Step 4: Invitation Generation
    await test.step('Generates invitation for storyteller', async () => {
      // Should see project setup page
      await expect(page.locator('[data-testid="project-setup-header"]')).toBeVisible();
      
      await page.click('[data-testid="generate-invitation"]');
      
      // Fill storyteller details
      await page.fill('[data-testid="storyteller-email"]', 'storyteller@test.com');
      await page.fill('[data-testid="storyteller-name"]', 'Test Storyteller');
      await page.fill('[data-testid="invitation-message"]', 'Please join my Saga project!');
      
      await page.click('[data-testid="send-invitation"]');
      
      // Should see invitation success
      await expect(page.locator('[data-testid="invitation-sent"]')).toBeVisible();
      await expect(page.locator('[data-testid="invitation-link"]')).toBeVisible();
    });

    // Step 5: Project Dashboard Navigation
    await test.step('Navigates project dashboard and features', async () => {
      // Go to project dashboard
      await page.click('[data-testid="view-project-dashboard"]');
      
      // Should see project overview
      await expect(page.locator('[data-testid="project-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="project-stats"]')).toBeVisible();
      await expect(page.locator('[data-testid="stories-section"]')).toBeVisible();
      
      // Check navigation tabs
      await expect(page.locator('[data-testid="stories-tab"]')).toBeVisible();
      await expect(page.locator('[data-testid="chapters-tab"]')).toBeVisible();
      await expect(page.locator('[data-testid="export-tab"]')).toBeVisible();
    });

    // Step 6: Story Management (simulated)
    await test.step('Views and manages stories', async () => {
      await page.click('[data-testid="stories-tab"]');
      
      // Should see empty state initially
      await expect(page.locator('[data-testid="no-stories-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="invite-family-cta"]')).toBeVisible();
      
      // Test search functionality
      await page.fill('[data-testid="story-search"]', 'test search');
      await expect(page.locator('[data-testid="no-search-results"]')).toBeVisible();
      
      // Clear search
      await page.click('[data-testid="clear-search"]');
    });

    // Step 7: Chapter Summaries
    await test.step('Views chapter summaries', async () => {
      await page.click('[data-testid="chapters-tab"]');
      
      // Should see empty state for chapters
      await expect(page.locator('[data-testid="no-chapters-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="auto-generate-chapters"]')).toBeVisible();
    });

    // Step 8: Export Functionality
    await test.step('Tests export functionality', async () => {
      await page.click('[data-testid="export-tab"]');
      
      // Should see export options
      await expect(page.locator('[data-testid="export-description"]')).toBeVisible();
      await expect(page.locator('[data-testid="request-export"]')).toBeVisible();
      
      // Test export request (should handle empty project gracefully)
      await page.click('[data-testid="request-export"]');
      await expect(page.locator('[data-testid="export-requested"]')).toBeVisible();
    });

    // Step 9: Profile and Settings
    await test.step('Accesses profile and settings', async () => {
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="profile-link"]');
      
      await page.waitForURL('/dashboard/profile');
      
      // Should see profile information
      await expect(page.locator('[data-testid="profile-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="account-settings"]')).toBeVisible();
    });

    // Step 10: Performance Validation
    await test.step('Validates performance requirements', async () => {
      // Test dashboard load time (should be < 2 seconds)
      const dashboardLoadTime = await measurePageLoad(page, `/dashboard/projects/${createdProjectId}`);
      expect(dashboardLoadTime).toBeLessThan(2000);
      
      // Test stories page load time
      const storiesLoadTime = await measurePageLoad(page, `/dashboard/projects/${createdProjectId}/stories`);
      expect(storiesLoadTime).toBeLessThan(2000);
    });
  });

  test('Facilitator story interaction flow', async ({ facilitatorPage }) => {
    // This test assumes there are existing stories to interact with
    // In a real scenario, you'd set up test data first
    
    await test.step('Views story feed', async () => {
      await facilitatorPage.goto('/dashboard/stories');
      
      // Should load story feed efficiently
      await expect(facilitatorPage.locator('[data-testid="story-feed"]')).toBeVisible();
    });

    await test.step('Interacts with story', async () => {
      // Click on first story (if exists)
      const firstStory = facilitatorPage.locator('[data-testid="story-card"]').first();
      
      if (await firstStory.isVisible()) {
        await firstStory.click();
        
        // Should see story detail page
        await expect(facilitatorPage.locator('[data-testid="audio-player"]')).toBeVisible();
        await expect(facilitatorPage.locator('[data-testid="transcript"]')).toBeVisible();
        await expect(facilitatorPage.locator('[data-testid="interaction-form"]')).toBeVisible();
        
        // Test adding comment
        await facilitatorPage.fill('[data-testid="comment-input"]', 'This is a test comment');
        await facilitatorPage.click('[data-testid="add-comment"]');
        
        await expect(facilitatorPage.locator('[data-testid="comment-success"]')).toBeVisible();
        
        // Test adding follow-up question
        await facilitatorPage.fill('[data-testid="followup-input"]', 'Can you tell me more about this?');
        await facilitatorPage.click('[data-testid="add-followup"]');
        
        await expect(facilitatorPage.locator('[data-testid="followup-success"]')).toBeVisible();
      }
    });
  });

  test('Cross-platform synchronization', async ({ page, context }) => {
    // Test real-time updates between multiple browser contexts
    const secondPage = await context.newPage();
    
    await test.step('Sets up two browser contexts', async () => {
      // Login to both pages
      await page.goto('/auth/signin');
      await page.fill('[data-testid="email-input"]', 'facilitator@test.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="signin-button"]');
      await page.waitForURL('/dashboard');
      
      await secondPage.goto('/auth/signin');
      await secondPage.fill('[data-testid="email-input"]', 'facilitator@test.com');
      await secondPage.fill('[data-testid="password-input"]', 'TestPassword123!');
      await secondPage.click('[data-testid="signin-button"]');
      await secondPage.waitForURL('/dashboard');
    });

    await test.step('Tests real-time story updates', async () => {
      // Navigate both pages to the same project
      await page.goto('/dashboard/stories');
      await secondPage.goto('/dashboard/stories');
      
      // Simulate story upload notification
      // In a real test, this would involve WebSocket events
      
      // For now, just verify both pages can load the same content
      await expect(page.locator('[data-testid="story-feed"]')).toBeVisible();
      await expect(secondPage.locator('[data-testid="story-feed"]')).toBeVisible();
    });

    await secondPage.close();
  });
});