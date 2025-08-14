import { Request, Response } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { StorageService } from '../services/storage-service'
import { AWSConfig } from '../config/aws'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'

export class UploadController {
  static generateUploadUrlValidation = [
    body('projectId').isUUID().withMessage('Invalid project ID'),
    body('fileType').isIn(['audio', 'image']).withMessage('File type must be audio or image'),
    body('contentType').notEmpty().withMessage('Content type is required'),
    body('fileName').optional().isString().withMessage('File name must be a string'),
  ]

  static generateUploadUrl = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId, fileType, contentType, fileName } = req.body

    // Validate content type
    if (fileType === 'audio') {
      const allowedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/mp4', 'audio/aac']
      if (!allowedAudioTypes.includes(contentType)) {
        throw createError('Invalid audio content type', 400, 'INVALID_CONTENT_TYPE')
      }
    } else if (fileType === 'image') {
      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedImageTypes.includes(contentType)) {
        throw createError('Invalid image content type', 400, 'INVALID_CONTENT_TYPE')
      }
    }

    const uploadData = StorageService.generateUploadUrl(projectId, fileType, contentType)

    const response: ApiResponse = {
      data: {
        uploadUrl: uploadData.uploadUrl,
        fields: uploadData.fields,
        key: uploadData.key,
        cdnUrl: `https://${AWSConfig.cloudFrontDomain}/${uploadData.key}`,
        expiresIn: 900, // 15 minutes
      },
      message: 'Upload URL generated successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static generateDownloadUrlValidation = [
    param('key').notEmpty().withMessage('File key is required'),
    query('expiresIn').optional().isInt({ min: 60, max: 86400 }).withMessage('Expires in must be between 60 and 86400 seconds'),
  ]

  static generateDownloadUrl = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { key } = req.params
    const expiresIn = parseInt(req.query.expiresIn as string) || 3600

    // Verify file exists
    try {
      await StorageService.getFileMetadata(key)
    } catch (error) {
      throw createError('File not found', 404, 'FILE_NOT_FOUND')
    }

    const downloadUrl = StorageService.generateSecureDownloadUrl(key, expiresIn)

    const response: ApiResponse = {
      data: {
        downloadUrl,
        expiresIn,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      },
      message: 'Download URL generated successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getFileMetadataValidation = [
    param('key').notEmpty().withMessage('File key is required'),
  ]

  static getFileMetadata = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { key } = req.params

    const metadata = await StorageService.getFileMetadata(key)

    const response: ApiResponse = {
      data: {
        key,
        size: metadata.ContentLength,
        contentType: metadata.ContentType,
        lastModified: metadata.LastModified,
        etag: metadata.ETag,
        metadata: metadata.Metadata,
      },
      message: 'File metadata retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static deleteFileValidation = [
    param('key').notEmpty().withMessage('File key is required'),
  ]

  static deleteFile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { key } = req.params

    // Verify file exists before deletion
    try {
      await StorageService.getFileMetadata(key)
    } catch (error) {
      throw createError('File not found', 404, 'FILE_NOT_FOUND')
    }

    await StorageService.deleteFile(key)

    const response: ApiResponse = {
      data: { success: true },
      message: 'File deleted successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static cleanupExpiredFiles = asyncHandler(async (req: Request, res: Response) => {
    const deletedCount = await StorageService.cleanupExpiredFiles()

    const response: ApiResponse = {
      data: { deletedCount },
      message: 'Expired files cleaned up successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getStorageStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get storage statistics (this would require additional AWS API calls)
      // For now, return placeholder data
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        audioFiles: 0,
        imageFiles: 0,
        exportFiles: 0,
      }

      const response: ApiResponse = {
        data: stats,
        message: 'Storage statistics retrieved successfully',
        timestamp: new Date().toISOString(),
      }

      res.json(response)
    } catch (error) {
      throw createError('Failed to retrieve storage statistics', 500, 'STORAGE_STATS_FAILED')
    }
  })

  static validateUploadCompletion = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { key } = req.body

    if (!key) {
      throw createError('File key is required', 400, 'KEY_REQUIRED')
    }

    // Verify file was uploaded successfully
    try {
      const metadata = await StorageService.getFileMetadata(key)
      
      const response: ApiResponse = {
        data: {
          key,
          uploaded: true,
          size: metadata.ContentLength,
          contentType: metadata.ContentType,
          cdnUrl: `https://${AWSConfig.cloudFrontDomain}/${key}`,
        },
        message: 'Upload validation successful',
        timestamp: new Date().toISOString(),
      }

      res.json(response)
    } catch (error) {
      const response: ApiResponse = {
        data: {
          key,
          uploaded: false,
          error: 'File not found or upload incomplete',
        },
        message: 'Upload validation failed',
        timestamp: new Date().toISOString(),
      }

      res.status(404).json(response)
    }
  })
}