import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Clean environment variables (remove any whitespace/newlines)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()!

function isValidUrl(url?: string): boolean {
  if (!url) return false
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Debug: Log environment variables (remove in production)
if (typeof window !== 'undefined') {
  console.log('Supabase URL valid:', isValidUrl(supabaseUrl))
  console.log('Supabase Anon Key exists:', !!supabaseAnonKey)
}

// Singleton client instance to avoid multiple GoTrueClient instances
let _supabaseClient: ReturnType<typeof createClient<Database>> | null = null

// Client-side Supabase client
export const createClientSupabase = () => {
  if (!supabaseUrl || !supabaseAnonKey || !isValidUrl(supabaseUrl)) {
    console.warn('Supabase client configuration is incomplete or invalid URL. Using stub client for local preview.')
    // Minimal stub client to avoid runtime errors in environments without Supabase
    const stubAuth: any = {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: (cb: any) => ({ data: { subscription: { unsubscribe() {} } }, error: null }),
      signInWithPassword: async () => ({ data: { user: null }, error: { message: 'Supabase not configured' } }),
      signUp: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
      signOut: async () => ({ error: null }),
      signInWithOAuth: async () => ({ error: { message: 'Supabase not configured' } }),
      getUser: async () => ({ data: { user: null }, error: null }),
    }
    return { auth: stubAuth } as any
  }

  // Return existing client if available (singleton pattern)
  if (_supabaseClient) {
    return _supabaseClient
  }

  // Create new client
  _supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  })

  return _supabaseClient
}

// Server-side Supabase client (use this in Server Components)
export const createServerSupabase = () => {
  if (!supabaseUrl || !supabaseAnonKey || !isValidUrl(supabaseUrl)) {
    console.error('Supabase configuration missing or invalid for server:', {
      url: isValidUrl(supabaseUrl),
      key: !!supabaseAnonKey
    })
    throw new Error('Supabase server configuration is incomplete or invalid')
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Admin client (server-side only) - lazy initialization
let _supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null

export const getSupabaseAdmin = () => {
  if (!_supabaseAdmin) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey || !isValidUrl(supabaseUrl)) {
      console.error('Supabase admin configuration missing or invalid:', {
        url: isValidUrl(supabaseUrl),
        serviceKey: !!serviceRoleKey
      })
      throw new Error('Supabase admin configuration is incomplete or invalid')
    }

    _supabaseAdmin = createClient<Database>(
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