/**
 * Package Model
 * Manages resource packages and pricing
 */

import { BaseModel } from './base'
import type { ResourcePackage } from '@saga/shared/types'

export interface PackageData {
  id: string
  name: string
  description: string
  price: number
  currency: string
  resources: {
    projectVouchers: number
    facilitatorSeats: number
    storytellerSeats: number
  }
  features: string[]
  isActive: boolean
  sortOrder: number
  stripeProductId?: string
  stripePriceId?: string
  createdAt: Date
  updatedAt: Date
}

export class PackageModel extends BaseModel {
  static tableName = 'packages'

  /**
   * Create a new package
   */
  static async create(data: Omit<PackageData, 'createdAt' | 'updatedAt'>): Promise<ResourcePackage> {
    const now = new Date()
    const packageData = {
      ...data,
      createdAt: now,
      updatedAt: now
    }

    const [result] = await this.db(this.tableName)
      .insert(packageData)
      .returning('*')

    return this.formatPackage(result)
  }

  /**
   * Find package by ID
   */
  static async findById(id: string): Promise<ResourcePackage | null> {
    const result = await this.db(this.tableName)
      .where({ id })
      .first()

    return result ? this.formatPackage(result) : null
  }

  /**
   * Get all active packages
   */
  static async getActivePackages(): Promise<ResourcePackage[]> {
    const results = await this.db(this.tableName)
      .where({ isActive: true })
      .orderBy('sortOrder', 'asc')

    return results.map(this.formatPackage)
  }

  /**
   * Get all packages (including inactive)
   */
  static async getAllPackages(): Promise<ResourcePackage[]> {
    const results = await this.db(this.tableName)
      .orderBy('sortOrder', 'asc')

    return results.map(this.formatPackage)
  }

  /**
   * Update package
   */
  static async update(id: string, data: Partial<PackageData>): Promise<ResourcePackage | null> {
    const updateData = {
      ...data,
      updatedAt: new Date()
    }

    const [result] = await this.db(this.tableName)
      .where({ id })
      .update(updateData)
      .returning('*')

    return result ? this.formatPackage(result) : null
  }

  /**
   * Delete package (soft delete by setting isActive to false)
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
   * Find package by Stripe product ID
   */
  static async findByStripeProductId(stripeProductId: string): Promise<ResourcePackage | null> {
    const result = await this.db(this.tableName)
      .where({ stripeProductId })
      .first()

    return result ? this.formatPackage(result) : null
  }

  /**
   * Get packages by price range
   */
  static async getPackagesByPriceRange(minPrice: number, maxPrice: number): Promise<ResourcePackage[]> {
    const results = await this.db(this.tableName)
      .where({ isActive: true })
      .whereBetween('price', [minPrice, maxPrice])
      .orderBy('price', 'asc')

    return results.map(this.formatPackage)
  }

  /**
   * Get package statistics
   */
  static async getPackageStats(): Promise<{
    totalPackages: number
    activePackages: number
    priceRange: { min: number; max: number }
    averagePrice: number
  }> {
    const stats = await this.db(this.tableName)
      .select(
        this.db.raw('COUNT(*) as total_packages'),
        this.db.raw('COUNT(CASE WHEN is_active = true THEN 1 END) as active_packages'),
        this.db.raw('MIN(price) as min_price'),
        this.db.raw('MAX(price) as max_price'),
        this.db.raw('AVG(price) as average_price')
      )
      .first()

    return {
      totalPackages: parseInt(stats.total_packages),
      activePackages: parseInt(stats.active_packages),
      priceRange: {
        min: parseFloat(stats.min_price) || 0,
        max: parseFloat(stats.max_price) || 0
      },
      averagePrice: parseFloat(stats.average_price) || 0
    }
  }

  /**
   * Format database result to ResourcePackage type
   */
  private static formatPackage(data: any): ResourcePackage {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      price: parseFloat(data.price),
      currency: data.currency,
      resources: {
        projectVouchers: data.resources.projectVouchers || data.project_vouchers,
        facilitatorSeats: data.resources.facilitatorSeats || data.facilitator_seats,
        storytellerSeats: data.resources.storytellerSeats || data.storyteller_seats
      },
      features: Array.isArray(data.features) ? data.features : JSON.parse(data.features || '[]'),
      isActive: data.isActive || data.is_active,
      createdAt: new Date(data.createdAt || data.created_at),
      updatedAt: new Date(data.updatedAt || data.updated_at)
    }
  }
}