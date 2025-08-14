import { SpeechClient } from '@google-cloud/speech'
import { createError } from '../middleware/error-handler'

export interface SpeechConfig {
  encoding: 'LINEAR16' | 'FLAC' | 'MULAW' | 'AMR' | 'AMR_WB' | 'OGG_OPUS' | 'SPEEX_WITH_HEADER_BYTE' | 'MP3' | 'WEBM_OPUS'
  sampleRateHertz: number
  languageCode: string
  alternativeLanguageCodes?: string[]
  maxAlternatives?: number
  profanityFilter?: boolean
  enableSpeakerDiarization?: boolean
  diarizationSpeakerCount?: number
  enableAutomaticPunctuation?: boolean
  enableWordTimeOffsets?: boolean
  enableWordConfidence?: boolean
  model?: 'latest_long' | 'latest_short' | 'command_and_search' | 'phone_call' | 'video' | 'default'
}

export interface TranscriptionResult {
  transcript: string
  confidence: number
  words?: Array<{
    word: string
    startTime: number
    endTime: number
    confidence?: number
  }>
  alternatives?: Array<{
    transcript: string
    confidence: number
  }>
  speakerTags?: number[]
}

export class SpeechConfigManager {
  private static speechClient: SpeechClient

  static get client(): SpeechClient {
    if (!this.speechClient) {
      // Initialize Google Cloud Speech client
      this.speechClient = new SpeechClient({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
        // Alternative: use service account key directly
        credentials: process.env.GOOGLE_CLOUD_CREDENTIALS 
          ? JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS)
          : undefined,
      })
    }
    return this.speechClient
  }

  static validateConfig(): void {
    const requiredEnvVars = [
      'GOOGLE_CLOUD_PROJECT_ID',
    ]

    // Check for either key file or credentials
    const hasKeyFile = !!process.env.GOOGLE_CLOUD_KEY_FILE
    const hasCredentials = !!process.env.GOOGLE_CLOUD_CREDENTIALS

    if (!hasKeyFile && !hasCredentials) {
      requiredEnvVars.push('GOOGLE_CLOUD_KEY_FILE or GOOGLE_CLOUD_CREDENTIALS')
    }

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])

    if (missingVars.length > 0) {
      throw createError(
        `Missing required Google Cloud environment variables: ${missingVars.join(', ')}`,
        500,
        'GOOGLE_CLOUD_CONFIG_MISSING'
      )
    }
  }

  static getDefaultConfig(audioFormat: string, sampleRate?: number): SpeechConfig {
    // Map audio formats to Google Cloud Speech encoding
    const encodingMap: Record<string, SpeechConfig['encoding']> = {
      'audio/mp3': 'MP3',
      'audio/mpeg': 'MP3',
      'audio/wav': 'LINEAR16',
      'audio/flac': 'FLAC',
      'audio/ogg': 'OGG_OPUS',
      'audio/webm': 'WEBM_OPUS',
    }

    const encoding = encodingMap[audioFormat] || 'MP3'

    return {
      encoding,
      sampleRateHertz: sampleRate || 44100,
      languageCode: 'en-US',
      alternativeLanguageCodes: ['en-GB', 'en-AU', 'en-CA'],
      maxAlternatives: 3,
      profanityFilter: false, // Keep original content for family stories
      enableSpeakerDiarization: true,
      diarizationSpeakerCount: 2, // Usually storyteller + interviewer
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
      enableWordConfidence: true,
      model: 'latest_long', // Best for longer audio content
    }
  }

  static getOptimizedConfig(
    audioFormat: string,
    duration: number,
    sampleRate?: number
  ): SpeechConfig {
    const baseConfig = this.getDefaultConfig(audioFormat, sampleRate)

    // Optimize based on audio duration
    if (duration < 60) {
      // Short audio - use command_and_search model
      baseConfig.model = 'command_and_search'
      baseConfig.enableSpeakerDiarization = false
    } else if (duration > 300) {
      // Long audio - optimize for accuracy
      baseConfig.model = 'latest_long'
      baseConfig.maxAlternatives = 1 // Reduce processing time
      baseConfig.enableWordTimeOffsets = false // Reduce response size
    }

    return baseConfig
  }

  static getSupportedLanguages(): Array<{ code: string; name: string }> {
    return [
      { code: 'en-US', name: 'English (US)' },
      { code: 'en-GB', name: 'English (UK)' },
      { code: 'en-AU', name: 'English (Australia)' },
      { code: 'en-CA', name: 'English (Canada)' },
      { code: 'es-US', name: 'Spanish (US)' },
      { code: 'es-ES', name: 'Spanish (Spain)' },
      { code: 'fr-FR', name: 'French (France)' },
      { code: 'fr-CA', name: 'French (Canada)' },
      { code: 'de-DE', name: 'German' },
      { code: 'it-IT', name: 'Italian' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)' },
      { code: 'pt-PT', name: 'Portuguese (Portugal)' },
      { code: 'ru-RU', name: 'Russian' },
      { code: 'ja-JP', name: 'Japanese' },
      { code: 'ko-KR', name: 'Korean' },
      { code: 'zh-CN', name: 'Chinese (Simplified)' },
      { code: 'zh-TW', name: 'Chinese (Traditional)' },
      { code: 'hi-IN', name: 'Hindi' },
      { code: 'ar-SA', name: 'Arabic' },
    ]
  }

  static async testConnection(): Promise<boolean> {
    try {
      // Test connection by listing available models
      await this.client.listModels({
        parent: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/global`,
      })
      return true
    } catch (error) {
      console.error('Google Cloud Speech connection test failed:', error)
      return false
    }
  }
}