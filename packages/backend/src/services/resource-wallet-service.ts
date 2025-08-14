/**
 * Resource Wallet Service
 * Manages package/seat business model operations including purchases, consumption, and transaction logging
 */

import { ResourceWalletModel } from '../models/resource-wallet'
import type { 
  UserResourceWallet,
  CreateResourceWalletInput,
  UpdateResourceWalletInput,
  ResourceType,
  TransactionType,
  CreateSeatTransactionInput,
  ResourceConsumptionRequest,
  ResourceConsumptionResult,
  ResourceWalletBalance,
  PackagePurchaseRequest,
  PackagePurchaseResult,
  ResourcePackage
} from '@saga/shared/types'
import { SeatTransactionModel } from '../models/seat-transaction'
import { BaseModel } from '../models/base'

export class ResourceWalletService {
  
  /**
   * Create a new resource wallet for a user
   */
  static async createWallet(input: CreateResourceWalletInput): Promise<UserResourceWallet> {
    try {
      const wallet = await ResourceWalletModel.create(input)
      
      // Log initial wallet creation
      if (input.projectVouchers || input.facilitatorSeats || input.storytellerSeats) {
        await this.logTransaction({
          userId: input.userId,
          transactionType: 'grant',
          resourceType: 'project_voucher',
          amount: input.projectVouchers || 0,
          description: 'Initial wallet creation'
        })
        
        if (input.facilitatorSeats) {
          await this.logTransaction({
            userId: input.userId,
            transactionType: 'grant',
            resourceType: 'facilitator_seat',
            amount: input.facilitatorSeats,
            description: 'Initial wallet creation'
          })
        }
        
        if (input.storytellerSeats) {
          await this.logTransaction({
            userId: input.userId,
            transactionType: 'grant',
            resourceType: 'storyteller_seat',
            amount: input.storytellerSeats,
            description: 'Initial wallet creation'
          })
        }
      }
      
      return wallet
    } catch (error) {
      console.error('Error creating resource wallet:', error)
      throw new Error('Failed to create resource wallet')
    }
  }

  /**
   * Get wallet by user ID, create if doesn't exist
   */
  static async getOrCreateWallet(userId: string): Promise<UserResourceWallet> {
    try {
      let wallet = await ResourceWalletModel.findByUserId(userId)
      
      if (!wallet) {
        wallet = await this.createWallet({
          userId,
          projectVouchers: 0,
          facilitatorSeats: 0,
          storytellerSeats: 0
        })
      }
      
      return wallet
    } catch (error) {
      console.error('Error getting or creating wallet:', error)
      throw new Error('Failed to get or create wallet')
    }
  }

  /**
   * Get wallet by user ID
   */
  static async getWallet(userId: string): Promise<UserResourceWallet | null> {
    try {
      return await ResourceWalletModel.findByUserId(userId)
    } catch (error) {
      console.error('Error getting wallet:', error)
      throw new Error('Failed to get wallet')
    }
  }

  /**
   * Update wallet balances
   */
  static async updateWallet(userId: string, input: UpdateResourceWalletInput): Promise<UserResourceWallet | null> {
    try {
      return await ResourceWalletModel.update(userId, input)
    } catch (error) {
      console.error('Error updating wallet:', error)
      throw new Error('Failed to update wallet')
    }
  }

  /**
   * Get wallet balance summary
   */
  static async getWalletBalance(userId: string): Promise<ResourceWalletBalance> {
    try {
      const wallet = await this.getOrCreateWallet(userId)
      
      // Calculate total value (this could be enhanced with actual pricing)
      const totalValue = this.calculateWalletValue(wallet)
      
      return {
        projectVouchers: wallet.projectVouchers,
        facilitatorSeats: wallet.facilitatorSeats,
        storytellerSeats: wallet.storytellerSeats,
        totalValue
      }
    } catch (error) {
      console.error('Error getting wallet balance:', error)
      throw new Error('Failed to get wallet balance')
    }
  }

  /**
   * Check if user has sufficient resources
   */
  static async hasSufficientResources(
    userId: string, 
    resourceType: ResourceType, 
    amount: number
  ): Promise<boolean> {
    try {
      const wallet = await this.getOrCreateWallet(userId)
      
      switch (resourceType) {
        case 'project_voucher':
          return wallet.projectVouchers >= amount
        case 'facilitator_seat':
          return wallet.facilitatorSeats >= amount
        case 'storyteller_seat':
          return wallet.storytellerSeats >= amount
        default:
          return false
      }
    } catch (error) {
      console.error('Error checking sufficient resources:', error)
      return false
    }
  }

