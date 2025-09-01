import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // Handle error cases
  if (error) {
    console.error('Auth callback error:', error, error_description)
    return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=${encodeURIComponent(error_description || error)}`)
  }

  if (code) {
    try {
      const cookieStore = cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value
            },
            set(name: string, value: string, options: any) {
              cookieStore.set({ name, value, ...options })
            },
            remove(name: string, options: any) {
              cookieStore.set({ name, value: '', ...options })
            },
          },
        }
      )

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('Token exchange error:', exchangeError)
        return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=${encodeURIComponent('Authentication failed')}`)
      }

      // Successful authentication - redirect to dashboard
      return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
    } catch (error) {
      console.error('Callback processing error:', error)
      return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=${encodeURIComponent('Authentication failed')}`)
    }
  }

  // No code parameter - redirect to signin
  return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=${encodeURIComponent('Invalid authentication request')}`)
}
