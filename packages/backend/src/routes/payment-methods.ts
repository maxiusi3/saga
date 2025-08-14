/**
 * Payment Method Routes
 * API endpoints for payment method management
 */

import { Router } from 'express'
import { PaymentMethodController } from '../controllers/payment-method-controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// All payment method routes require authentication
router.use(authMiddleware)

/**
 * @route GET /api/payment-methods
 * @desc Get all payment methods for authenticated user
 * @access Private
 */
router.get(
  '/',
  PaymentMethodController.getPaymentMethods
)

/**
 * @route POST /api/payment-methods/setup-intent
 * @desc Create setup intent for adding new payment method
 * @access Private
 */
router.post(
  '/setup-intent',
  PaymentMethodController.createSetupIntent
)

/**
 * @route POST /api/payment-methods/confirm-setup
 * @desc Confirm setup intent and save payment method
 * @access Private
 * @body { setupIntentId: string }
 */
router.post(
  '/confirm-setup',
  PaymentMethodController.confirmSetupIntentValidation,
  PaymentMethodController.confirmSetupIntent
)

/**
 * @route GET /api/payment-methods/stats
 * @desc Get payment method statistics for user
 * @access Private
 */
router.get(
  '/stats',
  PaymentMethodController.getPaymentMethodStats
)

/**
 * @route POST /api/payment-methods/handle-expired
 * @desc Handle expired payment methods
 * @access Private
 */
router.post(
  '/handle-expired',
  PaymentMethodController.handleExpiredPaymentMethods
)

/**
 * @route GET /api/payment-methods/:paymentMethodId
 * @desc Get specific payment method
 * @access Private
 * @params { paymentMethodId: string }
 */
router.get(
  '/:paymentMethodId',
  PaymentMethodController.getPaymentMethodValidation,
  PaymentMethodController.getPaymentMethod
)

/**
 * @route PUT /api/payment-methods/:paymentMethodId
 * @desc Update payment method billing details
 * @access Private
 * @params { paymentMethodId: string }
 * @body { billingDetails?: object }
 */
router.put(
  '/:paymentMethodId',
  PaymentMethodController.updatePaymentMethodValidation,
  PaymentMethodController.updatePaymentMethod
)

/**
 * @route POST /api/payment-methods/:paymentMethodId/set-default
 * @desc Set payment method as default
 * @access Private
 * @params { paymentMethodId: string }
 */
router.post(
  '/:paymentMethodId/set-default',
  PaymentMethodController.setDefaultPaymentMethodValidation,
  PaymentMethodController.setDefaultPaymentMethod
)

/**
 * @route DELETE /api/payment-methods/:paymentMethodId
 * @desc Remove payment method
 * @access Private
 * @params { paymentMethodId: string }
 */
router.delete(
  '/:paymentMethodId',
  PaymentMethodController.removePaymentMethodValidation,
  PaymentMethodController.removePaymentMethod
)

export default router