import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  
  // Handle Supabase OAuth redirect bug
  // When Supabase redirects to: https://encdblxyxztvfxotfuyh.supabase.co/saga-web-livid.vercel.app?code=...
  // We need to redirect to: https://saga-web-livid.vercel.app/auth/callback?code=...
  
  if (request.nextUrl.hostname.includes('supabase.co')) {
    // Extract the code parameter
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')
    const error_description = url.searchParams.get('error_description')
    
    if (code || error) {
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
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
