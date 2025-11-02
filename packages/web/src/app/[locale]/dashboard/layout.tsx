'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/layout/navigation'
import Link from 'next/link'
import { BookOpen, Gem, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuthStore } from '@/stores/auth-store'
import { useLocale, useTranslations } from 'next-intl'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAuthenticated, isLoading, initialize } = useAuthStore()
  const router = useRouter()
  const [initialized, setInitialized] = useState(false)
  const locale = useLocale()
  const t = useTranslations('common')

  const withLocale = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`
    const seg = normalized.split('/')[1]
    if (seg === 'en' || seg === 'zh-CN' || seg === 'zh-TW') return normalized
    return `/${locale}${normalized}`
  }

  useEffect(() => {
    console.log('Dashboard Layout: Auth state check', { user: !!user, isLoading, isAuthenticated, initialized })

    // Initialize auth store only once
    if (!user && !isLoading && !initialized) {
      console.log('Dashboard Layout: Initializing auth store (first time)')
      setInitialized(true)
      initialize()
    }
  }, [user, isLoading, initialized, initialize])

  useEffect(() => {
    console.log('Dashboard Layout: Redirect check', { isLoading, isAuthenticated })

    // Add delay before redirecting to allow session sync
    if (!isLoading && !isAuthenticated) {
      console.log('Dashboard Layout: Setting redirect timer (2s)')
      const timer = setTimeout(() => {
        console.log('Dashboard Layout: Redirecting to signin')
        router.push(withLocale('/auth/signin'))
      }, 2000) // Wait 2 seconds for auth state to sync

      return () => {
        console.log('Dashboard Layout: Clearing redirect timer')
        clearTimeout(timer)
      }
    }
  }, [isAuthenticated, isLoading, router])

  console.log('Dashboard Layout: Render decision', { isLoading, isAuthenticated, user: !!user })

  if (isLoading) {
    console.log('Dashboard Layout: Showing loading spinner')
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    console.log('Dashboard Layout: Not authenticated, returning null')
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
            <Link href={withLocale('/dashboard')}>
              <BookOpen className="w-5 h-5 mb-1" />
              <span className="font-medium">{t('mobileNav.mySagas')}</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" className="flex-1 flex-col h-auto py-2 text-xs rounded-none">
            <Link href={withLocale('/dashboard/resources')}>
              <Gem className="w-5 h-5 mb-1" />
              <span>{t('mobileNav.resources')}</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" className="flex-1 flex-col h-auto py-2 text-xs rounded-none">
            <Link href={withLocale('/dashboard/profile')}>
              <UserIcon className="w-5 h-5 mb-1" />
              <span>{t('nav.profile')}</span>
            </Link>
          </Button>
        </div>
      </nav>

      {/* Bottom padding for mobile nav */}
      <div className="md:hidden h-20"></div>
    </div>
  )
}
