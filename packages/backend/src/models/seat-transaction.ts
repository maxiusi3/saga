/**
 * Seat Transaction Model
 * Handles all resource wallet transaction operations and audit logging
 */

import { BaseModel } from './base'
import type { 
  SeatTransaction,
  CreateSeatTransactionInput,
  TransactionType,
  ResourceType
} from '@saga/shared/types'

export class SeatTransactionModel extends BaseModel {
  static tableName = 'seat_transactions'

  private static transformTransaction(transaction: any): SeatTransaction {
    return {
      id: transaction.id,
      userId: transaction.user_id,
      transactionType: transaction.transaction_type,
      resourceType: transaction.resource_type,
      amount: transaction.amount,
      projectId: transaction.project_id,
      description: transaction.description,
      metadata: transaction.metadata ? JSON.parse(transaction.metadata) : undefined,
      createdAt: transaction.created_at
    }
  }

  /**
   * Create a new seat transaction
   */
  static async create(input: CreateSeatTransactionInput, trx?: any): Promise<SeatTransaction> {
    const db = trx || this.db
    
    const [transaction] = await db(this.tableName)
      .insert({
        user_id: input.userId,
        transaction_type: input.transactionType,
        resource_type: input.resourceType,
        amount: input.amount,
        project_id: input.projectId,
        description: input.description,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        created_at: new Date()
      })
      .returning('*')

    return this.transformTransaction(transaction)
  }

  /**
   * Find transactions by user ID with filtering options
   */
  static async findByUserId(
    userId: string,
    options: {
      limit?: number
      offset?: number
      resourceType?: ResourceType
      transactionType?: TransactionType
      startDate?: Date
      endDate?: Date
      sortBy?: 'createdAt' | 'amount'
      sortOrder?: 'asc' | 'desc'
    } = {}
  ): Promise<SeatTransaction[]> {
    let query = this.db(this.tableName)
      .where('user_id', userId)

    // Apply filters
    if (options.resourceType) {
      query = query.where('resource_type', options.resourceType)
    }

    if (options.transactionType) {
      query = query.where('transaction_type', options.transactionType)
    }

    if (options.startDate) {
      query = query.where('created_at', '>=', options.startDate)
    }

    if (options.endDate) {
      query = query.where('created_at', '<=', options.endDate)
    }

    // Apply sorting
    const sortBy = options.sortBy || 'createdAt'
    const sortOrder = options.sortOrder || 'desc'
    query = query.orderBy(sortBy === 'createdAt' ? 'created_at' : sortBy, sortOrder)

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.offset(options.offset)
    }

