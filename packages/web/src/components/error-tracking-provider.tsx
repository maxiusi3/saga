'use client'

interface ErrorTrackingProviderProps {
  children: React.ReactNode
}

export function ErrorTrackingProvider({ children }: ErrorTrackingProviderProps) {
  // This would integrate with Sentry or other error tracking service
  // For now, just pass through children
  return <>{children}</>
}