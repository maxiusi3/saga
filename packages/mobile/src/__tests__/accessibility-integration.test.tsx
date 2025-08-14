import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { AccessibilityProvider, useAccessibility } from '../contexts/AccessibilityContext';
import { useAccessibleTheme } from '../hooks/useAccessibleTheme';
import { AccessibleButton } from '../components/accessibility/AccessibleButton';
import { AccessibleTextInput } from '../components/accessibility/AccessibleTextInput';
import {
  announceForAccessibility,
  isAccessibleTapTarget,
  calculateContrastRatio,
  meetsContrastRequirements,
  AccessibilityLabels,
  AccessibilityHints,
} from '../utils/accessibility';

// Mock AccessibilityInfo
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  AccessibilityInfo: {
    announceForAccessibility: jest.fn(),
    setAccessibilityFocus: jest.fn(),
    isScreenReaderEnabled: jest.fn(() => Promise.resolve(false)),
    isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Appearance: {
    addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: {
    OS: 'ios',
  },
}));

// Test component that uses all accessibility features
function AccessibilityTestApp() {
  const { fontSize, contrastMode, setFontSize, setContrastMode } = useAccessibility();
  const theme = useAccessibleTheme();
  const [inputValue, setInputValue] = React.useState('');

  return (
    <>
      {/* Font size controls */}
      <AccessibleButton
        title="Standard Font"
        onPress={() => setFontSize('standard')}
        variant={fontSize === 'standard' ? 'primary' : 'outline'}
        testID="font-standard"
      />
      <AccessibleButton
        title="Large Font"
        onPress={() => setFontSize('large')}
        variant={fontSize === 'large' ? 'primary' : 'outline'}
        testID="font-large"
      />
      <AccessibleButton
        title="Extra Large Font"
        onPress={() => setFontSize('extraLarge')}
        variant={fontSize === 'extraLarge' ? 'primary' : 'outline'}
        testID="font-extra-large"
      />

      {/* Contrast mode toggle */}
      <AccessibleButton
        title={`Contrast: ${contrastMode}`}
        onPress={() => setContrastMode(contrastMode === 'normal' ? 'high' : 'normal')}
        testID="contrast-toggle"
      />

      {/* Text input with accessibility */}
      <AccessibleTextInput
        label="Test Input"
        value={inputValue}
        onChangeText={setInputValue}
        placeholder="Enter text here"
        testID="test-input"
        required
      />

      {/* Display current theme values */}
      <AccessibleButton
        title={`Font Size: ${theme.fontSizes.base}`}
        onPress={() => {}}
        testID="current-font-size"
      />
      <AccessibleButton
        title={`Min Tap Target: ${theme.minTapTarget}`}
        onPress={() => {}}
        testID="min-tap-target"
      />
    </>
  );
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AccessibilityProvider>{children}</AccessibilityProvider>;
}

