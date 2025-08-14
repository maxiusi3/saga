import Queue from 'bull'
import { StoryModel } from '../models/story'
import { StorageService } from './storage-service'
import { MediaProcessingService } from './media-processing-service'

// Mock queues for testing
const createMockQueue = (name: string) => {
  const mockFn = (typeof jest !== 'undefined' && jest.fn) || (() => Promise.resolve())
  return {
    add: mockFn().mockResolvedValue ? mockFn().mockResolvedValue({ id: 'mock-job-id' }) : () => Promise.resolve({ id: 'mock-job-id' }),
    process: mockFn(),
    getJobCounts: mockFn().mockResolvedValue ? mockFn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }) : () => Promise.resolve({ waiting: 0, active: 0, completed: 0, failed: 0 }),
    clean: mockFn().mockResolvedValue ? mockFn().mockResolvedValue(0) : () => Promise.resolve(0),
    pause: mockFn().mockResolvedValue ? mockFn().mockResolvedValue(undefined) : () => Promise.resolve(undefined),
    resume: mockFn().mockResolvedValue ? mockFn().mockResolvedValue(undefined) : () => Promise.resolve(undefined),
    close: mockFn().mockResolvedValue ? mockFn().mockResolvedValue(undefined) : () => Promise.resolve(undefined),
    on: mockFn(),
  }
}

// Create job queues - use mocks in test environment
export const audioProcessingQueue = process.env.NODE_ENV === 'test' 
  ? createMockQueue('audio processing')
  : new Queue('audio processing', {
      redis: {
        port: parseInt(process.env.REDIS_PORT || '6379'),
        host: process.env.REDIS_HOST || 'localhost',
        password: process.env.REDIS_PASSWORD,
      },
    })

export const sttProcessingQueue = process.env.NODE_ENV === 'test'
  ? createMockQueue('speech-to-text processing')
  : new Queue('speech-to-text processing', {
      redis: {
        port: parseInt(process.env.REDIS_PORT || '6379'),
        host: process.env.REDIS_HOST || 'localhost',
        password: process.env.REDIS_PASSWORD,
      },
    })

export const exportProcessingQueue = process.env.NODE_ENV === 'test'
  ? createMockQueue('export processing')
  : new Queue('export processing', {
      redis: {
        port: parseInt(process.env.REDIS_PORT || '6379'),
        host: process.env.REDIS_HOST || 'localhost',
        password: process.env.REDIS_PASSWORD,
      },
    })

// Job interfaces
export interface AudioProcessingJob {
  storyId: string
  audioKey: string
  projectId: string
}

export interface STTProcessingJob {
  storyId: string
  audioUrl: string
  language?: string
}

export interface ExportProcessingJob {
  projectId: string
  facilitatorId: string
  exportRequestId: string
}

// Audio processing job handler - skip in test environment
if (process.env.NODE_ENV !== 'test') {
  audioProcessingQueue.process(async (job) => {
  const { storyId, audioKey, projectId }: AudioProcessingJob = job.data

  try {
    console.log(`Processing audio for story ${storyId}`)

    // Get file from S3
    const metadata = await StorageService.getFileMetadata(audioKey)
    
    // Update story with processing status
    await StoryModel.update(storyId, { status: 'processing' })

    // Generate waveform data (placeholder)
    const waveformData = await MediaProcessingService.generateWaveformData(Buffer.alloc(0))

    // Update story with metadata
    await StoryModel.update(storyId, {
      status: 'ready',
      // Store waveform data in metadata or separate table
    })

    // Queue STT processing
    await sttProcessingQueue.add('process-stt', {
      storyId,
      audioUrl: `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${audioKey}`,
    })

    console.log(`Audio processing completed for story ${storyId}`)
  } catch (error) {
    console.error(`Audio processing failed for story ${storyId}:`, error)
    await StoryModel.update(storyId, { status: 'failed' })
    throw error
  }
})
}

// STT processing job handler - skip in test environment
if (process.env.NODE_ENV !== 'test') {
  sttProcessingQueue.process(async (job) => {
  const { storyId, audioUrl, language = 'en-US' }: STTProcessingJob = job.data

  try {
    console.log(`Processing STT for story ${storyId}`)

    // Get story details for audio metadata
    const story = await StoryModel.findById(storyId)
    if (!story) {
      throw new Error(`Story ${storyId} not found`)
    }

    // Initialize STT service
    const { SpeechToTextService } = await import('./speech-to-text-service')
    const sttService = new SpeechToTextService()

    // Transcribe audio
    const result = await sttService.transcribeAudio(audioUrl, {
      audioFormat: 'audio/mp3', // Assuming processed audio is MP3
      duration: story.audio_duration || 120,
      sampleRate: 44100,
      languageCode: language,
      enableSpeakerDiarization: true,
    })

    // Update story with transcript and metadata
    await StoryModel.updateTranscriptWithMetadata(storyId, result.transcript, {
      confidence: result.confidence,
      language: language,
      provider: 'Google Cloud Speech-to-Text', // TODO: Get actual provider name
      hasSpeakerDiarization: !!result.speakerTags,
      wordCount: result.words?.length || 0,
      sttMetadata: {
        words: result.words,
        alternatives: result.alternatives,
        speakerTags: result.speakerTags,
      },
    })

    console.log(`STT processing completed for story ${storyId} with confidence: ${result.confidence}`)
  } catch (error) {
    console.error(`STT processing failed for story ${storyId}:`, error)
    
    // Update story status to indicate STT failure
    await StoryModel.update(storyId, {
      status: 'ready', // Keep as ready since audio is processed, just no transcript
    })
    
    throw error
  }
})
}

