'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
    <div className="min-h-screen bg-white flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Error Icon */}
        <div className="space-y-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Something went wrong</h1>
          <p className="text-lg text-gray-600">
            We encountered an unexpected error. Please try again.
          </p>
        </div>

        {/* Error Details */}
        {process.env.NODE_ENV === 'development' && (
          <Card className="p-4 text-left">
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 text-sm">Error Details:</h3>
              <p className="text-xs text-gray-600 font-mono break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-gray-600">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="default" onClick={reset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Link>
          </Button>
        </div>

        {/* Help Link */}
        <div className="text-sm text-gray-600">
          If this problem persists, please{' '}
          <Link href="/dashboard/help" className="text-primary hover:underline">
            contact support
          </Link>
        </div>
      </div>
    </div>
  )
}
