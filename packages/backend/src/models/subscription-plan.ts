/**
 * Subscription Plan Model
 * Manages subscription plans and pricing tiers
 */

import { BaseModel } from './base'
import type { SubscriptionPlan } from '@saga/shared/types'

export interface SubscriptionPlanData {
  id: string
  name: string
  description: string
  price: number
  interval: 'month' | 'year'
  currency: string
  features: {
    projectVouchers: number
    facilitatorSeats: number
    storytellerSeats: number
    storageGB: number
    aiFeatures: boolean
    prioritySupport: boolean
    advancedAnalytics: boolean
    customBranding: boolean
    apiAccess: boolean
  }
  limits: {
    maxProjects: number
    maxStoriesPerProject: number
    maxFamilyMembers: number
  }
  isActive: boolean
  isPopular?: boolean
  sortOrder: number
  stripeProductId?: string
  stripePriceId?: string
  createdAt: Date
  updatedAt: Date
}

export class SubscriptionPlanModel extends BaseModel {
  static tableName = 'subscription_plans'

  /**
   * Create a new subscription plan
   */
  static async create(data: Omit<SubscriptionPlanData, 'createdAt' | 'updatedAt'>): Promise<SubscriptionPlan> {
    const now = new Date()
    const planData = {
      ...data,
      createdAt: now,
      updatedAt: now
    }

    const [result] = await this.db(this.tableName)
      .insert(planData)
      .returning('*')

    return this.formatPlan(result)
  }

  /**
   * Find plan by ID
   */
  static async findById(id: string): Promise<SubscriptionPlan | null> {
    const result = await this.db(this.tableName)
      .where({ id })
      .first()

    return result ? this.formatPlan(result) : null
  }

  /**
   * Get all active plans
   */
  static async getActivePlans(): Promise<SubscriptionPlan[]> {
    const results = await this.db(this.tableName)
      .where({ isActive: true })
      .orderBy('sortOrder', 'asc')

    return results.map(this.formatPlan)
  }

  /**
   * Get plans by interval
   */
  static async getPlansByInterval(interval: 'month' | 'year'): Promise<SubscriptionPlan[]> {
    const results = await this.db(this.tableName)
      .where({ 
        isActive: true,
        interval 
      })
      .orderBy('sortOrder', 'asc')

    return results.map(this.formatPlan)
  }

  /**
   * Get all plans (including inactive)
   */
  static async getAllPlans(): Promise<SubscriptionPlan[]> {
    const results = await this.db(this.tableName)
      .orderBy('sortOrder', 'asc')

    return results.map(this.formatPlan)
  }

  /**
   * Update plan
   */
  static async update(id: string, data: Partial<SubscriptionPlanData>): Promise<SubscriptionPlan | null> {
    const updateData = {
      ...data,
      updatedAt: new Date()
    }

    const [result] = await this.db(this.tableName)
      .where({ id })
      .update(updateData)
      .returning('*')

    return result ? this.formatPlan(result) : null
  }

  /**
   * Delete plan (soft delete by setting isActive to false)
   */
  static async delete(id: string): Promise<boolean> {
    const result = await this.db(this.tableName)
      .where({ id })
      .update({ 
        isActive: false,
        updatedAt: new Date()
      })

    return result > 0
  }

  /**
   * Find plan by Stripe product ID
   */
  static async findByStripeProductId(stripeProductId: string): Promise<SubscriptionPlan | null> {
    const result = await this.db(this.tableName)
      .where({ stripeProductId })
      .first()

    return result ? this.formatPlan(result) : null
  }

  /**
   * Find plan by Stripe price ID
   */
  static async findByStripePriceId(stripePriceId: string): Promise<SubscriptionPlan | null> {
    const result = await this.db(this.tableName)
      .where({ stripePriceId })
      .first()

    return result ? this.formatPlan(result) : null
  }

  /**
   * Get plans by price range
   */
  static async getPlansByPriceRange(minPrice: number, maxPrice: number): Promise<SubscriptionPlan[]> {
    const results = await this.db(this.tableName)
      .where({ isActive: true })
      .whereBetween('price', [minPrice, maxPrice])
      .orderBy('price', 'asc')

    return results.map(this.formatPlan)
  }

  /**
   * Get popular plans
   */
  static async getPopularPlans(): Promise<SubscriptionPlan[]> {
    const results = await this.db(this.tableName)
      .where({ 
        isActive: true,
        isPopular: true 
      })
      .orderBy('sortOrder', 'asc')

    return results.map(this.formatPlan)
  }

  /**
   * Format database result to SubscriptionPlan type
   */
  private static formatPlan(data: any): SubscriptionPlan {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      price: parseFloat(data.price),
      interval: data.interval,
      currency: data.currency,
      features: typeof data.features === 'string' ? JSON.parse(data.features) : data.features,
      limits: typeof data.limits === 'string' ? JSON.parse(data.limits) : data.limits,
      isActive: data.isActive || data.is_active,
      isPopular: data.isPopular || data.is_popular,
      sortOrder: data.sortOrder || data.sort_order,
      stripeProductId: data.stripeProductId || data.stripe_product_id,
      stripePriceId: data.stripePriceId || data.stripe_price_id,
      createdAt: new Date(data.createdAt || data.created_at),
      updatedAt: new Date(data.updatedAt || data.updated_at)
    }
  }
}