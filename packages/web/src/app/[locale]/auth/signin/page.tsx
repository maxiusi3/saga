'use client'

// 避免构建期预渲染导致的环境变量缺失问题
// 在 Next.js 15 中，我们通过运行时检查来避免 SSG

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'
import { useLocale, useTranslations } from 'next-intl'
import { AUTH_RETURN_ERROR, authLocale, authReturnTarget, hasVerifiedSession, parseSessionReturn, removeLegacyAuthNext } from '@/lib/auth-return'

function SignInPageContent() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isClient, setIsClient] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const t = useTranslations('auth')

  const safeLocale = authLocale(locale)
  const query = searchParams?.toString() || ''
  const target = authReturnTarget(new URLSearchParams(query), safeLocale)
  const context = `${safeLocale}:${target}`
  type Flow = {
    context: string
    query: string
    fragment: string
    cleaned: string
    originalLocation: string
    cleanedLocation: string
    parsed: ReturnType<typeof parseSessionReturn>
    pending?: Promise<{ data?: unknown; error?: unknown }>
  }
  const flowRef = useRef<Flow | null>(null)
  const mounted = useRef(false)
  const fragment = isClient ? window.location.hash.slice(1) : ''
  const currentContext = useRef({ context, query, fragment })
  currentContext.current = { context, query, fragment }
  const isCurrent = useCallback((flow: Flow | null) => {
    const latest = currentContext.current
    const location = window.location.pathname + window.location.search + window.location.hash
    return !!flow && mounted.current && flowRef.current === flow && latest.context === flow.context
      && (latest.query === flow.query || latest.query === flow.cleaned)
      && (!latest.fragment || latest.fragment === flow.fragment)
      && (location === flow.originalLocation || location === flow.cleanedLocation)
  }, [])

  useEffect(() => {
    mounted.current = true
    removeLegacyAuthNext()
    setIsClient(true)
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!isClient) return
    let flow = flowRef.current
    // Next may publish our replaceState cleanup as new search params. Keep the
    // same in-memory attempt in that case, including StrictMode's effect replay.
    if (!flow || flow.context !== context || (query !== flow.query && query !== flow.cleaned)
      || (fragment !== '' && fragment !== flow.fragment)) {
      const cleaned = new URLSearchParams({ next: target }).toString()
      flow = {
        context, query, fragment, cleaned,
        originalLocation: window.location.pathname + window.location.search + window.location.hash,
        cleanedLocation: `/${safeLocale}/auth/signin?${cleaned}`,
        parsed: parseSessionReturn(new URLSearchParams(query), new URLSearchParams(fragment)),
      }
      flowRef.current = flow
      setMessage('')
      setIsLoading(false)
    }
    const attempt = flow
    try {
      window.history.replaceState(window.history.state, '', attempt.cleanedLocation)
    } catch { /* URL cleanup is best effort, including restricted history APIs. */ }
    if (attempt.parsed.kind === 'invalid') { setMessage(AUTH_RETURN_ERROR); return }
    if (attempt.parsed.kind !== 'session') return
    if (!attempt.pending) {
      const credentials = attempt.parsed.credentials
      attempt.pending = Promise.resolve().then(() => createClientSupabase().auth.setSession(credentials))
    }
    let active = true
    const current = () => active && isCurrent(attempt)
    attempt.pending.then(result => {
      if (!current()) return
      if (!result?.error && hasVerifiedSession(result?.data)) router.replace(target)
      else setMessage(AUTH_RETURN_ERROR)
    }).catch(() => { if (current()) setMessage(AUTH_RETURN_ERROR) })
    return () => { active = false }
  }, [context, fragment, isClient, isCurrent, query, router, safeLocale, target])

  const providerRedirect = () => `${window.location.origin}/${safeLocale}/auth/callback?${new URLSearchParams({ next: target })}`

  const handleGoogleSignIn = async () => {
    if (!isClient) return
    const flow = flowRef.current
    setIsLoading(true)
    setMessage('')
    try {
      const redirectTo = providerRedirect()
      const { data, error } = await createClientSupabase().auth.signInWithOAuth({
        provider: 'google', options: { redirectTo, skipBrowserRedirect: true },
      })
      if (!isCurrent(flow)) return
      if (error || !data || typeof data.url !== 'string') throw new Error('Authentication unavailable')
      const configured = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '')
      const provider = new URL(data.url)
      if (!['https:', 'http:'].includes(configured.protocol) || configured.username || configured.password
        || provider.origin !== configured.origin || provider.username || provider.password || provider.hash
        || provider.pathname !== `${configured.pathname.replace(/\/$/, '')}/auth/v1/authorize`
        || provider.searchParams.getAll('provider').length !== 1 || provider.searchParams.get('provider') !== 'google'
        || provider.searchParams.getAll('redirect_to').length !== 1 || provider.searchParams.get('redirect_to') !== redirectTo) {
        throw new Error('Authentication unavailable')
      }
      router.replace(provider.toString())
    } catch {
      if (isCurrent(flow)) setMessage('Error signing in with Google')
    } finally {
      if (isCurrent(flow)) setIsLoading(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !isClient) return
    const flow = flowRef.current
    setIsLoading(true)
    setMessage('')
    try {
      const { error } = await createClientSupabase().auth.signInWithOtp({
        email, options: { emailRedirectTo: providerRedirect() },
      })
      if (isCurrent(flow)) setMessage(error ? 'Error sending login email' : 'Check your email for the login link!')
    } catch {
      if (isCurrent(flow)) setMessage('Error sending login email')
    } finally {
      if (isCurrent(flow)) setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">{t('signin.title')}</h1>
          <p className="mt-2 text-muted-foreground">
            {t('signin.subtitle')}
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
              {t('signin.googleButton')}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {t('signin.divider')}
                </span>
              </div>
            </div>

            {/* Email Sign In */}
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <Label htmlFor="email">{t('signin.emailLabel')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('signin.emailPlaceholder')}
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
                {isLoading ? t('signin.submitButtonLoading') : t('signin.submitButton')}
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
          <Link href={`/${safeLocale}/terms`} className="hover:text-foreground">
            {t('signin.termsOfService')}
          </Link>
          <span>•</span>
          <Link href={`/${safeLocale}/privacy`} className="hover:text-foreground">
            {t('signin.privacyPolicy')}
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
