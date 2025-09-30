/**
 * Accessibility Utilities for Saga UI Components
 * Provides WCAG 2.1 AA compliant patterns and utilities
 */

// ARIA Labels and Descriptions
export const ariaLabels = {
  // Navigation
  mainNavigation: 'Main navigation',
  breadcrumb: 'Breadcrumb navigation',
  pagination: 'Pagination navigation',
  
  // Actions
  playAudio: 'Play audio recording',
  pauseAudio: 'Pause audio recording',
  stopRecording: 'Stop recording',
  startRecording: 'Start recording',
  deleteRecording: 'Delete recording',
  uploadPhoto: 'Upload photo',
  
  // Forms
  required: 'Required field',
  optional: 'Optional field',
  searchInput: 'Search stories and projects',
  
  // Status
  loading: 'Loading content',
  error: 'Error message',
  success: 'Success message',
  warning: 'Warning message',
  
  // Interactive elements
  expandMenu: 'Expand menu',
  collapseMenu: 'Collapse menu',
  openDialog: 'Open dialog',
  closeDialog: 'Close dialog',
} as const

// Screen Reader Announcements
export const screenReaderText = {
  // Status updates
  recordingStarted: 'Recording started',
  recordingStopped: 'Recording stopped',
  recordingPaused: 'Recording paused',
  uploadComplete: 'Upload completed successfully',
  uploadFailed: 'Upload failed, please try again',
  
  // Navigation
  currentPage: 'Current page',
  newPage: 'Navigated to new page',
  
  // Content updates
  newStory: 'New story added',
  storyUpdated: 'Story updated',
  commentAdded: 'Comment added',
  
  // Form feedback
  fieldError: 'Field has an error',
  formSubmitted: 'Form submitted successfully',
  formError: 'Form has errors, please review',
} as const

// Focus Management
export const focusUtils = {
  // Focus trap for modals and dialogs
  trapFocus: (element: HTMLElement) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus()
            e.preventDefault()
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus()
            e.preventDefault()
          }
        }
      }
    }

    element.addEventListener('keydown', handleTabKey)
    firstElement?.focus()

    return () => {
      element.removeEventListener('keydown', handleTabKey)
    }
  },

  // Restore focus after modal closes
  restoreFocus: (previousElement: HTMLElement | null) => {
    if (previousElement) {
      previousElement.focus()
    }
  },

  // Skip to main content
  skipToMain: () => {
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.focus()
      mainContent.scrollIntoView()
    }
  }
}

// Keyboard Navigation
export const keyboardUtils = {
  // Common keyboard event handlers
  handleEnterSpace: (callback: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      callback()
    }
  },

  handleEscape: (callback: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      callback()
    }
  },

  handleArrowKeys: (callbacks: {
    up?: () => void
    down?: () => void
    left?: () => void
    right?: () => void
  }) => (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        callbacks.up?.()
        break
      case 'ArrowDown':
        e.preventDefault()
        callbacks.down?.()
        break
      case 'ArrowLeft':
        e.preventDefault()
        callbacks.left?.()
        break
      case 'ArrowRight':
        e.preventDefault()
        callbacks.right?.()
        break
    }
  }
}

// Color Contrast Utilities
export const contrastUtils = {
  // High contrast mode classes
  highContrast: {
    text: 'contrast-more:text-black contrast-more:font-bold',
    background: 'contrast-more:bg-white',
    border: 'contrast-more:border-black contrast-more:border-2',
    button: 'contrast-more:bg-white contrast-more:text-black contrast-more:border-black contrast-more:border-2',
  },

  // Ensure sufficient color contrast
  ensureContrast: (foreground: string, background: string) => {
    // This would typically use a color contrast calculation library
    // For now, we'll return classes that ensure good contrast
    return 'text-foreground bg-background'
  }
}

