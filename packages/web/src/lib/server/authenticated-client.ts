import { cookies } from 'next/headers'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey) {
    throw new Error('Supabase public environment variables are required')
  }

  return { url, anonKey }
}

export type AuthenticatedClientResult =
  | { ok: true; user: User; client: SupabaseClient<Database> }
  | { ok: false; response: Response }

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function getAuthenticatedClient(request: Request): Promise<AuthenticatedClientResult> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const { url, anonKey } = getSupabaseEnv()
  const cookieStore = await cookies()

  const cookieClient = createServerClient<Database>(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  const cookieAuth = await cookieClient.auth.getUser()
  if (cookieAuth.data.user && !cookieAuth.error) {
    return { ok: true, user: cookieAuth.data.user, client: cookieClient }
  }

  if (!bearer) {
    return { ok: false, response: unauthorized() }
  }

  const bearerClient = createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const bearerAuth = await bearerClient.auth.getUser()
  if (!bearerAuth.data.user || bearerAuth.error) {
    return { ok: false, response: unauthorized() }
  }

  return { ok: true, user: bearerAuth.data.user, client: bearerClient }
}
