import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { AuthService } from '../services/auth-service'
import { OAuthService } from '../services/oauth-service'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'

export class AuthController {
  static signUpValidation = [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email format'),
    body('phone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Invalid phone number'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  ]

  static signUp = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { name, email, phone, password } = req.body

    if (!email && !phone) {
      throw createError('Either email or phone is required', 400, 'MISSING_IDENTIFIER')
    }

    const result = await AuthService.signUp({
      name,
      email,
      phone,
      password,
    })

    const response: ApiResponse<any> = {
      success: true,
      data: result,
      message: 'Account created successfully',
    }

    res.status(201).json(response)
  })

  static signInValidation = [
    body('identifier')
      .notEmpty()
      .withMessage('Email or phone is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ]

  static signIn = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { identifier, password } = req.body

    const result = await AuthService.signIn(identifier, password)

    const response: ApiResponse<any> = {
      success: true,
      data: result,
      message: 'Signed in successfully',
    }

    res.json(response)
  })

  static googleOAuthValidation = [
    body('accessToken')
      .notEmpty()
      .withMessage('Google access token is required'),
  ]

  static googleOAuth = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { accessToken } = req.body

    // Verify Google token and get user info
    const googleUser = await OAuthService.verifyGoogleToken(accessToken)

    // Sign in or create user
    const result = await AuthService.signInWithOAuth('google', googleUser.id, {
      name: googleUser.name,
      email: googleUser.email,
    })

    const response: ApiResponse<any> = {
      success: true,
      data: result,
      message: 'Signed in with Google successfully',
    }

    res.json(response)
  })

  static appleOAuthValidation = [
    body('idToken')
      .notEmpty()
      .withMessage('Apple ID token is required'),
    body('user')
      .optional()
      .isObject()
      .withMessage('User data must be an object'),
  ]

  static appleOAuth = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { idToken, user } = req.body

    // Verify Apple token and get user info
    const appleUser = await OAuthService.verifyAppleToken(idToken)

    // Apple provides user info only on first sign-in
    const userName = user?.name 
      ? `${user.name.firstName || ''} ${user.name.lastName || ''}`.trim()
      : appleUser.name 
        ? `${appleUser.name.firstName || ''} ${appleUser.name.lastName || ''}`.trim()
        : 'Apple User'

    // Sign in or create user
    const result = await AuthService.signInWithOAuth('apple', appleUser.sub, {
      name: userName,
      email: appleUser.email,
    })

    const response: ApiResponse<any> = {
      success: true,
      data: result,
      message: 'Signed in with Apple successfully',
    }

    res.json(response)
  })

  static refreshTokenValidation = [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required'),
  ]

  static refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { refreshToken } = req.body

    const result = await AuthService.refreshToken(refreshToken)

    const response: ApiResponse<any> = {
      success: true,
      data: result,
      message: 'Token refreshed successfully',
    }

    res.json(response)
  })

  static signOut = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const { refreshToken } = req.body

    await AuthService.signOut(req.user.id, refreshToken)

    const response: ApiResponse<any> = {
      success: true,
      data: { success: true },
      message: 'Signed out successfully',
    }

    res.json(response)
  })

  static changePasswordValidation = [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  ]

  static changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { currentPassword, newPassword } = req.body

    await AuthService.changePassword(req.user.id, currentPassword, newPassword)

    const response: ApiResponse<any> = {
      success: true,
      data: { success: true },
      message: 'Password changed successfully',
    }

    res.json(response)
  })

  static resetPasswordValidation = [
    body('identifier')
      .notEmpty()
      .withMessage('Email or phone is required'),
  ]

  static resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { identifier } = req.body

    await AuthService.resetPassword(identifier)

    const response: ApiResponse<any> = {
      success: true,
      data: { success: true },
      message: 'If an account with that email/phone exists, a reset link has been sent',
    }

    res.json(response)
  })

  static confirmPasswordResetValidation = [
    body('resetToken')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  ]

  static confirmPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { resetToken, newPassword } = req.body

    await AuthService.confirmPasswordReset(resetToken, newPassword)

    const response: ApiResponse<any> = {
      success: true,
      data: { success: true },
      message: 'Password reset successfully',
    }

    res.json(response)
  })

  static getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const { UserModel } = await import('../models/user')
    const userWithRoles = await UserModel.getUserWithProjectRoles(req.user.id)

    if (!userWithRoles) {
      throw createError('User not found', 404, 'USER_NOT_FOUND')
    }

    const response: ApiResponse<any> = {
      success: true,
      data: userWithRoles,
      message: 'Profile retrieved successfully',
    }

    res.json(response)
  })
}