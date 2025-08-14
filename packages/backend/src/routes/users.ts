import { Router } from 'express'
import { UserController } from '../controllers/user-controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// All user routes require authentication
router.use(authenticateToken)

// User operations
router.get('/search', UserController.searchUsersValidation, UserController.searchUsers)
router.get('/me/profile', UserController.getProfile)
router.get('/me/wallet', UserController.getWalletBalance)
router.get('/me/transactions', UserController.getTransactionHistory)
router.get('/me/roles', UserController.getUserRoles)
router.put('/me/profile', UserController.updateProfileValidation, UserController.updateProfile)
router.delete('/me/account', UserController.deleteAccount)
router.get('/:id', UserController.getUserValidation, UserController.getUser)

export { router as userRoutes }