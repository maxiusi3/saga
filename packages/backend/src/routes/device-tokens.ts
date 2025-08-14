import { Router } from 'express'
import { DeviceTokenController } from '../controllers/device-token-controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// All device token routes require authentication
router.use(authenticateToken)

// Register a new device token
router.post('/', 
  DeviceTokenController.registerTokenValidation,
  DeviceTokenController.registerToken
)

// Get user's device tokens
router.get('/', DeviceTokenController.getUserTokens)

// Refresh a device token
router.put('/refresh',
  DeviceTokenController.registerTokenValidation,
  DeviceTokenController.refreshToken
)

// Deactivate all user tokens (optionally filtered by platform)
router.delete('/', DeviceTokenController.deactivateAllTokens)

// Check token status
router.get('/:token/status', DeviceTokenController.checkTokenStatus)

// Deactivate a specific token
router.delete('/:token', DeviceTokenController.deactivateToken)

// Admin endpoint for statistics (would typically require admin role)
router.get('/admin/statistics', DeviceTokenController.getTokenStatistics)

export { router as deviceTokenRoutes }