// Motion and Animation
export const motionUtils = {
  // Reduced motion preferences
  reducedMotion: {
    transition: 'motion-reduce:transition-none',
    animation: 'motion-reduce:animate-none',
    transform: 'motion-reduce:transform-none',
  },

  // Safe animations that respect user preferences
  safeTransition: 'transition-colors duration-200 motion-reduce:transition-none',
  safeFade: 'transition-opacity duration-300 motion-reduce:transition-none',
  safeSlide: 'transition-transform duration-200 motion-reduce:transition-none motion-reduce:transform-none',
}

// Touch and Mobile Accessibility
export const touchUtils = {
  // Minimum touch target size (44x44dp)
  minTouchTarget: 'min-h-[44px] min-w-[44px]',
  
  // Touch-friendly spacing
  touchSpacing: 'p-3 m-1',
  
  // Gesture support indicators
  swipeable: 'touch-pan-x',
  scrollable: 'touch-pan-y',
}

// Form Accessibility
export const formUtils = {
  // Error message patterns
  errorMessage: (fieldId: string) => ({
    id: `${fieldId}-error`,
    role: 'alert',
    'aria-live': 'polite' as const,
  }),

  // Field descriptions
  fieldDescription: (fieldId: string) => ({
    id: `${fieldId}-description`,
  }),

  // Required field indicators
  requiredField: {
    'aria-required': true,
    'aria-invalid': false,
  },

  // Form validation
  invalidField: {
    'aria-invalid': true,
  },

  // Fieldset and legend for grouped fields
  fieldGroup: {
    role: 'group',
  }
}

// Live Regions for Dynamic Content
export const liveRegionUtils = {
  // Polite announcements (don't interrupt)
  polite: {
    'aria-live': 'polite' as const,
    'aria-atomic': true,
  },

  // Assertive announcements (interrupt screen reader)
  assertive: {
    'aria-live': 'assertive' as const,
    'aria-atomic': true,
  },

  // Status updates
  status: {
    role: 'status',
    'aria-live': 'polite' as const,
  },

  // Alert messages
  alert: {
    role: 'alert',
    'aria-live': 'assertive' as const,
  }
}

// Component-specific accessibility patterns
export const componentA11y = {
  // Button accessibility
  button: {
    base: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    disabled: 'disabled:opacity-50 disabled:cursor-not-allowed',
    loading: 'aria-disabled="true"',
  },

  // Card accessibility
  card: {
    interactive: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer',
    static: '',
  },

  // Modal/Dialog accessibility
  modal: {
    overlay: 'fixed inset-0 bg-black/50 z-50',
    content: 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50',
    attributes: {
      role: 'dialog',
      'aria-modal': true,
      'aria-labelledby': 'modal-title',
      'aria-describedby': 'modal-description',
    }
  },

  // Navigation accessibility
  nav: {
    main: { role: 'navigation', 'aria-label': ariaLabels.mainNavigation },
    breadcrumb: { role: 'navigation', 'aria-label': ariaLabels.breadcrumb },
    pagination: { role: 'navigation', 'aria-label': ariaLabels.pagination },
  },

  // Table accessibility
  table: {
    wrapper: 'overflow-x-auto',
    table: 'w-full',
    header: 'sr-only', // For screen readers when visual headers aren't needed
    sortable: 'cursor-pointer hover:bg-muted/50',
  }
}

// Utility function to announce to screen readers
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.className = 'sr-only'
  announcement.textContent = message

  document.body.appendChild(announcement)

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

// Skip link component utility
export const skipLinkUtils = {
  skipToMain: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded-md z-50',
  skipToNav: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-20 bg-primary text-primary-foreground px-4 py-2 rounded-md z-50',
}

// Screen reader only text utility
export const srOnly = 'sr-only'

export default {
  ariaLabels,
  screenReaderText,
  focusUtils,
  keyboardUtils,
  contrastUtils,
  motionUtils,
  touchUtils,
  formUtils,
  liveRegionUtils,
  componentA11y,
  announceToScreenReader,
  skipLinkUtils,
  srOnly,
}