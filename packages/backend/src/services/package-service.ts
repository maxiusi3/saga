/**
 * Package Service
 * Manages resource packages, pricing, and Stripe integration
 */

import { PackageModel } from '../models/package'
import { stripe } from '../config/stripe'
import type { ResourcePackage } from '@saga/shared/types'

export class PackageService {
  
  /**
   * Get all active packages
   */
  static async getActivePackages(): Promise<ResourcePackage[]> {
    return await PackageModel.getActivePackages()
  }

  /**
   * Get package by ID
   */
  static async getPackageById(id: string): Promise<ResourcePackage | null> {
    return await PackageModel.findById(id)
  }

  /**
   * Get packages in price range (for filtering)
   */
  static async getPackagesByPriceRange(minPrice: number, maxPrice: number): Promise<ResourcePackage[]> {
    return await PackageModel.getPackagesByPriceRange(minPrice, maxPrice)
  }

  /**
   * Get package statistics
   */
  static async getPackageStats() {
    return await PackageModel.getPackageStats()
  }

  /**
   * Create Stripe products for all packages
   */
  static async syncPackagesWithStripe(): Promise<{
    success: boolean
    synced: number
    errors: string[]
  }> {
    const packages = await PackageModel.getAllPackages()
    const errors: string[] = []
    let synced = 0

    for (const pkg of packages) {
      try {
        await this.createStripeProductForPackage(pkg)
        synced++
      } catch (error) {
        console.error(`Error syncing package ${pkg.id} with Stripe:`, error)
        errors.push(`${pkg.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return {
      success: errors.length === 0,
      synced,
      errors
    }
  }

  /**
   * Create Stripe product and price for a package
   */
  static async createStripeProductForPackage(pkg: ResourcePackage): Promise<{
    productId: string
    priceId: string
  }> {
    try {
      // Check if product already exists
      if (pkg.id) {
        const existingPackage = await PackageModel.findById(pkg.id)
        if (existingPackage && existingPackage.id) {
          // Product already exists, return existing IDs
          return {
            productId: existingPackage.id,
            priceId: existingPackage.id // This would be the actual Stripe price ID
          }
        }
      }

      // Create Stripe product
      const product = await stripe.products.create({
        id: pkg.id, // Use our package ID as Stripe product ID
        name: pkg.name,
        description: pkg.description,
        metadata: {
          packageId: pkg.id,
          projectVouchers: pkg.resources.projectVouchers.toString(),
          facilitatorSeats: pkg.resources.facilitatorSeats.toString(),
          storytellerSeats: pkg.resources.storytellerSeats.toString()
        }
      })

      // Create Stripe price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(pkg.price * 100), // Convert to cents
        currency: pkg.currency.toLowerCase(),
        metadata: {
          packageId: pkg.id
        }
      })

      // Update package with Stripe IDs
      await PackageModel.update(pkg.id, {
        stripeProductId: product.id,
        stripePriceId: price.id
      })

      return {
        productId: product.id,
        priceId: price.id
      }
    } catch (error) {
      console.error('Error creating Stripe product for package:', error)
      throw error
    }
  }

  /**
   * Update package pricing
   */
  static async updatePackagePrice(
    packageId: string, 
    newPrice: number
  ): Promise<ResourcePackage | null> {
    try {
      const pkg = await PackageModel.findById(packageId)
      if (!pkg) {
        throw new Error('Package not found')
      }

      // Create new Stripe price (prices are immutable in Stripe)
      if (pkg.id) { // This would be stripeProductId in real implementation
        const newStripePrice = await stripe.prices.create({
          product: pkg.id,
          unit_amount: Math.round(newPrice * 100),
          currency: pkg.currency.toLowerCase(),
          metadata: {
            packageId: pkg.id
          }
        })

        // Archive old price
        if (pkg.id) { // This would be stripePriceId in real implementation
          await stripe.prices.update(pkg.id, {
            active: false
          })
        }

        // Update package with new price and Stripe price ID
        return await PackageModel.update(packageId, {
          price: newPrice,
          stripePriceId: newStripePrice.id
        })
      }

      // If no Stripe integration, just update the price
      return await PackageModel.update(packageId, {
        price: newPrice
      })
    } catch (error) {
      console.error('Error updating package price:', error)
      throw error
    }
  }

  /**
   * Create a new package
   */
  static async createPackage(packageData: {
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
    isActive?: boolean
    sortOrder?: number
  }): Promise<ResourcePackage> {
    try {
      // Create package in database
      const pkg = await PackageModel.create({
        ...packageData,
        isActive: packageData.isActive ?? true,
        sortOrder: packageData.sortOrder ?? 0
      })

      // Create Stripe product if package is active
      if (pkg.isActive) {
        try {
          await this.createStripeProductForPackage(pkg)
        } catch (error) {
          console.error('Error creating Stripe product for new package:', error)
          // Don't fail package creation if Stripe fails
        }
      }

      return pkg
    } catch (error) {
      console.error('Error creating package:', error)
      throw error
    }
  }

  /**
   * Deactivate a package
   */
  static async deactivatePackage(packageId: string): Promise<boolean> {
    try {
      const pkg = await PackageModel.findById(packageId)
      if (!pkg) {
        return false
      }

      // Deactivate Stripe price if it exists
      if (pkg.id) { // This would be stripePriceId in real implementation
        try {
          await stripe.prices.update(pkg.id, {
            active: false
          })
        } catch (error) {
          console.error('Error deactivating Stripe price:', error)
          // Continue with database update even if Stripe fails
        }
      }

      // Update package status
      const updated = await PackageModel.update(packageId, {
        isActive: false
      })

      return updated !== null
    } catch (error) {
      console.error('Error deactivating package:', error)
      throw error
    }
  }

  /**
   * Get package recommendations based on user needs
   */
  static async getPackageRecommendations(criteria: {
    familySize?: number
    projectCount?: number
    budget?: number
  }): Promise<{
    recommended: ResourcePackage
    alternatives: ResourcePackage[]
    reasoning: string
  }> {
    const packages = await this.getActivePackages()
    
    if (packages.length === 0) {
      throw new Error('No active packages available')
    }

    // Sort packages by price
    const sortedPackages = packages.sort((a, b) => a.price - b.price)

    let recommended: ResourcePackage
    let reasoning: string

    if (criteria.budget) {
      // Find best package within budget
      const withinBudget = sortedPackages.filter(pkg => pkg.price <= criteria.budget!)
      if (withinBudget.length > 0) {
        recommended = withinBudget[withinBudget.length - 1] // Highest price within budget
        reasoning = `Recommended based on your budget of $${criteria.budget}. This package offers the best value within your price range.`
      } else {
        recommended = sortedPackages[0] // Cheapest option
        reasoning = `Your budget of $${criteria.budget} is below our lowest-priced package. This is our most affordable option.`
      }
    } else if (criteria.familySize) {
      // Recommend based on family size
      if (criteria.familySize <= 3) {
        recommended = sortedPackages[0] // Basic package
        reasoning = `For a family of ${criteria.familySize}, our basic package provides sufficient resources for your storytelling needs.`
      } else if (criteria.familySize <= 6) {
        recommended = sortedPackages[1] || sortedPackages[0] // Premium package
        reasoning = `For a family of ${criteria.familySize}, our premium package offers additional seats for better collaboration.`
      } else {
        recommended = sortedPackages[sortedPackages.length - 1] // Highest tier
        reasoning = `For a large family of ${criteria.familySize}, our top-tier package provides the most resources and flexibility.`
      }
    } else {
      // Default recommendation (middle option or most popular)
      const middleIndex = Math.floor(sortedPackages.length / 2)
      recommended = sortedPackages[middleIndex]
      reasoning = 'This is our most popular package, offering a great balance of features and value for most families.'
    }

    // Get alternatives (other packages)
    const alternatives = packages.filter(pkg => pkg.id !== recommended.id)

    return {
      recommended,
      alternatives,
      reasoning
    }
  }

  /**
   * Calculate package value score
   */
  static calculatePackageValue(pkg: ResourcePackage): number {
    // Simple value calculation based on resources per dollar
    const totalResources = pkg.resources.projectVouchers + 
                          pkg.resources.facilitatorSeats + 
                          pkg.resources.storytellerSeats
    
    return totalResources / pkg.price
  }

  /**
   * Get package comparison data
   */
  static async getPackageComparison(): Promise<{
    packages: ResourcePackage[]
    comparison: {
      features: string[]
      packageFeatures: Record<string, boolean[]>
    }
  }> {
    const packages = await this.getActivePackages()
    
    // Get all unique features
    const allFeatures = new Set<string>()
    packages.forEach(pkg => {
      pkg.features.forEach(feature => allFeatures.add(feature))
    })
    
    const features = Array.from(allFeatures).sort()
    
    // Create comparison matrix
    const packageFeatures: Record<string, boolean[]> = {}
    packages.forEach(pkg => {
      packageFeatures[pkg.id] = features.map(feature => 
        pkg.features.includes(feature)
      )
    })

    return {
      packages,
      comparison: {
        features,
        packageFeatures
      }
    }
  }
}