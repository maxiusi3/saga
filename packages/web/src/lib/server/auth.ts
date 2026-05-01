import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, serialize, type CookieOptions } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getSupabaseAdmin } from '@/lib/supabase'

export interface AuthenticatedUser {
  user: User
}

export type AuthResult =
  | { ok: true; user: User; headers: Headers }
  | { ok: false; response: NextResponse }

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey) {
    throw new Error('Supabase public environment variables are required')
  }

  return { url, anonKey }
}

function authServiceUnavailable() {
  return NextResponse.json({ error: 'Authentication service not configured' }, { status: 503 })
}

function appendSetCookie(headers: Headers, name: string, value: string, options: CookieOptions) {
  headers.append('Set-Cookie', serialize(name, value, options))
}

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthResult> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const responseHeaders = new Headers()

  if (bearer) {
    let admin: ReturnType<typeof getSupabaseAdmin>
    try {
      admin = getSupabaseAdmin()
    } catch {
      return { ok: false, response: authServiceUnavailable() }
    }

    const { data, error } = await admin.auth.getUser(bearer)
    if (!error && data.user) return { ok: true, user: data.user, headers: responseHeaders }
  }

  let supabaseEnv: ReturnType<typeof getSupabaseEnv>
  try {
    supabaseEnv = getSupabaseEnv()
  } catch {
    return { ok: false, response: authServiceUnavailable() }
  }

  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        appendSetCookie(responseHeaders, name, value, options)
      },
      remove(name: string, options: CookieOptions) {
        appendSetCookie(responseHeaders, name, '', { ...options, maxAge: 0, expires: new Date(0) })
      },
    },
  })

  const { data, error } = await supabase.auth.getUser()
  if (!error && data.user) return { ok: true, user: data.user, headers: responseHeaders }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: responseHeaders }),
  }
}
