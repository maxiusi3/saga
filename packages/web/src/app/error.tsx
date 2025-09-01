'use client'

import { useEffect } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Error Icon */}
        <div className="space-y-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Something went wrong</h1>
          <p className="text-lg text-muted-foreground">
            We encountered an unexpected error. Please try again.
          </p>
        </div>

        {/* Error Details */}
        {process.env.NODE_ENV === 'development' && (
          <FurbridgeCard className="p-4 text-left">
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground text-sm">Error Details:</h3>
              <p className="text-xs text-muted-foreground font-mono break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-muted-foreground">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          </FurbridgeCard>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <FurbridgeButton variant="orange" onClick={reset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </FurbridgeButton>
          
          <FurbridgeButton variant="outline" asChild>
            <Link href="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Link>
          </FurbridgeButton>
        </div>

        {/* Help Link */}
        <div className="text-sm text-muted-foreground">
          If this problem persists, please{' '}
          <Link href="/dashboard/help" className="text-furbridge-orange hover:underline">
            contact support
          </Link>
        </div>
      </div>
    </div>
  )
}
