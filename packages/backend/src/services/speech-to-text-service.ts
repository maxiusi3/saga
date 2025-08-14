import { SpeechConfigManager, SpeechConfig, TranscriptionResult } from '../config/speech'
import { StorageService } from './storage-service'
import { createError } from '../middleware/error-handler'
import axios from 'axios'

export interface STTProvider {
  name: string
  transcribe(audioUrl: string, config: SpeechConfig): Promise<TranscriptionResult>
  isAvailable(): Promise<boolean>
}

export class GoogleCloudSTTProvider implements STTProvider {
  name = 'Google Cloud Speech-to-Text'

  async transcribe(audioUrl: string, config: SpeechConfig): Promise<TranscriptionResult> {
    try {
      const client = SpeechConfigManager.client

      // For long audio files, use long-running recognition
      const audioDuration = await this.estimateAudioDuration(audioUrl)
      
      if (audioDuration > 60) {
        return this.longRunningRecognize(audioUrl, config)
      } else {
        return this.synchronousRecognize(audioUrl, config)
      }
    } catch (error) {
      console.error('Google Cloud STT failed:', error)
      throw createError('Google Cloud Speech-to-Text failed', 500, 'GOOGLE_STT_FAILED')
    }
  }

  async isAvailable(): Promise<boolean> {
    return SpeechConfigManager.testConnection()
  }

  private async synchronousRecognize(audioUrl: string, config: SpeechConfig): Promise<TranscriptionResult> {
    const client = SpeechConfigManager.client

    // Download audio content
    const audioContent = await this.downloadAudioContent(audioUrl)

    const request = {
      config: {
        encoding: config.encoding,
        sampleRateHertz: config.sampleRateHertz,
        languageCode: config.languageCode,
        alternativeLanguageCodes: config.alternativeLanguageCodes,
        maxAlternatives: config.maxAlternatives,
        profanityFilter: config.profanityFilter,
        enableSpeakerDiarization: config.enableSpeakerDiarization,
        diarizationConfig: config.enableSpeakerDiarization ? {
          enableSpeakerDiarization: true,
          minSpeakerCount: 1,
          maxSpeakerCount: config.diarizationSpeakerCount || 2,
        } : undefined,
        enableAutomaticPunctuation: config.enableAutomaticPunctuation,
        enableWordTimeOffsets: config.enableWordTimeOffsets,
        enableWordConfidence: config.enableWordConfidence,
        model: config.model,
      },
      audio: {
        content: audioContent.toString('base64'),
      },
    }

    const [response] = await client.recognize(request)
    return this.parseGoogleResponse(response)
  }

  private async longRunningRecognize(audioUrl: string, config: SpeechConfig): Promise<TranscriptionResult> {
    const client = SpeechConfigManager.client

    const request = {
      config: {
        encoding: config.encoding,
        sampleRateHertz: config.sampleRateHertz,
        languageCode: config.languageCode,
        alternativeLanguageCodes: config.alternativeLanguageCodes,
        maxAlternatives: config.maxAlternatives,
        profanityFilter: config.profanityFilter,
        enableSpeakerDiarization: config.enableSpeakerDiarization,
        diarizationConfig: config.enableSpeakerDiarization ? {
          enableSpeakerDiarization: true,
          minSpeakerCount: 1,
          maxSpeakerCount: config.diarizationSpeakerCount || 2,
        } : undefined,
        enableAutomaticPunctuation: config.enableAutomaticPunctuation,
        enableWordTimeOffsets: config.enableWordTimeOffsets,
        enableWordConfidence: config.enableWordConfidence,
        model: config.model,
      },
      audio: {
        uri: audioUrl,
      },
    }

    const [operation] = await client.longRunningRecognize(request)
    const [response] = await operation.promise()
    return this.parseGoogleResponse(response)
  }

  private parseGoogleResponse(response: any): TranscriptionResult {
    if (!response.results || response.results.length === 0) {
      return {
        transcript: '',
        confidence: 0,
        words: [],
        alternatives: [],
      }
    }

    const result = response.results[0]
    const alternative = result.alternatives[0]

    const words = alternative.words?.map((word: any) => ({
      word: word.word,
      startTime: parseFloat(word.startTime?.seconds || '0') + (word.startTime?.nanos || 0) / 1e9,
      endTime: parseFloat(word.endTime?.seconds || '0') + (word.endTime?.nanos || 0) / 1e9,
      confidence: word.confidence,
    })) || []

    const alternatives = result.alternatives?.slice(1).map((alt: any) => ({
      transcript: alt.transcript,
      confidence: alt.confidence,
    })) || []

    // Extract speaker tags if available
    const speakerTags = words.map((word: any) => word.speakerTag).filter(Boolean)

    return {
      transcript: alternative.transcript || '',
      confidence: alternative.confidence || 0,
      words,
      alternatives,
      speakerTags: speakerTags.length > 0 ? speakerTags : undefined,
    }
  }

  private async downloadAudioContent(audioUrl: string): Promise<Buffer> {
    const response = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    })
    return Buffer.from(response.data)
  }

  private async estimateAudioDuration(audioUrl: string): Promise<number> {
    // This is a simplified estimation
    // In production, you might want to use the actual audio metadata
    try {
      const response = await axios.head(audioUrl)
      const contentLength = parseInt(response.headers['content-length'] || '0')
      
      // Rough estimation: 1MB ≈ 60 seconds for typical speech audio
      return Math.max(60, contentLength / (1024 * 1024) * 60)
    } catch (error) {
      return 120 // Default to 2 minutes
    }
  }
}

export class AWSTranscribeProvider implements STTProvider {
  name = 'AWS Transcribe'