// Export processing job handler - skip in test environment
if (process.env.NODE_ENV !== 'test') {
  exportProcessingQueue.process(async (job) => {
  const { projectId, facilitatorId, exportRequestId }: ExportProcessingJob = job.data

  try {
    console.log(`Processing export for project ${projectId}`)

    // TODO: Implement actual export processing
    // This would involve:
    // 1. Gathering all project data (stories, interactions, etc.)
    // 2. Creating a ZIP file with organized structure
    // 3. Uploading to S3
    // 4. Updating export request with download URL

    // Placeholder implementation
    const exportBuffer = Buffer.from(`Export data for project ${projectId}`)
    
    const uploadResult = await StorageService.uploadExportFile(
      exportBuffer,
      projectId,
      `project-${projectId}-export.zip`
    )

    // Update export request
    const { ExportRequestModel } = await import('../models/export-request')
    await ExportRequestModel.update(exportRequestId, {
      status: 'ready',
      download_url: uploadResult.cdnUrl,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    })

    console.log(`Export processing completed for project ${projectId}`)
  } catch (error) {
    console.error(`Export processing failed for project ${projectId}:`, error)
    
    // Update export request with failed status
    const { ExportRequestModel } = await import('../models/export-request')
    await ExportRequestModel.update(exportRequestId, { status: 'failed' })
    
    throw error
  }
})
}

// Job queue management functions
export class JobQueueService {
  static async addAudioProcessingJob(data: AudioProcessingJob) {
    return audioProcessingQueue.add('process-audio', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    })
  }

  static async addSTTProcessingJob(data: STTProcessingJob) {
    return sttProcessingQueue.add('process-stt', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    })
  }

  static async addExportProcessingJob(data: ExportProcessingJob) {
    return exportProcessingQueue.add('process-export', data, {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 10000,
      },
    })
  }

  static async getQueueStats() {
    const [audioStats, sttStats, exportStats] = await Promise.all([
      audioProcessingQueue.getJobCounts(),
      sttProcessingQueue.getJobCounts(),
      exportProcessingQueue.getJobCounts(),
    ])

    return {
      audioProcessing: audioStats,
      sttProcessing: sttStats,
      exportProcessing: exportStats,
    }
  }

  static async cleanupCompletedJobs() {
    const cleanupPromises = [
      audioProcessingQueue.clean(24 * 60 * 60 * 1000, 'completed'),
      audioProcessingQueue.clean(24 * 60 * 60 * 1000, 'failed'),
      sttProcessingQueue.clean(24 * 60 * 60 * 1000, 'completed'),
      sttProcessingQueue.clean(24 * 60 * 60 * 1000, 'failed'),
      exportProcessingQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed'),
      exportProcessingQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'),
    ]

    await Promise.all(cleanupPromises)
  }

  static async pauseQueues() {
    await Promise.all([
      audioProcessingQueue.pause(),
      sttProcessingQueue.pause(),
      exportProcessingQueue.pause(),
    ])
  }

  static async resumeQueues() {
    await Promise.all([
      audioProcessingQueue.resume(),
      sttProcessingQueue.resume(),
      exportProcessingQueue.resume(),
    ])
  }

  static async closeQueues() {
    await Promise.all([
      audioProcessingQueue.close(),
      sttProcessingQueue.close(),
      exportProcessingQueue.close(),
    ])
  }
}

// Error handling for queues - skip in test environment
if (process.env.NODE_ENV !== 'test') {
  audioProcessingQueue.on('failed', (job, err) => {
    console.error(`Audio processing job ${job.id} failed:`, err)
  })

  sttProcessingQueue.on('failed', (job, err) => {
    console.error(`STT processing job ${job.id} failed:`, err)
  })

  exportProcessingQueue.on('failed', (job, err) => {
    console.error(`Export processing job ${job.id} failed:`, err)
  })

  // Progress tracking
  audioProcessingQueue.on('progress', (job, progress) => {
    console.log(`Audio processing job ${job.id} is ${progress}% complete`)
  })

  sttProcessingQueue.on('progress', (job, progress) => {
    console.log(`STT processing job ${job.id} is ${progress}% complete`)
  })

  exportProcessingQueue.on('progress', (job, progress) => {
    console.log(`Export processing job ${job.id} is ${progress}% complete`)
  })
}