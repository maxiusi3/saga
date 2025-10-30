'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { Loading } from '@/components/ui/loading'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
}

export function ProtectedRoute({ 
  children, 
  requireAuth = true, 
  redirectTo = '/auth/signin' 
}: ProtectedRouteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading, user } = useAuthStore()

  const getLocaleFromPath = () => {
    const first = (pathname?.split('/')[1] || '').trim()
    const supported = ['en', 'zh-CN', 'zh-TW']
    return supported.includes(first) ? first : 'en'
  }

  const withLocale = (path: string) => {
    const locale = getLocaleFromPath()
    const normalized = path.startsWith('/') ? path : `/${path}`
    return `/${locale}${normalized}`
  }

  useEffect(() => {
    if (!isLoading) {
      if (requireAuth && !isAuthenticated) {
        router.push(withLocale(redirectTo))
      } else if (!requireAuth && isAuthenticated) {
        router.push(withLocale('/dashboard'))
      }
    }
  }, [isAuthenticated, isLoading, requireAuth, router, redirectTo, pathname])

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" text="Loading..." />
      </div>
    )
  }

  // Don't render children if auth requirements aren't met
  if (requireAuth && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" text="Redirecting..." />
      </div>
    )
  }

  if (!requireAuth && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" text="Redirecting..." />
      </div>
    )
  }

  return <>{children}</>
}

// Higher-order component version
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: { requireAuth?: boolean; redirectTo?: string } = {}
) {
  const { requireAuth = true, redirectTo = '/auth/signin' } = options

  return function AuthenticatedComponent(props: P) {
    return (
      <ProtectedRoute requireAuth={requireAuth} redirectTo={redirectTo}>
        <Component {...props} />
      </ProtectedRoute>
    )
  }
}

// Hook for checking auth status in components
export function useRequireAuth(redirectTo = '/auth/signin') {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useAuthStore()

  const getLocaleFromPath = () => {
    const first = (pathname?.split('/')[1] || '').trim()
    const supported = ['en', 'zh-CN', 'zh-TW']
    return supported.includes(first) ? first : 'en'
  }

  const withLocale = (path: string) => {
    const locale = getLocaleFromPath()
    const normalized = path.startsWith('/') ? path : `/${path}`
    return `/${locale}${normalized}`
  }

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(withLocale(redirectTo))
    }
  }, [isAuthenticated, isLoading, router, redirectTo, pathname])

  return { isAuthenticated, isLoading }
}