import createMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'
import { locales, defaultLocale } from './src/i18n/config'

// Create next-intl middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always', // Always prefix locale in URL (works with app/[locale] route)
})

export function middleware(request: NextRequest) {
  return intlMiddleware(request)
}

export const config = {
  matcher: [
    // Recommended matcher from next-intl docs to avoid interfering with static assets
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}
