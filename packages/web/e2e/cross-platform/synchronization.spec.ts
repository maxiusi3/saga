import { test, expect } from '@playwright/test';
import { TestDataAPI, generateTestProject, generateTestStory } from '../utils/test-data';

test.describe('Cross-Platform Synchronization', () => {
  let testDataAPI: TestDataAPI;
  let projectId: string;

  test.beforeEach(async () => {
    testDataAPI = new TestDataAPI();
  });

  test('Real-time story upload notifications', async ({ page, context }) => {
    // Create two browser contexts to simulate facilitator and admin views
    const facilitatorPage = page;
    const adminPage = await context.newPage();

    await test.step('Setup both browser contexts', async () => {
      // Login facilitator
      await facilitatorPage.goto('/auth/signin');
      await facilitatorPage.fill('[data-testid="email-input"]', 'facilitator@test.com');
      await facilitatorPage.fill('[data-testid="password-input"]', 'TestPassword123!');
      await facilitatorPage.click('[data-testid="signin-button"]');
      await facilitatorPage.waitForURL('/dashboard');

      // Login admin/second facilitator
      await adminPage.goto('/auth/signin');
      await adminPage.fill('[data-testid="email-input"]', 'admin@test.com');
      await adminPage.fill('[data-testid="password-input"]', 'TestPassword123!');
      await adminPage.click('[data-testid="signin-button"]');
      await adminPage.waitForURL('/dashboard');

      // Navigate both to the same project
      await facilitatorPage.goto('/dashboard/stories');
      await adminPage.goto('/dashboard/stories');
    });

    await test.step('Test real-time story notifications', async () => {
      // Set up WebSocket listeners
      let facilitatorReceivedNotification = false;
      let adminReceivedNotification = false;

      facilitatorPage.on('websocket', ws => {
        ws.on('framereceived', event => {
          const data = JSON.parse(event.payload as string);
          if (data.type === 'story_uploaded') {
            facilitatorReceivedNotification = true;
          }
        });
      });

      adminPage.on('websocket', ws => {
        ws.on('framereceived', event => {
          const data = JSON.parse(event.payload as string);
          if (data.type === 'story_uploaded') {
            adminReceivedNotification = true;
          }
        });
      });

      // Simulate story upload via API (as if from mobile app)
      const projectResponse = await testDataAPI.createProject(generateTestProject());
      projectId = projectResponse.data.id;

      const storyData = generateTestStory(projectId);
      await testDataAPI.createStory(storyData);

      // Wait for real-time updates
      await facilitatorPage.waitForTimeout(2000);

      // Both pages should receive the notification
      expect(facilitatorReceivedNotification).toBeTruthy();
      expect(adminReceivedNotification).toBeTruthy();

      // Both pages should show the new story
      await expect(facilitatorPage.locator('[data-testid="story-card"]').first()).toBeVisible();
      await expect(adminPage.locator('[data-testid="story-card"]').first()).toBeVisible();
    });

    await adminPage.close();
  });

  test('Real-time interaction updates', async ({ page, context }) => {
    const facilitatorPage = page;
    const secondFacilitatorPage = await context.newPage();

    await test.step('Setup for interaction testing', async () => {
      // Login both users
      await facilitatorPage.goto('/auth/signin');
      await facilitatorPage.fill('[data-testid="email-input"]', 'facilitator@test.com');
      await facilitatorPage.fill('[data-testid="password-input"]', 'TestPassword123!');
      await facilitatorPage.click('[data-testid="signin-button"]');
      await facilitatorPage.waitForURL('/dashboard');

      await secondFacilitatorPage.goto('/auth/signin');
      await secondFacilitatorPage.fill('[data-testid="email-input"]', 'facilitator2@test.com');
      await secondFacilitatorPage.fill('[data-testid="password-input"]', 'TestPassword123!');
      await secondFacilitatorPage.click('[data-testid="signin-button"]');
      await secondFacilitatorPage.waitForURL('/dashboard');

      // Navigate to the same story
      await facilitatorPage.goto('/dashboard/stories/test-story-id');
      await secondFacilitatorPage.goto('/dashboard/stories/test-story-id');
    });

    await test.step('Test real-time comment updates', async () => {
      // First user adds a comment
      await facilitatorPage.fill('[data-testid="comment-input"]', 'This is a test comment');
      await facilitatorPage.click('[data-testid="add-comment"]');

      // Wait for real-time update
      await secondFacilitatorPage.waitForTimeout(2000);

      // Second user should see the comment
      await expect(secondFacilitatorPage.locator('[data-testid="comment"]').last()).toContainText('This is a test comment');
    });

    await test.step('Test real-time follow-up question updates', async () => {
      // Second user adds a follow-up question
      await secondFacilitatorPage.fill('[data-testid="followup-input"]', 'Can you tell me more about this?');
      await secondFacilitatorPage.click('[data-testid="add-followup"]');

      // Wait for real-time update
      await facilitatorPage.waitForTimeout(2000);

      // First user should see the follow-up question
      await expect(facilitatorPage.locator('[data-testid="followup-question"]').last()).toContainText('Can you tell me more about this?');
    });

    await secondFacilitatorPage.close();
  });

  test('Real-time transcript updates', async ({ page, context }) => {
    const facilitatorPage = page;
    const editorPage = await context.newPage();

    await test.step('Setup for transcript editing', async () => {
      // Login both users
      await facilitatorPage.goto('/auth/signin');
      await facilitatorPage.fill('[data-testid="email-input"]', 'facilitator@test.com');
      await facilitatorPage.fill('[data-testid="password-input"]', 'TestPassword123!');
      await facilitatorPage.click('[data-testid="signin-button"]');
      await facilitatorPage.waitForURL('/dashboard');

      await editorPage.goto('/auth/signin');
      await editorPage.fill('[data-testid="email-input"]', 'editor@test.com');
      await editorPage.fill('[data-testid="password-input"]', 'TestPassword123!');
      await editorPage.click('[data-testid="signin-button"]');
      await editorPage.waitForURL('/dashboard');

      // Navigate to the same story
      await facilitatorPage.goto('/dashboard/stories/test-story-id');
      await editorPage.goto('/dashboard/stories/test-story-id');
    });

    await test.step('Test real-time transcript editing', async () => {
      // First user starts editing transcript
      await facilitatorPage.click('[data-testid="edit-transcript-button"]');
      await facilitatorPage.fill('[data-testid="transcript-editor"]', 'This is the updated transcript content.');

      // Save changes
      await facilitatorPage.click('[data-testid="save-transcript"]');

      // Wait for real-time update
      await editorPage.waitForTimeout(2000);

      // Second user should see the updated transcript
      await expect(editorPage.locator('[data-testid="transcript-content"]')).toContainText('This is the updated transcript content.');
    });

    await editorPage.close();
  });

  test('Mobile-Web synchronization simulation', async ({ page }) => {
    await test.step('Simulate mobile story upload', async () => {
      // Login to web
      await page.goto('/auth/signin');
      await page.fill('[data-testid="email-input"]', 'facilitator@test.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="signin-button"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/stories');

      // Set up WebSocket listener for story uploads
      let storyUploadReceived = false;
      page.on('websocket', ws => {
        ws.on('framereceived', event => {
          const data = JSON.parse(event.payload as string);
          if (data.type === 'story_uploaded') {
            storyUploadReceived = true;
          }
        });
      });

      // Simulate mobile app uploading a story via API
      const projectResponse = await testDataAPI.createProject(generateTestProject());
      projectId = projectResponse.data.id;

      const storyData = generateTestStory(projectId, {
        title: 'Mobile Uploaded Story',
        transcript: 'This story was uploaded from the mobile app.',
      });

      await testDataAPI.createStory(storyData);

      // Wait for WebSocket notification
      await page.waitForTimeout(3000);

      // Web should receive the notification
      expect(storyUploadReceived).toBeTruthy();

      // Web should show the new story
      await expect(page.locator('[data-testid="story-card"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="story-title"]').first()).toContainText('Mobile Uploaded Story');
    });

    await test.step('Simulate web interaction sent to mobile', async () => {
      // Add a comment from web
      await page.click('[data-testid="story-card"]').first();
      await page.waitForSelector('[data-testid="story-detail"]');

      await page.fill('[data-testid="comment-input"]', 'Great story! Tell me more.');
      await page.click('[data-testid="add-comment"]');

      // In a real test, this would trigger a push notification to mobile
      // For now, we'll verify the comment was saved
      await expect(page.locator('[data-testid="comment"]').last()).toContainText('Great story! Tell me more.');

      // Add a follow-up question
      await page.fill('[data-testid="followup-input"]', 'What happened next?');
      await page.click('[data-testid="add-followup"]');

      // Verify follow-up was saved
      await expect(page.locator('[data-testid="followup-question"]').last()).toContainText('What happened next?');
    });
  });

  test('Chapter summary synchronization', async ({ page, context }) => {
    const facilitatorPage = page;
    const viewerPage = await context.newPage();

    await test.step('Setup for chapter summary testing', async () => {
      // Login both users
      await facilitatorPage.goto('/auth/signin');
      await facilitatorPage.fill('[data-testid="email-input"]', 'facilitator@test.com');
      await facilitatorPage.fill('[data-testid="password-input"]', 'TestPassword123!');
      await facilitatorPage.click('[data-testid="signin-button"]');
      await facilitatorPage.waitForURL('/dashboard');

      await viewerPage.goto('/auth/signin');
      await viewerPage.fill('[data-testid="email-input"]', 'viewer@test.com');
      await viewerPage.fill('[data-testid="password-password"]', 'TestPassword123!');
      await viewerPage.click('[data-testid="signin-button"]');
      await viewerPage.waitForURL('/dashboard');

      // Navigate to project chapters
      await facilitatorPage.goto('/dashboard/projects/test-project-id');
      await facilitatorPage.click('[data-testid="chapters-tab"]');

      await viewerPage.goto('/dashboard/projects/test-project-id');
      await viewerPage.click('[data-testid="chapters-tab"]');
    });

    await test.step('Test chapter generation synchronization', async () => {
      // First user generates chapters
      await facilitatorPage.click('[data-testid="auto-generate-chapters"]');

      // Wait for generation to complete
      await facilitatorPage.waitForSelector('[data-testid="chapter-card"]', { timeout: 30000 });

      // Wait for real-time update
      await viewerPage.waitForTimeout(3000);

      // Second user should see the generated chapters
      await expect(viewerPage.locator('[data-testid="chapter-card"]').first()).toBeVisible();
    });

    await viewerPage.close();
  });

  test('Export request synchronization', async ({ page, context }) => {
    const requesterPage = page;
    const adminPage = await context.newPage();

    await test.step('Setup for export testing', async () => {
      // Login both users
      await requesterPage.goto('/auth/signin');
      await requesterPage.fill('[data-testid="email-input"]', 'facilitator@test.com');
      await requesterPage.fill('[data-testid="password-input"]', 'TestPassword123!');
      await requesterPage.click('[data-testid="signin-button"]');
      await requesterPage.waitForURL('/dashboard');

      await adminPage.goto('/auth/signin');
      await adminPage.fill('[data-testid="email-input"]', 'admin@test.com');
      await adminPage.fill('[data-testid="password-input"]', 'TestPassword123!');
      await adminPage.click('[data-testid="signin-button"]');
      await adminPage.waitForURL('/dashboard');

      // Navigate to export pages
      await requesterPage.goto('/dashboard/projects/test-project-id/export');
      await adminPage.goto('/dashboard/exports');
    });

    await test.step('Test export request notifications', async () => {
      // Set up WebSocket listener for export updates
      let exportUpdateReceived = false;
      adminPage.on('websocket', ws => {
        ws.on('framereceived', event => {
          const data = JSON.parse(event.payload as string);
          if (data.type === 'export_ready') {
            exportUpdateReceived = true;
          }
        });
      });

      // Request export
      await requesterPage.click('[data-testid="request-export"]');

      // Should see export requested confirmation
      await expect(requesterPage.locator('[data-testid="export-requested"]')).toBeVisible();

      // Wait for processing (in real scenario, this would be background job)
      await requesterPage.waitForTimeout(5000);

      // Admin should receive notification when export is ready
      expect(exportUpdateReceived).toBeTruthy();

      // Both pages should show export status
      await expect(requesterPage.locator('[data-testid="export-status"]')).toContainText('Ready');
      await expect(adminPage.locator('[data-testid="export-item"]').first()).toBeVisible();
    });

    await adminPage.close();
  });

  test('Connection resilience and recovery', async ({ page }) => {
    await test.step('Test WebSocket reconnection', async () => {
      // Login
      await page.goto('/auth/signin');
      await page.fill('[data-testid="email-input"]', 'facilitator@test.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="signin-button"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/stories');

      // Monitor WebSocket connection
      let connectionLost = false;
      let connectionRestored = false;

      page.on('websocket', ws => {
        ws.on('close', () => {
          connectionLost = true;
        });
        ws.on('open', () => {
          if (connectionLost) {
            connectionRestored = true;
          }
        });
      });

      // Simulate network interruption
      await page.context().setOffline(true);
      await page.waitForTimeout(2000);

      // Restore network
      await page.context().setOffline(false);
      await page.waitForTimeout(3000);

      // Should have reconnected
      expect(connectionLost).toBeTruthy();
      expect(connectionRestored).toBeTruthy();

      // App should still be functional
      await expect(page.locator('[data-testid="story-feed"]')).toBeVisible();
    });
  });

  test('Performance under concurrent updates', async ({ page, context }) => {
    await test.step('Test performance with multiple concurrent users', async () => {
      // Create multiple browser contexts
      const contexts = await Promise.all([
        context,
        page.context(),
        await page.context().browser()?.newContext(),
        await page.context().browser()?.newContext(),
      ].filter(Boolean));

      const pages = await Promise.all(
        contexts.map(async (ctx) => {
          const newPage = await ctx!.newPage();
          
          // Login each user
          await newPage.goto('/auth/signin');
          await newPage.fill('[data-testid="email-input"]', `user${Math.random()}@test.com`);
          await newPage.fill('[data-testid="password-input"]', 'TestPassword123!');
          await newPage.click('[data-testid="signin-button"]');
          await newPage.waitForURL('/dashboard');
          
          return newPage;
        })
      );

      // Navigate all to the same story
      await Promise.all(
        pages.map(p => p.goto('/dashboard/stories/test-story-id'))
      );

      // Simulate concurrent interactions
      const startTime = Date.now();
      
      await Promise.all(
        pages.map(async (p, index) => {
          await p.fill('[data-testid="comment-input"]', `Comment from user ${index}`);
          await p.click('[data-testid="add-comment"]');
        })
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should handle concurrent updates efficiently
      expect(totalTime).toBeLessThan(5000);

      // All pages should show all comments
      for (const p of pages) {
        const comments = await p.locator('[data-testid="comment"]').count();
        expect(comments).toBeGreaterThanOrEqual(pages.length);
      }

      // Clean up
      await Promise.all(pages.map(p => p.close()));
    });
  });
});