import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Check environment variables
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY_EXISTS: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY_LENGTH: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
      SUPABASE_SERVICE_ROLE_KEY_EXISTS: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      timestamp: new Date().toISOString()
    }

    // Test Supabase connection from server
    let supabaseTest = null
    try {
      const { createServerSupabase } = await import('@/lib/supabase')
      const supabase = createServerSupabase()
      
      // Test basic query
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1)
      
      supabaseTest = {
        success: !error,
        error: error?.message,
        hasData: !!data
      }
    } catch (err) {
      supabaseTest = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        type: 'exception'
      }
    }

    return NextResponse.json({
      environment: envCheck,
      supabaseTest,
      status: 'ok'
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'error'
    }, { status: 500 })
  }
}
