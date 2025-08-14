import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Utility functions for accessibility support
 */

/**
 * Announces text to screen readers
 * @param message - The message to announce
 * @param options - Additional options for the announcement
 */
export function announceForAccessibility(
  message: string,
  options?: {
    queue?: boolean; // Whether to queue the announcement or interrupt current ones
  }
): void {
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibility(message);
  } else if (Platform.OS === 'android') {
    // On Android, we can use the same method
    AccessibilityInfo.announceForAccessibility(message);
  }
}

/**
 * Sets focus to a specific element for screen readers
 * @param reactTag - The react tag of the element to focus
 */
export function setAccessibilityFocus(reactTag: number): void {
  AccessibilityInfo.setAccessibilityFocus(reactTag);
}

/**
 * Checks if screen reader is currently enabled
 * @returns Promise that resolves to boolean indicating if screen reader is enabled
 */
export async function isScreenReaderEnabled(): Promise<boolean> {
  try {
    return await AccessibilityInfo.isScreenReaderEnabled();
  } catch (error) {
    console.warn('Failed to check screen reader status:', error);
    return false;
  }
}

/**
 * Checks if reduce motion is enabled
 * @returns Promise that resolves to boolean indicating if reduce motion is enabled
 */
export async function isReduceMotionEnabled(): Promise<boolean> {
  try {
    return await AccessibilityInfo.isReduceMotionEnabled();
  } catch (error) {
    console.warn('Failed to check reduce motion status:', error);
    return false;
  }
}

/**
 * Generates accessible labels for common UI patterns
 */
export const AccessibilityLabels = {
  /**
   * Creates a label for a story item
   */
  storyItem: (title: string, date: string, hasInteractions: boolean = false): string => {
    let label = `Story: ${title}, recorded on ${date}`;
    if (hasInteractions) {
      label += ', has new messages';
    }
    return label;
  },

  /**
   * Creates a label for a recording button
   */
  recordButton: (isRecording: boolean): string => {
    return isRecording ? 'Stop recording' : 'Start recording';
  },

  /**
   * Creates a label for an audio player
   */
  audioPlayer: (isPlaying: boolean, duration?: string): string => {
    let label = isPlaying ? 'Pause audio' : 'Play audio';
    if (duration) {
      label += `, duration ${duration}`;
    }
    return label;
  },

  /**
   * Creates a label for a message item
   */
  messageItem: (type: 'comment' | 'followup', content: string, isAnswered?: boolean): string => {
    let label = type === 'comment' ? 'Comment: ' : 'Follow-up question: ';
    label += content;
    if (type === 'followup' && isAnswered !== undefined) {
      label += isAnswered ? ', answered' : ', needs answer';
    }
    return label;
  },

  /**
   * Creates a label for navigation buttons
   */
  navigation: (destination: string): string => {
    return `Navigate to ${destination}`;
  },
};

/**
 * Accessibility hints for common UI patterns
 */
export const AccessibilityHints = {
  storyItem: 'Tap to view story details and interactions',
  recordButton: 'Press and hold to record your story',
  audioPlayer: 'Tap to play or pause the audio recording',
  messageItem: 'Tap to view full message and respond',
  searchInput: 'Type to search through your stories',
  fontSizeOption: 'Tap to change the app font size',
  contrastToggle: 'Toggle high contrast mode for better visibility',
};

/**
 * Creates accessibility props for common components
 */
export const createAccessibilityProps = {
  /**
   * Creates props for a button component
   */
  button: (
    label: string,
    hint?: string,
    disabled: boolean = false,
    loading: boolean = false
  ) => ({
    accessibilityRole: 'button' as const,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityState: {
      disabled: disabled || loading,
      busy: loading,
    },
  }),

  /**
   * Creates props for a text input component
   */
  textInput: (
    label: string,
    hint?: string,
    required: boolean = false,
    error?: string
  ) => {
    let accessibilityLabel = label;
    if (required) accessibilityLabel += ', required';
    if (error) accessibilityLabel += `, error: ${error}`;

    return {
      accessibilityRole: 'text' as const,
      accessibilityLabel,
      accessibilityHint: hint,
      accessibilityState: {
        invalid: !!error,
      },
    };
  },

  /**
   * Creates props for a switch/toggle component
   */
  switch: (
    label: string,
    isOn: boolean,
    hint?: string
  ) => ({
    accessibilityRole: 'switch' as const,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityState: {
      checked: isOn,
    },
  }),

  /**
   * Creates props for a list item
   */
  listItem: (
    label: string,
    hint?: string,
    selected: boolean = false
  ) => ({
    accessibilityRole: 'button' as const,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityState: {
      selected,
    },
  }),
};

/**
 * Validates if a tap target meets minimum size requirements
 * @param width - Width of the tap target
 * @param height - Height of the tap target
 * @returns boolean indicating if the tap target is accessible
 */
export function isAccessibleTapTarget(width: number, height: number): boolean {
  const MIN_SIZE = 44; // 44dp minimum as per WCAG guidelines
  return width >= MIN_SIZE && height >= MIN_SIZE;
}

/**
 * Calculates the contrast ratio between two colors
 * @param color1 - First color in hex format
 * @param color2 - Second color in hex format
 * @returns Contrast ratio (1-21)
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  // Simple implementation - in a real app, you'd use a more sophisticated algorithm
  // This is a placeholder that returns a reasonable value
  const luminance1 = getLuminance(color1);
  const luminance2 = getLuminance(color2);
  
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Gets the relative luminance of a color
 * @param color - Color in hex format
 * @returns Relative luminance (0-1)
 */
function getLuminance(color: string): number {
  // Remove # if present
  const hex = color.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  // Apply gamma correction
  const rs = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gs = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bs = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  
  // Calculate luminance
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Checks if a color combination meets WCAG AA contrast requirements
 * @param foreground - Foreground color in hex format
 * @param background - Background color in hex format
 * @param isLargeText - Whether the text is considered large (18pt+ or 14pt+ bold)
 * @returns boolean indicating if the contrast is sufficient
 */
export function meetsContrastRequirements(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = calculateContrastRatio(foreground, background);
  const requiredRatio = isLargeText ? 3 : 4.5; // WCAG AA requirements
  return ratio >= requiredRatio;
}