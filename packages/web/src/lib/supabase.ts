import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Clean environment variables (remove any whitespace/newlines)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()!

function isValidUrl(url?: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
  } catch {
    return false
  }
}

const unavailable = () => ({ data: { user: null, session: null }, error: { message: 'Authentication unavailable' } })
const stub = { auth: {
  getSession: async () => unavailable(), getUser: async () => unavailable(),
  signInWithPassword: async () => unavailable(), signUp: async () => unavailable(),
  signOut: async () => unavailable(), signInWithOAuth: async () => unavailable(),
  signInWithOtp: async () => unavailable(), verifyOtp: async () => unavailable(), setSession: async () => unavailable(),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
} }

let browserClient: ReturnType<typeof createBrowserClient> | null = null
function removeLegacyAuthStorage() {
  // Never import cached credentials or enumerate/clear unrelated user data.
  const key = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  for (const name of ['auth-store', key, `${key}-code-verifier`]) {
    try { window.localStorage.removeItem(name) } catch { /* best effort */ }
  }
}

// Auth-js logs failed recovery internally. Give it safe errors at the network
// boundary instead of changing its logger, retry policy or cookie lifecycle.
const browserFetch: typeof fetch = async (resource, init) => {
  const target = new URL(typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource.url)
  const configured = new URL(supabaseUrl)
  if (target.origin !== configured.origin || !target.pathname.startsWith(`${configured.pathname.replace(/\/$/, '')}/auth/v1/`)) {
    return fetch(resource, init)
  }
  try {
    const response = await fetch(resource, init)
    if (response.ok) {
      if (response.status === 204 || response.status === 205) return response
      // Validate/read inside the safe boundary so malformed JSON or failed body
      // reads cannot expose provider content via an SDK parsing exception.
      const body = await response.text()
      JSON.parse(body)
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
    }
    let code: unknown
    try { const body = await response.json(); code = body?.code ?? body?.error_code } catch { /* fixed error below */ }
    // These codes affect SDK session removal/error classification. Unknown
    // provider diagnostics must never become raw AuthApiError.code values.
    const safeCode = ['session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'weak_password'].includes(code as string) ? code : undefined
    return Response.json({ msg: 'Authentication unavailable', code: safeCode }, {
      status: response.status, headers: { 'X-Supabase-Api-Version': '2024-01-01' },
    })
  } catch {
    // Keep fetch rejection retryable to auth-js, without the original message,
    // stack or cause. Successful retries can still restore the existing cookie.
    throw new Error('Authentication unavailable')
  }
}

// A server render has no request cookies: never share a browser session there.
export const createClientSupabase = (): any => {
  if (!supabaseUrl || !supabaseAnonKey || !isValidUrl(supabaseUrl)) return stub
  if (typeof window === 'undefined') return createServerSupabase()
  if (!browserClient) {
    removeLegacyAuthStorage()
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: { detectSessionInUrl: false },
      global: { fetch: browserFetch },
    })
  }
  return browserClient
}

export const createServerSupabase = (): any => {
  if (!supabaseUrl || !supabaseAnonKey || !isValidUrl(supabaseUrl)) throw new Error('Authentication unavailable')
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

// Admin client (server-side only) - lazy initialization
let _supabaseAdmin: ReturnType<typeof createClient> | null = null

export const getSupabaseAdmin = (): any => {
  if (!_supabaseAdmin) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey || !isValidUrl(supabaseUrl)) {
      throw new Error('Supabase admin configuration is incomplete or invalid')
    }

    _supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  }
  return _supabaseAdmin
}

// Default client for general use (client-side) - use createClientSupabase() instead
// Note: Don't create client at module level to avoid initialization errors
// Use createClientSupabase() function instead
