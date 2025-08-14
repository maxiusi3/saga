import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/components/auth/auth-provider'
import { ErrorTrackingProvider } from '@/components/error-tracking-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Saga - Family Biography Platform',
  description: 'AI-powered family biography platform for intergenerational storytelling',
  keywords: ['family', 'biography', 'storytelling', 'memories', 'AI'],
  authors: [{ name: 'Saga Team' }],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <ErrorTrackingProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ErrorTrackingProvider>
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
        />
      </body>
    </html>
  )
}