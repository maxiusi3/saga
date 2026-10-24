import { useAuthStore } from '@/stores/auth-store'
import { InvalidAIResponseError, parseGeneratedContent, parseTranscriptionResponse } from './ai-response'
import type { MediaBucket } from './media-reference'

export interface AIContent {
  title: string
  summary: string
  transcript: string
  followUpQuestions: string[]
  confidence?: number
}

export interface TranscriptionResult {
  text: string
  confidence?: number
  duration?: number
}

export interface AIProcessingOptions {
  onProgress?: (step: string, progress: number) => void
  language?: string
  maxRetries?: number
}

export class AIService {
  private static readonly API_BASE_URL = '/api/ai'

  private static async authHeaders(): Promise<Record<string, string>> {
    const token = await useAuthStore.getState().getAccessToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  /**
   * Transcribe audio through the configured server-side provider.
   * AUD-03 FIX: For large files (>4MB), upload to storage first and pass storagePath
   */
  static async transcribeAudio(
    audioBlob: Blob,
    options: AIProcessingOptions & { storagePath?: string; storageBucket?: MediaBucket } = {}
  ): Promise<TranscriptionResult> {
    const { onProgress, language = 'en', maxRetries = 3, storagePath, storageBucket = 'audio-recordings' } = options

    try {
      onProgress?.('Preparing audio for transcription...', 10)

      const formData = new FormData()

      // AUD-03 FIX: Send storagePath for large files, blob for small files
      if (storagePath) {
        formData.append('storagePath', storagePath)
        formData.append('storageBucket', storageBucket)
      } else {
        formData.append('audio', audioBlob, audioBlob instanceof File ? audioBlob.name : 'recording.webm')
      }
      formData.append('language', language)

      onProgress?.('Sending to transcription service...', 30)

      const response = await fetch(`${this.API_BASE_URL}/transcribe`, {
        method: 'POST',
        headers: await this.authHeaders(),
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`)
      }

      onProgress?.('Processing transcription...', 80)

      const result = parseTranscriptionResponse(await response.json())

      onProgress?.('Transcription complete!', 100)

      return result
    } catch (error) {
      console.error('Transcription error:', error)

      if (maxRetries > 0 && !(error instanceof InvalidAIResponseError)) {
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

    try {
      onProgress?.('Analyzing story content...', 20)

      const response = await fetch(`${this.API_BASE_URL}/generate-content`, {
        method: 'POST',
        headers: {
          ...(await this.authHeaders()),
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

      const result = parseGeneratedContent(await response.json())

      onProgress?.('Creating follow-up questions...', 90)

      return {
        ...result,
        transcript: transcript,
      }
    } catch (error) {
      console.error('AI content generation error:', error)

      if (maxRetries > 0 && !(error instanceof InvalidAIResponseError)) {
        console.log(`Retrying AI content generation... (${maxRetries} attempts left)`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        return this.generateAIContent(transcript, prompt, { ...options, maxRetries: maxRetries - 1 })
      }

      throw new Error('Failed to generate AI content. Please try again.')
    }
  }

  /**
   * Wrapper for generateAIContent to match expected API in page.tsx
   */
  static async generateContentFromTranscript(
    transcript: string,
    prompt?: string,
    language: string = 'en'
  ): Promise<AIContent> {
    return this.generateAIContent(transcript, prompt, { language })
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
   * Generate a real-time prompt based on the current transcript
   */
  static async generateRealtimePrompt(transcript: string, language: string = 'en', previousPrompts: string[] = []): Promise<string | null> {
    try {
      const response = await fetch('/api/ai/realtime-prompt', {
        method: 'POST',
        headers: {
          ...(await this.authHeaders()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          language,
          previousPrompts
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch prompt')
      }

      const result = await response.json()
      return result.prompt
    } catch (error) {
      console.error('Error generating real-time prompt:', error)
      return ''
    }
  }

  /**
   * Check if AI services are available
   */
  static async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/health`, {
        method: 'GET',
      })
      if (!response.ok) return false
      const status = await response.json()
      return status?.services?.transcription === true || status?.services?.content_generation === true
    } catch (error) {
      console.error('AI service availability check failed:', error)
      return false
    }
  }

  /**
   * Get AI service status
   */
  static async getServiceStatus(): Promise<{ available: boolean; mode: 'configured' | 'unavailable' }> {
    const available = await this.checkAvailability()
    return {
      available,
      mode: available ? 'configured' : 'unavailable'
    }
  }
}

// Export singleton instance
export const aiService = AIService
