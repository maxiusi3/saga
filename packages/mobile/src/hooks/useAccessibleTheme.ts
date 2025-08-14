import { useMemo } from 'react';
import { useAccessibility, fontSizeMultipliers, highContrastColors, normalColors, MIN_TAP_TARGET_SIZE } from '../contexts/AccessibilityContext';

export interface AccessibleTheme {
  colors: typeof normalColors;
  fontSizes: {
    xs: number;
    sm: number;
    base: number;
    lg: number;
    xl: number;
    '2xl': number;
    '3xl': number;
    '4xl': number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    '2xl': number;
  };
  minTapTarget: number;
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  shadows: {
    sm: object;
    md: object;
    lg: object;
  };
}

const baseFontSizes = {
  xs: 10,
  sm: 12,
  base: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
};

const baseSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
};

const baseBorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
};

const baseShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};

export function useAccessibleTheme(): AccessibleTheme {
  const { fontSize, contrastMode } = useAccessibility();

  return useMemo(() => {
    const fontMultiplier = fontSizeMultipliers[fontSize];
    const colors = contrastMode === 'high' ? highContrastColors : normalColors;

    // Scale font sizes based on accessibility setting
    const fontSizes = Object.entries(baseFontSizes).reduce((acc, [key, value]) => {
      acc[key as keyof typeof baseFontSizes] = Math.round(value * fontMultiplier);
      return acc;
    }, {} as typeof baseFontSizes);

    // Adjust spacing for larger font sizes to maintain proportions
    const spacingMultiplier = fontSize === 'extraLarge' ? 1.2 : fontSize === 'large' ? 1.1 : 1;
    const spacing = Object.entries(baseSpacing).reduce((acc, [key, value]) => {
      acc[key as keyof typeof baseSpacing] = Math.round(value * spacingMultiplier);
      return acc;
    }, {} as typeof baseSpacing);

    // High contrast mode adjustments for shadows
    const shadows = contrastMode === 'high' 
      ? {
          sm: { ...baseShadows.sm, shadowOpacity: 0.3 },
          md: { ...baseShadows.md, shadowOpacity: 0.3 },
          lg: { ...baseShadows.lg, shadowOpacity: 0.4 },
        }
      : baseShadows;

    return {
      colors,
      fontSizes,
      spacing,
      minTapTarget: MIN_TAP_TARGET_SIZE,
      borderRadius: baseBorderRadius,
      shadows,
    };
  }, [fontSize, contrastMode]);
}

// Helper function to ensure minimum tap target size
export function ensureMinTapTarget(size: number): number {
  return Math.max(size, MIN_TAP_TARGET_SIZE);
}

// Helper function to get accessible text color based on background
export function getAccessibleTextColor(backgroundColor: string, theme: AccessibleTheme): string {
  // Simple contrast check - in a real app, you might use a more sophisticated algorithm
  if (theme.colors === highContrastColors) {
    return theme.colors.text;
  }
  
  // For normal mode, return appropriate text color based on background
  const lightBackgrounds = ['#ffffff', '#f9fafb', '#f3f4f6'];
  const isLightBackground = lightBackgrounds.includes(backgroundColor.toLowerCase());
  
  return isLightBackground ? theme.colors.text : '#ffffff';
}

// Helper function to create accessible button styles
export function createAccessibleButtonStyle(theme: AccessibleTheme, variant: 'primary' | 'secondary' | 'outline' = 'primary') {
  const baseStyle = {
    minHeight: theme.minTapTarget,
    minWidth: theme.minTapTarget,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    ...theme.shadows.sm,
  };

  switch (variant) {
    case 'primary':
      return {
        ...baseStyle,
        backgroundColor: theme.colors.primary,
      };
    case 'secondary':
      return {
        ...baseStyle,
        backgroundColor: theme.colors.secondary,
      };
    case 'outline':
      return {
        ...baseStyle,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: theme.colors.primary,
      };
    default:
      return baseStyle;
  }
}

// Helper function to create accessible text input styles
export function createAccessibleInputStyle(theme: AccessibleTheme) {
  return {
    minHeight: theme.minTapTarget,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    fontSize: theme.fontSizes.base,
    color: theme.colors.text,
  };
}