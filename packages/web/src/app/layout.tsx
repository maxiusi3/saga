import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/components/auth/auth-provider'
import { ErrorTrackingProvider } from '@/components/error-tracking-provider'
import { ClientOnly } from '@/components/client-only'
import { AnalyticsProvider } from '@/components/analytics-provider'
import { SkipLinks } from '@/components/accessibility/skip-links'
import './globals.css'

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
        {/* Skip Links for Screen Readers */}
        <SkipLinks />

        {/* Main Application */}
        <ErrorTrackingProvider>
          <AuthProvider>
            <div id="app-root">
              {children}
            </div>
          </AuthProvider>
        </ErrorTrackingProvider>

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