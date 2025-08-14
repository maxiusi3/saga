import { Request, Response, NextFunction } from 'express'
import { SubscriptionService } from '../services/subscription-service'
import { BaseModel } from '../models/base'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email?: string
    name: string
  }
}

/**
 * Middleware to check if the facilitator has an active subscription
 */
export const requireActiveSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      })
      return
    }

    // Check if user has facilitator role
    const facilitatorRole = await BaseModel.db('user_roles')
      .where('user_id', req.user.id)
      .where('type', 'facilitator')
      .first()

    if (!facilitatorRole) {
      next()
      return
    }

    const subscriptionStatus = await SubscriptionService.getSubscriptionStatus(req.user.id)

    if (!subscriptionStatus.hasActiveSubscription) {
      res.status(403).json({
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'Active subscription required to access this resource',
          details: {
            hasActiveSubscription: false,
            daysRemaining: subscriptionStatus.daysRemaining,
          },
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      })
      return
    }

    // Add subscription info to request for use in controllers
    ;(req as any).subscription = subscriptionStatus.subscription

    next()
  } catch (error) {
    console.error('Subscription middleware error:', error)
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to verify subscription status',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }
}

/**
 * Middleware to check subscription status without blocking access
 * Adds subscription info to request for optional use
 */
export const checkSubscriptionStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      // Check if user has facilitator role
      const facilitatorRole = await BaseModel.db('user_roles')
        .where('user_id', req.user.id)
        .where('type', 'facilitator')
        .first()

      if (facilitatorRole) {
        const subscriptionStatus = await SubscriptionService.getSubscriptionStatus(req.user.id)
        ;(req as any).subscriptionStatus = subscriptionStatus
      }
    }
    next()
  } catch (error) {
    console.error('Subscription status check error:', error)
    // Don't block request on error, just continue without subscription info
    next()
  }
}