/**
 * Mobile Cross-Platform Compatibility Tests
 * 
 * Tests mobile app functionality across iOS and Android platforms
 * ensuring consistent behavior and performance
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';

// Mock platform-specific modules
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios', // Will be changed in tests
  Version: '15.0',
  select: jest.fn()
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}));

jest.mock('@react-native-netinfo/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn()
}));

// Import components after mocks
import { HomeScreen } from '../screens/main/HomeScreen';
import { RecordScreen } from '../screens/main/RecordScreen';
import { StoriesScreen } from '../screens/main/StoriesScreen';
import { AuthProvider } from '../contexts/AuthContext';
import { AccessibilityProvider } from '../contexts/AccessibilityContext';

describe('Cross-Platform Mobile Compatibility', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User'
  };

  const mockProject = {
    id: 'test-project-id',
    name: 'Test Project',
    stories: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      type: 'wifi'
    });
  });

  describe('iOS Platform Compatibility', () => {
    beforeEach(() => {
      (Platform as any).OS = 'ios';
      (Platform as any).Version = '15.0';
    });

    test('should render home screen correctly on iOS', async () => {
      const { getByTestId, getByText } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <HomeScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('home-screen')).toBeTruthy();
      });

      // iOS-specific UI elements
      expect(getByTestId('ios-navigation-bar')).toBeTruthy();
      expect(getByText('Record Your Story')).toBeTruthy();
    });

    test('should handle iOS-specific audio recording', async () => {
      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <RecordScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      const recordButton = getByTestId('record-button');
      
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Should use iOS-specific audio session configuration
      await waitFor(() => {
        expect(getByTestId('ios-audio-session-active')).toBeTruthy();
      });
    });

    test('should handle iOS accessibility features', async () => {
      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <StoriesScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      const storyList = getByTestId('story-list');
      
      // iOS VoiceOver support
      expect(storyList.props.accessibilityRole).toBe('list');
      expect(storyList.props.accessibilityLabel).toBeDefined();
    });

    test('should handle iOS-specific file system operations', async () => {
      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <RecordScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      const recordButton = getByTestId('record-button');
      
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Should save to iOS Documents directory
      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining('recording_draft'),
          expect.stringContaining('Documents/')
        );
      });
    });
  });

  describe('Android Platform Compatibility', () => {
    beforeEach(() => {
      (Platform as any).OS = 'android';
      (Platform as any).Version = 31;
    });

    test('should render home screen correctly on Android', async () => {
      const { getByTestId, getByText } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <HomeScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('home-screen')).toBeTruthy();
      });

      // Android-specific UI elements
      expect(getByTestId('android-action-bar')).toBeTruthy();
      expect(getByText('Record Your Story')).toBeTruthy();
    });

    test('should handle Android-specific audio recording', async () => {
      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <RecordScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      const recordButton = getByTestId('record-button');
      
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Should use Android-specific MediaRecorder
      await waitFor(() => {
        expect(getByTestId('android-media-recorder-active')).toBeTruthy();
      });
    });

    test('should handle Android accessibility features', async () => {
      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <StoriesScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      const storyList = getByTestId('story-list');
      
      // Android TalkBack support
      expect(storyList.props.accessibilityRole).toBe('list');
      expect(storyList.props.importantForAccessibility).toBe('yes');
    });

    test('should handle Android-specific file system operations', async () => {
      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <RecordScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      const recordButton = getByTestId('record-button');
      
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Should save to Android external storage
      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining('recording_draft'),
          expect.stringContaining('Android/data/')
        );
      });
    });
  });

  describe('Cross-Platform Data Synchronization', () => {
    test('should sync data consistently across platforms', async () => {
      // Test with iOS
      (Platform as any).OS = 'ios';
      
      const { rerender } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <StoriesScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      // Simulate data sync
      await act(async () => {
        // Mock API call
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            stories: [
              { id: '1', transcript: 'iOS story', platform: 'ios' }
            ]
          })
        });
      });

      // Switch to Android
      (Platform as any).OS = 'android';
      
      rerender(
        <AuthProvider>
          <AccessibilityProvider>
            <StoriesScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      // Data should be available on Android too
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/stories'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-Platform': 'android'
            })
          })
        );
      });
    });

    test('should handle offline sync across platforms', async () => {
      // Simulate offline state
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        type: 'none'
      });

      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <RecordScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      // Create offline recording
      const recordButton = getByTestId('record-button');
      await act(async () => {
        fireEvent.press(recordButton);
      });

      // Should queue for sync
      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          'offline_actions',
          expect.stringContaining('CREATE_STORY')
        );
      });

      // Simulate coming back online
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        type: 'wifi'
      });

      // Should sync queued actions
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/sync/offline-actions'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Platform-Specific Features', () => {
    test('should handle iOS-specific notifications', async () => {
      (Platform as any).OS = 'ios';

      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <HomeScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      // Should request iOS notification permissions
      await waitFor(() => {
        expect(getByTestId('ios-notification-permission-request')).toBeTruthy();
      });
    });

    test('should handle Android-specific notifications', async () => {
      (Platform as any).OS = 'android';

      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <HomeScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      // Should handle Android notification channels
      await waitFor(() => {
        expect(getByTestId('android-notification-channel-setup')).toBeTruthy();
      });
    });

    test('should handle platform-specific sharing', async () => {
      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <StoriesScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      const shareButton = getByTestId('share-story-button');
      
      await act(async () => {
        fireEvent.press(shareButton);
      });

      if (Platform.OS === 'ios') {
        expect(getByTestId('ios-share-sheet')).toBeTruthy();
      } else {
        expect(getByTestId('android-share-intent')).toBeTruthy();
      }
    });
  });

  describe('Performance Across Platforms', () => {
    test('should maintain consistent performance on iOS', async () => {
      (Platform as any).OS = 'ios';

      const startTime = Date.now();
      
      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <StoriesScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('story-list')).toBeTruthy();
      });

      const renderTime = Date.now() - startTime;
      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
    });

    test('should maintain consistent performance on Android', async () => {
      (Platform as any).OS = 'android';

      const startTime = Date.now();
      
      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <StoriesScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('story-list')).toBeTruthy();
      });

      const renderTime = Date.now() - startTime;
      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
    });

    test('should handle memory management consistently', async () => {
      const { unmount } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <RecordScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      // Simulate memory pressure
      await act(async () => {
        // Create multiple recordings
        for (let i = 0; i < 5; i++) {
          await AsyncStorage.setItem(`recording_${i}`, 'large_audio_data');
        }
      });

      // Should clean up properly
      unmount();

      // Verify cleanup
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('Accessibility Across Platforms', () => {
    test('should provide consistent accessibility on iOS', async () => {
      (Platform as any).OS = 'ios';

      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <HomeScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      const recordButton = getByTestId('record-button');
      
      // iOS VoiceOver attributes
      expect(recordButton.props.accessibilityLabel).toBeDefined();
      expect(recordButton.props.accessibilityHint).toBeDefined();
      expect(recordButton.props.accessibilityRole).toBe('button');
    });

    test('should provide consistent accessibility on Android', async () => {
      (Platform as any).OS = 'android';

      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <HomeScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      const recordButton = getByTestId('record-button');
      
      // Android TalkBack attributes
      expect(recordButton.props.accessibilityLabel).toBeDefined();
      expect(recordButton.props.accessibilityHint).toBeDefined();
      expect(recordButton.props.importantForAccessibility).toBe('yes');
    });

    test('should handle high contrast mode consistently', async () => {
      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <HomeScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      // Enable high contrast mode
      await act(async () => {
        await AsyncStorage.setItem('accessibility_high_contrast', 'true');
      });

      const homeScreen = getByTestId('home-screen');
      
      // Should apply high contrast styles
      expect(homeScreen.props.style).toEqual(
        expect.objectContaining({
          backgroundColor: expect.any(String),
          borderColor: expect.any(String)
        })
      );
    });
  });

  describe('Network Handling Across Platforms', () => {
    test('should handle network changes consistently', async () => {
      const { getByTestId } = render(
        <AuthProvider>
          <AccessibilityProvider>
            <HomeScreen />
          </AccessibilityProvider>
        </AuthProvider>
      );

      // Simulate network change
      await act(async () => {
        (NetInfo.fetch as jest.Mock).mockResolvedValue({
          isConnected: false,
          type: 'none'
        });
      });

      // Should show offline indicator
      await waitFor(() => {
        expect(getByTestId('offline-indicator')).toBeTruthy();
      });

      // Simulate network recovery
      await act(async () => {
        (NetInfo.fetch as jest.Mock).mockResolvedValue({
          isConnected: true,
          type: 'wifi'
        });
      });

      // Should hide offline indicator and sync
      await waitFor(() => {
        expect(() => getByTestId('offline-indicator')).toThrow();
      });
    });
  });
});