  async transcribe(audioUrl: string, config: SpeechConfig): Promise<TranscriptionResult> {
    try {
      // TODO: Implement AWS Transcribe integration
      // This is a placeholder implementation
      console.log(`AWS Transcribe processing: ${audioUrl}`)
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      return {
        transcript: `[AWS Transcribe] Placeholder transcript for audio: ${audioUrl}`,
        confidence: 0.85,
        words: [],
        alternatives: [],
      }
    } catch (error) {
      console.error('AWS Transcribe failed:', error)
      throw createError('AWS Transcribe failed', 500, 'AWS_TRANSCRIBE_FAILED')
    }
  }

  async isAvailable(): Promise<boolean> {
    // Check if AWS credentials are available
    return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  }
}

export class AssemblyAIProvider implements STTProvider {
  name = 'AssemblyAI'

  async transcribe(audioUrl: string, config: SpeechConfig): Promise<TranscriptionResult> {
    try {
      const apiKey = process.env.ASSEMBLYAI_API_KEY
      if (!apiKey) {
        throw new Error('AssemblyAI API key not configured')
      }

      // Submit transcription job
      const submitResponse = await axios.post(
        'https://api.assemblyai.com/v2/transcript',
        {
          audio_url: audioUrl,
          language_code: config.languageCode.replace('-', '_'),
          punctuate: config.enableAutomaticPunctuation,
          format_text: true,
          speaker_labels: config.enableSpeakerDiarization,
          speakers_expected: config.diarizationSpeakerCount,
          word_timestamps: config.enableWordTimeOffsets,
        },
        {
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json',
          },
        }
      )

      const transcriptId = submitResponse.data.id

      // Poll for completion
      let transcript = null
      let attempts = 0
      const maxAttempts = 60 // 5 minutes max

      while (!transcript && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds

        const pollResponse = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          {
            headers: {
              'Authorization': apiKey,
            },
          }
        )

        if (pollResponse.data.status === 'completed') {
          transcript = pollResponse.data
          break
        } else if (pollResponse.data.status === 'error') {
          throw new Error(`AssemblyAI transcription failed: ${pollResponse.data.error}`)
        }

        attempts++
      }

      if (!transcript) {
        throw new Error('AssemblyAI transcription timed out')
      }

      return this.parseAssemblyAIResponse(transcript)
    } catch (error) {
      console.error('AssemblyAI failed:', error)
      throw createError('AssemblyAI transcription failed', 500, 'ASSEMBLYAI_FAILED')
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.ASSEMBLYAI_API_KEY
  }

  private parseAssemblyAIResponse(response: any): TranscriptionResult {
    const words = response.words?.map((word: any) => ({
      word: word.text,
      startTime: word.start / 1000, // Convert ms to seconds
      endTime: word.end / 1000,
      confidence: word.confidence,
    })) || []

    return {
      transcript: response.text || '',
      confidence: response.confidence || 0,
      words,
      alternatives: [],
      speakerTags: response.utterances?.map((u: any) => u.speaker) || undefined,
    }
  }
}

export class SpeechToTextService {
  private providers: STTProvider[]
  private primaryProvider: STTProvider
  private fallbackProviders: STTProvider[]

  constructor() {
    this.providers = [
      new GoogleCloudSTTProvider(),
      new AWSTranscribeProvider(),
      new AssemblyAIProvider(),
    ]

    this.primaryProvider = this.providers[0] // Google Cloud as primary
    this.fallbackProviders = this.providers.slice(1)
  }

  async transcribeAudio(
    audioUrl: string,
    options: {
      audioFormat: string
      duration?: number
      sampleRate?: number
      languageCode?: string
      enableSpeakerDiarization?: boolean
    }
  ): Promise<TranscriptionResult> {
    const config = SpeechConfigManager.getOptimizedConfig(
      options.audioFormat,
      options.duration || 120,
      options.sampleRate
    )

    // Override language if specified
    if (options.languageCode) {
      config.languageCode = options.languageCode
    }

    // Override speaker diarization if specified
    if (options.enableSpeakerDiarization !== undefined) {
      config.enableSpeakerDiarization = options.enableSpeakerDiarization
    }

    // Try primary provider first
    try {
      if (await this.primaryProvider.isAvailable()) {
        console.log(`Using primary STT provider: ${this.primaryProvider.name}`)
        return await this.primaryProvider.transcribe(audioUrl, config)
      }
    } catch (error) {
      console.error(`Primary STT provider failed: ${error.message}`)
    }

    // Try fallback providers
    for (const provider of this.fallbackProviders) {
      try {
        if (await provider.isAvailable()) {
          console.log(`Using fallback STT provider: ${provider.name}`)
          return await provider.transcribe(audioUrl, config)
        }
      } catch (error) {
        console.error(`Fallback STT provider ${provider.name} failed: ${error.message}`)
      }
    }

    throw createError(
      'All speech-to-text providers failed',
      500,
      'ALL_STT_PROVIDERS_FAILED'
    )
  }

  async getAvailableProviders(): Promise<Array<{ name: string; available: boolean }>> {
    const results = await Promise.all(
      this.providers.map(async provider => ({
        name: provider.name,
        available: await provider.isAvailable(),
      }))
    )

    return results
  }

  async validateConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      SpeechConfigManager.validateConfig()
    } catch (error) {
      errors.push(error.message)
    }

    // Test primary provider
    try {
      const isAvailable = await this.primaryProvider.isAvailable()
      if (!isAvailable) {
        errors.push(`Primary STT provider (${this.primaryProvider.name}) is not available`)
      }
    } catch (error) {
      errors.push(`Primary STT provider validation failed: ${error.message}`)
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  getSupportedLanguages() {
    return SpeechConfigManager.getSupportedLanguages()
  }
}