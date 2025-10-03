'use client'

import { useAccessibility } from '@/hooks/use-accessibility'

/**
 * Accessibility Provider Component
 * 
 * This component replaces the floating accessibility toolbar.
 * It automatically loads and applies accessibility settings on app initialization.
 * Users can now manage accessibility settings through the Settings page instead
 * of using a floating toolbar.
 */
export function AccessibilityProvider() {
  // Initialize accessibility settings
  useAccessibility()

  // This component doesn't render anything visible
  // It just ensures accessibility settings are loaded and applied
  return null
}