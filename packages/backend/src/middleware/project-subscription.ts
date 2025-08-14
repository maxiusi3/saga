import { Request, Response, NextFunction } from 'express'
import { SubscriptionService } from '../services/subscription-service'
import { ProjectModel } from '../models/project'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email?: string
    name: string
  }
}

/**
 * Middleware to check if the project's facilitator has an active subscription
 * This should be used on project-specific routes where we need to verify
 * that the facilitator has paid for the service
 */
export const requireProjectSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const projectId = req.params.id || req.params.projectId

    if (!projectId) {
      res.status(400).json({
        error: {
          code: 'MISSING_PROJECT_ID',
          message: 'Project ID is required',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      })
      return
    }

    // Get the project to find the facilitator
    const project = await ProjectModel.findById(projectId)
    if (!project) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      })
      return
    }

    // Check if the project's facilitator has an active subscription
    const subscriptionStatus = await SubscriptionService.getSubscriptionStatus(project.facilitatorId)

    if (!subscriptionStatus.hasActiveSubscription) {
      res.status(403).json({
        error: {
          code: 'PROJECT_SUBSCRIPTION_REQUIRED',
          message: 'Project facilitator must have an active subscription to access this resource',
          details: {
            hasActiveSubscription: false,
            daysRemaining: subscriptionStatus.daysRemaining,
            facilitatorId: project.facilitatorId,
          },
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      })
      return
    }

    // Add subscription info to request for use in controllers
    ;(req as any).projectSubscription = subscriptionStatus.subscription

    next()
  } catch (error) {
    console.error('Project subscription middleware error:', error)
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to verify project subscription status',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }
}