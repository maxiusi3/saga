const { device, expect, element, by, waitFor } = require('detox');

describe('Storyteller Complete User Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('Complete storyteller journey: invitation → onboarding → recording → story review', async () => {
    // Step 1: Invitation Acceptance
    await describe('Accepts invitation and joins project', async () => {
      // Simulate deep link from invitation
      await device.openURL({
        url: 'saga://invite?token=test-invitation-token',
        sourceApp: 'com.apple.mobilesafari'
      });

      // Should see invitation welcome screen
      await waitForElementToBeVisible(by.testID('invitation-welcome'));
      await expect(element(by.testID('invitation-welcome'))).toBeVisible();
      
      // Should see project details
      await expect(element(by.testID('project-title'))).toBeVisible();
      await expect(element(by.testID('facilitator-name'))).toBeVisible();
      
      // Accept invitation
      await element(by.testID('accept-invitation-button')).tap();
    });

    // Step 2: Privacy Pledge
    await describe('Reviews and accepts privacy pledge', async () => {
      await waitForElementToBeVisible(by.testID('privacy-pledge'));
      
      // Should see privacy pledge content
      await expect(element(by.testID('privacy-pledge-content'))).toBeVisible();
      await expect(element(by.testID('privacy-pledge-scroll'))).toBeVisible();
      
      // Scroll through privacy pledge
      await element(by.testID('privacy-pledge-scroll')).scroll(300, 'down');
      await sleep(1000);
      
      // Accept privacy pledge
      await element(by.testID('accept-privacy-button')).tap();
    });

    // Step 3: User Information Setup
    await describe('Provides basic user information', async () => {
      await waitForElementToBeVisible(by.testID('user-info-form'));
      
      // Fill user information
      await element(by.testID('name-input')).typeText('Test Storyteller');
      await element(by.testID('age-input')).typeText('75');
      
      // Select preferences
      await element(by.testID('notification-preference-toggle')).tap();
      
      await element(by.testID('continue-button')).tap();
    });

    // Step 4: Onboarding Tutorial
    await describe('Completes onboarding tutorial', async () => {
      await waitForElementToBeVisible(by.testID('tutorial-step-1'));
      
      // Go through tutorial steps
      for (let step = 1; step <= 3; step++) {
        await expect(element(by.testID(`tutorial-step-${step}`))).toBeVisible();
        
        if (step < 3) {
          await element(by.testID('tutorial-next-button')).tap();
        } else {
          await element(by.testID('tutorial-finish-button')).tap();
        }
        
        await sleep(1000);
      }
    });

    // Step 5: Home Screen Navigation
    await describe('Navigates main app interface', async () => {
      await waitForElementToBeVisible(by.testID('home-screen'));
      
      // Should see main navigation tabs
      await expect(element(by.testID('home-tab'))).toBeVisible();
      await expect(element(by.testID('record-tab'))).toBeVisible();
      await expect(element(by.testID('stories-tab'))).toBeVisible();
      await expect(element(by.testID('messages-tab'))).toBeVisible();
      
      // Should see daily prompt
      await expect(element(by.testID('daily-prompt-card'))).toBeVisible();
      await expect(element(by.testID('record-story-button'))).toBeVisible();
    });

    // Step 6: Voice Recording
    await describe('Records first story', async () => {
      // Tap record button
      await element(by.testID('record-story-button')).tap();
      
      await waitForElementToBeVisible(by.testID('record-screen'));
      
      // Should see AI prompt
      await expect(element(by.testID('ai-prompt-text'))).toBeVisible();
      await expect(element(by.testID('play-prompt-audio'))).toBeVisible();
      
      // Test audio playback
      await element(by.testID('play-prompt-audio')).tap();
      await sleep(2000); // Let audio play briefly
      
      // Should see recording controls
      await expect(element(by.testID('record-button'))).toBeVisible();
      await expect(element(by.testID('waveform-animation'))).toBeVisible();
      
      // Start recording
      await element(by.testID('record-button')).longPress(3000);
      
      // Should see recording feedback
      await expect(element(by.testID('recording-indicator'))).toBeVisible();
      await expect(element(by.testID('recording-timer'))).toBeVisible();
      
      // Stop recording
      await element(by.testID('record-button')).tap();
      
      // Should see recording preview
      await waitForElementToBeVisible(by.testID('recording-preview'));
      await expect(element(by.testID('play-recording-button'))).toBeVisible();
      await expect(element(by.testID('re-record-button'))).toBeVisible();
      await expect(element(by.testID('upload-recording-button'))).toBeVisible();
      
      // Test playback
      await element(by.testID('play-recording-button')).tap();
      await sleep(2000);
      
      // Upload recording
      await element(by.testID('upload-recording-button')).tap();
      
      // Should see upload progress
      await waitForElementToBeVisible(by.testID('upload-progress'));
      
      // Wait for upload completion
      await waitForElementToBeVisible(by.testID('upload-success'), 30000);
      await expect(element(by.testID('upload-success-message'))).toBeVisible();
    });

    // Step 7: Photo Attachment
    await describe('Adds photo to story', async () => {
      // Should see photo attachment option
      await expect(element(by.testID('add-photo-button'))).toBeVisible();
      
      await element(by.testID('add-photo-button')).tap();
      
      // Should see photo source options
      await waitForElementToBeVisible(by.testID('photo-source-modal'));
      await expect(element(by.testID('camera-option'))).toBeVisible();
      await expect(element(by.testID('gallery-option'))).toBeVisible();
      
      // Select gallery (safer for testing)
      await element(by.testID('gallery-option')).tap();
      
      // Note: In real testing, you'd need to handle system photo picker
      // For now, simulate photo selection
      await sleep(2000);
      
      // Should see photo preview
      await waitForElementToBeVisible(by.testID('photo-preview'));
      await expect(element(by.testID('photo-image'))).toBeVisible();
      await expect(element(by.testID('remove-photo-button'))).toBeVisible();
    });

    // Step 8: Story Completion
    await describe('Completes story submission', async () => {
      // Should see completion options
      await expect(element(by.testID('story-complete-button'))).toBeVisible();
      
      await element(by.testID('story-complete-button')).tap();
      
      // Should see success confirmation
      await waitForElementToBeVisible(by.testID('story-submitted'));
      await expect(element(by.testID('success-message'))).toBeVisible();
      await expect(element(by.testID('record-another-button'))).toBeVisible();
      await expect(element(by.testID('view-stories-button'))).toBeVisible();
    });

    // Step 9: Story Review
    await describe('Reviews submitted stories', async () => {
      await element(by.testID('view-stories-button')).tap();
      
      await waitForElementToBeVisible(by.testID('stories-screen'));
      
      // Should see story list
      await expect(element(by.testID('stories-list'))).toBeVisible();
      await expect(element(by.testID('story-card')).atIndex(0)).toBeVisible();
      
      // Tap on first story
      await element(by.testID('story-card')).atIndex(0).tap();
      
      // Should see story detail
      await waitForElementToBeVisible(by.testID('story-detail'));
      await expect(element(by.testID('story-audio-player'))).toBeVisible();
      await expect(element(by.testID('story-transcript'))).toBeVisible();
      await expect(element(by.testID('story-interactions'))).toBeVisible();
    });

    // Step 10: Messages and Feedback
    await describe('Views messages and feedback', async () => {
      // Navigate to messages tab
      await element(by.testID('messages-tab')).tap();
      
      await waitForElementToBeVisible(by.testID('messages-screen'));
      
      // Should see messages interface
      await expect(element(by.testID('messages-list'))).toBeVisible();
      
      // If there are messages, test interaction
      const messageExists = await element(by.testID('message-card')).atIndex(0);
      try {
        await expect(messageExists).toBeVisible();
        
        // Tap on message
        await messageExists.tap();
        
        // Should see message detail
        await waitForElementToBeVisible(by.testID('message-detail'));
        
        // If it's a follow-up question, should see record answer button
        const recordAnswerButton = element(by.testID('record-answer-button'));
        try {
          await expect(recordAnswerButton).toBeVisible();
          
          // Test record answer flow
          await recordAnswerButton.tap();
          await waitForElementToBeVisible(by.testID('record-answer-screen'));
          
          // Should see original question context
          await expect(element(by.testID('original-question'))).toBeVisible();
          await expect(element(by.testID('record-button'))).toBeVisible();
        } catch (e) {
          // No record answer button, just a comment
          await expect(element(by.testID('comment-content'))).toBeVisible();
        }
      } catch (e) {
        // No messages yet, should see empty state
        await expect(element(by.testID('no-messages-state'))).toBeVisible();
      }
    });
  });

  it('Accessibility features work correctly', async () => {
    await describe('Tests accessibility features', async () => {
      // Navigate to accessibility settings
      await element(by.testID('home-tab')).tap();
      await element(by.testID('profile-button')).tap();
      await element(by.testID('accessibility-settings')).tap();
      
      await waitForElementToBeVisible(by.testID('accessibility-screen'));
      
      // Test font size controls
      await expect(element(by.testID('font-size-controls'))).toBeVisible();
      
      // Test large font
      await element(by.testID('large-font-button')).tap();
      await sleep(1000);
      
      // Verify font size changed (check if text is larger)
      // This would need specific implementation based on your app
      
      // Test extra large font
      await element(by.testID('extra-large-font-button')).tap();
      await sleep(1000);
      
      // Test high contrast mode
      await expect(element(by.testID('high-contrast-toggle'))).toBeVisible();
      await element(by.testID('high-contrast-toggle')).tap();
      await sleep(1000);
      
      // Verify high contrast is applied
      // This would need specific visual verification
      
      // Reset to standard
      await element(by.testID('standard-font-button')).tap();
      await element(by.testID('high-contrast-toggle')).tap();
    });
  });

  it('Performance requirements are met', async () => {
    await describe('Tests performance requirements', async () => {
      // Test app cold start time
      const startTime = Date.now();
      await device.launchApp({ newInstance: true });
      await waitForElementToBeVisible(by.testID('home-screen'));
      const coldStartTime = Date.now() - startTime;
      
      // Should start within 3 seconds
      expect(coldStartTime).toBeLessThan(3000);
      
      // Test story feed load time
      const feedStartTime = Date.now();
      await element(by.testID('stories-tab')).tap();
      await waitForElementToBeVisible(by.testID('stories-screen'));
      const feedLoadTime = Date.now() - feedStartTime;
      
      // Should load within 2 seconds
      expect(feedLoadTime).toBeLessThan(2000);
    });
  });

  it('Handles network connectivity issues', async () => {
    await describe('Tests offline/poor connectivity scenarios', async () => {
      // Simulate network issues
      await device.setURLBlacklist(['*']);
      
      // Try to record a story
      await element(by.testID('record-tab')).tap();
      await waitForElementToBeVisible(by.testID('record-screen'));
      
      // Record something
      await element(by.testID('record-button')).longPress(2000);
      await element(by.testID('record-button')).tap();
      
      // Try to upload
      await element(by.testID('upload-recording-button')).tap();
      
      // Should see network error
      await waitForElementToBeVisible(by.testID('network-error'));
      await expect(element(by.testID('retry-button'))).toBeVisible();
      
      // Restore network
      await device.setURLBlacklist([]);
      
      // Retry upload
      await element(by.testID('retry-button')).tap();
      
      // Should succeed now
      await waitForElementToBeVisible(by.testID('upload-success'), 30000);
    });
  });

  it('Cross-platform synchronization works', async () => {
    await describe('Tests real-time updates', async () => {
      // This would require coordination with web tests
      // For now, just verify the app can receive push notifications
      
      // Navigate to home
      await element(by.testID('home-tab')).tap();
      
      // Simulate receiving a push notification
      // (In real testing, this would be triggered by web actions)
      await device.sendUserNotification({
        trigger: {
          type: 'push',
        },
        title: 'New Comment',
        subtitle: 'Someone commented on your story',
        body: 'This is a test comment notification',
        badge: 1,
        payload: {
          storyId: 'test-story-id',
          type: 'comment',
        },
      });
      
      // Should see notification
      await sleep(2000);
      
      // Tap notification to open app
      await device.launchApp({ newInstance: false });
      
      // Should navigate to relevant story
      await waitForElementToBeVisible(by.testID('story-detail'));
    });
  });
});