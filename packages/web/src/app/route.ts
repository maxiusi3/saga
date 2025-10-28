import { NextRequest, NextResponse } from 'next/server'
import { locales, defaultLocale } from '../i18n/config'

// Fallback root route: redirect "/" to default locale (e.g., "/en")
// This ensures production won't 404 when hitting the bare domain without a locale prefix.
export async function GET(request: NextRequest) {
  const url = new URL(request.url)

  // Try to detect preferred locale from headers; fallback to defaultLocale
  const acceptLang = request.headers.get('accept-language') || ''
  const preferred = acceptLang.split(',')[0]?.trim()
  const matched = locales.includes(preferred as any) ? preferred : defaultLocale

  // Redirect to locale-prefixed home
  url.pathname = `/${matched}`
  return NextResponse.redirect(url.toString(), { status: 307 })
}

export const dynamic = 'force-dynamic'