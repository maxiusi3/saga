import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { AccessibleButton } from '../AccessibleButton';
import { AccessibilityProvider } from '../../../contexts/AccessibilityContext';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AccessibilityProvider>{children}</AccessibilityProvider>;
}

describe('AccessibleButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders button with title', () => {
    const { getByText } = render(
      <TestWrapper>
        <AccessibleButton title="Test Button" onPress={mockOnPress} />
      </TestWrapper>
    );

    expect(getByText('Test Button')).toBeTruthy();
  });

  it('handles press events', () => {
    const { getByText } = render(
      <TestWrapper>
        <AccessibleButton title="Test Button" onPress={mockOnPress} />
      </TestWrapper>
    );

    fireEvent.press(getByText('Test Button'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('renders with different variants', () => {
    const { getByText, rerender } = render(
      <TestWrapper>
        <AccessibleButton title="Primary" onPress={mockOnPress} variant="primary" />
      </TestWrapper>
    );

    expect(getByText('Primary')).toBeTruthy();

    rerender(
      <TestWrapper>
        <AccessibleButton title="Secondary" onPress={mockOnPress} variant="secondary" />
      </TestWrapper>
    );

    expect(getByText('Secondary')).toBeTruthy();

    rerender(
      <TestWrapper>
        <AccessibleButton title="Outline" onPress={mockOnPress} variant="outline" />
      </TestWrapper>
    );

    expect(getByText('Outline')).toBeTruthy();

    rerender(
      <TestWrapper>
        <AccessibleButton title="Danger" onPress={mockOnPress} variant="danger" />
      </TestWrapper>
    );

    expect(getByText('Danger')).toBeTruthy();
  });

  it('renders with different sizes', () => {
    const { getByText, rerender } = render(
      <TestWrapper>
        <AccessibleButton title="Small" onPress={mockOnPress} size="small" />
      </TestWrapper>
    );

    expect(getByText('Small')).toBeTruthy();

    rerender(
      <TestWrapper>
        <AccessibleButton title="Medium" onPress={mockOnPress} size="medium" />
      </TestWrapper>
    );

    expect(getByText('Medium')).toBeTruthy();

    rerender(
      <TestWrapper>
        <AccessibleButton title="Large" onPress={mockOnPress} size="large" />
      </TestWrapper>
    );

    expect(getByText('Large')).toBeTruthy();
  });

  it('handles disabled state', () => {
    const { getByText } = render(
      <TestWrapper>
        <AccessibleButton title="Disabled" onPress={mockOnPress} disabled />
      </TestWrapper>
    );

    const button = getByText('Disabled').parent;
    fireEvent.press(button);
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('handles loading state', () => {
    const { getByText } = render(
      <TestWrapper>
        <AccessibleButton title="Loading" onPress={mockOnPress} loading />
      </TestWrapper>
    );

    expect(getByText('Loading...')).toBeTruthy();
    
    const button = getByText('Loading...').parent;
    fireEvent.press(button);
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('renders with icon', () => {
    const { getByText } = render(
      <TestWrapper>
        <AccessibleButton title="With Icon" onPress={mockOnPress} icon="home" />
      </TestWrapper>
    );

    expect(getByText('With Icon')).toBeTruthy();
    // Icon would be rendered as an Ionicons component
  });

  it('renders icon in different positions', () => {
    const { getByText, rerender } = render(
      <TestWrapper>
        <AccessibleButton 
          title="Left Icon" 
          onPress={mockOnPress} 
          icon="home" 
          iconPosition="left" 
        />
      </TestWrapper>
    );

    expect(getByText('Left Icon')).toBeTruthy();

    rerender(
      <TestWrapper>
        <AccessibleButton 
          title="Right Icon" 
          onPress={mockOnPress} 
          icon="home" 
          iconPosition="right" 
        />
      </TestWrapper>
    );

    expect(getByText('Right Icon')).toBeTruthy();
  });

  it('provides proper accessibility properties', () => {
    const { getByLabelText } = render(
      <TestWrapper>
        <AccessibleButton 
          title="Accessible Button" 
          onPress={mockOnPress}
          accessibilityLabel="Custom accessibility label"
          accessibilityHint="Custom accessibility hint"
          testID="test-button"
        />
      </TestWrapper>
    );

    const button = getByLabelText('Custom accessibility label');
    expect(button).toBeTruthy();
    expect(button.props.accessibilityHint).toBe('Custom accessibility hint');
    expect(button.props.testID).toBe('test-button');
  });

  it('uses title as accessibility label when no custom label provided', () => {
    const { getByLabelText } = render(
      <TestWrapper>
        <AccessibleButton title="Default Label" onPress={mockOnPress} />
      </TestWrapper>
    );

    expect(getByLabelText('Default Label')).toBeTruthy();
  });

  it('sets proper accessibility states', () => {
    const { getByLabelText, rerender } = render(
      <TestWrapper>
        <AccessibleButton title="Normal Button" onPress={mockOnPress} />
      </TestWrapper>
    );

    let button = getByLabelText('Normal Button');
    expect(button.props.accessibilityState.disabled).toBe(false);
    expect(button.props.accessibilityState.busy).toBe(false);

    rerender(
      <TestWrapper>
        <AccessibleButton title="Disabled Button" onPress={mockOnPress} disabled />
      </TestWrapper>
    );

    button = getByLabelText('Disabled Button');
    expect(button.props.accessibilityState.disabled).toBe(true);

    rerender(
      <TestWrapper>
        <AccessibleButton title="Loading Button" onPress={mockOnPress} loading />
      </TestWrapper>
    );

    button = getByLabelText('Loading Button');
    expect(button.props.accessibilityState.busy).toBe(true);
  });

  it('renders full width when specified', () => {
    const { getByLabelText } = render(
      <TestWrapper>
        <AccessibleButton title="Full Width" onPress={mockOnPress} fullWidth />
      </TestWrapper>
    );

    const button = getByLabelText('Full Width');
    expect(button.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: '100%' })
      ])
    );
  });

  it('applies custom styles', () => {
    const customStyle = { backgroundColor: 'red' };
    const customTextStyle = { fontSize: 20 };

    const { getByLabelText } = render(
      <TestWrapper>
        <AccessibleButton 
          title="Custom Style" 
          onPress={mockOnPress}
          style={customStyle}
          textStyle={customTextStyle}
        />
      </TestWrapper>
    );

    const button = getByLabelText('Custom Style');
    expect(button.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining(customStyle)
      ])
    );
  });
});