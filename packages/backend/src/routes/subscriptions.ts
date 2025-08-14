import { Router } from 'express'
import { SubscriptionController } from '../controllers/subscription-controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// Create checkout session for "The Saga Package"
router.post('/checkout', authenticateToken, SubscriptionController.createCheckoutSession)

// Handle successful payment completion
router.post('/payment-success', SubscriptionController.validatePaymentSuccess, SubscriptionController.handlePaymentSuccess)

// Get subscription status for authenticated facilitator
router.get('/status', authenticateToken, SubscriptionController.getSubscriptionStatus)

// Cancel subscription
router.post('/cancel', authenticateToken, SubscriptionController.cancelSubscription)

// Project subscription renewal
router.post('/projects/:projectId/renew', authenticateToken, SubscriptionController.renewProjectSubscription)
router.post('/projects/:projectId/renewal-checkout', authenticateToken, SubscriptionController.createRenewalCheckoutSession)
router.get('/projects/:projectId/status', authenticateToken, SubscriptionController.getProjectSubscriptionStatus)

// Stripe webhook endpoint (no authentication required)
router.post('/webhook', SubscriptionController.handleWebhook)

export { router as subscriptionRoutes }