'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center space-y-8">
        {/* 404 Illustration */}
        <div className="space-y-4">
          <div className="text-8xl font-bold text-primary">404</div>
          <h1 className="text-3xl font-bold text-gray-900">Page Not Found</h1>
          <p className="text-lg text-gray-600">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Suggestions */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">What can you do?</h2>
            <div className="space-y-2 text-sm text-gray-600 text-left">
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <span>Check the URL for any typos</span>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <span>Go back to the previous page</span>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <span>Visit your dashboard to access your projects</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="default" asChild>
            <Link href="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Link>
          </Button>
          
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>

        {/* Help Link */}
        <div className="text-sm text-gray-600">
          Need help? <Link href="/dashboard/help" className="text-furbridge-orange hover:underline">Contact Support</Link>
        </div>
      </div>
    </div>
  )
}
