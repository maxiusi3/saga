import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo, Appearance } from 'react-native';
import { AccessibilityAnalytics } from '../services/accessibility-analytics';

export type FontSize = 'standard' | 'large' | 'extraLarge';
export type ContrastMode = 'normal' | 'high';

interface AccessibilitySettings {
  fontSize: FontSize;
  contrastMode: ContrastMode;
  isScreenReaderEnabled: boolean;
  isReduceMotionEnabled: boolean;
}

interface AccessibilityContextType extends AccessibilitySettings {
  setFontSize: (size: FontSize) => void;
  setContrastMode: (mode: ContrastMode) => void;
  resetToDefaults: () => void;
  isLoading: boolean;
}

const defaultSettings: AccessibilitySettings = {
  fontSize: 'standard',
  contrastMode: 'normal',
  isScreenReaderEnabled: false,
  isReduceMotionEnabled: false,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const STORAGE_KEY = '@saga_accessibility_settings';

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from storage on app start
  useEffect(() => {
    loadSettings();
  }, []);

  // Listen for system accessibility changes
  useEffect(() => {
    const screenReaderSubscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (isScreenReaderEnabled) => {
        setSettings(prev => ({ ...prev, isScreenReaderEnabled }));
        
        // Track analytics
        AccessibilityAnalytics.trackSystemAccessibilityDetected('screen_reader', isScreenReaderEnabled);
      }
    );

    const reduceMotionSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (isReduceMotionEnabled) => {
        setSettings(prev => ({ ...prev, isReduceMotionEnabled }));
        
        // Track analytics
        AccessibilityAnalytics.trackSystemAccessibilityDetected('reduce_motion', isReduceMotionEnabled);
      }
    );

    // Get initial accessibility states
    AccessibilityInfo.isScreenReaderEnabled().then((isScreenReaderEnabled) => {
      setSettings(prev => ({ ...prev, isScreenReaderEnabled }));
      
      // Track initial state
      AccessibilityAnalytics.trackSystemAccessibilityDetected('screen_reader', isScreenReaderEnabled);
    });

    AccessibilityInfo.isReduceMotionEnabled().then((isReduceMotionEnabled) => {
      setSettings(prev => ({ ...prev, isReduceMotionEnabled }));
      
      // Track initial state
      AccessibilityAnalytics.trackSystemAccessibilityDetected('reduce_motion', isReduceMotionEnabled);
    });

    return () => {
      screenReaderSubscription?.remove();
      reduceMotionSubscription?.remove();
    };
  }, []);

  // Auto-detect high contrast mode from system settings
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      // On some devices, high contrast mode affects the color scheme
      // This is a basic implementation - more sophisticated detection would be needed
      if (colorScheme === 'dark' && settings.contrastMode === 'normal') {
        // Could potentially auto-switch to high contrast, but we'll let users control this
      }
    });

    return () => subscription?.remove();
  }, [settings.contrastMode]);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      }
    } catch (error) {
      console.warn('Failed to load accessibility settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<AccessibilitySettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));
      setSettings(updatedSettings);
    } catch (error) {
      console.warn('Failed to save accessibility settings:', error);
    }
  };

  const setFontSize = (fontSize: FontSize) => {
    const previousFontSize = settings.fontSize;
    saveSettings({ fontSize });
    
    // Track analytics
    AccessibilityAnalytics.trackFontSizeChanged(previousFontSize, fontSize);
  };

  const setContrastMode = (contrastMode: ContrastMode) => {
    const previousContrastMode = settings.contrastMode;
    saveSettings({ contrastMode });
    
    // Track analytics
    AccessibilityAnalytics.trackContrastModeChanged(previousContrastMode, contrastMode);
  };

  const resetToDefaults = () => {
    saveSettings(defaultSettings);
    
    // Track analytics
    AccessibilityAnalytics.trackSettingsReset();
  };

  const value: AccessibilityContextType = {
    ...settings,
    setFontSize,
    setContrastMode,
    resetToDefaults,
    isLoading,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

// Font size multipliers for different accessibility levels
export const fontSizeMultipliers = {
  standard: 1,
  large: 1.2,
  extraLarge: 1.5,
} as const;

// Minimum tap target size (44x44dp as per WCAG guidelines)
export const MIN_TAP_TARGET_SIZE = 44;

// High contrast color palette
export const highContrastColors = {
  background: '#000000',
  surface: '#1a1a1a',
  primary: '#ffffff',
  secondary: '#cccccc',
  accent: '#ffff00',
  success: '#00ff00',
  warning: '#ffaa00',
  error: '#ff0000',
  text: '#ffffff',
  textSecondary: '#cccccc',
  border: '#ffffff',
  disabled: '#666666',
} as const;

// Normal contrast color palette (existing colors)
export const normalColors = {
  background: '#f9fafb',
  surface: '#ffffff',
  primary: '#2563eb',
  secondary: '#6b7280',
  accent: '#10b981',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  text: '#1f2937',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  disabled: '#9ca3af',
} as const;