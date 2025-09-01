import { NextRequest, NextResponse } from 'next/server'

// This route handles the malformed Supabase OAuth redirect
// When Supabase generates: https://encdblxyxztvfxotfuyh.supabase.co/saga-web-livid.vercel.app?code=...
// We need to redirect to: https://saga-web-livid.vercel.app/auth/callback?code=...

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')
  
  // Build the correct redirect URL
  const redirectUrl = new URL('/auth/callback', 'https://saga-web-livid.vercel.app')
  
  if (code) {
    redirectUrl.searchParams.set('code', code)
  }
  if (error) {
    redirectUrl.searchParams.set('error', error)
  }
  if (error_description) {
    redirectUrl.searchParams.set('error_description', error_description)
  }
  
  return NextResponse.redirect(redirectUrl.toString())
}
