import { Router } from 'express'
import { UploadController } from '../controllers/upload-controller'
import { authenticateToken, requireProjectAccess } from '../middleware/auth'

const router = Router()

// All upload routes require authentication
router.use(authenticateToken)

// Generate presigned upload URL
router.post('/url', UploadController.generateUploadUrlValidation, UploadController.generateUploadUrl)

// Validate upload completion
router.post('/validate', UploadController.validateUploadCompletion)

// Generate secure download URL
router.get('/download/:key', UploadController.generateDownloadUrlValidation, UploadController.generateDownloadUrl)

// Get file metadata
router.get('/metadata/:key', UploadController.getFileMetadataValidation, UploadController.getFileMetadata)

// Delete file (admin or file owner only)
router.delete('/:key', UploadController.deleteFileValidation, UploadController.deleteFile)

// Storage statistics
router.get('/stats', UploadController.getStorageStats)

// Cleanup expired files (admin only)
router.delete('/cleanup/expired', UploadController.cleanupExpiredFiles)

export { router as uploadRoutes }