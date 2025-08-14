import { BaseModel } from './base'
import type { Subscription, CreateSubscriptionInput, UpdateSubscriptionInput } from '@saga/shared/types'

export class SubscriptionModel extends BaseModel {
  static tableName = 'subscriptions'

  private static transformSubscription(subscription: any): Subscription {
    return {
      id: subscription.id,
      facilitatorId: subscription.facilitator_id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      planId: subscription.plan_id,
      createdAt: subscription.created_at,
      updatedAt: subscription.updated_at,
    }
  }

  static async create(data: CreateSubscriptionInput): Promise<Subscription> {
    const [subscription] = await this.db(this.tableName)
      .insert({
        facilitator_id: data.facilitatorId,
        stripe_subscription_id: data.stripeSubscriptionId,
        status: 'active',
        current_period_start: new Date(),
        current_period_end: data.currentPeriodEnd,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*')

    return this.transformSubscription(subscription)
  }

  static async findByFacilitatorId(facilitatorId: string): Promise<Subscription | null> {
    const subscription = await this.db(this.tableName)
      .where('facilitator_id', facilitatorId)
      .first()

    return subscription ? this.transformSubscription(subscription) : null
  }

  static async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const subscription = await this.db(this.tableName)
      .where('stripe_subscription_id', stripeSubscriptionId)
      .first()

    return subscription ? this.transformSubscription(subscription) : null
  }

  static async createProjectSubscription(data: {
    projectId: string
    facilitatorId: string
    status: string
    currentPeriodStart: Date
    currentPeriodEnd: Date
    planId: string
    metadata?: any
  }, trx?: any): Promise<Subscription> {
    const query = trx ? this.db(this.tableName).transacting(trx) : this.db(this.tableName)
    
    const [subscription] = await query
      .insert({
        project_id: data.projectId,
        facilitator_id: data.facilitatorId,
        status: data.status,
        current_period_start: data.currentPeriodStart,
        current_period_end: data.currentPeriodEnd,
        plan_id: data.planId,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*')

    return this.transformSubscription(subscription)
  }

  static async findByProjectId(projectId: string): Promise<Subscription | null> {
    const subscription = await this.db(this.tableName)
      .where('project_id', projectId)
      .first()

    return subscription ? this.transformSubscription(subscription) : null
  }

  static async isProjectSubscriptionActive(projectId: string): Promise<boolean> {
    const subscription = await this.findByProjectId(projectId)
    if (!subscription) return false

    const now = new Date()
    return subscription.status === 'active' && 
           subscription.currentPeriodEnd && 
           new Date(subscription.currentPeriodEnd) > now
  }

  static async getProjectSubscriptionStatus(projectId: string): Promise<{
    isActive: boolean
    subscription: Subscription | null
    daysRemaining: number | null
    isExpired: boolean
  }> {
    const subscription = await this.findByProjectId(projectId)
    
    if (!subscription) {
      return {
        isActive: false,
        subscription: null,
        daysRemaining: null,
        isExpired: true
      }
    }

    const now = new Date()
    const endDate = new Date(subscription.currentPeriodEnd)
    const isActive = subscription.status === 'active' && endDate > now
    const isExpired = endDate <= now
    const daysRemaining = isExpired ? 0 : Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return {
      isActive,
      subscription,
      daysRemaining,
      isExpired
    }
  }

  static async update(id: string, data: UpdateSubscriptionInput): Promise<Subscription | null> {
    const updateData: any = {
      updated_at: new Date(),
    }

    if (data.status) updateData.status = data.status
    if (data.currentPeriodStart) updateData.current_period_start = data.currentPeriodStart
    if (data.currentPeriodEnd) updateData.current_period_end = data.currentPeriodEnd

    const [subscription] = await this.db(this.tableName)
      .where('id', id)
      .update(updateData)
      .returning('*')

    return subscription ? this.transformSubscription(subscription) : null
  }

  static async findActiveByFacilitatorId(facilitatorId: string): Promise<Subscription | null> {
    const subscription = await this.db(this.tableName)
      .where('facilitator_id', facilitatorId)
      .where('status', 'active')
      .where('current_period_end', '>', new Date())
      .first()

    return subscription ? this.transformSubscription(subscription) : null
  }

  static async findExpiredSubscriptions(): Promise<Subscription[]> {
    const subscriptions = await this.db(this.tableName)
      .where('status', 'active')
      .where('current_period_end', '<', new Date())

    return subscriptions.map(this.transformSubscription)
  }

  static async delete(id: string): Promise<boolean> {
    const deletedCount = await this.db(this.tableName)
      .where('id', id)
      .del()

    return deletedCount > 0
  }
}