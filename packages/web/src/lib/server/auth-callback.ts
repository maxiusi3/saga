import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { authLocale, authReturnTarget, EMAIL_AUTH_TYPES, hasVerifiedSession, isAuthCredential } from '@/lib/auth-return'

type CookieWrite = { name: string; value: string; options: CookieOptions }
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
function deletion(cookie: CookieWrite) {
  return cookie.options.maxAge === 0 || (cookie.options.expires !== undefined && +cookie.options.expires <= Date.now())
}
function redirect(origin: string, path: string, writes: CookieWrite[], success: boolean) {
  const response = NextResponse.redirect(`${origin}${path}`, { status: 303, headers })
  for (const cookie of writes) if (success || deletion(cookie)) response.cookies.set(cookie.name, cookie.value, cookie.options)
  return response
}
type CallbackInput = { code: string } | { token_hash: string; type: typeof EMAIL_AUTH_TYPES[number] }
function callbackInput(params: URLSearchParams): CallbackInput | null {
  if (params.has('error') || ['code', 'token_hash', 'type'].some(key => params.getAll(key).length > 1)
    || ['access_token', 'refresh_token', 'provider_token', 'provider_refresh_token'].some(key => params.has(key))) return null
  const code = params.get('code'), tokenHash = params.get('token_hash'), type = params.get('type')
  if (params.has('code')) return !params.has('token_hash') && !params.has('type') && isAuthCredential(code) ? { code } : null
  return isAuthCredential(tokenHash) && EMAIL_AUTH_TYPES.includes(type as typeof EMAIL_AUTH_TYPES[number])
    ? { token_hash: tokenHash, type: type as typeof EMAIL_AUTH_TYPES[number] } : null
}
function operationDeadline(caller: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  caller.addEventListener('abort', abort, { once: true })
  if (caller.aborted) abort()
  const timer = setTimeout(abort, 10_000)
  return {
    signal: controller.signal,
    async run<T>(work: PromiseLike<T>): Promise<T> {
      let onAbort: () => void = () => {}
      const stopped = new Promise<never>((_, reject) => {
        onAbort = () => reject(new Error('Authentication unavailable'))
        controller.signal.addEventListener('abort', onAbort, { once: true })
        if (controller.signal.aborted) onAbort()
      })
      try { return await Promise.race([work, stopped]) }
      finally { controller.signal.removeEventListener('abort', onAbort) }
    },
    close() { clearTimeout(timer); caller.removeEventListener('abort', abort); controller.abort() },
  }
}

export async function handleAuthCallback(request: NextRequest) {
  const url = new URL(request.url)
  const locale = authLocale(url.pathname.split('/')[1])
  const target = authReturnTarget(url.searchParams, locale)
  const failurePath = `/${locale}/auth/signin?${new URLSearchParams({ error: 'auth_failed', next: target })}`
  const writes: CookieWrite[] = []
  const fail = () => {
    try { return redirect(url.origin, failurePath, writes, false) }
    catch { return redirect(url.origin, failurePath, [], false) }
  }
  const deadline = operationDeadline(request.signal)
  try {
    const input = callbackInput(url.searchParams)
    if (!input || deadline.signal.aborted) return fail()
    const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!publicUrl || !anonKey) return fail()
    const provider = new URL(publicUrl)
    if (!['http:', 'https:'].includes(provider.protocol) || provider.username || provider.password || provider.search || provider.hash) return fail()
    const requestCookies = request.cookies.getAll()
    const storageKey = `sb-${provider.hostname.split('.')[0]}-auth-token`
    // Existing sessions are not callback credentials. Preserve their names for
    // SSR stale-chunk deletion, but never let its initial-session event refresh
    // or trust their values. Only the PKCE verifier is read from this request.
    const cookieNames = requestCookies.map(cookie => ({
      name: cookie.name,
      value: cookie.name === `${storageKey}-code-verifier` || cookie.name.startsWith(`${storageKey}-code-verifier.`) ? cookie.value : '',
    }))
    let transportFailed = false
    let dispatched = false
    const expectedUrl = `${publicUrl.replace(/\/$/, '')}/auth/v1/${'code' in input ? 'token?grant_type=pkce' : 'verify'}`
    const unavailable = () => Response.json({ msg: 'Authentication unavailable', code: 'auth_unavailable' }, { status: 400 })
    const client = createServerClient(publicUrl, anonKey, {
      cookies: {
        getAll: () => cookieNames,
        setAll: cookies => { if (!deadline.signal.aborted) writes.push(...cookies) },
      },
      global: {
        fetch: async (resource, init) => {
          // Guard SDK re-entry and unexpected refreshes as well as HTTP redirects.
          if (deadline.signal.aborted || dispatched || String(resource) !== expectedUrl || init?.method !== 'POST') {
            transportFailed = true
            return unavailable()
          }
          dispatched = true
          try {
            const response = await deadline.run(fetch(resource, { ...init, signal: deadline.signal, redirect: 'error' }))
            // Read the entire body inside the same deadline. Never expose raw
            // transport exceptions to auth-js, whose fetch catch logs them.
            const body = await deadline.run(response.text())
            const parsed: unknown = JSON.parse(body)
            return Response.json(parsed, { status: response.status, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
          } catch {
            transportFailed = true
            return unavailable()
          }
        },
      },
    })
    const result = await deadline.run('code' in input
      ? client.auth.exchangeCodeForSession(input.code)
      : client.auth.verifyOtp(input))
    if (deadline.signal.aborted || transportFailed || result.error || !hasVerifiedSession(result.data)) return fail()
    return redirect(url.origin, target, writes, true)
  } catch { return fail() }
  finally { deadline.close() }
}
