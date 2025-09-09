import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)

  // 详细日志记录所有参数
  console.log('=== Auth Callback Debug ===')
  console.log('Full URL:', requestUrl.toString())
  console.log('All search params:', Object.fromEntries(requestUrl.searchParams.entries()))

  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  console.log('Parsed params:', { code, token_hash, type, error, error_description })

  // Handle error cases
  if (error) {
    console.error('Auth callback error:', error, error_description)
    return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=${encodeURIComponent(error_description || error)}`)
  }

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

  try {
    // Handle OAuth callback (code parameter)
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('OAuth token exchange error:', exchangeError)
        return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=${encodeURIComponent('Authentication failed')}`)
      }

      console.log('OAuth authentication successful')

      // Get the session after successful OAuth
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session after OAuth:', session ? 'exists' : 'null')

      // Force complete page refresh using JavaScript redirect
      const dashboardUrl = `${requestUrl.origin}/dashboard`
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Redirecting...</title>
        </head>
        <body>
          <script>
            console.log('OAuth: Forcing page refresh to dashboard');
            window.location.href = '${dashboardUrl}';
          </script>
          <p>Redirecting to dashboard...</p>
        </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }

    // Handle Magic Link callback (token_hash parameter)
    if (token_hash && type) {
      console.log('Magic Link verification attempt:', { token_hash: token_hash.substring(0, 8) + '...', type })

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any
      })

      if (verifyError) {
        console.error('Magic Link verification error:', verifyError)
        return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=${encodeURIComponent(`Magic link verification failed: ${verifyError.message}`)}`)
      }

      console.log('Magic Link verification successful')

      // Get the session after successful verification
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session after verification:', session ? 'exists' : 'null')

      // Force complete page refresh using JavaScript redirect
      const dashboardUrl = `${requestUrl.origin}/dashboard`
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Redirecting...</title>
        </head>
        <body>
          <script>
            console.log('Magic Link: Forcing page refresh to dashboard');
            window.location.href = '${dashboardUrl}';
          </script>
          <p>Redirecting to dashboard...</p>
        </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }

    // No valid parameters - redirect to signin
    console.log('No valid auth parameters found, redirecting to signin')
    return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=${encodeURIComponent('Invalid authentication request')}`)

  } catch (error) {
    console.error('Callback processing error:', error)
    return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=${encodeURIComponent('Authentication failed')}`)
  }
}
