import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { AccessibilityScreen } from '../AccessibilityScreen';
import { AccessibilityProvider, useAccessibility } from '../../../contexts/AccessibilityContext';

// Mock the accessibility context
const mockSetFontSize = jest.fn();
const mockSetContrastMode = jest.fn();
const mockResetToDefaults = jest.fn();

jest.mock('../../../contexts/AccessibilityContext', () => ({
  ...jest.requireActual('../../../contexts/AccessibilityContext'),
  useAccessibility: jest.fn(),
  AccessibilityProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseAccessibility = useAccessibility as jest.MockedFunction<typeof useAccessibility>;

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock accessibility analytics
jest.mock('../../../services/accessibility-analytics', () => ({
  AccessibilityAnalytics: {
    trackSettingsScreenOpened: jest.fn(),
  },
}));

// Mock navigation
const mockGoBack = jest.fn();
const mockNavigation = {
  goBack: mockGoBack,
};

const Stack = createStackNavigator();

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NavigationContainer>
      <AccessibilityProvider>
        <Stack.Navigator>
          <Stack.Screen name="Accessibility" component={() => <>{children}</>} />
        </Stack.Navigator>
      </AccessibilityProvider>
    </NavigationContainer>
  );
}

describe('AccessibilityScreen', () => {
  const mockAccessibilityState = {
    fontSize: 'standard' as const,
    contrastMode: 'normal' as const,
    isScreenReaderEnabled: false,
    isReduceMotionEnabled: false,
    setFontSize: mockSetFontSize,
    setContrastMode: mockSetContrastMode,
    resetToDefaults: mockResetToDefaults,
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAccessibility.mockReturnValue(mockAccessibilityState);
  });

  it('renders accessibility settings correctly', () => {
    const { getByText, getByTestID } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    expect(getByText('Accessibility')).toBeTruthy();
    expect(getByText('Font Size')).toBeTruthy();
    expect(getByText('Choose a comfortable text size for reading')).toBeTruthy();
    expect(getByText('High Contrast')).toBeTruthy();
    expect(getByText('Increase contrast for better visibility')).toBeTruthy();
    expect(getByTestID('font-size-setting')).toBeTruthy();
    expect(getByTestID('contrast-setting')).toBeTruthy();
  });

  it('displays current font size selection', () => {
    mockUseAccessibility.mockReturnValue({
      ...mockAccessibilityState,
      fontSize: 'large',
    });

    const { getByText } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    // The large font size option should be selected (would have different styling)
    expect(getByText('Large')).toBeTruthy();
  });

  it('displays current contrast mode', () => {
    mockUseAccessibility.mockReturnValue({
      ...mockAccessibilityState,
      contrastMode: 'high',
    });

    const { getByTestID } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    const contrastSwitch = getByTestID('contrast-setting').findByType('Switch');
    expect(contrastSwitch.props.value).toBe(true);
  });

  it('handles font size changes', async () => {
    const { getByText } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    fireEvent.press(getByText('Large'));

    expect(mockSetFontSize).toHaveBeenCalledWith('large');
  });

  it('handles contrast mode changes', async () => {
    const { getByTestID } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    const contrastSwitch = getByTestID('contrast-setting').findByType('Switch');
    fireEvent(contrastSwitch, 'valueChange', true);

    expect(mockSetContrastMode).toHaveBeenCalledWith('high');
  });

  it('shows screen reader status when enabled', () => {
    mockUseAccessibility.mockReturnValue({
      ...mockAccessibilityState,
      isScreenReaderEnabled: true,
    });

    const { getByText } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    expect(getByText('Screen reader is enabled')).toBeTruthy();
  });

  it('handles back button press', () => {
    const { getByLabelText } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    fireEvent.press(getByLabelText('Go back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('handles reset to defaults', async () => {
    const { getByText } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    fireEvent.press(getByText('Reset to Defaults'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Reset Settings',
        'Are you sure you want to reset all accessibility settings to their default values?',
        expect.arrayContaining([
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reset',
            style: 'destructive',
            onPress: expect.any(Function),
          },
        ])
      );
    });

    // Simulate user confirming reset
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const resetCallback = alertCall[2][1].onPress;
    resetCallback();

    expect(mockResetToDefaults).toHaveBeenCalled();
  });

  it('shows accessibility tips', () => {
    const { getByText } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    expect(getByText('Accessibility Tips')).toBeTruthy();
    expect(getByText(/All buttons and interactive elements are designed to be at least 44 points/)).toBeTruthy();
    expect(getByText(/Voice prompts can be played aloud/)).toBeTruthy();
    expect(getByText(/Use simple gestures/)).toBeTruthy();
  });

  it('shows system settings information', () => {
    const { getByText } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    expect(getByText('System Settings')).toBeTruthy();
    expect(getByText(/Screen reader and reduce motion settings are automatically detected/)).toBeTruthy();
  });

  it('provides proper accessibility labels and hints', () => {
    const { getByLabelText } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    expect(getByLabelText('Go back')).toBeTruthy();
    expect(getByLabelText('High contrast mode')).toBeTruthy();
    expect(getByLabelText('Reset all accessibility settings to defaults')).toBeTruthy();
  });

  it('handles font size changes with screen reader feedback', async () => {
    mockUseAccessibility.mockReturnValue({
      ...mockAccessibilityState,
      isScreenReaderEnabled: true,
    });

    const { getByText } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    fireEvent.press(getByText('Large'));

    expect(mockSetFontSize).toHaveBeenCalledWith('large');

    // Wait for the alert to be shown
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Font Size Changed',
        'Font size has been changed to Large',
        [{ text: 'OK' }]
      );
    });
  });

  it('handles contrast mode changes with screen reader feedback', async () => {
    mockUseAccessibility.mockReturnValue({
      ...mockAccessibilityState,
      isScreenReaderEnabled: true,
    });

    const { getByTestID } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    const contrastSwitch = getByTestID('contrast-setting').findByType('Switch');
    fireEvent(contrastSwitch, 'valueChange', true);

    expect(mockSetContrastMode).toHaveBeenCalledWith('high');

    // Wait for the alert to be shown
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Contrast Mode Changed',
        'Contrast mode has been changed to High Contrast',
        [{ text: 'OK' }]
      );
    });
  });

  it('displays all font size options', () => {
    const { getByText } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    expect(getByText('Standard')).toBeTruthy();
    expect(getByText('Large')).toBeTruthy();
    expect(getByText('Extra Large')).toBeTruthy();
  });

  it('provides proper accessibility states for font size options', () => {
    const { getByLabelText } = render(
      <TestWrapper>
        <AccessibilityScreen navigation={mockNavigation as any} />
      </TestWrapper>
    );

    expect(getByLabelText('Standard font size, selected')).toBeTruthy();
    expect(getByLabelText('Large font size')).toBeTruthy();
    expect(getByLabelText('Extra Large font size')).toBeTruthy();
  });
});