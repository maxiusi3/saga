/**
 * Receipt Routes
 * API endpoints for purchase receipts and history
 */

import { Router } from 'express'
import { ReceiptController } from '../controllers/receipt-controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// All receipt routes require authentication
router.use(authMiddleware)

/**
 * @route GET /api/receipts/history
 * @desc Get purchase history for authenticated user
 * @access Private
 * @query { limit?: number, offset?: number, startDate?: string, endDate?: string }
 */
router.get(
  '/history',
  ReceiptController.getPurchaseHistoryValidation,
  ReceiptController.getPurchaseHistory
)

/**
 * @route GET /api/receipts/:receiptId
 * @desc Get specific receipt by ID
 * @access Private
 * @params { receiptId: string }
 */
router.get(
  '/:receiptId',
  ReceiptController.getReceiptValidation,
  ReceiptController.getReceipt
)

/**
 * @route GET /api/receipts/:receiptId/download
 * @desc Download receipt as PDF
 * @access Private
 * @params { receiptId: string }
 */
router.get(
  '/:receiptId/download',
  ReceiptController.downloadReceiptValidation,
  ReceiptController.downloadReceipt
)

export default router