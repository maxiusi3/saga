import Stripe from 'stripe'
import { stripe, STRIPE_CONFIG } from '../config/stripe'
import { SubscriptionModel } from '../models/subscription'
import { UserModel } from '../models/user'
import type { Subscription, User } from '@saga/shared/types'

export class SubscriptionService {
  /**
   * Create a Stripe checkout session for "The Saga Package"
   */
  static async createCheckoutSession(facilitatorId: string): Promise<Stripe.Checkout.Session> {
    const facilitator = await UserModel.findById(facilitatorId)
    if (!facilitator) {
      throw new Error('Facilitator not found')
    }

    // Check if facilitator already has an active subscription
    const existingSubscription = await SubscriptionModel.findActiveByFacilitatorId(facilitatorId)
    if (existingSubscription) {
      throw new Error('Facilitator already has an active subscription')
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: STRIPE_CONFIG.currency,
            product_data: {
              name: 'The Saga Package',
              description: 'One year of family storytelling with AI-guided prompts and unlimited storage',
            },
            unit_amount: STRIPE_CONFIG.sagaPackagePrice,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${STRIPE_CONFIG.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: STRIPE_CONFIG.cancelUrl,
      customer_email: facilitator.email,
      metadata: {
        facilitatorId,
        packageType: 'saga_package',
      },
    })

    return session
  }

  /**
   * Handle successful payment completion
   */
  static async handlePaymentSuccess(sessionId: string): Promise<Subscription> {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    
    if (session.payment_status !== 'paid') {
      throw new Error('Payment not completed')
    }

    const facilitatorId = session.metadata?.facilitatorId
    if (!facilitatorId) {
      throw new Error('Facilitator ID not found in session metadata')
    }

    // Check if subscription already exists for this session
    const existingSubscription = await SubscriptionModel.findByFacilitatorId(facilitatorId)
    if (existingSubscription) {
      return existingSubscription
    }

    // Create subscription with 1 year validity
    const currentPeriodEnd = new Date()
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1)

    const subscription = await SubscriptionModel.create({
      facilitatorId,
      stripeSubscriptionId: session.id, // Using session ID as reference
      currentPeriodEnd,
    })

    return subscription
  }

  /**
   * Get subscription status for a facilitator
   */
  static async getSubscriptionStatus(facilitatorId: string): Promise<{
    hasActiveSubscription: boolean
    subscription: Subscription | null
    daysRemaining: number | null
  }> {
    const subscription = await SubscriptionModel.findActiveByFacilitatorId(facilitatorId)
    
    if (!subscription) {
      return {
        hasActiveSubscription: false,
        subscription: null,
        daysRemaining: null,
      }
    }

    const now = new Date()
    const endDate = new Date(subscription.currentPeriodEnd)
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return {
      hasActiveSubscription: daysRemaining > 0,
      subscription,
      daysRemaining: Math.max(0, daysRemaining),
    }
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(facilitatorId: string): Promise<void> {
    const subscription = await SubscriptionModel.findByFacilitatorId(facilitatorId)
    if (!subscription) {
      throw new Error('Subscription not found')
    }

    await SubscriptionModel.update(subscription.id, {
      status: 'canceled',
    })
  }

  /**
   * Renew a subscription (for future subscription model)
   */
  static async renewSubscription(facilitatorId: string): Promise<Subscription> {
    const subscription = await SubscriptionModel.findByFacilitatorId(facilitatorId)
    if (!subscription) {
      throw new Error('Subscription not found')
    }

    const newEndDate = new Date()
    newEndDate.setFullYear(newEndDate.getFullYear() + 1)

    const updatedSubscription = await SubscriptionModel.update(subscription.id, {
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: newEndDate,
    })

    if (!updatedSubscription) {
      throw new Error('Failed to renew subscription')
    }

    return updatedSubscription
  }

  /**
   * Handle Stripe webhook events
   */
  static async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break
      
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  }

  private static async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    if (session.metadata?.facilitatorId) {
      // Check if this is a renewal payment
      if (session.metadata.type === 'renewal' && session.metadata.projectId) {
        await this.handleRenewalPaymentSuccess(session.metadata.projectId, session.metadata.userId);
      } else {
        // Regular subscription payment
        await this.handlePaymentSuccess(session.id);
      }
    }
  }

  /**
   * Handle successful renewal payment
   */
  private static async handleRenewalPaymentSuccess(projectId: string, userId: string): Promise<void> {
    try {
      // Import ArchivalService here to avoid circular dependencies
      const { ArchivalService } = await import('./archival-service');
      const archivalService = new ArchivalService();

      // Renew the project subscription
      await archivalService.renewSubscription(projectId);

      console.log(`Subscription renewed successfully for project ${projectId} by user ${userId}`);
    } catch (error) {
      console.error('Error handling renewal payment success:', error);
      throw error;
    }
  }

  private static async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (invoice.subscription && typeof invoice.subscription === 'string') {
      const subscription = await SubscriptionModel.findByStripeSubscriptionId(invoice.subscription)
      if (subscription) {
        await SubscriptionModel.update(subscription.id, {
          status: 'active',
        })
      }
    }
  }

  private static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (invoice.subscription && typeof invoice.subscription === 'string') {
      const subscription = await SubscriptionModel.findByStripeSubscriptionId(invoice.subscription)
      if (subscription) {
        await SubscriptionModel.update(subscription.id, {
          status: 'past_due',
        })
      }
    }
  }

  private static async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = await SubscriptionModel.findByStripeSubscriptionId(stripeSubscription.id)
    if (subscription) {
      await SubscriptionModel.update(subscription.id, {
        status: stripeSubscription.status as any,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      })
    }
  }

  private static async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = await SubscriptionModel.findByStripeSubscriptionId(stripeSubscription.id)
    if (subscription) {
      await SubscriptionModel.update(subscription.id, {
        status: 'canceled',
      })
    }
  }
}