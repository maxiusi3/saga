/**
 * Payment Routes
 * API endpoints for payment processing and package purchases
 */

import { Router } from 'express'
import { PaymentController } from '../controllers/payment-controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Apply authentication middleware to all payment routes
router.use(authMiddleware)

/**
 * @route GET /api/payments/packages
 * @desc Get available packages for purchase
 * @access Private
 */
router.get('/packages', PaymentController.getPackages)

/**
 * @route POST /api/payments/create-intent
 * @desc Create payment intent for package purchase
 * @access Private
 * @body { packageId: string }
 */
router.post('/create-intent', PaymentController.createPaymentIntent)

/**
 * @route POST /api/payments/confirm
 * @desc Confirm payment and complete purchase
 * @access Private
 * @body { paymentIntentId: string }
 */
router.post('/confirm', PaymentController.confirmPayment)

/**
 * @route GET /api/payments/methods
 * @desc Get user's saved payment methods
 * @access Private
 */
router.get('/methods', PaymentController.getPaymentMethods)

/**
 * @route POST /api/payments/setup-intent
 * @desc Create setup intent for saving payment method
 * @access Private
 */
router.post('/setup-intent', PaymentController.createSetupIntent)

/**
 * @route POST /api/payments/default-method
 * @desc Set default payment method
 * @access Private
 * @body { paymentMethodId: string }
 */
router.post('/default-method', PaymentController.setDefaultPaymentMethod)

/**
 * @route GET /api/payments/status/:paymentIntentId
 * @desc Get payment intent status
 * @access Private
 */
router.get('/status/:paymentIntentId', PaymentController.getPaymentStatus)

/**
 * @route GET /api/payments/attempts
 * @desc Get user's payment attempts
 * @access Private
 */
router.get('/attempts', PaymentController.getPaymentAttempts)

/**
 * @route POST /api/payments/validate-method
 * @desc Validate payment method before use
 * @access Private
 * @body { paymentMethodId: string }
 */
router.post('/validate-method', PaymentController.validatePaymentMethod)

/**
 * @route POST /api/payments/refund
 * @desc Process refund (admin only)
 * @access Private (Admin)
 * @body { paymentIntentId: string, amount?: number, reason?: string }
 */
router.post('/refund', PaymentController.processRefund)

/**
 * @route POST /api/payments/webhook
 * @desc Handle Stripe webhooks
 * @access Public (but verified by Stripe signature)
 */
router.post('/webhook', PaymentController.handleWebhook)

export default router