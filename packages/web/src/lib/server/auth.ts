import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, serialize } from '@supabase/ssr'
import { createClient, type User } from '@supabase/supabase-js'
import { isUuid } from '@/lib/invitation-acceptance-protocol'

export interface AuthenticatedUser { user: User }
export type AuthResult =
  | { ok: true; user: User; headers: Headers }
  | { ok: false; response: NextResponse }

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthResult> {
  const headers = new Headers()
  const failure = (status: number): AuthResult => ({ ok: false, response: NextResponse.json(
    { error: status === 401 ? 'Unauthorized' : 'Authentication service unavailable' }, { status, headers },
  ) })
  // An explicit credential selects Bearer mode, even when it is malformed.
  const authorization = request.headers.get('authorization')
  const bearer = authorization?.match(/^Bearer ([A-Za-z0-9._~+/-]+=*)$/i)?.[1]
  if (authorization !== null && !bearer) return failure(401)
  const controller = new AbortController()
  const abort = () => controller.abort()
  request.signal.addEventListener('abort', abort, { once: true })
  if (request.signal.aborted) abort()
  const timer = setTimeout(abort, 10_000)
  const bounded = async <T,>(work: PromiseLike<T>): Promise<T> => {
    let stop = () => {}
    const expired = new Promise<never>((_, reject) => {
      stop = () => reject(new Error('Authentication unavailable'))
      controller.signal.addEventListener('abort', stop, { once: true })
      if (controller.signal.aborted) stop()
    })
    try { return await Promise.race([work, expired]) }
    finally { controller.signal.removeEventListener('abort', stop) }
  }
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    if (!url || !anonKey) return failure(503)
    const provider = new URL(url)
    if (!['http:', 'https:'].includes(provider.protocol) || provider.username || provider.password || provider.search || provider.hash || controller.signal.aborted) return failure(503)
    const base = `${url.replace(/\/$/, '')}/auth/v1`
    const dispatched = new Set<string>()
    let transportFailed = false
    const unavailable = () => Response.json({ msg: 'Authentication unavailable', code: 'auth_unavailable' }, { status: 400 })
    const transport: typeof fetch = async (resource, init) => {
      const target = String(resource)
      const allowed = (target === `${base}/user` && init?.method === 'GET')
        || (!bearer && target === `${base}/token?grant_type=refresh_token` && init?.method === 'POST')
      if (!allowed || dispatched.has(target) || controller.signal.aborted) { transportFailed = true; return unavailable() }
      dispatched.add(target)
      try {
        const response = await bounded(fetch(resource, { ...init, signal: controller.signal, redirect: 'error' }))
        const body: unknown = JSON.parse(await bounded(response.text()))
        // Auth-js retries some status codes and logs raw fetch exceptions. Return
        // a finite, safe SDK error instead, keeping all transport work in budget.
        if (response.status >= 500 || response.status === 429) { transportFailed = true; return unavailable() }
        return Response.json(response.ok ? body : { msg: 'Authentication rejected', code: 'session_not_found' }, {
          status: response.status, headers: { 'X-Supabase-Api-Version': '2024-01-01' },
        })
      } catch { transportFailed = true; return unavailable() }
    }
    const client = bearer
      ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: transport } })
      : createServerClient(url, anonKey, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: writes => {
            // Synthetic unavailable responses stop SDK retries, but their
            // resulting removals are not a provider revocation decision.
            if (controller.signal.aborted || transportFailed) return
            for (const { name, value, options } of writes) headers.append('Set-Cookie', serialize(name, value, options))
          },
        },
        global: { fetch: transport },
      })
    const result = await bounded(client.auth.getUser(bearer))
    if (controller.signal.aborted || transportFailed) return failure(503)
    if (result.error || !result.data.user || !isUuid(result.data.user.id)) return failure(401)
    return { ok: true, user: result.data.user, headers }
  } catch { return failure(503) }
  finally { clearTimeout(timer); request.signal.removeEventListener('abort', abort); controller.abort() }
}
