import { Request, Response, NextFunction } from 'express'
import { AuthConfig } from '../config/auth'
import { UserModel } from '../models/user'
import { ResourceWalletModel } from '../models/resource-wallet'
import { User } from '@saga/shared'
import { createError } from './error-handler'

export interface AuthenticatedRequest extends Request {
  user?: User
  userWallet?: any // Optional wallet information
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      throw createError('Access token required', 401, 'MISSING_TOKEN')
    }

    const payload = AuthConfig.verifyAccessToken(token)
    
    // Verify user still exists
    const user = await UserModel.findById(payload.userId) as User | undefined
    if (!user) {
      throw createError('User not found', 401, 'USER_NOT_FOUND')
    }

    req.user = user

    next()
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('jwt expired')) {
        next(createError('Token expired', 401, 'TOKEN_EXPIRED'))
      } else if (error.message.includes('invalid token')) {
        next(createError('Invalid token', 401, 'INVALID_TOKEN'))
      } else {
        next(error)
      }
    } else {
      next(createError('Authentication failed', 401, 'AUTH_FAILED'))
    }
  }
}

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (token) {
      const payload = AuthConfig.verifyAccessToken(token)
      const user = await UserModel.findById(payload.userId) as User | undefined
      
      if (user) {
        req.user = user
      }
    }

    next()
  } catch (error) {
    // For optional auth, we don't throw errors, just continue without user
    next()
  }
}

export const requireProjectRole = (allowedRoles: ('facilitator' | 'storyteller')[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401, 'AUTH_REQUIRED')
      }

      const projectId = req.params.id || req.params.projectId
      if (!projectId) {
        throw createError('Project ID required', 400, 'PROJECT_ID_REQUIRED')
      }

      // Check user's role in this specific project
      const projectRole = await UserModel.db('project_roles')
        .where('user_id', req.user.id)
        .where('project_id', projectId)
        .first();

      if (!projectRole || !allowedRoles.includes(projectRole.role)) {
        throw createError(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`,
          403,
          'INSUFFICIENT_PERMISSIONS'
        )
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

// Legacy role middleware for backward compatibility
export const requireRole = (allowedRoles: string[]) => {
  return requireProjectRole(allowedRoles as any);
}

export const includeWallet = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user) {
      // Optionally include wallet information
      req.userWallet = await ResourceWalletModel.getWallet(req.user.id);
    }
    next()
  } catch (error) {
    // Don't fail if wallet can't be loaded, just continue without it
    next()
  }
}

export const requireProjectAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw createError('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const projectId = req.params.id || req.params.projectId
    if (!projectId) {
      throw createError('Project ID required', 400, 'PROJECT_ID_REQUIRED')
    }

    // Check if user has any role in this project
    const projectRole = await UserModel.db('project_roles')
      .where('user_id', req.user.id)
      .where('project_id', projectId)
      .first();

    if (!projectRole) {
      throw createError('Access denied to this project', 403, 'PROJECT_ACCESS_DENIED')
    }

    next()
  } catch (error) {
    next(error)
  }
}

// Alias for backward compatibility
export const authMiddleware = authenticateToken