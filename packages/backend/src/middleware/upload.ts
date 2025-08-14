import multer from 'multer'
import { Request } from 'express'
import { createError } from './error-handler'
import { FILE_LIMITS } from '@saga/shared'

// Configure multer for memory storage
const storage = multer.memoryStorage()

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check file type based on field name
  if (file.fieldname === 'audio') {
    const allowedAudioTypes = FILE_LIMITS.AUDIO.ALLOWED_TYPES
    if (allowedAudioTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(createError(
        `Invalid audio format. Allowed formats: ${allowedAudioTypes.join(', ')}`,
        400,
        'INVALID_AUDIO_FORMAT'
      ))
    }
  } else if (file.fieldname === 'photo' || file.fieldname === 'image') {
    const allowedImageTypes = FILE_LIMITS.IMAGE.ALLOWED_TYPES
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(createError(
        `Invalid image format. Allowed formats: ${allowedImageTypes.join(', ')}`,
        400,
        'INVALID_IMAGE_FORMAT'
      ))
    }
  } else {
    cb(createError('Unknown file field', 400, 'UNKNOWN_FILE_FIELD'))
  }
}

// Create multer instance with configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: FILE_LIMITS.AUDIO.MAX_SIZE, // Use the larger limit (50MB)
    files: 2, // Maximum 2 files (audio + photo)
  },
})

// Middleware for story uploads (audio + optional photo)
export const uploadStoryFiles = upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
])

// Middleware for single audio file
export const uploadAudioFile = upload.single('audio')

// Middleware for single image file
export const uploadImageFile = upload.single('image')

// Middleware for multiple images
export const uploadMultipleImages = upload.array('images', 5)

// Error handling middleware for multer errors
export const handleUploadError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return next(createError(
          `File too large. Maximum size: ${FILE_LIMITS.AUDIO.MAX_SIZE / (1024 * 1024)}MB`,
          400,
          'FILE_TOO_LARGE'
        ))
      case 'LIMIT_FILE_COUNT':
        return next(createError('Too many files uploaded', 400, 'TOO_MANY_FILES'))
      case 'LIMIT_UNEXPECTED_FILE':
        return next(createError('Unexpected file field', 400, 'UNEXPECTED_FILE'))
      default:
        return next(createError('File upload error', 400, 'UPLOAD_ERROR'))
    }
  }
  next(error)
}

// Validation middleware for uploaded files
export const validateUploadedFiles = (req: Request, res: any, next: any) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] }

  if (!files) {
    return next()
  }

  // Validate audio file if present
  if (files.audio && files.audio.length > 0) {
    const audioFile = files.audio[0]
    
    // Check file size
    if (audioFile.size > FILE_LIMITS.AUDIO.MAX_SIZE) {
      return next(createError(
        `Audio file too large. Maximum size: ${FILE_LIMITS.AUDIO.MAX_SIZE / (1024 * 1024)}MB`,
        400,
        'AUDIO_FILE_TOO_LARGE'
      ))
    }

    // Check duration (if available in metadata)
    // Note: Actual duration check would require audio processing
    // This is a placeholder for future implementation
  }

  // Validate image file if present
  if (files.photo && files.photo.length > 0) {
    const photoFile = files.photo[0]
    
    // Check file size
    if (photoFile.size > FILE_LIMITS.IMAGE.MAX_SIZE) {
      return next(createError(
        `Image file too large. Maximum size: ${FILE_LIMITS.IMAGE.MAX_SIZE / (1024 * 1024)}MB`,
        400,
        'IMAGE_FILE_TOO_LARGE'
      ))
    }
  }

  next()
}

// Middleware to extract file information
export const extractFileInfo = (req: Request, res: any, next: any) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] }

  if (files) {
    // Add file info to request for easy access
    req.fileInfo = {
      audio: files.audio?.[0] ? {
        originalName: files.audio[0].originalname,
        size: files.audio[0].size,
        mimetype: files.audio[0].mimetype,
      } : null,
      photo: files.photo?.[0] ? {
        originalName: files.photo[0].originalname,
        size: files.photo[0].size,
        mimetype: files.photo[0].mimetype,
      } : null,
    }
  }

  next()
}

// Extend Request interface to include file info
declare global {
  namespace Express {
    interface Request {
      fileInfo?: {
        audio?: {
          originalName: string
          size: number
          mimetype: string
        } | null
        photo?: {
          originalName: string
          size: number
          mimetype: string
        } | null
      }
    }
  }
}