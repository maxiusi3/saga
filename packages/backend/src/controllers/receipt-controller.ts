/**
 * Receipt Controller
 * Handles receipt generation, purchase history, and receipt downloads
 */

import { Request, Response } from 'express'
import { param, query, validationResult } from 'express-validator'
import { ReceiptService } from '../services/receipt-service'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'

export class ReceiptController {
  /**
   * Get purchase history for authenticated user
   */
  static getPurchaseHistoryValidation = [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
  ]

  static getPurchaseHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { limit, offset, startDate, endDate } = req.query

    const options = {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    }

    const history = await ReceiptService.getPurchaseHistory(req.user.id, options)

    const response: ApiResponse = {
      data: history,
      message: 'Purchase history retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Get specific receipt by ID
   */
  static getReceiptValidation = [
    param('receiptId').notEmpty().withMessage('Receipt ID is required')
  ]

  static getReceipt = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { receiptId } = req.params

    const receipt = await ReceiptService.getReceiptById(receiptId, req.user.id)
    if (!receipt) {
      throw createError('Receipt not found', 404, 'RECEIPT_NOT_FOUND')
    }

    const response: ApiResponse = {
      data: receipt,
      message: 'Receipt retrieved successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)
  })

  /**
   * Download receipt as PDF
   */
  static downloadReceiptValidation = [
    param('receiptId').notEmpty().withMessage('Receipt ID is required')
  ]

  static downloadReceipt = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { receiptId } = req.params

    // Verify user owns this receipt
    const receipt = await ReceiptService.getReceiptById(receiptId, req.user.id)
    if (!receipt) {
      throw createError('Receipt not found', 404, 'RECEIPT_NOT_FOUND')
    }

    // Generate PDF
    const pdfBuffer = await ReceiptService.generatePDFReceipt(receiptId)

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receiptId}.pdf"`)
    res.setHeader('Content-Length', pdfBuffer.length)

    res.send(pdfBuffer)
  })
}