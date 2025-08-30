/**
 * Package Routes
 * API endpoints for package management and purchasing
 */

import { Router } from 'express'
import { PackageController } from '../controllers/package-controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

/**
 * Public routes (no authentication required)
 */

/**
 * @route GET /api/packages
 * @desc Get all active packages
 * @access Public
 */
router.get('/', PackageController.getActivePackages)

/**
 * @route GET /api/packages/:packageId
 * @desc Get package details by ID
 * @access Public
 */
router.get('/:packageId', PackageController.getPackageById)

/**
 * @route GET /api/packages/recommendations
 * @desc Get package recommendations based on criteria
 * @access Public
 * @query familySize, projectCount, budget
 */
router.get('/recommendations', PackageController.getPackageRecommendations)

/**
 * @route GET /api/packages/comparison
 * @desc Get package comparison data
 * @access Public
 */
router.get('/comparison', PackageController.getPackageComparison)

/**
 * Protected routes (authentication required)
 */
router.use(authMiddleware)

/**
 * @route POST /api/packages/:packageId/payment-intent
 * @desc Create payment intent for package purchase
 * @access Private
 */
router.post('/:packageId/payment-intent', PackageController.createPaymentIntent)

/**
 * @route POST /api/packages/:packageId/purchase
 * @desc Confirm payment and complete package purchase
 * @access Private
 * @body { paymentIntentId: string, paymentMethodId?: string }
 */
router.post('/:packageId/purchase', PackageController.confirmPaymentAndPurchase)

/**
 * @route GET /api/packages/user/purchase-history
 * @desc Get user's package purchase history
 * @access Private
 * @query limit, offset
 */
router.get('/user/purchase-history', PackageController.getPurchaseHistory)

/**
 * Admin routes (admin access required)
 */

/**
 * @route GET /api/packages/admin/stats
 * @desc Get package statistics
 * @access Private (Admin)
 */
router.get('/admin/stats', PackageController.getPackageStats)

/**
 * @route POST /api/packages/admin/create
 * @desc Create new package
 * @access Private (Admin)
 * @body Package data
 */
router.post('/admin/create', PackageController.createPackage)

/**
 * @route PUT /api/packages/:packageId/admin/price
 * @desc Update package price
 * @access Private (Admin)
 * @body { price: number }
 */
router.put('/:packageId/admin/price', PackageController.updatePackagePrice)

/**
 * @route DELETE /api/packages/:packageId/admin/deactivate
 * @desc Deactivate package
 * @access Private (Admin)
 */
router.delete('/:packageId/admin/deactivate', PackageController.deactivatePackage)

/**
 * @route POST /api/packages/admin/sync-stripe
 * @desc Sync packages with Stripe
 * @access Private (Admin)
 */
router.post('/admin/sync-stripe', PackageController.syncWithStripe)

export default router