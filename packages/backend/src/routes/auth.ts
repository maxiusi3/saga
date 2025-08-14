import { Router } from 'express'
import { AuthController } from '../controllers/auth-controller'
import { authenticateToken } from '../middleware/auth'
import { passwordResetRateLimit } from '../middleware/rate-limiting'

const router = Router()

// Public routes
router.post('/signup', AuthController.signUpValidation, AuthController.signUp)
router.post('/signin', AuthController.signInValidation, AuthController.signIn)
router.post('/oauth/google', AuthController.googleOAuthValidation, AuthController.googleOAuth)
router.post('/oauth/apple', AuthController.appleOAuthValidation, AuthController.appleOAuth)
router.post('/refresh', AuthController.refreshTokenValidation, AuthController.refreshToken)
router.post('/reset-password', passwordResetRateLimit, AuthController.resetPasswordValidation, AuthController.resetPassword)
router.post('/confirm-reset', passwordResetRateLimit, AuthController.confirmPasswordResetValidation, AuthController.confirmPasswordReset)

// Protected routes - cast to any to avoid TypeScript conflicts
router.post('/signout', authenticateToken as any, AuthController.signOut)
router.post('/change-password', authenticateToken as any, AuthController.changePasswordValidation, AuthController.changePassword)
router.get('/profile', authenticateToken as any, AuthController.getProfile)

export { router as authRoutes }