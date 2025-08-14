import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo } from 'react-native';

import { AccessibilityProvider, useAccessibility, FontSize, ContrastMode } from '../AccessibilityContext';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock AccessibilityInfo
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  AccessibilityInfo: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    isScreenReaderEnabled: jest.fn(() => Promise.resolve(false)),
    isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)),
  },
  Appearance: {
    addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockAccessibilityInfo = AccessibilityInfo as jest.Mocked<typeof AccessibilityInfo>;

// Test component that uses the accessibility context
function TestComponent() {
  const {
    fontSize,
    contrastMode,
    isScreenReaderEnabled,
    isReduceMotionEnabled,
    setFontSize,
    setContrastMode,
    resetToDefaults,
    isLoading,
  } = useAccessibility();

  return (
    <View>
      <Text testID="font-size">{fontSize}</Text>
      <Text testID="contrast-mode">{contrastMode}</Text>
      <Text testID="screen-reader">{isScreenReaderEnabled.toString()}</Text>
      <Text testID="reduce-motion">{isReduceMotionEnabled.toString()}</Text>
      <Text testID="loading">{isLoading.toString()}</Text>
      <Text testID="set-font-large" onPress={() => setFontSize('large')}>
        Set Large Font
      </Text>
      <Text testID="set-high-contrast" onPress={() => setContrastMode('high')}>
        Set High Contrast
      </Text>
      <Text testID="reset" onPress={resetToDefaults}>
        Reset
      </Text>
    </View>
  );
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AccessibilityProvider>{children}</AccessibilityProvider>;
}

describe('AccessibilityContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAccessibilityInfo.isScreenReaderEnabled.mockResolvedValue(false);
    mockAccessibilityInfo.isReduceMotionEnabled.mockResolvedValue(false);
  });

  it('provides default accessibility settings', async () => {
    const { getByTestID } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestID('font-size').children[0]).toBe('standard');
      expect(getByTestID('contrast-mode').children[0]).toBe('normal');
      expect(getByTestID('screen-reader').children[0]).toBe('false');
      expect(getByTestID('reduce-motion').children[0]).toBe('false');
      expect(getByTestID('loading').children[0]).toBe('false');
    });
  });

  it('loads settings from AsyncStorage on initialization', async () => {
    const storedSettings = {
      fontSize: 'large',
      contrastMode: 'high',
    };
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(storedSettings));

    const { getByTestID } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestID('font-size').children[0]).toBe('large');
      expect(getByTestID('contrast-mode').children[0]).toBe('high');
    });

    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@saga_accessibility_settings');
  });

  it('updates font size and saves to storage', async () => {
    const { getByTestID } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestID('loading').children[0]).toBe('false');
    });

    act(() => {
      getByTestID('set-font-large').props.onPress();
    });

    await waitFor(() => {
      expect(getByTestID('font-size').children[0]).toBe('large');
    });

    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      '@saga_accessibility_settings',
      JSON.stringify({
        fontSize: 'large',
        contrastMode: 'normal',
        isScreenReaderEnabled: false,
        isReduceMotionEnabled: false,
      })
    );
  });

  it('updates contrast mode and saves to storage', async () => {
    const { getByTestID } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestID('loading').children[0]).toBe('false');
    });

    act(() => {
      getByTestID('set-high-contrast').props.onPress();
    });

    await waitFor(() => {
      expect(getByTestID('contrast-mode').children[0]).toBe('high');
    });

    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      '@saga_accessibility_settings',
      JSON.stringify({
        fontSize: 'standard',
        contrastMode: 'high',
        isScreenReaderEnabled: false,
        isReduceMotionEnabled: false,
      })
    );
  });

  it('resets to default settings', async () => {
    // Start with custom settings
    const storedSettings = {
      fontSize: 'extraLarge',
      contrastMode: 'high',
    };
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(storedSettings));

    const { getByTestID } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestID('font-size').children[0]).toBe('extraLarge');
      expect(getByTestID('contrast-mode').children[0]).toBe('high');
    });

    act(() => {
      getByTestID('reset').props.onPress();
    });

    await waitFor(() => {
      expect(getByTestID('font-size').children[0]).toBe('standard');
      expect(getByTestID('contrast-mode').children[0]).toBe('normal');
    });

    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      '@saga_accessibility_settings',
      JSON.stringify({
        fontSize: 'standard',
        contrastMode: 'normal',
        isScreenReaderEnabled: false,
        isReduceMotionEnabled: false,
      })
    );
  });

  it('detects system screen reader settings', async () => {
    mockAccessibilityInfo.isScreenReaderEnabled.mockResolvedValue(true);

    const { getByTestID } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestID('screen-reader').children[0]).toBe('true');
    });
  });

  it('detects system reduce motion settings', async () => {
    mockAccessibilityInfo.isReduceMotionEnabled.mockResolvedValue(true);

    const { getByTestID } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestID('reduce-motion').children[0]).toBe('true');
    });
  });

  it('handles AsyncStorage errors gracefully', async () => {
    mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { getByTestID } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestID('font-size').children[0]).toBe('standard');
      expect(getByTestID('loading').children[0]).toBe('false');
    });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to load accessibility settings:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('handles save errors gracefully', async () => {
    mockAsyncStorage.setItem.mockRejectedValue(new Error('Save error'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { getByTestID } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestID('loading').children[0]).toBe('false');
    });

    act(() => {
      getByTestID('set-font-large').props.onPress();
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save accessibility settings:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('listens for accessibility changes', async () => {
    const mockScreenReaderListener = jest.fn();
    const mockReduceMotionListener = jest.fn();
    
    mockAccessibilityInfo.addEventListener
      .mockImplementationOnce((event, callback) => {
        if (event === 'screenReaderChanged') {
          mockScreenReaderListener.mockImplementation(callback);
        }
        return { remove: jest.fn() };
      })
      .mockImplementationOnce((event, callback) => {
        if (event === 'reduceMotionChanged') {
          mockReduceMotionListener.mockImplementation(callback);
        }
        return { remove: jest.fn() };
      });

    const { getByTestID } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestID('loading').children[0]).toBe('false');
    });

    // Simulate screen reader being enabled
    act(() => {
      mockScreenReaderListener(true);
    });

    await waitFor(() => {
      expect(getByTestID('screen-reader').children[0]).toBe('true');
    });

    // Simulate reduce motion being enabled
    act(() => {
      mockReduceMotionListener(true);
    });

    await waitFor(() => {
      expect(getByTestID('reduce-motion').children[0]).toBe('true');
    });
  });

  it('throws error when used outside provider', () => {
    const TestComponentWithoutProvider = () => {
      useAccessibility();
      return <Text>Test</Text>;
    };

    expect(() => {
      render(<TestComponentWithoutProvider />);
    }).toThrow('useAccessibility must be used within an AccessibilityProvider');
  });
});