    const transactions = await query
    return transactions.map(this.transformTransaction)
  }

  /**
   * Find transactions by project ID
   */
  static async findByProjectId(projectId: string): Promise<SeatTransaction[]> {
    const transactions = await this.db(this.tableName)
      .where('project_id', projectId)
      .orderBy('created_at', 'desc')

    return transactions.map(this.transformTransaction)
  }

  /**
   * Get transaction by ID
   */
  static async findById(id: string): Promise<SeatTransaction | null> {
    const transaction = await this.db(this.tableName)
      .where('id', id)
      .first()

    return transaction ? this.transformTransaction(transaction) : null
  }

  /**
   * Get transaction statistics for a user
   */
  static async getUserTransactionStats(userId: string): Promise<{
    totalTransactions: number
    totalSpent: number
    totalEarned: number
    byType: Record<TransactionType, number>
    byResource: Record<ResourceType, number>
  }> {
    const transactions = await this.findByUserId(userId)

    const stats = {
      totalTransactions: transactions.length,
      totalSpent: 0,
      totalEarned: 0,
      byType: {
        purchase: 0,
        consume: 0,
        refund: 0,
        grant: 0,
        expire: 0
      } as Record<TransactionType, number>,
      byResource: {
        project_voucher: 0,
        facilitator_seat: 0,
        storyteller_seat: 0
      } as Record<ResourceType, number>
    }

    transactions.forEach(transaction => {
      // Count by type
      stats.byType[transaction.transactionType]++

      // Count by resource
      stats.byResource[transaction.resourceType] += Math.abs(transaction.amount)

      // Calculate spent vs earned
      if (transaction.amount < 0) {
        stats.totalSpent += Math.abs(transaction.amount)
      } else {
        stats.totalEarned += transaction.amount
      }
    })

    return stats
  }

  /**
   * Get system-wide transaction statistics
   */
  static async getSystemStats(): Promise<{
    totalTransactions: number
    totalUsers: number
    recentTransactions: SeatTransaction[]
    topUsers: Array<{
      userId: string
      transactionCount: number
      totalAmount: number
    }>
  }> {
    // Get total transaction count
    const [{ count: totalTransactions }] = await this.db(this.tableName)
      .count('* as count')

    // Get unique user count
    const [{ count: totalUsers }] = await this.db(this.tableName)
      .countDistinct('user_id as count')

    // Get recent transactions
    const recentTransactionsData = await this.db(this.tableName)
      .orderBy('created_at', 'desc')
      .limit(10)

    const recentTransactions = recentTransactionsData.map(this.transformTransaction)

    // Get top users by transaction count
    const topUsersData = await this.db(this.tableName)
      .select('user_id')
      .count('* as transaction_count')
      .sum('amount as total_amount')
      .groupBy('user_id')
      .orderBy('transaction_count', 'desc')
      .limit(10)

    const topUsers = topUsersData.map(user => ({
      userId: user.user_id,
      transactionCount: parseInt(user.transaction_count),
      totalAmount: parseFloat(user.total_amount) || 0
    }))

    return {
      totalTransactions: parseInt(totalTransactions),
      totalUsers: parseInt(totalUsers),
      recentTransactions,
      topUsers
    }
  }

  /**
   * Get transactions within date range
   */
  static async findByDateRange(
    startDate: Date,
    endDate: Date,
    options: {
      userId?: string
      resourceType?: ResourceType
      transactionType?: TransactionType
      limit?: number
    } = {}
  ): Promise<SeatTransaction[]> {
    let query = this.db(this.tableName)
      .where('created_at', '>=', startDate)
      .where('created_at', '<=', endDate)

    if (options.userId) {
      query = query.where('user_id', options.userId)
    }

    if (options.resourceType) {
      query = query.where('resource_type', options.resourceType)
    }

    if (options.transactionType) {
      query = query.where('transaction_type', options.transactionType)
    }

    query = query.orderBy('created_at', 'desc')

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const transactions = await query
    return transactions.map(this.transformTransaction)
  }

  /**
   * Delete old transactions (for cleanup)
   */
  static async deleteOlderThan(date: Date): Promise<number> {
    const deletedCount = await this.db(this.tableName)
      .where('created_at', '<', date)
      .del()

    return deletedCount
  }

  /**
   * Get transaction summary for reporting
   */
  static async getTransactionSummary(
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<Array<{
    period: string
    totalTransactions: number
    totalAmount: number
    byType: Record<TransactionType, number>
    byResource: Record<ResourceType, number>
  }>> {
    // This would require more complex SQL queries
    // For now, return a simplified version
    const transactions = await this.findByDateRange(startDate, endDate)

    // Group transactions by period
    const grouped = new Map<string, SeatTransaction[]>()

    transactions.forEach(transaction => {
      let periodKey: string
      const date = new Date(transaction.createdAt)

      switch (groupBy) {
        case 'day':
          periodKey = date.toISOString().split('T')[0]
          break
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          periodKey = weekStart.toISOString().split('T')[0]
          break
        case 'month':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          break
        default:
          periodKey = date.toISOString().split('T')[0]
      }

      if (!grouped.has(periodKey)) {
        grouped.set(periodKey, [])
      }
      grouped.get(periodKey)!.push(transaction)
    })

    // Convert to summary format
    const summary = Array.from(grouped.entries()).map(([period, periodTransactions]) => {
      const byType = {
        purchase: 0,
        consume: 0,
        refund: 0,
        grant: 0,
        expire: 0
      } as Record<TransactionType, number>

      const byResource = {
        project_voucher: 0,
        facilitator_seat: 0,
        storyteller_seat: 0
      } as Record<ResourceType, number>

      let totalAmount = 0

      periodTransactions.forEach(transaction => {
        byType[transaction.transactionType]++
        byResource[transaction.resourceType] += Math.abs(transaction.amount)
        totalAmount += Math.abs(transaction.amount)
      })

      return {
        period,
        totalTransactions: periodTransactions.length,
        totalAmount,
        byType,
        byResource
      }
    })

    return summary.sort((a, b) => a.period.localeCompare(b.period))
  }
}