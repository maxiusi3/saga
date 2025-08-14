/**
 * Wallet Synchronization Service
 * Handles real-time wallet balance synchronization across user sessions
 */

import { Server as SocketIOServer } from 'socket.io'
import { ResourceWalletService } from './resource-wallet-service'
import type { 
  UserResourceWallet,
  ResourceWalletBalance,
  SeatTransaction
} from '@saga/shared/types'

export class WalletSyncService {
  private static io: SocketIOServer | null = null
  private static userSessions: Map<string, Set<string>> = new Map() // userId -> Set of socketIds

  /**
   * Initialize the wallet sync service with Socket.IO server
   */
  static initialize(io: SocketIOServer) {
    this.io = io
    this.setupSocketHandlers()
  }

  /**
   * Setup Socket.IO event handlers
   */
  private static setupSocketHandlers() {
    if (!this.io) return

    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`)

      // Handle user authentication and session tracking
      socket.on('authenticate', async (data: { userId: string, token: string }) => {
        try {
          // Verify the token (this should use your auth middleware logic)
          const isValid = await this.verifyToken(data.token, data.userId)
          
          if (isValid) {
            // Join user to their personal room
            socket.join(`user:${data.userId}`)
            
            // Track user session
            if (!this.userSessions.has(data.userId)) {
              this.userSessions.set(data.userId, new Set())
            }
            this.userSessions.get(data.userId)!.add(socket.id)
            
            // Send current wallet balance
            const walletBalance = await ResourceWalletService.getWalletBalance(data.userId)
            socket.emit('wallet:balance', walletBalance)
            
            socket.emit('authenticated', { success: true })
            console.log(`User ${data.userId} authenticated on socket ${socket.id}`)
          } else {
            socket.emit('authenticated', { success: false, error: 'Invalid token' })
          }
        } catch (error) {
          console.error('Authentication error:', error)
          socket.emit('authenticated', { success: false, error: 'Authentication failed' })
        }
      })

      // Handle wallet balance requests
      socket.on('wallet:get-balance', async (data: { userId: string }) => {
        try {
          const walletBalance = await ResourceWalletService.getWalletBalance(data.userId)
          socket.emit('wallet:balance', walletBalance)
        } catch (error) {
          console.error('Error getting wallet balance:', error)
          socket.emit('wallet:error', { error: 'Failed to get wallet balance' })
        }
      })

      // Handle transaction history requests
      socket.on('wallet:get-history', async (data: { 
        userId: string, 
        limit?: number, 
        offset?: number 
      }) => {
        try {
          const history = await ResourceWalletService.getTransactionHistory(
            data.userId,
            { limit: data.limit || 10, offset: data.offset || 0 }
          )
          socket.emit('wallet:history', history)
        } catch (error) {
          console.error('Error getting transaction history:', error)
          socket.emit('wallet:error', { error: 'Failed to get transaction history' })
        }
      })

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`)
        
