'use client'

import { useEffect } from 'react'
import { errorTracking } from '@/lib/error-tracking'

interface ErrorTrackingProviderProps {
  children: React.ReactNode
}

export function ErrorTrackingProvider({ children }: ErrorTrackingProviderProps) {
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    // Initialize error tracking
    errorTracking.init()

    // Track page load
    errorTracking.captureMessage('Web app loaded', 'info', {
      component: 'app',
      action: 'load',
      url: window.location.href,
    })

    // Track unhandled errors
    const handleError = (event: ErrorEvent) => {
      errorTracking.captureException(event.error, {
        component: 'window',
        action: 'unhandled_error',
        url: window.location.href,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      })
    }

    // Track unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      errorTracking.captureException(
        new Error(`Unhandled Promise Rejection: ${event.reason}`),
        {
          component: 'window',
          action: 'unhandled_rejection',
          url: window.location.href,
          reason: event.reason,
        }
      )
    }

    // Add event listeners
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return <>{children}</>
}