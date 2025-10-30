import { NextRequest, NextResponse } from 'next/server'
import { defaultLocale } from '@/i18n/config'

// This route handles the malformed Supabase OAuth redirect
// When Supabase generates: https://encdblxyxztvfxotfuyh.supabase.co/saga-web-livid.vercel.app?code=...
// We need to redirect to: https://saga-web-livid.vercel.app/auth/callback?code=...

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')
  
  // Build the correct redirect URL (locale-aware, defaulting to defaultLocale)
  const redirectUrl = new URL(`/${defaultLocale}/auth/callback`, 'https://saga-web-livid.vercel.app')
  
  if (code) {
    redirectUrl.searchParams.set('code', code)
  }
  if (error) {
    redirectUrl.searchParams.set('error', error)
  }
  if (error_description) {
    redirectUrl.searchParams.set('error_description', error_description)
  }
  // Preserve optional next parameter for post-auth redirect
  const next = requestUrl.searchParams.get('next')
  if (next) {
    redirectUrl.searchParams.set('next', next)
  }
  
  return NextResponse.redirect(redirectUrl.toString())
}
