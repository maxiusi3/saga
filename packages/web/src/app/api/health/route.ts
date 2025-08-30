import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

// Health check endpoint for deployment verification
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Basic health check response
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      deployment: {
        platform: 'vercel',
        region: process.env.VERCEL_REGION || 'unknown',
        url: process.env.VERCEL_URL || 'localhost'
      },
      services: {
        supabase: 'checking...',
        stripe: 'checking...'
      },
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      responseTime: 0
    }

    // Test Supabase connection
    try {
      const supabase = createServerSupabase()
      const { error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows, which is fine
        throw error
      }

      healthStatus.services.supabase = 'connected'
    } catch (supabaseError) {
      console.error('Supabase health check failed:', supabaseError)
      healthStatus.services.supabase = 'error'
      healthStatus.status = 'degraded'
    }

    // Test Stripe configuration (just check if keys are present)
    try {
      const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY

      if (stripePublishableKey && stripeSecretKey) {
        // Check if keys look valid (basic format check)
        const pubKeyValid = stripePublishableKey.startsWith('pk_')
        const secretKeyValid = stripeSecretKey.startsWith('sk_')

        if (pubKeyValid && secretKeyValid) {
          healthStatus.services.stripe = 'configured'
        } else {
          healthStatus.services.stripe = 'invalid_keys'
          healthStatus.status = 'degraded'
        }
      } else {
        healthStatus.services.stripe = 'not_configured'
        healthStatus.status = 'degraded'
      }
    } catch (stripeError) {
      console.error('Stripe health check failed:', stripeError)
      healthStatus.services.stripe = 'error'
      healthStatus.status = 'degraded'
    }

    // Calculate response time
    healthStatus.responseTime = Date.now() - startTime

    // Return appropriate status code
    const statusCode = healthStatus.status === 'healthy' ? 200 :
                      healthStatus.status === 'degraded' ? 200 : 503

    return NextResponse.json(healthStatus, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Health check failed:', error)

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache'
    },
  })
}
