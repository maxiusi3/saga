import { Request, Response } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { SpeechToTextService } from '../services/speech-to-text-service'
import { StoryModel } from '../models/story'
import { JobQueueService } from '../services/job-queue-service'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'

export class STTController {
  static retranscribeStoryValidation = [
    param('storyId').isUUID().withMessage('Invalid story ID'),
    body('languageCode').optional().isString().withMessage('Language code must be a string'),
    body('enableSpeakerDiarization').optional().isBoolean().withMessage('Speaker diarization must be boolean'),
  ]

  static retranscribeStory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { storyId } = req.params
    const { languageCode, enableSpeakerDiarization } = req.body

    // Get story details
    const story = await StoryModel.findById(storyId)
    if (!story) {
      throw createError('Story not found', 404, 'STORY_NOT_FOUND')
    }

    // Queue STT processing job
    await JobQueueService.addSTTProcessingJob({
      storyId,
      audioUrl: story.audio_url,
      language: languageCode,
    })

    const response: ApiResponse = {
      data: {
        storyId,
        status: 'queued',
        message: 'Retranscription job queued successfully',
      },
      message: 'Story retranscription initiated',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getTranscriptionStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { storyId } = req.params

    const story = await StoryModel.findById(storyId)
    if (!story) {
      throw createError('Story not found', 404, 'STORY_NOT_FOUND')
    }

    const response: ApiResponse = {
      data: {
        storyId,
        status: story.status,
        hasTranscript: !!story.transcript,
        transcriptLength: story.transcript?.length || 0,
        audioDuration: story.audio_duration,
      },
      message: 'Transcription status retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getAvailableProviders = asyncHandler(async (req: Request, res: Response) => {
    const sttService = new SpeechToTextService()
    const providers = await sttService.getAvailableProviders()

    const response: ApiResponse = {
      data: { providers },
      message: 'Available STT providers retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getSupportedLanguages = asyncHandler(async (req: Request, res: Response) => {
    const sttService = new SpeechToTextService()
    const languages = sttService.getSupportedLanguages()

    const response: ApiResponse = {
      data: { languages },
      message: 'Supported languages retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static validateConfiguration = asyncHandler(async (req: Request, res: Response) => {
    const sttService = new SpeechToTextService()
    const validation = await sttService.validateConfiguration()

    const response: ApiResponse = {
      data: validation,
      message: validation.valid 
        ? 'STT configuration is valid' 
        : 'STT configuration has issues',
      timestamp: new Date().toISOString(),
    }

    res.status(validation.valid ? 200 : 400).json(response)
  })

  static testTranscription = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { audioUrl, languageCode = 'en-US' } = req.body

    if (!audioUrl) {
      throw createError('Audio URL is required', 400, 'AUDIO_URL_REQUIRED')
    }

    const sttService = new SpeechToTextService()

    try {
      const result = await sttService.transcribeAudio(audioUrl, {
        audioFormat: 'audio/mp3',
        duration: 60, // Assume short test audio
        languageCode,
        enableSpeakerDiarization: false, // Disable for test
      })

      const response: ApiResponse = {
        data: {
          transcript: result.transcript,
          confidence: result.confidence,
          wordCount: result.words?.length || 0,
          hasAlternatives: (result.alternatives?.length || 0) > 0,
        },
        message: 'Test transcription completed successfully',
        timestamp: new Date().toISOString(),
      }

      res.json(response)
    } catch (error) {
      throw createError(
        `Test transcription failed: ${error.message}`,
        500,
        'TEST_TRANSCRIPTION_FAILED'
      )
    }
  })

  static getQueueStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await JobQueueService.getQueueStats()

    const response: ApiResponse = {
      data: {
        sttQueue: stats.sttProcessing,
        audioQueue: stats.audioProcessing,
        exportQueue: stats.exportProcessing,
      },
      message: 'Queue statistics retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static retryFailedJobs = asyncHandler(async (req: Request, res: Response) => {
    // This would require additional Bull Queue methods to retry failed jobs
    // For now, return a placeholder response
    const response: ApiResponse = {
      data: {
        retriedJobs: 0,
        message: 'Failed job retry functionality not yet implemented',
      },
      message: 'Job retry operation completed',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static bulkRetranscribe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId, languageCode, enableSpeakerDiarization } = req.body

    if (!projectId) {
      throw createError('Project ID is required', 400, 'PROJECT_ID_REQUIRED')
    }

    // Get all stories for the project
    const stories = await StoryModel.findByProject(projectId, { limit: 1000 })

    let queuedCount = 0
    const processingErrors: string[] = []

    for (const story of stories.stories) {
      try {
        await JobQueueService.addSTTProcessingJob({
          storyId: story.id,
          audioUrl: story.audio_url,
          language: languageCode,
        })
        queuedCount++
      } catch (error) {
        processingErrors.push(`Failed to queue story ${story.id}: ${error.message}`)
      }
    }

    const response: ApiResponse = {
      data: {
        projectId,
        totalStories: stories.stories.length,
        queuedCount,
        errors: processingErrors.length > 0 ? processingErrors : undefined,
      },
      message: `Bulk retranscription initiated for ${queuedCount} stories`,
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })
}