describe('Accessibility Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Font Size Scaling', () => {
    it('scales font sizes correctly across different settings', async () => {
      const { getByTestID } = render(
        <TestWrapper>
          <AccessibilityTestApp />
        </TestWrapper>
      );

      // Start with standard font
      await waitFor(() => {
        expect(getByTestID('current-font-size')).toBeTruthy();
      });

      // Switch to large font
      fireEvent.press(getByTestID('font-large'));

      await waitFor(() => {
        // Font size should be scaled up (14 * 1.2 = 16.8, rounded to 17)
        const button = getByTestID('current-font-size');
        expect(button.children[0].children[0]).toContain('17');
      });

      // Switch to extra large font
      fireEvent.press(getByTestID('font-extra-large'));

      await waitFor(() => {
        // Font size should be scaled up more (14 * 1.5 = 21)
        const button = getByTestID('current-font-size');
        expect(button.children[0].children[0]).toContain('21');
      });
    });

    it('maintains minimum tap target sizes', async () => {
      const { getByTestID } = render(
        <TestWrapper>
          <AccessibilityTestApp />
        </TestWrapper>
      );

      await waitFor(() => {
        const minTapTargetButton = getByTestID('min-tap-target');
        expect(minTapTargetButton.children[0].children[0]).toContain('44');
      });
    });
  });

  describe('High Contrast Mode', () => {
    it('switches between normal and high contrast themes', async () => {
      const { getByTestID } = render(
        <TestWrapper>
          <AccessibilityTestApp />
        </TestWrapper>
      );

      // Start with normal contrast
      await waitFor(() => {
        const contrastButton = getByTestID('contrast-toggle');
        expect(contrastButton.children[0].children[0]).toContain('normal');
      });

      // Switch to high contrast
      fireEvent.press(getByTestID('contrast-toggle'));

      await waitFor(() => {
        const contrastButton = getByTestID('contrast-toggle');
        expect(contrastButton.children[0].children[0]).toContain('high');
      });
    });
  });

  describe('Accessibility Utilities', () => {
    it('validates tap target sizes correctly', () => {
      expect(isAccessibleTapTarget(44, 44)).toBe(true);
      expect(isAccessibleTapTarget(50, 50)).toBe(true);
      expect(isAccessibleTapTarget(40, 40)).toBe(false);
      expect(isAccessibleTapTarget(44, 30)).toBe(false);
    });

    it('calculates contrast ratios', () => {
      const ratio = calculateContrastRatio('#000000', '#ffffff');
      expect(ratio).toBeGreaterThan(1);
      
      const sameColorRatio = calculateContrastRatio('#000000', '#000000');
      expect(sameColorRatio).toBe(1);
    });

    it('validates contrast requirements', () => {
      // High contrast should pass
      expect(meetsContrastRequirements('#000000', '#ffffff')).toBe(true);
      expect(meetsContrastRequirements('#ffffff', '#000000')).toBe(true);
      
      // Low contrast should fail
      expect(meetsContrastRequirements('#cccccc', '#ffffff')).toBe(false);
    });

    it('generates appropriate accessibility labels', () => {
      const storyLabel = AccessibilityLabels.storyItem(
        'My Story',
        'Jan 15, 2024',
        true
      );
      expect(storyLabel).toContain('My Story');
      expect(storyLabel).toContain('Jan 15, 2024');
      expect(storyLabel).toContain('has new messages');

      const recordLabel = AccessibilityLabels.recordButton(true);
      expect(recordLabel).toBe('Stop recording');

      const playLabel = AccessibilityLabels.audioPlayer(false, '2:30');
      expect(playLabel).toContain('Play audio');
      expect(playLabel).toContain('2:30');
    });

    it('provides appropriate accessibility hints', () => {
      expect(AccessibilityHints.storyItem).toContain('Tap to view');
      expect(AccessibilityHints.recordButton).toContain('Press and hold');
      expect(AccessibilityHints.audioPlayer).toContain('Tap to play');
    });
  });

  describe('Screen Reader Integration', () => {
    it('announces messages for accessibility', () => {
      announceForAccessibility('Test announcement');
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Test announcement');
    });
  });

  describe('Component Accessibility', () => {
    it('provides proper accessibility props for buttons', async () => {
      const { getByTestID } = render(
        <TestWrapper>
          <AccessibilityTestApp />
        </TestWrapper>
      );

      const button = getByTestID('font-standard');
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe('Standard Font');
      expect(button.props.accessibilityState).toEqual({
        disabled: false,
        busy: false,
      });
    });

    it('provides proper accessibility props for text inputs', async () => {
      const { getByTestID } = render(
        <TestWrapper>
          <AccessibilityTestApp />
        </TestWrapper>
      );

      const input = getByTestID('test-input');
      expect(input.props.accessibilityLabel).toContain('Test Input');
      expect(input.props.accessibilityLabel).toContain('required');
    });
  });

  describe('Theme Consistency', () => {
    it('maintains consistent styling across font size changes', async () => {
      const { getByTestID } = render(
        <TestWrapper>
          <AccessibilityTestApp />
        </TestWrapper>
      );

      // Test that buttons maintain their styling when font size changes
      const standardButton = getByTestID('font-standard');
      const initialStyle = standardButton.props.style;

      fireEvent.press(getByTestID('font-large'));

      await waitFor(() => {
        const updatedButton = getByTestID('font-standard');
        // Style structure should remain consistent
        expect(Array.isArray(updatedButton.props.style)).toBe(Array.isArray(initialStyle));
      });
    });

    it('maintains consistent styling across contrast mode changes', async () => {
      const { getByTestID } = render(
        <TestWrapper>
          <AccessibilityTestApp />
        </TestWrapper>
      );

      const button = getByTestID('font-standard');
      const initialStyle = button.props.style;

      fireEvent.press(getByTestID('contrast-toggle'));

      await waitFor(() => {
        const updatedButton = getByTestID('font-standard');
        // Style structure should remain consistent
        expect(Array.isArray(updatedButton.props.style)).toBe(Array.isArray(initialStyle));
      });
    });
  });

  describe('Error Handling', () => {
    it('handles accessibility API errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Mock API failure
      (AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockRejectedValue(
        new Error('API Error')
      );

      const { isScreenReaderEnabled } = await import('../utils/accessibility');
      const result = await isScreenReaderEnabled();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to check screen reader status:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});