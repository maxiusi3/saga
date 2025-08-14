'use client'

import { useEffect } from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuthStore, initializeAuth } from '@/stores/auth-store'
import { ErrorBoundary } from '@/components/error-boundary'
import { Navigation } from '@/components/layout/navigation'
import { Sidebar } from '@/components/layout/sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    // Initialize auth state on app load
    if (!isAuthenticated) {
      initializeAuth()
    }
  }, [isAuthenticated])

  return (
    <ProtectedRoute requireAuth={true}>
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <div className="flex">
            <Sidebar />
            <main className="flex-1 lg:ml-64">
              <div className="py-6">
                {children}
              </div>
            </main>
          </div>
        </div>
      </ErrorBoundary>
    </ProtectedRoute>
  )
}