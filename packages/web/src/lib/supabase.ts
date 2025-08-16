import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Clean environment variables (remove any whitespace/newlines)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()!

// Debug: Log environment variables (remove in production)
if (typeof window !== 'undefined') {
  console.log('Supabase URL:', supabaseUrl)
  console.log('Supabase Anon Key exists:', !!supabaseAnonKey)
}

// Singleton client instance to avoid multiple GoTrueClient instances
let _supabaseClient: ReturnType<typeof createClient<Database>> | null = null

// Client-side Supabase client
export const createClientSupabase = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase configuration missing for client:', {
      url: !!supabaseUrl,
      key: !!supabaseAnonKey
    })
    throw new Error('Supabase client configuration is incomplete')
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
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase configuration missing for server:', {
      url: !!supabaseUrl,
      key: !!supabaseAnonKey
    })
    throw new Error('Supabase server configuration is incomplete')
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Admin client (server-side only) - lazy initialization
let _supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null

export const getSupabaseAdmin = () => {
  if (!_supabaseAdmin) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Supabase admin configuration missing:', {
        url: !!supabaseUrl,
        serviceKey: !!serviceRoleKey
      })
      throw new Error('Supabase admin configuration is incomplete')
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