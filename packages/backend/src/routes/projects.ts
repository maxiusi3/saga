import { Router } from 'express'
import { ProjectController } from '../controllers/project-controller'
import { StoryController } from '../controllers/story-controller'
import { InvitationController } from '../controllers/invitation-controller'
import { authenticateToken, requireProjectAccess, requireRole } from '../middleware/auth'
import { requireActiveSubscription } from '../middleware/subscription'
import { requireProjectSubscription } from '../middleware/project-subscription'
import { 
  archivalMiddleware, 
  recordingArchivalMiddleware, 
  archivalHeadersMiddleware 
} from '../middleware/archival'

const router = Router()

// All project routes require authentication
router.use(authenticateToken)

// Project CRUD operations
router.get('/', ProjectController.getProjects)
router.post('/', ProjectController.createProjectValidation, requireActiveSubscription, ProjectController.createProject)

// Project-specific routes (require project access)
router.get('/:id', ProjectController.getProjectValidation, requireProjectAccess, archivalMiddleware, archivalHeadersMiddleware, ProjectController.getProject)
router.put('/:id', ProjectController.updateProjectValidation, requireProjectAccess, requireRole(['facilitator']), archivalMiddleware, ProjectController.updateProject)
router.delete('/:id', ProjectController.deleteProjectValidation, requireProjectAccess, requireRole(['facilitator']), archivalMiddleware, ProjectController.deleteProject)

// Project stats
router.get('/:id/stats', ProjectController.getProjectValidation, requireProjectAccess, archivalMiddleware, archivalHeadersMiddleware, ProjectController.getProjectStats)

// Invitation management (facilitator only)
router.post('/:id/invitation', ProjectController.generateInvitationValidation, requireProjectAccess, requireRole(['facilitator']), archivalMiddleware, ProjectController.generateInvitation)
router.get('/:id/invitations', requireProjectAccess, requireRole(['facilitator']), archivalMiddleware, archivalHeadersMiddleware, InvitationController.getProjectInvitations)
router.delete('/:id/invitations', requireProjectAccess, requireRole(['facilitator']), archivalMiddleware, InvitationController.invalidateInvitations)
router.get('/:id/invitations/stats', requireProjectAccess, requireRole(['facilitator']), archivalMiddleware, archivalHeadersMiddleware, InvitationController.getInvitationStats)

// Storyteller assignment (facilitator only)
router.post('/:id/assign-storyteller', requireProjectAccess, requireRole(['facilitator']), archivalMiddleware, ProjectController.assignStoryteller)

// Story management
router.get('/:projectId/stories', StoryController.getProjectStoriesValidation, requireProjectAccess, archivalMiddleware, archivalHeadersMiddleware, StoryController.getProjectStories)
router.post('/:projectId/stories', StoryController.uploadMiddleware, StoryController.createStoryValidation, requireProjectAccess, requireProjectSubscription, requireRole(['storyteller']), archivalMiddleware, recordingArchivalMiddleware, StoryController.createStory)
router.get('/:projectId/stories/search', StoryController.searchStoriesValidation, requireProjectAccess, archivalMiddleware, archivalHeadersMiddleware, StoryController.searchStories)
router.get('/:projectId/stories/recent', requireProjectAccess, archivalMiddleware, archivalHeadersMiddleware, StoryController.getRecentStories)

export { router as projectRoutes }