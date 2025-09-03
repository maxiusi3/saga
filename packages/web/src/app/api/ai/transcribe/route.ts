import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client only if API key is available
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const language = formData.get('language') as string || 'en'

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Validate file size (OpenAI has a 25MB limit)
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Audio file too large. Maximum size is 25MB.' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'audio/webm',
      'audio/mp3',
      'audio/mp4',
      'audio/mpeg',
      'audio/m4a',
      'audio/wav',
      'audio/flac'
    ]
    
    if (!allowedTypes.includes(audioFile.type)) {
      return NextResponse.json(
        { error: `Unsupported audio format: ${audioFile.type}` },
        { status: 400 }
      )
    }

    console.log(`Transcribing audio file: ${audioFile.name}, size: ${audioFile.size} bytes, type: ${audioFile.type}`)

    // Convert File to format expected by OpenAI
    const audioBuffer = await audioFile.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: audioFile.type })
    
    // Create a File object with proper extension
    const fileExtension = audioFile.type.split('/')[1] || 'webm'
    const fileName = `audio.${fileExtension}`
    const audioFileForAPI = new File([audioBlob], fileName, { type: audioFile.type })

    // Call OpenAI Whisper API
    if (!openai) {
      throw new Error('OpenAI client not initialized')
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFileForAPI,
      model: 'whisper-1',
      language: language,
      response_format: 'verbose_json',
      temperature: 0.2, // Lower temperature for more consistent results
    })

    console.log('Transcription completed successfully')

    // Calculate confidence score based on duration and text length
    const duration = transcription.duration || 0
    const textLength = transcription.text?.length || 0
    const confidence = Math.min(0.95, Math.max(0.7, textLength / (duration * 10)))

    return NextResponse.json({
      text: transcription.text || '',
      confidence: confidence,
      duration: duration,
      language: transcription.language || language,
      segments: transcription.segments || []
    })

  } catch (error: any) {
    console.error('Transcription error:', error)

    // Handle specific OpenAI errors
    if (error?.error?.type === 'invalid_request_error') {
      return NextResponse.json(
        { error: 'Invalid audio file format or corrupted file' },
        { status: 400 }
      )
    }

    if (error?.error?.code === 'rate_limit_exceeded') {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    if (error?.error?.code === 'insufficient_quota') {
      return NextResponse.json(
        { error: 'OpenAI quota exceeded. Please check your billing.' },
        { status: 402 }
      )
    }

    // Generic error response
    return NextResponse.json(
      { 
        error: 'Transcription failed. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
