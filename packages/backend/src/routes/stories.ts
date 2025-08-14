import { Router } from 'express'
import { StoryController } from '../controllers/story-controller'
import { authenticateToken, requireRole } from '../middleware/auth'
import { 
  archivalMiddleware, 
  interactionArchivalMiddleware, 
  editingArchivalMiddleware,
  archivalHeadersMiddleware 
} from '../middleware/archival'

const router = Router()

// All story routes require authentication
router.use(authenticateToken)

// Story operations
router.get('/:id', StoryController.getStoryValidation, archivalMiddleware, archivalHeadersMiddleware, StoryController.getStory)
router.put('/:id/transcript', StoryController.updateTranscriptValidation, requireRole(['facilitator']), archivalMiddleware, editingArchivalMiddleware, StoryController.updateTranscript)

// Story interactions
router.get('/:id/interactions', StoryController.getStoryValidation, archivalMiddleware, archivalHeadersMiddleware, StoryController.getStoryInteractions)
router.post('/:id/interactions', StoryController.createInteractionValidation, requireRole(['facilitator']), archivalMiddleware, interactionArchivalMiddleware, StoryController.createInteraction)

export { router as storyRoutes }