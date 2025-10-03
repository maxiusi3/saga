import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/components/auth/auth-provider'
import { ErrorTrackingProvider } from '@/components/error-tracking-provider'
import { ClientOnly } from '@/components/client-only'
import { AnalyticsProvider } from '@/components/analytics-provider'
import { validateConfigOnStartup } from '@/lib/config'
import { AccessibilityProvider } from '@/components/accessibility/accessibility-provider'

import './globals.css'

// 验证配置（仅在服务端）
if (typeof window === 'undefined') {
  try {
    validateConfigOnStartup()
  } catch (error) {
    console.error('Configuration validation failed:', error)
    // 在开发环境中抛出错误，生产环境中记录错误但继续运行
    if (process.env.NODE_ENV === 'development') {
      throw error
    }
  }
}

export const metadata: Metadata = {
  title: 'Saga - Family Biography Platform',
  description: 'AI-powered family biography platform for intergenerational storytelling',
  keywords: ['family', 'biography', 'storytelling', 'memories', 'AI'],
  authors: [{ name: 'Saga Team' }],
  other: {
    'color-scheme': 'light',
    'theme-color': '#2563eb',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">


        {/* Main Application */}
        <ErrorTrackingProvider>
          <AuthProvider>
            <div id="app-root">
              <main id="main-content">
                {children}
              </main>
            </div>
          </AuthProvider>
        </ErrorTrackingProvider>

        {/* Accessibility Provider */}
        <ClientOnly>
          <AccessibilityProvider />
        </ClientOnly>

        {/* Toast Notifications with Accessibility */}
        <ClientOnly>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
            containerStyle={{
              zIndex: 9999,
            }}
          />
        </ClientOnly>

        {/* Analytics */}
        <AnalyticsProvider />

        {/* Screen Reader Announcement Region */}
        <div
          id="announcement-region"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />
      </body>
    </html>
  )
}