import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './i18n/config'

// Enforce locale-prefixed routing for all pages (e.g., redirect /auth/signin -> /en/auth/signin).
// This fixes 404s when navigating to non-prefixed paths in production.
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export default function middleware(request: NextRequest) {
  return intlMiddleware(request)
}

// Exclude Next.js internals, API routes, and static assets
export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\.(?:js|css|png|jpg|jpeg|gif|svg|ico|webp|mp4|webm|wav|mp3|json)).*)',
  ],
}