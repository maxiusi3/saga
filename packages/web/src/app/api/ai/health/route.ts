import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET(request: NextRequest) {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      openrouter_configured: !!process.env.OPENROUTER_API_KEY,
      services: {
        transcription: true, // Web Speech API
        content_generation: false
      },
      mode: process.env.OPENROUTER_API_KEY ? 'production' : 'mock',
      model: 'z-ai/glm-4.5-air:free'
    }

    // If OpenRouter is configured, mark content generation as available
    if (process.env.OPENROUTER_API_KEY) {
      status.services.content_generation = true
    }

    return NextResponse.json(status)

  } catch (error) {
    console.error('Health check error:', error)
    
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        openrouter_configured: !!process.env.OPENROUTER_API_KEY,
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
