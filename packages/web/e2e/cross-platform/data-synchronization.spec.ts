/**
 * Cross-Platform Data Synchronization E2E Tests
 * 
 * Tests data synchronization between web and mobile platforms
 * using Playwright for web testing and API simulation for mobile
 */

import { test, expect, Page } from '@playwright/test';
import { APIRequestContext } from '@playwright/test';

test.describe('Cross-Platform Data Synchronization', () => {
  let webPage: Page;
  let apiContext: APIRequestContext;
  let authToken: string;
  let testProjectId: string;

  test.beforeAll(async ({ browser, playwright }) => {
    // Set up web browser context
    const context = await browser.newContext();
    webPage = await context.newPage();

    // Set up API context for mobile simulation
    apiContext = await playwright.request.newContext({
      baseURL: process.env.API_BASE_URL || 'http://localhost:8080',
    });

    // Authenticate and get token
    const authResponse = await apiContext.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'TestPassword123!'
      }
    });

    const authData = await authResponse.json();
    authToken = authData.token;

    // Create test project
    const projectResponse = await apiContext.post('/api/projects', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        name: 'Cross-Platform Sync Test Project',
        description: 'Test project for synchronization validation'
      }
    });

    const projectData = await projectResponse.json();
    testProjectId = projectData.id;
  });

  test.afterAll(async () => {
    await webPage.close();
    await apiContext.dispose();
  });

  test('should sync story creation from mobile to web', async () => {
    // Navigate to web dashboard
    await webPage.goto('/dashboard/projects');
    await webPage.waitForLoadState('networkidle');

    // Create story via mobile API
    const storyResponse = await apiContext.post('/api/stories', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Platform': 'mobile'
      },
      data: {
        projectId: testProjectId,
        transcript: 'Story created from mobile app',
        duration: 180,
        audioUrl: 'https://example.com/audio/mobile-story.mp3'
      }
    });

    expect(storyResponse.ok()).toBeTruthy();
    const storyData = await storyResponse.json();

    // Navigate to project stories page
    await webPage.goto(`/dashboard/projects/${testProjectId}/stories`);
    await webPage.waitForLoadState('networkidle');

    // Wait for real-time sync and verify story appears
    await webPage.waitForSelector(`[data-story-id="${storyData.id}"]`, { timeout: 10000 });
    
    const storyElement = webPage.locator(`[data-story-id="${storyData.id}"]`);
    await expect(storyElement).toBeVisible();
    
    const transcriptText = await storyElement.locator('.story-transcript').textContent();
    expect(transcriptText).toContain('Story created from mobile app');
  });

  test('should sync story updates from web to mobile', async () => {
    // Create initial story via API
    const storyResponse = await apiContext.post('/api/stories', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        projectId: testProjectId,
        transcript: 'Original story content',
        duration: 120
      }
    });

    const storyData = await storyResponse.json();

    // Navigate to story detail page on web
    await webPage.goto(`/dashboard/stories/${storyData.id}`);
    await webPage.waitForLoadState('networkidle');

    // Edit transcript on web
    await webPage.click('[data-testid="edit-transcript-button"]');
    await webPage.fill('[data-testid="transcript-editor"]', 'Updated story content from web');
    await webPage.click('[data-testid="save-transcript-button"]');

    // Wait for save confirmation
    await webPage.waitForSelector('[data-testid="save-success-message"]');

    // Verify update via mobile API
    const updatedStoryResponse = await apiContext.get(`/api/stories/${storyData.id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Platform': 'mobile'
      }
    });

    const updatedStoryData = await updatedStoryResponse.json();
    expect(updatedStoryData.transcript).toBe('Updated story content from web');
  });

  test('should sync real-time interactions across platforms', async () => {
    // Create a story first
    const storyResponse = await apiContext.post('/api/stories', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        projectId: testProjectId,
        transcript: 'Story for interaction testing',
        duration: 90
      }
    });

    const storyData = await storyResponse.json();

    // Navigate to story page on web
    await webPage.goto(`/dashboard/stories/${storyData.id}`);
    await webPage.waitForLoadState('networkidle');

    // Set up WebSocket listener for real-time updates
    await webPage.evaluate(() => {
      window.receivedInteractions = [];
      // Assuming WebSocket connection is established
      if (window.websocket) {
        window.websocket.addEventListener('message', (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'interaction_created') {
            window.receivedInteractions.push(data);
          }
        });
      }
    });

    // Create interaction via mobile API
    const interactionResponse = await apiContext.post('/api/interactions', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Platform': 'mobile'
      },
      data: {
        storyId: storyData.id,
        type: 'comment',
        content: 'Great story! Added from mobile app'
      }
    });

    expect(interactionResponse.ok()).toBeTruthy();
    const interactionData = await interactionResponse.json();

    // Wait for real-time update on web
    await webPage.waitForFunction(
      () => window.receivedInteractions && window.receivedInteractions.length > 0,
      { timeout: 10000 }
    );

    // Verify interaction appears in UI
    await webPage.waitForSelector(`[data-interaction-id="${interactionData.id}"]`);
    const interactionElement = webPage.locator(`[data-interaction-id="${interactionData.id}"]`);
    await expect(interactionElement).toBeVisible();
    
    const commentText = await interactionElement.locator('.interaction-content').textContent();
    expect(commentText).toContain('Great story! Added from mobile app');
  });

  test('should handle offline sync recovery', async () => {
    // Simulate offline actions queue
    const offlineActions = [
      {
        type: 'CREATE_STORY',
        data: {
          projectId: testProjectId,
          transcript: 'Offline story 1',
          duration: 60,
          clientId: 'offline-story-1'
        },
        timestamp: Date.now() - 5000
      },
      {
        type: 'CREATE_INTERACTION',
        data: {
          storyId: 'temp-story-id',
          type: 'comment',
          content: 'Offline comment',
          clientId: 'offline-interaction-1'
        },
        timestamp: Date.now() - 3000
      }
    ];

    // Process offline sync
    const syncResponse = await apiContext.post('/api/sync/offline-actions', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Platform': 'mobile'
      },
      data: {
        actions: offlineActions
      }
    });

    expect(syncResponse.ok()).toBeTruthy();
    const syncResult = await syncResponse.json();
    expect(syncResult.processed).toBe(offlineActions.length);

    // Navigate to web and verify synced content
    await webPage.goto(`/dashboard/projects/${testProjectId}/stories`);
    await webPage.waitForLoadState('networkidle');

    // Look for the synced story
    await webPage.waitForSelector('[data-testid="story-list"]');
    const storyList = webPage.locator('[data-testid="story-list"]');
    await expect(storyList.locator('text=Offline story 1')).toBeVisible();
  });

  test('should maintain consistent user state across platforms', async () => {
    // Update user preferences via mobile API
    const preferencesResponse = await apiContext.put('/api/users/preferences', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Platform': 'mobile'
      },
      data: {
        theme: 'dark',
        fontSize: 'large',
        notifications: {
          email: true,
          push: false
        }
      }
    });

    expect(preferencesResponse.ok()).toBeTruthy();

    // Navigate to web settings page
    await webPage.goto('/dashboard/settings');
    await webPage.waitForLoadState('networkidle');

    // Verify preferences are synced
    const themeSelect = webPage.locator('[data-testid="theme-select"]');
    await expect(themeSelect).toHaveValue('dark');

    const fontSizeSelect = webPage.locator('[data-testid="font-size-select"]');
    await expect(fontSizeSelect).toHaveValue('large');

    const emailNotifications = webPage.locator('[data-testid="email-notifications-toggle"]');
    await expect(emailNotifications).toBeChecked();

    const pushNotifications = webPage.locator('[data-testid="push-notifications-toggle"]');
    await expect(pushNotifications).not.toBeChecked();
  });

  test('should handle concurrent edits with conflict resolution', async () => {
    // Create a story
    const storyResponse = await apiContext.post('/api/stories', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        projectId: testProjectId,
        transcript: 'Original transcript for conflict test',
        duration: 150
      }
    });

    const storyData = await storyResponse.json();

    // Navigate to story on web
    await webPage.goto(`/dashboard/stories/${storyData.id}`);
    await webPage.waitForLoadState('networkidle');

    // Start editing on web (but don't save yet)
    await webPage.click('[data-testid="edit-transcript-button"]');
    await webPage.fill('[data-testid="transcript-editor"]', 'Web edit in progress');

    // Meanwhile, update via mobile API
    const mobileUpdateResponse = await apiContext.put(`/api/stories/${storyData.id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Platform': 'mobile'
      },
      data: {
        transcript: 'Mobile edit completed first'
      }
    });

    expect(mobileUpdateResponse.ok()).toBeTruthy();

    // Now try to save web edit
    await webPage.click('[data-testid="save-transcript-button"]');

    // Should show conflict resolution dialog
    await webPage.waitForSelector('[data-testid="conflict-resolution-dialog"]');
    
    // Choose to keep mobile version
    await webPage.click('[data-testid="keep-server-version-button"]');

    // Verify the mobile version is displayed
    const transcriptContent = await webPage.locator('[data-testid="transcript-content"]').textContent();
    expect(transcriptContent).toContain('Mobile edit completed first');
  });

  test('should sync notification preferences across platforms', async () => {
    // Update notification settings via web
    await webPage.goto('/dashboard/settings/notifications');
    await webPage.waitForLoadState('networkidle');

    await webPage.check('[data-testid="story-notifications-toggle"]');
    await webPage.uncheck('[data-testid="export-notifications-toggle"]');
    await webPage.click('[data-testid="save-notification-settings"]');

    await webPage.waitForSelector('[data-testid="settings-saved-message"]');

    // Verify settings via mobile API
    const settingsResponse = await apiContext.get('/api/users/notification-preferences', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Platform': 'mobile'
      }
    });

    const settings = await settingsResponse.json();
    expect(settings.storyNotifications).toBe(true);
    expect(settings.exportNotifications).toBe(false);
  });

  test('should maintain session consistency across platform switches', async () => {
    // Perform actions on web
    await webPage.goto(`/dashboard/projects/${testProjectId}`);
    await webPage.waitForLoadState('networkidle');

    // Add project to favorites
    await webPage.click('[data-testid="favorite-project-button"]');
    await webPage.waitForSelector('[data-testid="favorite-added-message"]');

    // Verify session state via mobile API
    const sessionResponse = await apiContext.get('/api/users/session', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Platform': 'mobile'
      }
    });

    const sessionData = await sessionResponse.json();
    expect(sessionData.favoriteProjects).toContain(testProjectId);

    // Perform action via mobile API
    const activityResponse = await apiContext.post('/api/users/activity', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Platform': 'mobile'
      },
      data: {
        type: 'project_viewed',
        projectId: testProjectId,
        timestamp: Date.now()
      }
    });

    expect(activityResponse.ok()).toBeTruthy();

    // Refresh web page and verify activity is reflected
    await webPage.reload();
    await webPage.waitForLoadState('networkidle');

    const lastActivity = webPage.locator('[data-testid="last-activity"]');
    await expect(lastActivity).toContainText('Viewed on mobile');
  });
});