        // Remove from user sessions
        for (const [userId, socketIds] of this.userSessions.entries()) {
          if (socketIds.has(socket.id)) {
            socketIds.delete(socket.id)
            if (socketIds.size === 0) {
              this.userSessions.delete(userId)
            }
            break
          }
        }
      })
    })
  }

  /**
   * Broadcast wallet balance update to all user sessions
   */
  static async broadcastWalletUpdate(userId: string, transaction?: SeatTransaction) {
    if (!this.io) return

    try {
      // Get updated wallet balance
      const walletBalance = await ResourceWalletService.getWalletBalance(userId)
      
      // Broadcast to all user sessions
      this.io.to(`user:${userId}`).emit('wallet:balance-updated', {
        balance: walletBalance,
        transaction: transaction ? {
          id: transaction.id,
          type: transaction.transactionType,
          resourceType: transaction.resourceType,
          amount: transaction.amount,
          description: transaction.description,
          createdAt: transaction.createdAt
        } : undefined
      })

      console.log(`Broadcasted wallet update to user ${userId}`)
    } catch (error) {
      console.error('Error broadcasting wallet update:', error)
    }
  }

  /**
   * Broadcast transaction to user sessions
   */
  static async broadcastTransaction(userId: string, transaction: SeatTransaction) {
    if (!this.io) return

    try {
      this.io.to(`user:${userId}`).emit('wallet:transaction', {
        id: transaction.id,
        type: transaction.transactionType,
        resourceType: transaction.resourceType,
        amount: transaction.amount,
        description: transaction.description,
        projectId: transaction.projectId,
        createdAt: transaction.createdAt
      })

      console.log(`Broadcasted transaction to user ${userId}: ${transaction.id}`)
    } catch (error) {
      console.error('Error broadcasting transaction:', error)
    }
  }

  /**
   * Broadcast payment status update
   */
  static async broadcastPaymentUpdate(
    userId: string, 
    status: 'processing' | 'succeeded' | 'failed',
    paymentIntentId: string,
    packageId?: string
  ) {
    if (!this.io) return

    try {
      this.io.to(`user:${userId}`).emit('payment:status-update', {
        status,
        paymentIntentId,
        packageId,
        timestamp: new Date()
      })

      console.log(`Broadcasted payment update to user ${userId}: ${status}`)
    } catch (error) {
      console.error('Error broadcasting payment update:', error)
    }
  }

  /**
   * Get active sessions for a user
   */
  static getUserSessionCount(userId: string): number {
    return this.userSessions.get(userId)?.size || 0
  }

  /**
   * Get all active users
   */
  static getActiveUsers(): string[] {
    return Array.from(this.userSessions.keys())
  }

  /**
   * Force refresh wallet data for a user
   */
  static async forceWalletRefresh(userId: string) {
    if (!this.io) return

    try {
      const walletBalance = await ResourceWalletService.getWalletBalance(userId)
      const walletStats = await ResourceWalletService.getWalletStats(userId)
      
      this.io.to(`user:${userId}`).emit('wallet:force-refresh', {
        balance: walletBalance,
        stats: walletStats,
        timestamp: new Date()
      })

      console.log(`Forced wallet refresh for user ${userId}`)
    } catch (error) {
      console.error('Error forcing wallet refresh:', error)
    }
  }

  /**
   * Broadcast system-wide wallet maintenance notification
   */
  static broadcastMaintenanceNotification(message: string, duration?: number) {
    if (!this.io) return

    this.io.emit('wallet:maintenance', {
      message,
      duration,
      timestamp: new Date()
    })

    console.log('Broadcasted wallet maintenance notification')
  }

  /**
   * Private helper methods
   */

  private static async verifyToken(token: string, userId: string): Promise<boolean> {
    try {
      // This should use your actual JWT verification logic
      // For now, we'll do a simple check
      if (!token || !userId) {
        return false
      }

      // Import JWT verification logic
      const jwt = require('jsonwebtoken')
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret')
      
      return decoded.userId === userId
    } catch (error) {
      console.error('Token verification error:', error)
      return false
    }
  }

  /**
   * Utility methods for testing and debugging
   */

  static getConnectionStats() {
    return {
      totalConnections: this.io?.engine.clientsCount || 0,
      activeUsers: this.userSessions.size,
      userSessions: Array.from(this.userSessions.entries()).map(([userId, socketIds]) => ({
        userId,
        sessionCount: socketIds.size
      }))
    }
  }

  static async testBroadcast(userId: string, message: string) {
    if (!this.io) return

    this.io.to(`user:${userId}`).emit('test:message', {
      message,
      timestamp: new Date()
    })

    console.log(`Sent test message to user ${userId}: ${message}`)
  }
}

/**
 * Middleware to integrate wallet sync with ResourceWalletService operations
 */
export class WalletSyncMiddleware {
  
  /**
   * Wrap ResourceWalletService methods to trigger sync events
   */
  static initialize() {
    // Override consumeResources to trigger sync
    const originalConsumeResources = ResourceWalletService.consumeResources
    ResourceWalletService.consumeResources = async function(request) {
      const result = await originalConsumeResources.call(this, request)
      
      if (result.success && result.transactionId) {
        // Broadcast wallet update
        await WalletSyncService.broadcastWalletUpdate(request.userId)
      }
      
      return result
    }

    // Override addResources to trigger sync
    const originalAddResources = ResourceWalletService.addResources
    ResourceWalletService.addResources = async function(userId, resourceType, amount, transactionType, description, projectId) {
      const result = await originalAddResources.call(this, userId, resourceType, amount, transactionType, description, projectId)
      
      if (result.success) {
        // Broadcast wallet update
        await WalletSyncService.broadcastWalletUpdate(userId)
      }
      
      return result
    }

    console.log('Wallet sync middleware initialized')
  }
}