'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/layout/navigation'
import Link from 'next/link'
import { BookOpen, Gem, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuthStore } from '@/stores/auth-store'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAuthenticated, isLoading, initialize } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    // Initialize auth store if not already done
    if (!user && !isLoading) {
      initialize()
    }
  }, [user, isLoading, initialize])

  useEffect(() => {
    // Add delay before redirecting to allow session sync
    if (!isLoading && !isAuthenticated) {
      const timer = setTimeout(() => {
        router.push('/auth/signin')
      }, 2000) // Wait 2 seconds for auth state to sync

      return () => clearTimeout(timer)
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg">
        <div className="flex justify-around">
          <Button asChild variant="ghost" className="flex-1 flex-col h-auto py-2 text-xs rounded-none">
            <Link href="/dashboard">
              <BookOpen className="w-5 h-5 mb-1" />
              <span className="font-medium">My Sagas</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" className="flex-1 flex-col h-auto py-2 text-xs rounded-none">
            <Link href="/dashboard/resources">
              <Gem className="w-5 h-5 mb-1" />
              <span>Resources</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" className="flex-1 flex-col h-auto py-2 text-xs rounded-none">
            <Link href="/dashboard/profile">
              <UserIcon className="w-5 h-5 mb-1" />
              <span>Profile</span>
            </Link>
          </Button>
        </div>
      </nav>

      {/* Bottom padding for mobile nav */}
      <div className="md:hidden h-20"></div>
    </div>
  )
}
