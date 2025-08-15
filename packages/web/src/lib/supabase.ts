import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side Supabase client
export const createClientSupabase = () => 
  createClientComponentClient<Database>()

// Server-side Supabase client (use this in Server Components)
export const createServerSupabase = () => {
  const { cookies } = require('next/headers')
  return createServerComponentClient<Database>({ cookies })
}

// Admin client (server-side only)
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Default client for general use (client-side)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)