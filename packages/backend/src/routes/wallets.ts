/**
 * Wallet Routes
 * API endpoints for wallet and resource management
 */

import { Router } from 'express'
import { WalletController } from '../controllers/wallet-controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Apply authentication middleware to all wallet routes
router.use(authMiddleware)

/**
 * @route GET /api/wallets/:userId
 * @desc Get user's wallet details
 * @access Private (Self or Admin)
 */
router.get('/:userId', WalletController.getWallet)

/**
 * @route GET /api/wallets/:userId/balance
 * @desc Get user's wallet balance
 * @access Private (Self or Admin)
 */
router.get('/:userId/balance', WalletController.getWalletBalance)

/**
 * @route GET /api/wallets/:userId/stats
 * @desc Get user's wallet statistics
 * @access Private (Self or Admin)
 */
router.get('/:userId/stats', WalletController.getWalletStats)

/**
 * @route GET /api/wallets/:userId/history
 * @desc Get user's transaction history
 * @access Private (Self or Admin)
 * @query limit, offset, resourceType, transactionType, startDate, endDate
 */
router.get('/:userId/history', WalletController.getTransactionHistory)

/**
 * @route GET /api/wallets/:userId/check-resources
 * @desc Check if user has sufficient resources
 * @access Private (Self or Admin)
 * @query resourceType, amount
 */
router.get('/:userId/check-resources', WalletController.checkSufficientResources)

/**
 * @route POST /api/wallets/:userId/consume
 * @desc Consume resources from wallet
 * @access Private (Self or Admin)
 * @body { resourceType: string, amount: number, projectId?: string, description?: string }
 */
router.post('/:userId/consume', WalletController.consumeResources)

/**
 * @route POST /api/wallets/:userId/add
 * @desc Add resources to wallet (Admin only)
 * @access Private (Admin)
 * @body { resourceType: string, amount: number, transactionType?: string, description?: string, projectId?: string }
 */
router.post('/:userId/add', WalletController.addResources)

/**
 * @route POST /api/wallets/:userId/refund
 * @desc Process refund to wallet (Admin only)
 * @access Private (Admin)
 * @body { resourceType: string, amount: number, description: string, projectId?: string }
 */
router.post('/:userId/refund', WalletController.processRefund)

/**
 * @route POST /api/wallets/:userId/refresh
 * @desc Force wallet refresh and sync
 * @access Private (Self or Admin)
 */
router.post('/:userId/refresh', WalletController.forceRefresh)

/**
 * @route GET /api/wallets/:userId/sync-status
 * @desc Get wallet synchronization status
 * @access Private (Self or Admin)
 */
router.get('/:userId/sync-status', WalletController.getSyncStatus)

/**
 * Utility endpoints for common operations
 */

/**
 * @route GET /api/wallets/:userId/can-create-project
 * @desc Check if user can create a project
 * @access Private (Self or Admin)
 */
router.get('/:userId/can-create-project', WalletController.canCreateProject)

/**
 * @route GET /api/wallets/:userId/can-invite-facilitator
 * @desc Check if user can invite a facilitator
 * @access Private (Self or Admin)
 */
router.get('/:userId/can-invite-facilitator', WalletController.canInviteFacilitator)

/**
 * @route GET /api/wallets/:userId/can-invite-storyteller
 * @desc Check if user can invite a storyteller
 * @access Private (Self or Admin)
 */
router.get('/:userId/can-invite-storyteller', WalletController.canInviteStoryteller)

export default router