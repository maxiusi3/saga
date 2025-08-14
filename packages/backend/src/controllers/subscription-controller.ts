import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { SubscriptionService } from '../services/subscription-service'
import { stripe, STRIPE_CONFIG } from '../config/stripe'
import { BaseModel } from '../models/base'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email?: string
    name: string
  }
}

export class SubscriptionController {
  /**
   * Create a checkout session for "The Saga Package"
   */
  static async createCheckoutSession(req: AuthenticatedRequest, res: Response): Promise<void> {
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
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Only facilitators can purchase subscriptions',
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        })
        return
      }

      const session = await SubscriptionService.createCheckoutSession(req.user.id)

      res.json({
        sessionId: session.id,
        url: session.url,
      })
    } catch (error) {
      console.error('Create checkout session error:', error)
      
      if (error instanceof Error) {
        if (error.message === 'Facilitator already has an active subscription') {
          res.status(409).json({
            error: {
              code: 'SUBSCRIPTION_EXISTS',
              message: error.message,
            },
            timestamp: new Date().toISOString(),
            path: req.path,
          })
          return
        }
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create checkout session',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      })
    }
  }

  /**
   * Handle successful payment completion
   */
  static async handlePaymentSuccess(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: errors.array(),
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        })
        return
      }

      const { sessionId } = req.body

      const subscription = await SubscriptionService.handlePaymentSuccess(sessionId)

      res.json({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
      })
    } catch (error) {
      console.error('Handle payment success error:', error)
      
      if (error instanceof Error) {
        if (error.message === 'Payment not completed' || error.message === 'Facilitator ID not found in session metadata') {
          res.status(400).json({
            error: {
              code: 'INVALID_SESSION',
              message: error.message,
            },
            timestamp: new Date().toISOString(),
            path: req.path,
          })
          return
        }
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process payment success',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      })
    }
  }

  /**
   * Get subscription status for the authenticated facilitator
   */
  static async getSubscriptionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
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
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Only facilitators can check subscription status',
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        })
        return
      }

      const subscriptionStatus = await SubscriptionService.getSubscriptionStatus(req.user.id)

      res.json(subscriptionStatus)
    } catch (error) {
      console.error('Get subscription status error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get subscription status',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      })
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
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
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Only facilitators can cancel subscriptions',
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        })
        return
      }

      await SubscriptionService.cancelSubscription(req.user.id)

      res.json({
        success: true,
        message: 'Subscription canceled successfully',
      })
    } catch (error) {
      console.error('Cancel subscription error:', error)
      
      if (error instanceof Error && error.message === 'Subscription not found') {
        res.status(404).json({
          error: {
            code: 'SUBSCRIPTION_NOT_FOUND',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        })
        return
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cancel subscription',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      })
    }
  }

  /**
   * Handle Stripe webhooks
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const sig = req.headers['stripe-signature'] as string

      if (!sig) {
        res.status(400).json({
          error: {
            code: 'MISSING_SIGNATURE',
            message: 'Stripe signature header is required',
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        })
        return
      }

      let event: any

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_CONFIG.webhookSecret)
      } catch (err) {
        console.error('Webhook signature verification failed:', err)
        res.status(400).json({
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Invalid webhook signature',
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        })
        return
      }

      await SubscriptionService.handleWebhookEvent(event)

      res.json({ received: true })
    } catch (error) {
      console.error('Webhook handling error:', error)
      res.status(500).json({
        error: {
          code: 'WEBHOOK_ERROR',
          message: 'Failed to process webhook',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      })
    }
  }

  /**
   * Renew a project subscription
   */
  static async renewProjectSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const { projectId } = req.params;

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

      // Import ArchivalService here to avoid circular dependencies
      const { ArchivalService } = await import('../services/archival-service');
      const archivalService = new ArchivalService();

      await archivalService.renewSubscription(projectId);

      res.json({
        success: true,
        message: 'Subscription renewed successfully',
        projectId,
      })
    } catch (error) {
      console.error('Renew subscription error:', error)
      
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
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
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to renew subscription',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      })
    }
  }

  /**
   * Create a checkout session for subscription renewal
   */
  static async createRenewalCheckoutSession(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const { projectId } = req.params;

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

      // Create a Stripe checkout session for renewal
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Saga Subscription Renewal',
                description: 'One year subscription renewal for your Saga project',
              },
              unit_amount: 9900, // $99.00 in cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.WEB_APP_URL}/projects/${projectId}?renewal=success`,
        cancel_url: `${process.env.WEB_APP_URL}/projects/${projectId}?renewal=cancelled`,
        metadata: {
          type: 'renewal',
          projectId,
          userId: req.user.id,
        },
      });

      res.json({
        sessionId: session.id,
        url: session.url,
      })
    } catch (error) {
      console.error('Create renewal checkout session error:', error)
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create renewal checkout session',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      })
    }
  }

  /**
   * Get project subscription status
   */
  static async getProjectSubscriptionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const { projectId } = req.params;

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

      // Import ArchivalService here to avoid circular dependencies
      const { ArchivalService } = await import('../services/archival-service');
      const archivalService = new ArchivalService();

      const projectStatus = await archivalService.checkProjectStatus(projectId);

      res.json({
        projectId,
        isActive: projectStatus.isActive,
        isArchived: projectStatus.isArchived,
        subscriptionExpiresAt: projectStatus.subscriptionExpiresAt,
        daysUntilExpiry: projectStatus.daysUntilExpiry,
      })
    } catch (error) {
      console.error('Get project subscription status error:', error)
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get project subscription status',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      })
    }
  }

  /**
   * Validation rules for payment success endpoint
   */
  static validatePaymentSuccess = [
    body('sessionId')
      .isString()
      .notEmpty()
      .withMessage('Session ID is required'),
  ]
}