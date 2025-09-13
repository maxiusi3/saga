'use client'

// 避免构建期预渲染导致的环境变量缺失问题
// 在 Next.js 15 中，我们通过运行时检查来避免 SSG

import { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'

function SignInPageContent() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isClient, setIsClient] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // 确保只在客户端执行
  useEffect(() => {
    setIsClient(true)
  }, [])

  // 仅在客户端事件中创建 Supabase 实例，避免服务端渲染阶段访问环境变量
  const getSupabase = () => {
    if (typeof window === 'undefined') return null
    // 统一使用单例客户端，避免多个 GoTrueClient 导致的异常
    return createClientSupabase()
  }

  // Handle Magic Link tokens from URL
  useEffect(() => {
    if (!isClient) return

    const next = searchParams?.get('next')

    // Debug: Log full URL information
    const fullUrl = window.location.href
    console.log('SignIn page: Full URL:', fullUrl)
    console.log('SignIn page: Search string:', window.location.search)
    console.log('SignIn page: next param:', next)

    // Extract tokens using regex from full URL (more reliable than URLSearchParams)
    const accessTokenMatch = fullUrl.match(/access_token=([^&]+)/)
    const refreshTokenMatch = fullUrl.match(/refresh_token=([^&]+)/)
    const tokenTypeMatch = fullUrl.match(/token_type=([^&]+)/)
    // Use more specific regex to avoid matching token_type instead of type
    const typeMatch = fullUrl.match(/[?&]type=([^&]+)/)

    const accessToken = accessTokenMatch ? decodeURIComponent(accessTokenMatch[1]) : null
    const refreshToken = refreshTokenMatch ? decodeURIComponent(refreshTokenMatch[1]) : null
    const tokenType = tokenTypeMatch ? decodeURIComponent(tokenTypeMatch[1]) : null
    const type = typeMatch ? decodeURIComponent(typeMatch[1]) : null

    // Also try with traditional methods for comparison
    const urlParams = new URLSearchParams(window.location.search)
    const accessTokenFromSearch = searchParams?.get('access_token')
    const refreshTokenFromSearch = searchParams?.get('refresh_token')
    const typeFromSearch = searchParams?.get('type')

    console.log('SignIn page: Regex extraction results:', { accessToken: !!accessToken, refreshToken: !!refreshToken, tokenType, type })
    console.log('SignIn page: URLSearchParams results:', { accessToken: !!urlParams.get('access_token'), refreshToken: !!urlParams.get('refresh_token'), type: urlParams.get('type') })
    console.log('SignIn page: useSearchParams results:', { accessToken: !!accessTokenFromSearch, refreshToken: !!refreshTokenFromSearch, type: typeFromSearch })

    // Use regex-extracted tokens (most reliable)
    // Support both Magic Link (type=magiclink) and Google OAuth (no type parameter)
    if (accessToken && refreshToken) {
      const authType = type === 'magiclink' ? 'Magic Link' : 'Google OAuth'
      console.log(`SignIn page: ${authType} tokens found, setting session and redirecting`)

      // Set the session using the tokens
      const supabase = getSupabase()
      if (supabase) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        }).then(({ data, error }) => {
          if (error) {
            console.error('SignIn page: Error setting session:', error)
            setMessage(`Error setting session: ${error.message}`)
          } else {
            console.log(`SignIn page: ${authType} session set successfully, redirecting`)
            const next = searchParams?.get('next')
            router.push(next || '/dashboard')
          }
        })
      }
    }
  }, [isClient, router, searchParams])

  // Check for error from callback
  useEffect(() => {
    const error = searchParams?.get('error')
    if (error) {
      setMessage(`Error: ${error}`)
    }
  }, [searchParams])

  const handleGoogleSignIn = async () => {
    if (!isClient) return
    setIsLoading(true)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Supabase client not available')
      const next = searchParams?.get('next')
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // 使用运行时当前域名，避免硬编码 Vercel 预览/生产域名
          redirectTo: `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`
        }
      })
      if (error) throw error
    } catch (error) {
      console.error('Google sign in error:', error)
      setMessage('Error signing in with Google')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !isClient) return

    setIsLoading(true)
    setMessage('')

    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Supabase client not available')
      const next = searchParams?.get('next')
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`
        }
      })

      if (error) throw error

      setMessage('Check your email for the login link!')
    } catch (error) {
      setMessage('Error sending login email')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Welcome to Saga</h1>
          <p className="mt-2 text-muted-foreground">
            Your family's story, a conversation away
          </p>
        </div>

        <Card className="p-8">
          {/* Google Sign In */}
          <div className="space-y-4">
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Email Sign In */}
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="mt-1"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isLoading || !email}
              >
                {isLoading ? 'Sending...' : 'Continue'}
              </Button>
            </form>

            {message && (
              <div className={`text-sm text-center ${
                message.includes('Error') ? 'text-destructive' : 'text-primary'
              }`}>
                {message}
              </div>
            )}
          </div>
        </Card>

        {/* Footer Links */}
        <div className="text-center text-sm text-muted-foreground space-x-4">
          <Link href="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <SignInPageContent />
    </Suspense>
  )
}
