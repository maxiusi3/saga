import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getSupabaseAdmin } from '@/lib/supabase'

export interface AuthenticatedUser {
  user: User
}

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey) {
    throw new Error('Supabase public environment variables are required')
  }

  return { url, anonKey }
}

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthResult> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (bearer) {
    const { data, error } = await getSupabaseAdmin().auth.getUser(bearer)
    if (!error && data.user) return { ok: true, user: data.user }
  }

  const { url, anonKey } = getSupabaseEnv()
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  const { data, error } = await supabase.auth.getUser()
  if (!error && data.user) return { ok: true, user: data.user }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  }
}
