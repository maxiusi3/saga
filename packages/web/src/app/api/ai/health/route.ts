import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET(request: NextRequest) {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      openai_configured: !!process.env.OPENAI_API_KEY,
      services: {
        transcription: false,
        content_generation: false
      },
      mode: process.env.OPENAI_API_KEY ? 'production' : 'mock'
    }

    // If OpenAI is configured, test the connection
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        })

        // Test with a minimal API call (only during runtime, not build)
        if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'production') {
          const testCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
          temperature: 0
        })

          if (testCompletion.choices[0]?.message?.content) {
            status.services.transcription = true
            status.services.content_generation = true
          }
        } else {
          // Skip API test during build, assume services are available
          status.services.transcription = true
          status.services.content_generation = true
        }
      } catch (error: any) {
        console.error('OpenAI health check failed:', error)
        
        // Still return success but mark services as unavailable
        status.services.transcription = false
        status.services.content_generation = false
      }
    } else {
      // Mock mode - services are "available"
      status.services.transcription = true
      status.services.content_generation = true
    }

    return NextResponse.json(status)

  } catch (error) {
    console.error('Health check error:', error)
    
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        openai_configured: !!process.env.OPENAI_API_KEY,
        services: {
          transcription: false,
          content_generation: false
        },
        mode: 'error',
        error: 'Health check failed'
      },
      { status: 500 }
    )
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
