import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  AccessibilityRole,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAccessibleTheme, createAccessibleButtonStyle } from '../../hooks/useAccessibleTheme';

interface AccessibleButtonProps {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  fullWidth?: boolean;
}

export function AccessibleButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  testID,
  fullWidth = false,
}: AccessibleButtonProps) {
  const theme = useAccessibleTheme();
  
  // Get base button style from theme
  const baseButtonStyle = createAccessibleButtonStyle(theme, variant === 'danger' ? 'outline' : variant);
  
  // Size adjustments
  const sizeStyles = {
    small: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      minHeight: theme.minTapTarget * 0.8,
    },
    medium: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      minHeight: theme.minTapTarget,
    },
    large: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
      minHeight: theme.minTapTarget * 1.2,
    },
  };

  // Color variants
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: disabled ? theme.colors.disabled : theme.colors.primary,
          borderColor: disabled ? theme.colors.disabled : theme.colors.primary,
        };
      case 'secondary':
        return {
          backgroundColor: disabled ? theme.colors.disabled : theme.colors.secondary,
          borderColor: disabled ? theme.colors.disabled : theme.colors.secondary,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: disabled ? theme.colors.disabled : theme.colors.primary,
          borderWidth: 2,
        };
      case 'danger':
        return {
          backgroundColor: 'transparent',
          borderColor: disabled ? theme.colors.disabled : theme.colors.error,
          borderWidth: 2,
        };
      default:
        return {};
    }
  };

  const getTextColor = () => {
    if (disabled) return theme.colors.disabled;
    
    switch (variant) {
      case 'primary':
      case 'secondary':
        return '#ffffff';
      case 'outline':
        return theme.colors.primary;
      case 'danger':
        return theme.colors.error;
      default:
        return theme.colors.text;
    }
  };

  const getIconColor = () => {
    return getTextColor();
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return theme.fontSizes.sm;
      case 'medium':
        return theme.fontSizes.base;
      case 'large':
        return theme.fontSizes.lg;
      default:
        return theme.fontSizes.base;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'medium':
        return 20;
      case 'large':
        return 24;
      default:
        return 20;
    }
  };

  const buttonStyle = [
    baseButtonStyle,
    sizeStyles[size],
    getVariantStyles(),
    fullWidth && { width: '100%' },
    disabled && { opacity: 0.6 },
    loading && { opacity: 0.8 },
    style,
  ];

  const buttonTextStyle = [
    {
      fontSize: getFontSize(),
      fontWeight: '600' as const,
      color: getTextColor(),
    },
    textStyle,
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <Text style={buttonTextStyle}>
          Loading...
        </Text>
      );
    }

    if (icon) {
      const iconElement = (
        <Ionicons 
          name={icon} 
          size={getIconSize()} 
          color={getIconColor()} 
        />
      );

      return (
        <React.Fragment>
          {iconPosition === 'left' && iconElement}
          <Text style={[
            buttonTextStyle,
            icon && { 
              marginLeft: iconPosition === 'left' ? theme.spacing.xs : 0,
              marginRight: iconPosition === 'right' ? theme.spacing.xs : 0,
            }
          ]}>
            {title}
          </Text>
          {iconPosition === 'right' && iconElement}
        </React.Fragment>
      );
    }

    return <Text style={buttonTextStyle}>{title}</Text>;
  };

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
      }}
      testID={testID}
      activeOpacity={0.7}
    >
      {renderContent()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Additional styles can be added here if needed
});