  /**
   * Check if user can consume a project voucher
   */
  static async canConsumeProjectVoucher(userId: string): Promise<{ 
    success: boolean; 
    error?: string;
    walletBalance?: {
      projectVouchers: number;
      facilitatorSeats: number;
      storytellerSeats: number;
    }
  }> {
    try {
      const wallet = await this.getOrCreateWallet(userId)
      const hasVoucher = wallet.projectVouchers >= 1
      
      const walletBalance = {
        projectVouchers: wallet.projectVouchers,
        facilitatorSeats: wallet.facilitatorSeats,
        storytellerSeats: wallet.storytellerSeats
      }
      
      if (!hasVoucher) {
        return {
          success: false,
          error: 'You need at least 1 Project Voucher to create a project. Purchase a package to get more vouchers.',
          walletBalance
        }
      }
      
      return { 
        success: true,
        walletBalance
      }
    } catch (error) {
      console.error('Error checking project voucher availability:', error)
      return {
        success: false,
        error: 'Failed to check project voucher availability'
      }
    }
  }

  /**
   * Consume a project voucher atomically
   */
  static async consumeProjectVoucher(
    userId: string, 
    projectId: string, 
    trx?: any
  ): Promise<{ success: boolean; error?: string; remainingVouchers?: number }> {
    const transaction = trx || await BaseModel.db.transaction()
    const shouldCommit = !trx
    
    try {
      // Get current wallet within transaction
      const wallet = await ResourceWalletModel.findByUserId(userId, transaction)
      
      if (!wallet) {
        if (shouldCommit) await transaction.rollback()
        return {
          success: false,
          error: 'Wallet not found'
        }
      }

      // Check sufficient vouchers
      if (wallet.projectVouchers < 1) {
        if (shouldCommit) await transaction.rollback()
        return {
          success: false,
          remainingVouchers: wallet.projectVouchers,
          error: `Insufficient project vouchers. Required: 1, Available: ${wallet.projectVouchers}`
        }
      }

      // Update wallet balance
      const newBalance = wallet.projectVouchers - 1
      await ResourceWalletModel.update(userId, { projectVouchers: newBalance }, transaction)

      // Log transaction
      await this.logTransaction({
        userId,
        transactionType: 'consume',
        resourceType: 'project_voucher',
        amount: 1,
        projectId,
        description: 'Project creation'
      }, transaction)

      if (shouldCommit) await transaction.commit()

      return {
        success: true,
        remainingVouchers: newBalance
      }
    } catch (error) {
      if (shouldCommit) await transaction.rollback()
      console.error('Error consuming project voucher:', error)
      return {
        success: false,
        error: 'Failed to consume project voucher'
      }
    }
  }

  /**
   * Consume resources atomically
   */
  static async consumeResources(request: ResourceConsumptionRequest): Promise<ResourceConsumptionResult> {
    const trx = await BaseModel.db.transaction()
    
    try {
      // Get current wallet within transaction
      const wallet = await ResourceWalletModel.findByUserId(request.userId, trx)
      
      if (!wallet) {
        await trx.rollback()
        return {
          success: false,
          remainingBalance: 0,
          error: 'Wallet not found'
        }
      }

      // Check sufficient resources
      const currentBalance = this.getResourceAmount(wallet, request.resourceType)
      if (currentBalance < request.amount) {
        await trx.rollback()
        return {
          success: false,
          remainingBalance: currentBalance,
          error: `Insufficient ${request.resourceType}. Required: ${request.amount}, Available: ${currentBalance}`
        }
      }

      // Calculate new balance
      const newBalance = currentBalance - request.amount
      const updateData: UpdateResourceWalletInput = {}
      
      switch (request.resourceType) {
        case 'project_voucher':
          updateData.projectVouchers = newBalance
          break
        case 'facilitator_seat':
          updateData.facilitatorSeats = newBalance
          break
        case 'storyteller_seat':
          updateData.storytellerSeats = newBalance
          break
      }

      // Update wallet
      await ResourceWalletModel.update(request.userId, updateData, trx)

      // Log transaction
      const transaction = await this.logTransaction({
        userId: request.userId,
        transactionType: 'consume',
        resourceType: request.resourceType,
        amount: -request.amount, // Negative for consumption
        projectId: request.projectId,
        description: request.description || `Consumed ${request.amount} ${request.resourceType}`
      }, trx)

      await trx.commit()

      return {
        success: true,
        remainingBalance: newBalance,
        transactionId: transaction.id
      }
    } catch (error) {
      await trx.rollback()
      console.error('Error consuming resources:', error)
      return {
        success: false,
        remainingBalance: 0,
        error: 'Failed to consume resources'
      }
    }
  }

