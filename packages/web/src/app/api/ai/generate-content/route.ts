import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenRouter client (compatible with OpenAI SDK)
const openai = process.env.OPENROUTER_API_KEY ? new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000',
    'X-Title': 'Saga Family Biography Platform'
  }
}) : null

export async function POST(request: NextRequest) {
  try {
    // Check if OpenRouter API key is configured
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { transcript, prompt, language = 'en' } = body

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: 'No transcript provided' },
        { status: 400 }
      )
    }

    console.log(`Generating AI content for transcript (${transcript.length} chars)`)

    // Create system prompt for story analysis
    const systemPrompt = `You are an expert storyteller and family historian. Your task is to analyze personal stories and create meaningful titles, summaries, and follow-up questions that help preserve family memories.

Guidelines:
- Create titles that are specific, emotional, and memorable
- Write summaries that capture the essence and emotional significance
- Generate follow-up questions that encourage deeper storytelling
- Be respectful and sensitive to personal experiences
- Focus on the human elements and emotional connections
- Keep language warm and conversational

Response format should be valid JSON with these fields:
- title: A compelling, specific title (max 60 characters)
- summary: A warm, engaging summary (2-3 sentences)
- followUpQuestions: Array of 3-4 thoughtful questions
- confidence: Number between 0.7 and 1.0 indicating analysis confidence`

    // Create user prompt with the transcript
    const userPrompt = `Please analyze this personal story and generate appropriate content:

${prompt ? `Story context/prompt: ${prompt}\n\n` : ''}Story transcript:
"${transcript}"

Generate a title, summary, and follow-up questions that would help this person share more meaningful memories.`

    // Call OpenRouter GPT API
    if (!openai) {
      throw new Error('OpenRouter client not initialized')
    }

    const completion = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat-v3.1:free', // DeepSeek model via OpenRouter
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7, // Balanced creativity and consistency
      max_tokens: 800,
      response_format: { type: 'json_object' }
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    console.log('AI content generation completed successfully')

    // Parse the JSON response
    let aiContent
    try {
      aiContent = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      throw new Error('Invalid response format from AI')
    }

    // Validate and sanitize the response
    const result = {
      title: aiContent.title || 'Untitled Story',
      summary: aiContent.summary || 'A meaningful personal story.',
      followUpQuestions: Array.isArray(aiContent.followUpQuestions) 
        ? aiContent.followUpQuestions.slice(0, 4) // Limit to 4 questions
        : [
            'Can you tell me more about how that experience affected you?',
            'What do you remember most vividly about that time?',
            'How did that moment shape who you are today?'
          ],
      confidence: typeof aiContent.confidence === 'number' 
        ? Math.max(0.7, Math.min(1.0, aiContent.confidence))
        : 0.8
    }

    // Ensure title is not too long
    if (result.title.length > 60) {
      result.title = result.title.substring(0, 57) + '...'
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('AI content generation error:', error)

    // Handle specific OpenAI errors
    if (error?.error?.type === 'invalid_request_error') {
      return NextResponse.json(
        { error: 'Invalid request to AI service' },
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
        error: 'AI content generation failed. Please try again.',
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
