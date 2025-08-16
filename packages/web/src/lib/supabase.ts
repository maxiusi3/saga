import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Debug: Log environment variables (remove in production)
if (typeof window !== 'undefined') {
  console.log('Supabase URL:', supabaseUrl)
  console.log('Supabase Anon Key exists:', !!supabaseAnonKey)
}

// Client-side Supabase client
export const createClientSupabase = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase configuration missing for client:', {
      url: !!supabaseUrl,
      key: !!supabaseAnonKey
    })
    throw new Error('Supabase client configuration is incomplete')
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
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