'use client'

import { useEffect } from 'react'
import { settingsService } from '@/services/settings-service'

/**
 * Hook to initialize and manage accessibility settings
 * This replaces the floating accessibility toolbar functionality
 */
export function useAccessibility() {
  useEffect(() => {
    // Load and apply accessibility settings on app initialization
    settingsService.loadAndApplyAccessibilitySettings()
  }, [])

  // Return utility functions for manual accessibility control
  return {
    loadAndApplySettings: () => settingsService.loadAndApplyAccessibilitySettings()
  }
}