import { Request, Response } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { UserModel } from '../models/user'
import { ResourceWalletModel } from '../models/resource-wallet'
import { AuthService } from '../services/auth-service'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'

export class UserController {
  static getUserValidation = [
    param('id').isUUID().withMessage('Invalid user ID format'),
  ]

  static getUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { id } = req.params

    const user = await UserModel.findById(id)
    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND')
    }

    // Get project roles
    const projectRoles = await UserModel.db('project_roles')
      .where('user_id', id)
      .select('*');

    // Remove sensitive information
    const { password_hash, ...safeUser } = user as any

    const response: ApiResponse = {
      data: {
        ...safeUser,
        projectRoles,
      },
      message: 'User retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static updateProfileValidation = [
    body('name')
      .optional()
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
  ]

  static updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { name, email, phone } = req.body

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await UserModel.findByEmail(email)
      if (existingUser && existingUser.id !== req.user.id) {
        throw createError('Email is already taken', 409, 'EMAIL_TAKEN')
      }
    }

    // Check if phone is already taken by another user
    if (phone) {
      const existingUser = await UserModel.findByPhone(phone)
      if (existingUser && existingUser.id !== req.user.id) {
        throw createError('Phone number is already taken', 409, 'PHONE_TAKEN')
      }
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone

    const updatedUser = await UserModel.updateUser(req.user.id, updateData)

    // Remove sensitive information
    const { password_hash, ...safeUser } = updatedUser as any

    const response: ApiResponse = {
      data: safeUser,
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static searchUsersValidation = [
    query('q').trim().notEmpty().withMessage('Search query is required'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  ]

  static searchUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { q, limit = 10 } = req.query

    const users = await UserModel.searchUsers(
      q as string,
      parseInt(limit as string)
    )

    const response: ApiResponse = {
      data: users,
      message: 'User search completed successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const profile = await AuthService.getUserProfile(req.user.id);

    const response: ApiResponse = {
      data: profile,
      message: 'User profile retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getWalletBalance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const balance = await AuthService.getWalletBalance(req.user.id);

    const response: ApiResponse = {
      data: balance,
      message: 'Wallet balance retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getTransactionHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const { limit = 50, offset = 0 } = req.query;
    const { SeatTransactionModel } = await import('../models/resource-wallet');
    
    const transactions = await SeatTransactionModel.getTransactionHistory(
      req.user.id,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    const response: ApiResponse = {
      data: transactions,
      message: 'Transaction history retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static getUserRoles = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const projectRoles = await UserModel.db('project_roles')
      .where('user_id', req.user.id)
      .select('*');

    const response: ApiResponse = {
      data: {
        userId: req.user.id,
        projectRoles,
      },
      message: 'User roles retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })

  static deleteAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const { password } = req.body

    if (!password) {
      throw createError('Password is required to delete account', 400, 'PASSWORD_REQUIRED')
    }

    // Verify password
    const user = await UserModel.findById(req.user.id)
    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND')
    }

    const isValidPassword = await UserModel.verifyPassword(user, password)
    if (!isValidPassword) {
      throw createError('Invalid password', 401, 'INVALID_PASSWORD')
    }

    // Check if user has active projects as facilitator
    const { ProjectModel } = await import('../models/project')
    const facilitatorProjects = await ProjectModel.findByFacilitator(req.user.id)
    const activeProjects = facilitatorProjects.filter(p => p.status === 'active')

    if (activeProjects.length > 0) {
      throw createError(
        'Cannot delete account with active projects. Please complete or transfer your projects first.',
        400,
        'HAS_ACTIVE_PROJECTS'
      )
    }

    // Soft delete user (in production, you might want to anonymize data instead)
    await UserModel.update(req.user.id, {
      email: null,
      phone: null,
      name: 'Deleted User',
    })

    const response: ApiResponse = {
      data: { success: true },
      message: 'Account deleted successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })
}