  /**
   * Add resources to wallet (for purchases, grants, refunds)
   */
  static async addResources(
    userId: string,
    resourceType: ResourceType,
    amount: number,
    transactionType: TransactionType = 'purchase',
    description?: string,
    projectId?: string
  ): Promise<ResourceConsumptionResult> {
    const trx = await BaseModel.db.transaction()
    
    try {
      const wallet = await this.getOrCreateWallet(userId)
      
      // Calculate new balance
      const currentBalance = this.getResourceAmount(wallet, resourceType)
      const newBalance = currentBalance + amount
      const updateData: UpdateResourceWalletInput = {}
      
      switch (resourceType) {
        case 'project_voucher':
          updateData.projectVouchers = newBalance
          break
        case 'facilitator_seat':
          updateData.facilitatorSeats = newBalance
          break
        case 'storyteller_seat':
          updateData.storytellerSeats = newBalance
          break
      }

      // Update wallet
      await ResourceWalletModel.update(userId, updateData, trx)

      // Log transaction
      const transaction = await this.logTransaction({
        userId,
        transactionType,
        resourceType,
        amount,
        projectId,
        description: description || `Added ${amount} ${resourceType}`
      }, trx)

      await trx.commit()

      return {
        success: true,
        remainingBalance: newBalance,
        transactionId: transaction.id
      }
    } catch (error) {
      await trx.rollback()
      console.error('Error adding resources:', error)
      return {
        success: false,
        remainingBalance: 0,
        error: 'Failed to add resources'
      }
    }
  }

  /**
   * Process package purchase with database transaction
   */
  static async purchasePackage(request: PackagePurchaseRequest): Promise<PackagePurchaseResult> {
    // Start database transaction for atomic operation
    const trx = await BaseModel.startTransaction()
    
    try {
      console.log('Starting package purchase transaction', { 
        userId: request.userId, 
        packageId: request.packageId 
      })

      // Input validation
      if (!request.userId || typeof request.userId !== 'string') {
        throw new Error('Invalid user ID provided')
      }
      
      if (!request.packageId || typeof request.packageId !== 'string') {
        throw new Error('Invalid package ID provided')
      }
      
      if (!request.paymentDetails || typeof request.paymentDetails !== 'object') {
        throw new Error('Invalid payment details provided')
      }

      // Get package details within transaction
      const packageDetails = await this.getPackageDetails(request.packageId, trx)
      
      if (!packageDetails) {
        throw new Error(`Package with ID '${request.packageId}' not found`)
      }

      // Validate package is available for purchase
      if (!packageDetails.active) {
        throw new Error('Package is not available for purchase')
      }

      // Process payment (this should be idempotent)
      const paymentResult = await this.processPayment(request, packageDetails)
      
      if (!paymentResult.success) {
        throw new Error(`Payment failed: ${paymentResult.error || 'Unknown payment error'}`)
      }

      // Get or create wallet within transaction
      let wallet = await ResourceWalletModel.findByUserId(request.userId, trx)
      if (!wallet) {
        wallet = await ResourceWalletModel.create({
          userId: request.userId,
          projectVouchers: 0,
          facilitatorSeats: 0,
          storytellerSeats: 0
        }, trx)
      }

      // Validate wallet state
      if (wallet.userId !== request.userId) {
        throw new Error('Wallet user ID mismatch')
      }

      // Calculate new resource amounts
      const newProjectVouchers = wallet.projectVouchers + packageDetails.resources.projectVouchers
      const newFacilitatorSeats = wallet.facilitatorSeats + packageDetails.resources.facilitatorSeats
      const newStorytellerSeats = wallet.storytellerSeats + packageDetails.resources.storytellerSeats
      
      // Validate resource limits (prevent overflow)
      if (newProjectVouchers > 1000 || newFacilitatorSeats > 1000 || newStorytellerSeats > 1000) {
        throw new Error('Resource limit exceeded')
      }

      // Update wallet within transaction
      const updatedWallet = await ResourceWalletModel.update(request.userId, {
        projectVouchers: newProjectVouchers,
        facilitatorSeats: newFacilitatorSeats,
        storytellerSeats: newStorytellerSeats
      }, trx)

      if (!updatedWallet) {
        throw new Error('Failed to update wallet')
      }

      // Log all transactions within same database transaction
      const transactionPromises = []
      
      if (packageDetails.resources.projectVouchers > 0) {
        transactionPromises.push(
          this.logTransaction({
            userId: request.userId,
            transactionType: 'purchase',
            resourceType: 'project_voucher',
            amount: packageDetails.resources.projectVouchers,
            description: `Package purchase: ${packageDetails.name}`,
            paymentId: paymentResult.transactionId
          }, trx)
        )
      }
      
      if (packageDetails.resources.facilitatorSeats > 0) {
        transactionPromises.push(
          this.logTransaction({
            userId: request.userId,
            transactionType: 'purchase',
            resourceType: 'facilitator_seat',
            amount: packageDetails.resources.facilitatorSeats,
            description: `Package purchase: ${packageDetails.name}`,
            paymentId: paymentResult.transactionId
          }, trx)
        )
      }
      
      if (packageDetails.resources.storytellerSeats > 0) {
        transactionPromises.push(
          this.logTransaction({
            userId: request.userId,
            transactionType: 'purchase',
            resourceType: 'storyteller_seat',
            amount: packageDetails.resources.storytellerSeats,
            description: `Package purchase: ${packageDetails.name}`,
            paymentId: paymentResult.transactionId
          }, trx)
        )
      }

      await Promise.all(transactionPromises)

      // Commit transaction
      await trx.commit()

      console.log('Package purchase completed successfully', {
        userId: request.userId,
        packageId: request.packageId,
        transactionId: paymentResult.transactionId,
        resourcesAdded: packageDetails.resources
      })

      const walletBalance = await this.getWalletBalance(request.userId)

      return {
        success: true,
        transactionId: paymentResult.transactionId,
        walletBalance
      }
    } catch (error) {
      // Rollback transaction on any error
      await trx.rollback()
      
      console.error('Package purchase failed', {
        userId: request.userId,
        packageId: request.packageId,
        error: error.message,
        stack: error.stack
      })
      
      // Attempt to refund payment if it was processed
      // This should be done asynchronously to avoid blocking the response
      if (error.message.includes('Payment failed') === false) {
        // Payment was successful but something else failed
        // Schedule a refund (this would be handled by a background job)
        this.schedulePaymentRefund(request.paymentDetails).catch(refundError => {
          console.error('Failed to schedule payment refund', refundError)
        })
      }
      
      return {
        success: false,
        error: `Package purchase failed: ${error.message}`
      }
    }
  }

