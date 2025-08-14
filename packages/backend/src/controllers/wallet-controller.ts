/**
 * Wallet Controller
 * Handles wallet-related API endpoints for resource management
 */

import { Request, Response } from 'express'
import { ResourceWalletService } from '../services/resource-wallet-service'
import { WalletSyncService } from '../services/wallet-sync-service'
import type { 
  ResourceType,
  TransactionType,
  ResourceConsumptionRequest
} from '@saga/shared/types'

export class WalletController {
  
  /**
   * Get user's wallet balance
   */
  static async getWalletBalance(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const requestingUserId = req.user?.id

      // Check if user can access this wallet
      if (userId !== requestingUserId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const balance = await ResourceWalletService.getWalletBalance(userId)
      
      res.json({
        success: true,
        data: balance
      })
    } catch (error) {
      console.error('Error getting wallet balance:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get wallet balance'
      })
    }
  }

  /**
   * Get user's wallet details
   */
  static async getWallet(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const requestingUserId = req.user?.id

      // Check if user can access this wallet
      if (userId !== requestingUserId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const wallet = await ResourceWalletService.getWallet(userId)
      
      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found'
        })
      }

      res.json({
        success: true,
        data: wallet
      })
    } catch (error) {
      console.error('Error getting wallet:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get wallet'
      })
    }
  }

  /**
   * Get wallet statistics
   */
  static async getWalletStats(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const requestingUserId = req.user?.id

      // Check if user can access this wallet
      if (userId !== requestingUserId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const stats = await ResourceWalletService.getWalletStats(userId)
      
      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('Error getting wallet stats:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get wallet statistics'
      })
    }
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const requestingUserId = req.user?.id

      // Check if user can access this wallet
      if (userId !== requestingUserId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const {
        limit = 20,
        offset = 0,
        resourceType,
        transactionType,
        startDate,
        endDate
      } = req.query

      const options = {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        resourceType: resourceType as ResourceType,
        transactionType: transactionType as TransactionType,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      }

      const history = await ResourceWalletService.getTransactionHistory(userId, options)
      
      res.json({
        success: true,
        data: history
      })
    } catch (error) {
      console.error('Error getting transaction history:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction history'
      })
    }
  }

  /**
   * Check if user has sufficient resources
   */
  static async checkSufficientResources(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const { resourceType, amount } = req.query
      const requestingUserId = req.user?.id

      // Check if user can access this wallet
      if (userId !== requestingUserId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      if (!resourceType || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Resource type and amount are required'
        })
      }

      const hasSufficient = await ResourceWalletService.hasSufficientResources(
        userId,
        resourceType as ResourceType,
        parseInt(amount as string)
      )
      
      res.json({
        success: true,
        data: { hasSufficient }
      })
    } catch (error) {
      console.error('Error checking sufficient resources:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to check resources'
      })
    }
  }

  /**
   * Consume resources (admin only or specific operations)
   */
  static async consumeResources(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const { resourceType, amount, projectId, description } = req.body
      const requestingUserId = req.user?.id

      // Only allow self-consumption or admin access
      if (userId !== requestingUserId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      if (!resourceType || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Resource type and amount are required'
        })
      }

      const request: ResourceConsumptionRequest = {
        userId,
        resourceType,
        amount,
        projectId,
        description
      }

      const result = await ResourceWalletService.consumeResources(request)
      
      if (result.success) {
        res.json({
          success: true,
          data: {
            remainingBalance: result.remainingBalance,
            transactionId: result.transactionId
          }
        })
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        })
      }
    } catch (error) {
      console.error('Error consuming resources:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to consume resources'
      })
    }
  }

  /**
   * Add resources (admin only)
   */
  static async addResources(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const { resourceType, amount, transactionType = 'grant', description, projectId } = req.body

      // Only admins can add resources
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        })
      }

      if (!resourceType || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Resource type and amount are required'
        })
      }

      const result = await ResourceWalletService.addResources(
        userId,
        resourceType,
        amount,
        transactionType,
        description,
        projectId
      )
      
      if (result.success) {
        res.json({
          success: true,
          data: {
            remainingBalance: result.remainingBalance,
            transactionId: result.transactionId
          }
        })
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        })
      }
    } catch (error) {
      console.error('Error adding resources:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to add resources'
      })
    }
  }

  /**
   * Process refund (admin only)
   */
  static async processRefund(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const { resourceType, amount, description, projectId } = req.body

      // Only admins can process refunds
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        })
      }

      if (!resourceType || !amount || !description) {
        return res.status(400).json({
          success: false,
          error: 'Resource type, amount, and description are required'
        })
      }

      const result = await ResourceWalletService.refundResources(
        userId,
        resourceType,
        amount,
        description,
        projectId
      )
      
      if (result.success) {
        res.json({
          success: true,
          data: {
            remainingBalance: result.remainingBalance,
            transactionId: result.transactionId
          }
        })
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        })
      }
    } catch (error) {
      console.error('Error processing refund:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to process refund'
      })
    }
  }

  /**
   * Force wallet refresh (triggers sync)
   */
  static async forceRefresh(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const requestingUserId = req.user?.id

      // Check if user can access this wallet
      if (userId !== requestingUserId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      // Force refresh via sync service
      await WalletSyncService.forceWalletRefresh(userId)
      
      // Also return current balance
      const balance = await ResourceWalletService.getWalletBalance(userId)
      
      res.json({
        success: true,
        data: balance,
        message: 'Wallet refreshed successfully'
      })
    } catch (error) {
      console.error('Error forcing wallet refresh:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to refresh wallet'
      })
    }
  }

  /**
   * Get wallet sync status
   */
  static async getSyncStatus(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const requestingUserId = req.user?.id

      // Check if user can access this wallet
      if (userId !== requestingUserId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const sessionCount = WalletSyncService.getUserSessionCount(userId)
      
      res.json({
        success: true,
        data: {
          userId,
          activeSessions: sessionCount,
          isOnline: sessionCount > 0,
          lastSync: new Date()
        }
      })
    } catch (error) {
      console.error('Error getting sync status:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get sync status'
      })
    }
  }

  /**
   * Utility endpoints for common operations
   */

  /**
   * Check if user can create project
   */
  static async canCreateProject(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const requestingUserId = req.user?.id

      if (userId !== requestingUserId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const canCreate = await ResourceWalletService.canCreateProject(userId)
      
      res.json({
        success: true,
        data: { canCreate }
      })
    } catch (error) {
      console.error('Error checking project creation:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to check project creation ability'
      })
    }
  }

  /**
   * Check if user can invite facilitator
   */
  static async canInviteFacilitator(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const requestingUserId = req.user?.id

      if (userId !== requestingUserId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const canInvite = await ResourceWalletService.canInviteFacilitator(userId)
      
      res.json({
        success: true,
        data: { canInvite }
      })
    } catch (error) {
      console.error('Error checking facilitator invitation:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to check facilitator invitation ability'
      })
    }
  }

  /**
   * Check if user can invite storyteller
   */
  static async canInviteStoryteller(req: Request, res: Response) {
    try {
      const { userId } = req.params
      const requestingUserId = req.user?.id

      if (userId !== requestingUserId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const canInvite = await ResourceWalletService.canInviteStoryteller(userId)
      
      res.json({
        success: true,
        data: { canInvite }
      })
    } catch (error) {
      console.error('Error checking storyteller invitation:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to check storyteller invitation ability'
      })
    }
  }
}