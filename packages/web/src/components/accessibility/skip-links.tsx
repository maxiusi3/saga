'use client'

import React from 'react'

interface SkipLinksProps {
  links?: Array<{
    href: string
    label: string
  }>
}

const defaultLinks = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#navigation', label: 'Skip to navigation' },
  { href: '#footer', label: 'Skip to footer' }
]

export function SkipLinks({ links = defaultLinks }: SkipLinksProps) {
  return (
    <div className="sr-only-focusable">
      {links.map((link, index) => (
        <a
          key={index}
          href={link.href}
          className="skip-link"
          onClick={(e) => {
            e.preventDefault()
            const target = document.querySelector(link.href)
            if (target) {
              target.scrollIntoView({ behavior: 'smooth' })
              // Set focus to the target element
              if (target instanceof HTMLElement) {
                target.focus()
              }
            }
          }}
        >
          {link.label}
        </a>
      ))}
    </div>
  )
}

// Focus management hook
export function useFocusManagement() {
  const focusRef = React.useRef<HTMLElement | null>(null)
  const previousFocusRef = React.useRef<HTMLElement | null>(null)

  const trapFocus = React.useCallback((element: HTMLElement) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    element.addEventListener('keydown', handleTabKey)
    return () => element.removeEventListener('keydown', handleTabKey)
  }, [])

  const setFocus = React.useCallback((element: HTMLElement | null) => {
    if (element) {
      previousFocusRef.current = document.activeElement as HTMLElement
      element.focus()
      focusRef.current = element
    }
  }, [])

  const restoreFocus = React.useCallback(() => {
    if (previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [])

  return { trapFocus, setFocus, restoreFocus, focusRef }
}

// Announcement hook for screen readers
export function useAnnouncement() {
  const announcementRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    // Create announcement region if it doesn't exist
    if (!announcementRef.current) {
      const announcement = document.createElement('div')
      announcement.setAttribute('aria-live', 'polite')
      announcement.setAttribute('aria-atomic', 'true')
      announcement.className = 'sr-only'
      announcement.id = 'announcement-region'
      document.body.appendChild(announcement)
      announcementRef.current = announcement
    }

    return () => {
      if (announcementRef.current && document.body.contains(announcementRef.current)) {
        document.body.removeChild(announcementRef.current)
      }
    }
  }, [])

  const announce = React.useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcementRef.current) {
      announcementRef.current.setAttribute('aria-live', priority)
      announcementRef.current.textContent = message
      
      // Clear the message after a short delay to allow for re-announcements
      setTimeout(() => {
        if (announcementRef.current) {
          announcementRef.current.textContent = ''
        }
      }, 1000)
    }
  }, [])

  return { announce }
}

// Keyboard navigation hook
export function useKeyboardNavigation() {
  const handleKeyDown = React.useCallback((
    e: React.KeyboardEvent,
    handlers: {
      onEnter?: () => void
      onSpace?: () => void
      onEscape?: () => void
      onArrowUp?: () => void
      onArrowDown?: () => void
      onArrowLeft?: () => void
      onArrowRight?: () => void
    }
  ) => {
    switch (e.key) {
      case 'Enter':
        if (handlers.onEnter) {
          e.preventDefault()
          handlers.onEnter()
        }
        break
      case ' ':
        if (handlers.onSpace) {
          e.preventDefault()
          handlers.onSpace()
        }
        break
      case 'Escape':
        if (handlers.onEscape) {
          e.preventDefault()
          handlers.onEscape()
        }
        break
      case 'ArrowUp':
        if (handlers.onArrowUp) {
          e.preventDefault()
          handlers.onArrowUp()
        }
        break
      case 'ArrowDown':
        if (handlers.onArrowDown) {
          e.preventDefault()
          handlers.onArrowDown()
        }
        break
      case 'ArrowLeft':
        if (handlers.onArrowLeft) {
          e.preventDefault()
          handlers.onArrowLeft()
        }
        break
      case 'ArrowRight':
        if (handlers.onArrowRight) {
          e.preventDefault()
          handlers.onArrowRight()
        }
        break
    }
  }, [])

  return { handleKeyDown }
}
