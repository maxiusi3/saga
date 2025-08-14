/**
 * Payment Method Controller
 * Handles payment method management endpoints
 */

import { Request, Response } from 'express'
import { body, param, validationResult } from 'express-validator'
import { PaymentMethodService } from '../services/payment-method-service'
import { PaymentService } from '../services/payment-service'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'

export class PaymentMethodController {
  /**
   * Get all payment methods for authenticated user
   */
  static getPaymentMethods = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    // Get or create Stripe customer
    const customer = await PaymentService.createOrGetCustomer(
      req.user.id,
      req.user.email,
      req.user.name
    )

    const paymentMethods = await PaymentMethodService.getPaymentMethodsWithDefault(customer.id)

    const response: ApiResponse = {
      data: {
        paymentMethods,
        customerId: customer.id
      },
      message: 'Payment methods retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Create setup intent for adding new payment method
   */
  static createSetupIntent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    // Get or create Stripe customer
    const customer = await PaymentService.createOrGetCustomer(
      req.user.id,
      req.user.email,
      req.user.name
    )

    const result = await PaymentMethodService.createSetupIntent(customer.id)

    if (!result.success) {
      throw createError(result.error || 'Failed to create setup intent', 400, 'SETUP_INTENT_FAILED')
    }

    const response: ApiResponse = {
      data: {
        clientSecret: result.clientSecret,
        setupIntentId: result.setupIntentId
      },
      message: 'Setup intent created successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Confirm setup intent and save payment method
   */
  static confirmSetupIntentValidation = [
    body('setupIntentId').notEmpty().withMessage('Setup intent ID is required')
  ]

  static confirmSetupIntent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { setupIntentId } = req.body

    // Get or create Stripe customer
    const customer = await PaymentService.createOrGetCustomer(
      req.user.id,
      req.user.email,
      req.user.name
    )

    const result = await PaymentMethodService.confirmSetupIntent(setupIntentId, customer.id)

    if (!result.success) {
      throw createError(result.error || 'Failed to confirm setup intent', 400, 'SETUP_INTENT_CONFIRMATION_FAILED')
    }

    const response: ApiResponse = {
      data: {
        paymentMethod: result.paymentMethod
      },
      message: 'Payment method added successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Set default payment method
   */
  static setDefaultPaymentMethodValidation = [
    param('paymentMethodId').notEmpty().withMessage('Payment method ID is required')
  ]

  static setDefaultPaymentMethod = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { paymentMethodId } = req.params

    // Get or create Stripe customer
    const customer = await PaymentService.createOrGetCustomer(
      req.user.id,
      req.user.email,
      req.user.name
    )

    // Validate that payment method belongs to customer
    const isValid = await PaymentMethodService.validatePaymentMethod(customer.id, paymentMethodId)
    if (!isValid) {
      throw createError('Payment method not found or does not belong to user', 404, 'PAYMENT_METHOD_NOT_FOUND')
    }

    const result = await PaymentMethodService.setDefaultPaymentMethod(customer.id, paymentMethodId)

    if (!result.success) {
      throw createError(result.error || 'Failed to set default payment method', 400, 'SET_DEFAULT_FAILED')
    }

    const response: ApiResponse = {
      data: { success: true },
      message: 'Default payment method set successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Remove payment method
   */
  static removePaymentMethodValidation = [
    param('paymentMethodId').notEmpty().withMessage('Payment method ID is required')
  ]

  static removePaymentMethod = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { paymentMethodId } = req.params

    // Get or create Stripe customer
    const customer = await PaymentService.createOrGetCustomer(
      req.user.id,
      req.user.email,
      req.user.name
    )

    // Validate that payment method belongs to customer
    const isValid = await PaymentMethodService.validatePaymentMethod(customer.id, paymentMethodId)
    if (!isValid) {
      throw createError('Payment method not found or does not belong to user', 404, 'PAYMENT_METHOD_NOT_FOUND')
    }

    const result = await PaymentMethodService.removePaymentMethod(paymentMethodId)

    if (!result.success) {
      throw createError(result.error || 'Failed to remove payment method', 400, 'REMOVE_PAYMENT_METHOD_FAILED')
    }

    const response: ApiResponse = {
      data: { success: true },
      message: 'Payment method removed successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Get specific payment method
   */
  static getPaymentMethodValidation = [
    param('paymentMethodId').notEmpty().withMessage('Payment method ID is required')
  ]

  static getPaymentMethod = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { paymentMethodId } = req.params

    // Get or create Stripe customer
    const customer = await PaymentService.createOrGetCustomer(
      req.user.id,
      req.user.email,
      req.user.name
    )

    // Validate that payment method belongs to customer
    const isValid = await PaymentMethodService.validatePaymentMethod(customer.id, paymentMethodId)
    if (!isValid) {
      throw createError('Payment method not found or does not belong to user', 404, 'PAYMENT_METHOD_NOT_FOUND')
    }

    const paymentMethod = await PaymentMethodService.getPaymentMethodById(paymentMethodId)

    if (!paymentMethod) {
      throw createError('Payment method not found', 404, 'PAYMENT_METHOD_NOT_FOUND')
    }

    const response: ApiResponse = {
      data: { paymentMethod },
      message: 'Payment method retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Update payment method billing details
   */
  static updatePaymentMethodValidation = [
    param('paymentMethodId').notEmpty().withMessage('Payment method ID is required'),
    body('billingDetails').optional().isObject().withMessage('Billing details must be an object'),
    body('billingDetails.name').optional().isString().withMessage('Name must be a string'),
    body('billingDetails.email').optional().isEmail().withMessage('Email must be valid'),
    body('billingDetails.phone').optional().isString().withMessage('Phone must be a string')
  ]

  static updatePaymentMethod = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { paymentMethodId } = req.params
    const { billingDetails } = req.body

    // Get or create Stripe customer
    const customer = await PaymentService.createOrGetCustomer(
      req.user.id,
      req.user.email,
      req.user.name
    )

    // Validate that payment method belongs to customer
    const isValid = await PaymentMethodService.validatePaymentMethod(customer.id, paymentMethodId)
    if (!isValid) {
      throw createError('Payment method not found or does not belong to user', 404, 'PAYMENT_METHOD_NOT_FOUND')
    }

    const result = await PaymentMethodService.updatePaymentMethod(paymentMethodId, {
      billingDetails
    })

    if (!result.success) {
      throw createError(result.error || 'Failed to update payment method', 400, 'UPDATE_PAYMENT_METHOD_FAILED')
    }

    const response: ApiResponse = {
      data: {
        paymentMethod: result.paymentMethod
      },
      message: 'Payment method updated successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Get payment method statistics
   */
  static getPaymentMethodStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    // Get or create Stripe customer
    const customer = await PaymentService.createOrGetCustomer(
      req.user.id,
      req.user.email,
      req.user.name
    )

    const stats = await PaymentMethodService.getPaymentMethodStats(customer.id)

    const response: ApiResponse = {
      data: stats,
      message: 'Payment method statistics retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Handle expired payment methods
   */
  static handleExpiredPaymentMethods = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    // Get or create Stripe customer
    const customer = await PaymentService.createOrGetCustomer(
      req.user.id,
      req.user.email,
      req.user.name
    )

    const result = await PaymentMethodService.handleExpiredPaymentMethods(customer.id)

    const response: ApiResponse = {
      data: result,
      message: 'Expired payment methods handled successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })
}