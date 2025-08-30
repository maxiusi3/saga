import { Router } from 'express'
import { InvitationController } from '../controllers/invitation-controller'
import { authenticateToken, optionalAuth } from '../middleware/auth'

const router = Router()

// Protected invitation routes (auth required)
router.post('/', authenticateToken, InvitationController.createInvitationValidation, InvitationController.createInvitation)
router.post('/:invitationId/resend', authenticateToken, InvitationController.resendInvitationValidation, InvitationController.resendInvitation)
router.delete('/:invitationId/cancel', authenticateToken, InvitationController.cancelInvitationValidation, InvitationController.cancelInvitation)
router.get('/:invitationId/status', authenticateToken, InvitationController.getInvitationStatusValidation, InvitationController.getInvitationStatus)

// Project-specific invitation routes
router.get('/projects/:projectId', authenticateToken, InvitationController.getProjectInvitationsValidation, InvitationController.getProjectInvitations)
router.get('/projects/:projectId/stats', authenticateToken, InvitationController.getProjectInvitationsValidation, InvitationController.getInvitationStats)

// Analytics routes
router.get('/analytics', authenticateToken, InvitationController.getInvitationAnalytics)

// Public invitation routes (no auth required)
router.get('/:token', InvitationController.getInvitationValidation, InvitationController.getInvitation)
router.post('/:token/accept', optionalAuth, InvitationController.acceptInvitationValidation, InvitationController.acceptInvitation)

// Admin route for cleanup (could be protected with admin role in production)
router.delete('/cleanup/expired', InvitationController.cleanupExpiredInvitations)

export { router as invitationRoutes }