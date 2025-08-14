import { Router } from 'express'
import { STTController } from '../controllers/stt-controller'
import { authenticateToken, requireRole } from '../middleware/auth'

const router = Router()

// Public routes (no auth required)
router.get('/providers', STTController.getAvailableProviders)
router.get('/languages', STTController.getSupportedLanguages)
router.get('/config/validate', STTController.validateConfiguration)

// Protected routes (authentication required)
router.use(authenticateToken)

// Story-specific transcription
router.post('/stories/:storyId/retranscribe', 
  STTController.retranscribeStoryValidation, 
  requireRole(['facilitator']), 
  STTController.retranscribeStory
)

router.get('/stories/:storyId/status', 
  STTController.getTranscriptionStatus
)

// Testing and management
router.post('/test', 
  requireRole(['facilitator']), 
  STTController.testTranscription
)

router.post('/bulk-retranscribe', 
  requireRole(['facilitator']), 
  STTController.bulkRetranscribe
)

// Admin/monitoring routes
router.get('/queue/stats', 
  requireRole(['facilitator']), 
  STTController.getQueueStats
)

router.post('/queue/retry-failed', 
  requireRole(['facilitator']), 
  STTController.retryFailedJobs
)

export { router as sttRoutes }