import { toast } from 'react-hot-toast'

export interface AIContent {
  title: string
  summary: string
  transcript: string
  followUpQuestions: string[]
  confidence: number
}

export interface TranscriptionResult {
  text: string
  confidence: number
  duration?: number
}

export interface AIProcessingOptions {
  onProgress?: (step: string, progress: number) => void
  language?: string
  maxRetries?: number
}

export class AIService {
  private static readonly API_BASE_URL = '/api/ai'
  private static readonly MOCK_MODE = !process.env.NEXT_PUBLIC_OPENROUTER_API_KEY

  /**
   * Transcribe audio using OpenAI Whisper API
   */
  static async transcribeAudio(
    audioBlob: Blob,
    options: AIProcessingOptions = {}
  ): Promise<TranscriptionResult> {
    const { onProgress, language = 'en', maxRetries = 3 } = options

    if (this.MOCK_MODE) {
      return this.mockTranscribeAudio(audioBlob, onProgress)
    }

    try {
      onProgress?.('Preparing audio for transcription...', 10)

      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('language', language)

      onProgress?.('Sending to transcription service...', 30)

      const response = await fetch(`${this.API_BASE_URL}/transcribe`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`)
      }

      onProgress?.('Processing transcription...', 80)

      const result = await response.json()
      
      onProgress?.('Transcription complete!', 100)

      return {
        text: result.text || '',
        confidence: result.confidence || 0.9,
        duration: result.duration
      }
    } catch (error) {
      console.error('Transcription error:', error)
      
      if (maxRetries > 0) {
        console.log(`Retrying transcription... (${maxRetries} attempts left)`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        return this.transcribeAudio(audioBlob, { ...options, maxRetries: maxRetries - 1 })
      }
      
      throw new Error('Failed to transcribe audio. Please try again.')
    }
  }

  /**
   * Generate AI content from transcript
   */
  static async generateAIContent(
    transcript: string,
    prompt?: string,
    options: AIProcessingOptions = {}
  ): Promise<AIContent> {
    const { onProgress, maxRetries = 3 } = options

    if (this.MOCK_MODE) {
      return this.mockGenerateAIContent(transcript, onProgress)
    }

    try {
      onProgress?.('Analyzing story content...', 20)

      const response = await fetch(`${this.API_BASE_URL}/generate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          prompt,
          language: options.language || 'en'
        }),
      })

      if (!response.ok) {
        throw new Error(`AI content generation failed: ${response.statusText}`)
      }

      onProgress?.('Generating title and summary...', 60)

      const result = await response.json()

      onProgress?.('Creating follow-up questions...', 90)

      return {
        title: result.title || 'Untitled Story',
        summary: result.summary || 'No summary available',
        transcript: transcript,
        followUpQuestions: result.followUpQuestions || [],
        confidence: result.confidence || 0.8
      }
    } catch (error) {
      console.error('AI content generation error:', error)
      
      if (maxRetries > 0) {
        console.log(`Retrying AI content generation... (${maxRetries} attempts left)`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        return this.generateAIContent(transcript, prompt, { ...options, maxRetries: maxRetries - 1 })
      }
      
      throw new Error('Failed to generate AI content. Please try again.')
    }
  }

  /**
   * Process audio file and generate complete AI content
   */
  static async processAudioWithAI(
    audioBlob: Blob,
    prompt?: string,
    options: AIProcessingOptions = {}
  ): Promise<AIContent> {
    const { onProgress } = options

    try {
      // Step 1: Transcribe audio
      onProgress?.('Starting audio transcription...', 0)
      const transcriptionResult = await this.transcribeAudio(audioBlob, {
        ...options,
        onProgress: (step, progress) => onProgress?.(step, progress * 0.5)
      })

      // Step 2: Generate AI content
      onProgress?.('Generating AI content...', 50)
      const aiContent = await this.generateAIContent(
        transcriptionResult.text,
        prompt,
        {
          ...options,
          onProgress: (step, progress) => onProgress?.(step, 50 + progress * 0.5)
        }
      )

      onProgress?.('Processing complete!', 100)
      return aiContent
    } catch (error) {
      console.error('AI processing error:', error)
      throw error
    }
  }

  /**
   * Mock transcription for development/demo
   */
  private static async mockTranscribeAudio(
    audioBlob: Blob,
    onProgress?: (step: string, progress: number) => void
  ): Promise<TranscriptionResult> {
    onProgress?.('Preparing audio for transcription...', 10)
    await new Promise(resolve => setTimeout(resolve, 500))

    onProgress?.('Analyzing audio content...', 40)
    await new Promise(resolve => setTimeout(resolve, 1000))

    onProgress?.('Generating transcript...', 80)
    await new Promise(resolve => setTimeout(resolve, 1000))

    onProgress?.('Transcription complete!', 100)

    const mockTranscripts = [
      "I remember when I was just seven years old, living in that small house on Maple Street. The neighborhood was so different back then - kids played outside until the streetlights came on, and everyone knew each other. My mother would call us in for dinner by ringing a bell from the front porch, and we'd come running from wherever we were playing in the neighborhood.",
      "My first day at work was both exciting and terrifying. I walked through those office doors not knowing what to expect, but everyone was so welcoming. I remember my supervisor showing me around and introducing me to the team. It felt like the beginning of something important in my life.",
      "The summer of 1965 was unforgettable. We spent every day at the lake, swimming and fishing with our friends. Dad would pack sandwiches and we'd stay there from sunrise to sunset. Those were the days when time seemed to move slower, and every moment felt precious."
    ]

    const randomTranscript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)]

    return {
      text: randomTranscript,
      confidence: 0.92,
      duration: Math.floor(audioBlob.size / 1000) // Rough estimate
    }
  }

  /**
   * Mock AI content generation for development/demo
   */
  private static async mockGenerateAIContent(
    transcript: string,
    onProgress?: (step: string, progress: number) => void
  ): Promise<AIContent> {
    onProgress?.('Analyzing story themes...', 20)
    await new Promise(resolve => setTimeout(resolve, 800))

    onProgress?.('Generating title suggestions...', 50)
    await new Promise(resolve => setTimeout(resolve, 800))

    onProgress?.('Creating summary...', 80)
    await new Promise(resolve => setTimeout(resolve, 800))

    onProgress?.('Preparing follow-up questions...', 95)
    await new Promise(resolve => setTimeout(resolve, 500))

    // Generate content based on transcript keywords
    const isChildhood = transcript.toLowerCase().includes('child') || transcript.toLowerCase().includes('young')
    const isWork = transcript.toLowerCase().includes('work') || transcript.toLowerCase().includes('job')
    const isFamily = transcript.toLowerCase().includes('family') || transcript.toLowerCase().includes('mother') || transcript.toLowerCase().includes('father')

    let title = "A Meaningful Memory"
    let summary = "A heartfelt story about an important moment in life."
    let followUpQuestions = [
      "Can you tell me more about how that experience affected you?",
      "What do you remember most vividly about that time?",
      "How did that moment shape who you are today?"
    ]

    if (isChildhood) {
      title = "Growing Up in Simpler Times"
      summary = "A nostalgic recollection of childhood memories, capturing the innocence and wonder of growing up in a different era."
      followUpQuestions = [
        "What games did you and your friends play back then?",
        "Can you describe what your neighborhood was like?",
        "What was your favorite thing about being a child in that time?"
      ]
    } else if (isWork) {
      title = "Starting My Career Journey"
      summary = "A reflection on the early days of professional life, filled with excitement, nervousness, and new beginnings."
      followUpQuestions = [
        "What was the most surprising thing about your first job?",
        "How did your colleagues welcome you?",
        "What advice would you give to someone starting their career today?"
      ]
    } else if (isFamily) {
      title = "Family Memories That Matter"
      summary = "A touching story about family bonds and the moments that bring us together."
      followUpQuestions = [
        "What family traditions were most important to you?",
        "How did your family show love and support?",
        "What values did your family teach you?"
      ]
    }

    return {
      title,
      summary,
      transcript,
      followUpQuestions,
      confidence: 0.88
    }
  }

  /**
   * Check if AI services are available
   */
  static async checkAvailability(): Promise<boolean> {
    if (this.MOCK_MODE) {
      return true
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/health`, {
        method: 'GET',
      })
      return response.ok
    } catch (error) {
      console.error('AI service availability check failed:', error)
      return false
    }
  }

  /**
   * Get AI service status
   */
  static getServiceStatus(): { available: boolean; mode: 'production' | 'mock' } {
    return {
      available: true,
      mode: this.MOCK_MODE ? 'mock' : 'production'
    }
  }
}

// Export singleton instance
export const aiService = AIService
