import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAccessibleTheme, createAccessibleInputStyle } from '../../hooks/useAccessibleTheme';

interface AccessibleTextInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  required?: boolean;
  testID?: string;
}

export const AccessibleTextInput = forwardRef<TextInput, AccessibleTextInputProps>(
  ({
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    onRightIconPress,
    containerStyle,
    inputStyle,
    labelStyle,
    required = false,
    testID,
    ...textInputProps
  }, ref) => {
    const theme = useAccessibleTheme();
    const [isFocused, setIsFocused] = useState(false);
    
    const baseInputStyle = createAccessibleInputStyle(theme);
    
    const containerStyles = [
      styles.container,
      containerStyle,
    ];

    const inputContainerStyles = [
      styles.inputContainer,
      baseInputStyle,
      {
        borderColor: error 
          ? theme.colors.error 
          : isFocused 
            ? theme.colors.primary 
            : theme.colors.border,
        borderWidth: isFocused ? 2 : 1,
      },
      leftIcon && { paddingLeft: theme.spacing.xl + theme.spacing.md },
      rightIcon && { paddingRight: theme.spacing.xl + theme.spacing.md },
    ];

    const textInputStyles = [
      {
        flex: 1,
        fontSize: theme.fontSizes.base,
        color: theme.colors.text,
        minHeight: theme.minTapTarget - (theme.spacing.sm * 2), // Account for padding
      },
      inputStyle,
    ];

    const labelStyles = [
      styles.label,
      {
        fontSize: theme.fontSizes.sm,
        color: error ? theme.colors.error : theme.colors.text,
        marginBottom: theme.spacing.xs,
      },
      labelStyle,
    ];

    const getAccessibilityLabel = () => {
      let accessibilityLabel = label || textInputProps.placeholder || 'Text input';
      if (required) accessibilityLabel += ', required';
      if (error) accessibilityLabel += `, error: ${error}`;
      return accessibilityLabel;
    };

    const getAccessibilityHint = () => {
      if (helperText && !error) return helperText;
      if (textInputProps.accessibilityHint) return textInputProps.accessibilityHint;
      return undefined;
    };

    return (
      <View style={containerStyles}>
        {/* Label */}
        {label && (
          <Text style={labelStyles}>
            {label}
            {required && (
              <Text style={{ color: theme.colors.error }}> *</Text>
            )}
          </Text>
        )}

        {/* Input Container */}
        <View style={inputContainerStyles}>
          {/* Left Icon */}
          {leftIcon && (
            <View style={[styles.iconContainer, styles.leftIcon]}>
              <Ionicons
                name={leftIcon}
                size={20}
                color={error ? theme.colors.error : theme.colors.textSecondary}
              />
            </View>
          )}

          {/* Text Input */}
          <TextInput
            ref={ref}
            style={textInputStyles}
            placeholderTextColor={theme.colors.textSecondary}
            onFocus={(e) => {
              setIsFocused(true);
              textInputProps.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              textInputProps.onBlur?.(e);
            }}
            accessibilityLabel={getAccessibilityLabel()}
            accessibilityHint={getAccessibilityHint()}
            accessibilityState={{
              disabled: textInputProps.editable === false,
            }}
            testID={testID}
            {...textInputProps}
          />

          {/* Right Icon */}
          {rightIcon && (
            <View style={[styles.iconContainer, styles.rightIcon]}>
              <Ionicons
                name={rightIcon}
                size={20}
                color={error ? theme.colors.error : theme.colors.textSecondary}
                onPress={onRightIconPress}
                suppressHighlighting={!onRightIconPress}
              />
            </View>
          )}
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.messageContainer}>
            <Ionicons
              name="alert-circle"
              size={16}
              color={theme.colors.error}
              style={styles.messageIcon}
            />
            <Text
              style={[
                styles.messageText,
                {
                  fontSize: theme.fontSizes.sm,
                  color: theme.colors.error,
                }
              ]}
              accessibilityRole="alert"
            >
              {error}
            </Text>
          </View>
        )}

        {/* Helper Text */}
        {helperText && !error && (
          <Text
            style={[
              styles.helperText,
              {
                fontSize: theme.fontSizes.sm,
                color: theme.colors.textSecondary,
                marginTop: theme.spacing.xs,
              }
            ]}
          >
            {helperText}
          </Text>
        )}
      </View>
    );
  }
);

AccessibleTextInput.displayName = 'AccessibleTextInput';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  iconContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    zIndex: 1,
  },
  leftIcon: {
    left: 8,
  },
  rightIcon: {
    right: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  messageIcon: {
    marginRight: 6,
  },
  messageText: {
    flex: 1,
    lineHeight: 20,
  },
  helperText: {
    lineHeight: 20,
  },
});