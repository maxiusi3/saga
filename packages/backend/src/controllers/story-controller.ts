import { Request, Response } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { StoryModel } from '../models/story'
import { InteractionModel } from '../models/interaction'
import { StorageService } from '../services/storage-service'
import { MediaProcessingService } from '../services/media-processing-service'
import { NotificationEvents } from '../services/notification-events'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'
import { uploadStoryFiles, handleUploadError, validateUploadedFiles, extractFileInfo } from '../middleware/upload'
import { emitWebSocketEvent } from '../middleware/websocket'
import { WEBSOCKET_EVENTS } from '@saga/shared'

export class StoryController {
  static uploadMiddleware = [uploadStoryFiles, handleUploadError, validateUploadedFiles, extractFileInfo]

  static getProjectStoriesValidation = [
    param('projectId').isUUID().withMessage('Invalid project ID format'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['processing', 'ready', 'failed']).withMessage('Invalid status'),
  ]

  static getProjectStories = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId } = req.params
    const { page = 1, limit = 20, status } = req.query

    const stories = await StoryModel.findByProject(projectId, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as any,
    })

    const response: ApiResponse = {
      data: stories,
      message: 'Stories retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static createStoryValidation = [
    param('projectId').isUUID().withMessage('Invalid project ID format'),
    body('title').optional().trim().isLength({ max: 255 }).withMessage('Title must be less than 255 characters'),
    body('aiPrompt').optional().trim().isLength({ max: 1000 }).withMessage('AI prompt must be less than 1000 characters'),
  ]

  static createStory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId } = req.params
    const { title, aiPrompt } = req.body
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }

    // Validate audio file is present
    if (!files.audio || files.audio.length === 0) {
      throw createError('Audio file is required', 400, 'AUDIO_FILE_REQUIRED')
    }

    const audioFile = files.audio[0]
    const photoFile = files.photo?.[0]

    // Validate audio file
    const isValidAudio = await MediaProcessingService.validateAudioFile(audioFile)
    if (!isValidAudio) {
      throw createError('Invalid audio file', 400, 'INVALID_AUDIO_FILE')
    }

    // Create story record first
    const story = await StoryModel.create({
      project_id: projectId,
      title,
      ai_prompt: aiPrompt,
      audio_url: '', // Will be updated after upload
      status: 'processing',
    })

    try {
      // Process and upload audio file
      const processedAudio = await MediaProcessingService.processAudioFile(audioFile, {
        targetFormat: 'mp3',
        targetBitrate: 128,
      })

      const audioUpload = await StorageService.uploadAudioFile(
        { ...audioFile, buffer: processedAudio.buffer },
        projectId,
        story.id
      )

      // Upload photo if present
      let photoUpload = null
      if (photoFile) {
        photoUpload = await StorageService.uploadImageFile(photoFile, projectId, story.id, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 85,
          format: 'jpeg',
          generateThumbnail: true,
          thumbnailSize: 300,
        })
      }

      // Update story with file URLs and metadata
      const updatedStory = await StoryModel.update(story.id, {
        audio_url: audioUpload.cdnUrl,
        photo_url: photoUpload?.cdnUrl,
        audio_duration: Math.round(processedAudio.metadata.duration),
        status: 'ready',
      })

      // Queue background job for audio processing and STT
      const { JobQueueService } = await import('../services/job-queue-service')
      await JobQueueService.addAudioProcessingJob({
        storyId: story.id,
        audioKey: audioUpload.key,
        projectId,
      })

      const response: ApiResponse = {
        data: {
          ...updatedStory,
          fileInfo: {
            audio: {
              size: audioUpload.size,
              duration: processedAudio.metadata.duration,
              format: processedAudio.metadata.format,
            },
            photo: photoUpload ? {
              size: photoUpload.size,
            } : null,
          },
        },
        message: 'Story uploaded successfully',
        timestamp: new Date().toISOString(),
      }

      // Emit WebSocket event for story upload
      emitWebSocketEvent(req, WEBSOCKET_EVENTS.STORY_UPLOADED, {
        story: updatedStory,
        projectId,
        uploadedBy: req.user?.name || 'Unknown',
      }, { projectId })

      res.status(201).json(response)
    } catch (uploadError) {
      // Clean up story record if upload fails
      await StoryModel.delete(story.id)
      throw uploadError
    }
  })

  static getStoryValidation = [
    param('id').isUUID().withMessage('Invalid story ID format'),
  ]

  static getStory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { id } = req.params

    const story = await StoryModel.getStoryWithInteractions(id)
    if (!story) {
      throw createError('Story not found', 404, 'STORY_NOT_FOUND')
    }

    const response: ApiResponse = {
      data: story,
      message: 'Story retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static updateTranscriptValidation = [
    param('id').isUUID().withMessage('Invalid story ID format'),
    body('transcript').trim().notEmpty().withMessage('Transcript is required'),
  ]

  static updateTranscript = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { id } = req.params
    const { transcript } = req.body

    // Get story first to get project ID
    const existingStory = await StoryModel.findById(id)
    if (!existingStory) {
      throw createError('Story not found', 404, 'STORY_NOT_FOUND')
    }

    const story = await StoryModel.updateTranscript(id, transcript)

    // Emit WebSocket event for transcript update
    emitWebSocketEvent(req, WEBSOCKET_EVENTS.TRANSCRIPT_UPDATED, {
      storyId: id,
      transcript,
      projectId: existingStory.projectId,
      updatedBy: req.user?.name || 'Unknown',
      updatedById: req.user?.id,
    }, { projectId: existingStory.projectId })

    const response: ApiResponse = {
      data: story,
      message: 'Transcript updated successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getStoryInteractions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { id } = req.params

    const interactions = await InteractionModel.findByStory(id)

    const response: ApiResponse = {
      data: interactions,
      message: 'Story interactions retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static createInteractionValidation = [
    param('id').isUUID().withMessage('Invalid story ID format'),
    body('type').isIn(['comment', 'followup']).withMessage('Type must be comment or followup'),
    body('content').trim().notEmpty().withMessage('Content is required'),
  ]

  static createInteraction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { id } = req.params
    const { type, content } = req.body

    // Verify story exists
    const story = await StoryModel.findById(id)
    if (!story) {
      throw createError('Story not found', 404, 'STORY_NOT_FOUND')
    }

    const interaction = await InteractionModel.createInteraction({
      storyId: id,
      facilitatorId: req.user.id,
      type,
      content,
    })

    // Emit WebSocket event for new interaction
    emitWebSocketEvent(req, WEBSOCKET_EVENTS.INTERACTION_ADDED, {
      interaction: {
        ...interaction,
        facilitatorName: req.user.name,
      },
      storyId: id,
      projectId: story.projectId,
      facilitatorName: req.user.name,
      facilitatorId: req.user.id,
    }, { projectId: story.projectId })

    const response: ApiResponse = {
      data: interaction,
      message: 'Interaction created successfully',
      timestamp: new Date().toISOString(),
    }

    res.status(201).json(response)
  })

  static searchStoriesValidation = [
    param('projectId').isUUID().withMessage('Invalid project ID format'),
    query('q').trim().notEmpty().withMessage('Search query is required'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  ]

  static searchStories = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId } = req.params
    const { q, limit = 10 } = req.query

    const stories = await StoryModel.searchStories(
      projectId,
      q as string,
      parseInt(limit as string)
    )

    const response: ApiResponse = {
      data: stories,
      message: 'Stories search completed successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getRecentStories = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId } = req.params
    const { days = 7 } = req.query

    const stories = await StoryModel.getRecentStories(
      projectId,
      parseInt(days as string)
    )

    const response: ApiResponse = {
      data: stories,
      message: 'Recent stories retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })
}