  /**
   * Refund resources (for failed invitations, etc.)
   */
  static async refundResources(
    userId: string,
    resourceType: ResourceType,
    amount: number,
    description: string,
    projectId?: string
  ): Promise<ResourceConsumptionResult> {
    return await this.addResources(
      userId,
      resourceType,
      amount,
      'refund',
      description,
      projectId
    )
  }

  /**
   * Get transaction history for user
   */
  static async getTransactionHistory(
    userId: string,
    options: {
      limit?: number
      offset?: number
      resourceType?: ResourceType
      transactionType?: TransactionType
      startDate?: Date
      endDate?: Date
    } = {}
  ) {
    try {
      return await SeatTransactionModel.findByUserId(userId, options)
    } catch (error) {
      console.error('Error getting transaction history:', error)
      throw new Error('Failed to get transaction history')
    }
  }

  /**
   * Get wallet statistics
   */
  static async getWalletStats(userId: string) {
    try {
      const wallet = await this.getOrCreateWallet(userId)
      const transactions = await this.getTransactionHistory(userId, { limit: 10 })
      
      return {
        currentBalance: {
          projectVouchers: wallet.projectVouchers,
          facilitatorSeats: wallet.facilitatorSeats,
          storytellerSeats: wallet.storytellerSeats
        },
        totalValue: this.calculateWalletValue(wallet),
        recentTransactions: transactions,
        createdAt: wallet.createdAt,
        lastUpdated: wallet.updatedAt
      }
    } catch (error) {
      console.error('Error getting wallet stats:', error)
      throw new Error('Failed to get wallet statistics')
    }
  }

  /**
   * Private helper methods
   */

