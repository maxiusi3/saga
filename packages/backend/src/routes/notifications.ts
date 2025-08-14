import { Router } from 'express'
import { NotificationController } from '../controllers/notification-controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// All notification routes require authentication
router.use(authenticateToken)

// Notification management
router.get('/', NotificationController.getNotificationsValidation, NotificationController.getNotifications)
router.patch('/:id/read', NotificationController.markAsReadValidation, NotificationController.markAsRead)
router.patch('/read-all', NotificationController.markAllAsRead)

// Notification preferences
router.get('/preferences', NotificationController.getPreferences)
router.put('/preferences', NotificationController.updatePreferencesValidation, NotificationController.updatePreferences)

// Device token management
router.post('/device-tokens', NotificationController.registerDeviceTokenValidation, NotificationController.registerDeviceToken)
router.get('/device-tokens', NotificationController.getDeviceTokens)
router.delete('/device-tokens', NotificationController.deactivateDeviceTokenValidation, NotificationController.deactivateDeviceToken)

// Testing and statistics
router.post('/test', NotificationController.testNotificationValidation, NotificationController.testNotification)
router.get('/stats', NotificationController.getStats)

export { router as notificationRoutes }