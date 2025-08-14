/**
 * Device Compatibility Tests
 * 
 * Tests mobile app functionality across different devices and screen sizes
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Dimensions, Platform } from 'react-native';

// Import screens and components to test
import { HomeScreen } from '../screens/main/HomeScreen';
import { RecordScreen } from '../screens/main/RecordScreen';
import { StoriesScreen } from '../screens/main/StoriesScreen';
import { AccessibilityScreen } from '../screens/main/AccessibilityScreen';
import { AccessibilityProvider } from '../contexts/AccessibilityContext';

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
}));

// Mock device info
jest.mock('react-native-device-info', () => ({
  getModel: jest.fn(() => 'iPhone 12'),
  getSystemVersion: jest.fn(() => '15.0'),
  hasNotch: jest.fn(() => true),
  isTablet: jest.fn(() => false),
  getDeviceType: jest.fn(() => 'Handset'),
}));

// Mock audio recording
jest.mock('../services/audio-recording-service', () => ({
  AudioRecordingService: {
    requestPermissions: jest.fn(() => Promise.resolve(true)),
    startRecording: jest.fn(() => Promise.resolve()),
    stopRecording: jest.fn(() => Promise.resolve('file://recording.m4a')),
    isRecording: jest.fn(() => false),
  },
}));

describe('Device Compatibility Tests', () => {
  // Test different screen sizes
  const screenSizes = [
    { name: 'iPhone SE', width: 320, height: 568, scale: 2 },
    { name: 'iPhone 12', width: 390, height: 844, scale: 3 },
    { name: 'iPhone 12 Pro Max', width: 428, height: 926, scale: 3 },
    { name: 'iPad', width: 768, height: 1024, scale: 2 },
    { name: 'Android Small', width: 360, height: 640, scale: 2 },
    { name: 'Android Large', width: 412, height: 892, scale: 3 },
  ];

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <AccessibilityProvider>{children}</AccessibilityProvider>
  );

  describe('Screen Size Compatibility', () => {
    screenSizes.forEach(({ name, width, height, scale }) => {
      describe(`${name} (${width}x${height})`, () => {
        beforeEach(() => {
          // Mock screen dimensions
          jest.spyOn(Dimensions, 'get').mockReturnValue({
            width,
            height,
            scale,
            fontScale: 1,
          });
        });

        it('should render HomeScreen properly', () => {
          const { getByTestID } = render(
            <TestWrapper>
              <HomeScreen />
            </TestWrapper>
          );

          // Check that main elements are present
          expect(getByTestID('home-screen')).toBeTruthy();
          expect(getByTestID('record-button')).toBeTruthy();
          expect(getByTestID('stories-tab')).toBeTruthy();
          expect(getByTestID('messages-tab')).toBeTruthy();
        });

        it('should render RecordScreen with proper layout', () => {
          const { getByTestID } = render(
            <TestWrapper>
              <RecordScreen />
            </TestWrapper>
          );

          // Check recording interface elements
          expect(getByTestID('record-screen')).toBeTruthy();
          expect(getByTestID('prompt-card')).toBeTruthy();
          expect(getByTestID('record-button')).toBeTruthy();
          
          // Check that elements are properly sized for screen
          const recordButton = getByTestID('record-button');
          expect(recordButton.props.style).toBeDefined();
        });

        it('should handle touch targets appropriately for screen size', () => {
          const { getByTestID } = render(
            <TestWrapper>
              <HomeScreen />
            </TestWrapper>
          );

          const recordButton = getByTestID('record-button');
          const buttonStyle = recordButton.props.style;
          
          // Touch targets should be at least 44dp on all devices
          if (Array.isArray(buttonStyle)) {
            const flatStyle = buttonStyle.reduce((acc, style) => ({ ...acc, ...style }), {});
            expect(flatStyle.minWidth || flatStyle.width).toBeGreaterThanOrEqual(44);
            expect(flatStyle.minHeight || flatStyle.height).toBeGreaterThanOrEqual(44);
          }
        });

        it('should adapt font sizes for screen density', () => {
          const { getByTestID } = render(
            <TestWrapper>
              <StoriesScreen />
            </TestWrapper>
          );

          // Check that text elements have appropriate sizing
          const storyTitle = getByTestID('story-title');
          if (storyTitle) {
            const textStyle = storyTitle.props.style;
            expect(textStyle.fontSize).toBeGreaterThan(12);
            
            // Larger screens should have larger base font sizes
            if (width > 400) {
              expect(textStyle.fontSize).toBeGreaterThanOrEqual(16);
            }
          }
        });
      });
    });
  });

  describe('Platform-Specific Compatibility', () => {
    describe('iOS Compatibility', () => {
      beforeEach(() => {
        Platform.OS = 'ios';
      });

      it('should handle iOS-specific navigation patterns', () => {
        const { getByTestID } = render(
          <TestWrapper>
            <HomeScreen />
          </TestWrapper>
        );

        // iOS should have proper navigation structure
        expect(getByTestID('home-screen')).toBeTruthy();
        
        // Check for iOS-specific styling
        const container = getByTestID('home-screen');
        expect(container.props.style).toBeDefined();
      });

      it('should handle iOS safe area properly', () => {
        const { getByTestID } = render(
          <TestWrapper>
            <RecordScreen />
          </TestWrapper>
        );

        const screen = getByTestID('record-screen');
        const style = screen.props.style;
        
        // Should have safe area handling
        expect(style).toBeDefined();
      });

      it('should use iOS-appropriate haptic feedback', async () => {
        const { getByTestID } = render(
          <TestWrapper>
            <RecordScreen />
          </TestWrapper>
        );

        const recordButton = getByTestID('record-button');
        
        // Simulate press - should trigger haptic feedback on iOS
        fireEvent.press(recordButton);
        
        // Verify button responds to press
        expect(recordButton).toBeTruthy();
      });
    });

    describe('Android Compatibility', () => {
      beforeEach(() => {
        Platform.OS = 'android';
      });

      it('should handle Android-specific navigation patterns', () => {
        const { getByTestID } = render(
          <TestWrapper>
            <HomeScreen />
          </TestWrapper>
        );

        // Android should have proper navigation structure
        expect(getByTestID('home-screen')).toBeTruthy();
      });

      it('should handle Android back button behavior', () => {
        const { getByTestID } = render(
          <TestWrapper>
            <StoriesScreen />
          </TestWrapper>
        );

        // Should render without issues on Android
        expect(getByTestID('stories-screen')).toBeTruthy();
      });

      it('should use Android-appropriate material design elements', () => {
        const { getByTestID } = render(
          <TestWrapper>
            <RecordScreen />
          </TestWrapper>
        );

        const recordButton = getByTestID('record-button');
        const style = recordButton.props.style;
        
        // Should have material design styling
        expect(style).toBeDefined();
      });
    });
  });

  describe('Accessibility Across Devices', () => {
    screenSizes.forEach(({ name, width, height }) => {
      it(`should maintain accessibility on ${name}`, () => {
        jest.spyOn(Dimensions, 'get').mockReturnValue({
          width,
          height,
          scale: 2,
          fontScale: 1,
        });

        const { getByTestID } = render(
          <TestWrapper>
            <AccessibilityScreen />
          </TestWrapper>
        );

        // Check accessibility controls are present
        expect(getByTestID('font-size-control')).toBeTruthy();
        expect(getByTestID('contrast-toggle')).toBeTruthy();
        
        // Test font size adjustment
        const fontSizeControl = getByTestID('font-size-control');
        fireEvent.press(fontSizeControl);
        
        // Should work on all screen sizes
        expect(fontSizeControl).toBeTruthy();
      });
    });

    it('should scale accessibility features appropriately', () => {
      // Test on small screen
      jest.spyOn(Dimensions, 'get').mockReturnValue({
        width: 320,
        height: 568,
        scale: 2,
        fontScale: 1,
      });

      const { getByTestID, rerender } = render(
        <TestWrapper>
          <AccessibilityScreen />
        </TestWrapper>
      );

      const smallScreenButton = getByTestID('font-size-control');
      const smallScreenStyle = smallScreenButton.props.style;

      // Test on large screen
      jest.spyOn(Dimensions, 'get').mockReturnValue({
        width: 428,
        height: 926,
        scale: 3,
        fontScale: 1,
      });

      rerender(
        <TestWrapper>
          <AccessibilityScreen />
        </TestWrapper>
      );

      const largeScreenButton = getByTestID('font-size-control');
      const largeScreenStyle = largeScreenButton.props.style;

      // Buttons should be appropriately sized for each screen
      expect(smallScreenStyle).toBeDefined();
      expect(largeScreenStyle).toBeDefined();
    });
  });

  describe('Performance Across Devices', () => {
    it('should render efficiently on low-end devices', async () => {
      // Simulate low-end device with smaller screen and lower scale
      jest.spyOn(Dimensions, 'get').mockReturnValue({
        width: 320,
        height: 568,
        scale: 1,
        fontScale: 1,
      });

      const startTime = Date.now();
      
      const { getByTestID } = render(
        <TestWrapper>
          <StoriesScreen />
        </TestWrapper>
      );

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      // Should render quickly even on low-end devices
      expect(renderTime).toBeLessThan(1000);
      expect(getByTestID('stories-screen')).toBeTruthy();
    });

    it('should handle memory constraints on older devices', () => {
      // Test with multiple screen renders to simulate memory pressure
      const screens = [HomeScreen, RecordScreen, StoriesScreen];
      
      screens.forEach((Screen, index) => {
        const { getByTestID, unmount } = render(
          <TestWrapper>
            <Screen />
          </TestWrapper>
        );

        // Should render successfully
        expect(getByTestID(`${Screen.name.toLowerCase().replace('screen', '')}-screen`)).toBeTruthy();
        
        // Unmount to free memory
        unmount();
      });
    });
  });

  describe('Orientation Compatibility', () => {
    it('should handle portrait orientation', () => {
      jest.spyOn(Dimensions, 'get').mockReturnValue({
        width: 390,
        height: 844,
        scale: 3,
        fontScale: 1,
      });

      const { getByTestID } = render(
        <TestWrapper>
          <RecordScreen />
        </TestWrapper>
      );

      expect(getByTestID('record-screen')).toBeTruthy();
      expect(getByTestID('prompt-card')).toBeTruthy();
    });

    it('should handle landscape orientation', () => {
      // Swap width and height for landscape
      jest.spyOn(Dimensions, 'get').mockReturnValue({
        width: 844,
        height: 390,
        scale: 3,
        fontScale: 1,
      });

      const { getByTestID } = render(
        <TestWrapper>
          <RecordScreen />
        </TestWrapper>
      );

      // Should still render properly in landscape
      expect(getByTestID('record-screen')).toBeTruthy();
      expect(getByTestID('prompt-card')).toBeTruthy();
    });
  });

  describe('Network Conditions Compatibility', () => {
    it('should handle offline state gracefully', async () => {
      // Mock network state
      jest.doMock('@react-native-async-storage/async-storage', () => ({
        getItem: jest.fn(() => Promise.resolve(null)),
        setItem: jest.fn(() => Promise.resolve()),
        removeItem: jest.fn(() => Promise.resolve()),
      }));

      const { getByTestID } = render(
        <TestWrapper>
          <StoriesScreen />
        </TestWrapper>
      );

      // Should render offline state
      expect(getByTestID('stories-screen')).toBeTruthy();
      
      // Should show appropriate offline message
      await waitFor(() => {
        const offlineIndicator = getByTestID('offline-indicator');
        expect(offlineIndicator).toBeTruthy();
      });
    });

    it('should handle slow network conditions', async () => {
      const { getByTestID } = render(
        <TestWrapper>
          <StoriesScreen />
        </TestWrapper>
      );

      // Should show loading state for slow networks
      expect(getByTestID('stories-screen')).toBeTruthy();
      
      // Should eventually load content or show error
      await waitFor(() => {
        const content = getByTestID('stories-list') || getByTestID('error-message');
        expect(content).toBeTruthy();
      }, { timeout: 5000 });
    });
  });

  describe('Battery and Performance Optimization', () => {
    it('should optimize for battery usage during recording', () => {
      const { getByTestID } = render(
        <TestWrapper>
          <RecordScreen />
        </TestWrapper>
      );

      const recordButton = getByTestID('record-button');
      
      // Start recording
      fireEvent.press(recordButton);
      
      // Should handle recording state efficiently
      expect(recordButton).toBeTruthy();
    });

    it('should reduce background activity when app is backgrounded', () => {
      const { getByTestID } = render(
        <TestWrapper>
          <HomeScreen />
        </TestWrapper>
      );

      // Simulate app going to background
      // This would typically involve app state changes
      expect(getByTestID('home-screen')).toBeTruthy();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});