  private static async logTransaction(
    input: CreateSeatTransactionInput,
    trx?: any
  ) {
    const startTime = Date.now()
    
    try {
      // Input validation
      if (!input.userId || typeof input.userId !== 'string') {
        throw new Error('Invalid userId for transaction logging')
      }
      
      if (!input.transactionType || typeof input.transactionType !== 'string') {
        throw new Error('Invalid transactionType for transaction logging')
      }
      
      if (!input.resourceType || typeof input.resourceType !== 'string') {
        throw new Error('Invalid resourceType for transaction logging')
      }
      
      if (typeof input.amount !== 'number' || input.amount === 0) {
        throw new Error('Invalid amount for transaction logging')
      }

      console.log('Logging seat transaction', {
        userId: input.userId,
        transactionType: input.transactionType,
        resourceType: input.resourceType,
        amount: input.amount,
        description: input.description,
        paymentId: input.paymentId,
        hasTransaction: !!trx
      })

      // Create transaction record
      const transaction = await SeatTransactionModel.create(input, trx)
      
      const duration = Date.now() - startTime
      
      console.log('Seat transaction logged successfully', {
        transactionId: transaction.id,
        userId: input.userId,
        transactionType: input.transactionType,
        resourceType: input.resourceType,
        amount: input.amount,
        duration: `${duration}ms`
      })
      
      return transaction
      
    } catch (error) {
      const duration = Date.now() - startTime
      
      console.error('Failed to log seat transaction', {
        error: error.message,
        stack: error.stack,
        userId: input.userId,
        transactionType: input.transactionType,
        resourceType: input.resourceType,
        amount: input.amount,
        duration: `${duration}ms`,
        hasTransaction: !!trx
      })
      
      // Re-throw the error since this is a critical operation
      throw new Error(`Transaction logging failed: ${error.message}`)
    }
  }

  private static getResourceAmount(wallet: UserResourceWallet, resourceType: ResourceType): number {
    switch (resourceType) {
      case 'project_voucher':
        return wallet.projectVouchers
      case 'facilitator_seat':
        return wallet.facilitatorSeats
      case 'storyteller_seat':
        return wallet.storytellerSeats
      default:
        return 0
    }
  }

  private static calculateWalletValue(wallet: UserResourceWallet): number {
    // These values should come from configuration or database
    const VOUCHER_VALUE = 29.99
    const FACILITATOR_SEAT_VALUE = 9.99
    const STORYTELLER_SEAT_VALUE = 4.99
    
    return (
      wallet.projectVouchers * VOUCHER_VALUE +
      wallet.facilitatorSeats * FACILITATOR_SEAT_VALUE +
      wallet.storytellerSeats * STORYTELLER_SEAT_VALUE
    )
  }

  private static async getPackageDetails(packageId: string): Promise<ResourcePackage | null> {
    // Import PaymentService dynamically to avoid circular dependency
    const { PaymentService } = await import('./payment-service')
    return await PaymentService.getPackageDetails(packageId)
  }

  private static async processPayment(
    request: PackagePurchaseRequest,
    packageDetails: ResourcePackage
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    // This method is now handled by PaymentService
    // The actual payment processing should be done through PaymentService.confirmPaymentAndPurchase
    // This method is kept for backward compatibility but should not be used directly
    console.warn('processPayment called directly - use PaymentService.confirmPaymentAndPurchase instead')
    
    return {
      success: false,
      error: 'Payment should be processed through PaymentService'
    }
  }

  private static async refundPayment(transactionId: string): Promise<boolean> {
    // This would process refund through payment processor
    // For now, simulate successful refund
    console.log(`Refunding payment: ${transactionId}`)
    return true
  }

  /**
   * Validation helpers
   */

  static validateResourceType(resourceType: string): boolean {
    return ['project_voucher', 'facilitator_seat', 'storyteller_seat'].includes(resourceType)
  }

  static validateTransactionType(transactionType: string): boolean {
    return ['purchase', 'consume', 'refund', 'grant', 'expire'].includes(transactionType)
  }

  static validateAmount(amount: number): boolean {
    return typeof amount === 'number' && amount > 0 && Number.isInteger(amount)
  }

  /**
   * Utility methods for common operations
   */

  static async canCreateProject(userId: string): Promise<boolean> {
    return await this.hasSufficientResources(userId, 'project_voucher', 1)
  }

  static async canInviteFacilitator(userId: string): Promise<boolean> {
    return await this.hasSufficientResources(userId, 'facilitator_seat', 1)
  }

  static async canInviteStoryteller(userId: string): Promise<boolean> {
    return await this.hasSufficientResources(userId, 'storyteller_seat', 1)
  }

  static async consumeProjectVoucher(userId: string, projectId: string): Promise<ResourceConsumptionResult> {
    return await this.consumeResources({
      userId,
      resourceType: 'project_voucher',
      amount: 1,
      projectId,
      description: 'Project creation'
    })
  }

  static async consumeFacilitatorSeat(userId: string, projectId: string): Promise<ResourceConsumptionResult> {
    return await this.consumeResources({
      userId,
      resourceType: 'facilitator_seat',
      amount: 1,
      projectId,
      description: 'Facilitator invitation'
    })
  }

  static async consumeStorytellerSeat(userId: string, projectId: string): Promise<ResourceConsumptionResult> {
    return await this.consumeResources({
      userId,
      resourceType: 'storyteller_seat',
      amount: 1,
      projectId,
      description: 'Storyteller invitation'
    })
  }
}