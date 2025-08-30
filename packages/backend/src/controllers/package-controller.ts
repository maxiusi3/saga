/**
 * Package Controller
 * Handles package-related API endpoints for purchasing and management
 */

import { Request, Response } from 'express'
import { PackageService } from '../services/package-service'
import { PaymentService } from '../services/payment-service'
import { ResourceWalletService } from '../services/resource-wallet-service'
import type { PackagePurchaseRequest } from '@saga/shared/types'

export class PackageController {
  
  /**
   * Get all active packages
   */
  static async getActivePackages(req: Request, res: Response) {
    try {
      const packages = await PackageService.getActivePackages()
      
      res.json({
        success: true,
        data: packages
      })
    } catch (error) {
      console.error('Error getting active packages:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get packages'
      })
    }
  }

  /**
   * Get package by ID
   */
  static async getPackageById(req: Request, res: Response) {
    try {
      const { packageId } = req.params
      
      const packageDetails = await PackageService.getPackageById(packageId)
      
      if (!packageDetails) {
        return res.status(404).json({
          success: false,
          error: 'Package not found'
        })
      }

      res.json({
        success: true,
        data: packageDetails
      })
    } catch (error) {
      console.error('Error getting package:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get package'
      })
    }
  }

  /**
   * Get package recommendations
   */
  static async getPackageRecommendations(req: Request, res: Response) {
    try {
      const { familySize, projectCount, budget } = req.query
      
      const criteria = {
        familySize: familySize ? parseInt(familySize as string) : undefined,
        projectCount: projectCount ? parseInt(projectCount as string) : undefined,
        budget: budget ? parseFloat(budget as string) : undefined
      }

      const recommendations = await PackageService.getPackageRecommendations(criteria)
      
      res.json({
        success: true,
        data: recommendations
      })
    } catch (error) {
      console.error('Error getting package recommendations:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get package recommendations'
      })
    }
  }

  /**
   * Get package comparison data
   */
  static async getPackageComparison(req: Request, res: Response) {
    try {
      const comparison = await PackageService.getPackageComparison()
      
      res.json({
        success: true,
        data: comparison
      })
    } catch (error) {
      console.error('Error getting package comparison:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get package comparison'
      })
    }
  }

  /**
   * Create payment intent for package purchase
   */
  static async createPaymentIntent(req: Request, res: Response) {
    try {
      const { packageId } = req.params
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      // Get package details
      const packageDetails = await PackageService.getPackageById(packageId)
      
      if (!packageDetails) {
        return res.status(404).json({
          success: false,
          error: 'Package not found'
        })
      }

      if (!packageDetails.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Package is not available for purchase'
        })
      }

      // Create payment intent
      const paymentIntent = await PaymentService.createPaymentIntent({
        userId,
        packageId,
        amount: packageDetails.price,
        currency: packageDetails.currency,
        metadata: {
          packageName: packageDetails.name,
          resources: JSON.stringify(packageDetails.resources)
        }
      })

      res.json({
        success: true,
        data: {
          clientSecret: paymentIntent.clientSecret,
          paymentIntentId: paymentIntent.id,
          package: packageDetails
        }
      })
    } catch (error) {
      console.error('Error creating payment intent:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to create payment intent'
      })
    }
  }

  /**
   * Confirm payment and complete package purchase
   */
  static async confirmPaymentAndPurchase(req: Request, res: Response) {
    try {
      const { packageId } = req.params
      const { paymentIntentId, paymentMethodId } = req.body
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          error: 'Payment intent ID is required'
        })
      }

      // Confirm payment and process purchase
      const result = await PaymentService.confirmPaymentAndPurchase({
        userId,
        packageId,
        paymentIntentId,
        paymentMethodId
      })

      if (result.success) {
        res.json({
          success: true,
          data: {
            transactionId: result.transactionId,
            walletBalance: result.walletBalance,
            package: result.packageDetails
          },
          message: 'Package purchased successfully'
        })
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        })
      }
    } catch (error) {
      console.error('Error confirming payment and purchase:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to complete purchase'
      })
    }
  }

  /**
   * Get package purchase history for user
   */
  static async getPurchaseHistory(req: Request, res: Response) {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const { limit = 10, offset = 0 } = req.query

      // Get purchase transactions from wallet history
      const history = await ResourceWalletService.getTransactionHistory(userId, {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        transactionType: 'purchase'
      })

      res.json({
        success: true,
        data: history
      })
    } catch (error) {
      console.error('Error getting purchase history:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get purchase history'
      })
    }
  }

  /**
   * Get package statistics (admin only)
   */
  static async getPackageStats(req: Request, res: Response) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        })
      }

      const stats = await PackageService.getPackageStats()
      
      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('Error getting package stats:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get package statistics'
      })
    }
  }

  /**
   * Create new package (admin only)
   */
  static async createPackage(req: Request, res: Response) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        })
      }

      const packageData = req.body

      // Validate required fields
      if (!packageData.id || !packageData.name || !packageData.price || !packageData.resources) {
        return res.status(400).json({
          success: false,
          error: 'Missing required package fields'
        })
      }

      const newPackage = await PackageService.createPackage(packageData)
      
      res.status(201).json({
        success: true,
        data: newPackage,
        message: 'Package created successfully'
      })
    } catch (error) {
      console.error('Error creating package:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to create package'
      })
    }
  }

  /**
   * Update package pricing (admin only)
   */
  static async updatePackagePrice(req: Request, res: Response) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        })
      }

      const { packageId } = req.params
      const { price } = req.body

      if (!price || price <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid price is required'
        })
      }

      const updatedPackage = await PackageService.updatePackagePrice(packageId, price)
      
      if (!updatedPackage) {
        return res.status(404).json({
          success: false,
          error: 'Package not found'
        })
      }

      res.json({
        success: true,
        data: updatedPackage,
        message: 'Package price updated successfully'
      })
    } catch (error) {
      console.error('Error updating package price:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to update package price'
      })
    }
  }

  /**
   * Deactivate package (admin only)
   */
  static async deactivatePackage(req: Request, res: Response) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        })
      }

      const { packageId } = req.params

      const success = await PackageService.deactivatePackage(packageId)
      
      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Package not found'
        })
      }

      res.json({
        success: true,
        message: 'Package deactivated successfully'
      })
    } catch (error) {
      console.error('Error deactivating package:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate package'
      })
    }
  }

  /**
   * Sync packages with Stripe (admin only)
   */
  static async syncWithStripe(req: Request, res: Response) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        })
      }

      const result = await PackageService.syncPackagesWithStripe()
      
      res.json({
        success: result.success,
        data: {
          synced: result.synced,
          errors: result.errors
        },
        message: `Synced ${result.synced} packages with Stripe`
      })
    } catch (error) {
      console.error('Error syncing with Stripe:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to sync with Stripe'
      })
    }
  }
}