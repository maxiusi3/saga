/**
 * Payment Analytics Service
 * Handles payment analytics and tracking
 */

import { BaseModel } from '../models/base'
import type { 
  PaymentAnalytics,
  PaymentMetrics,
  ConversionFunnel,
  RevenueAnalytics
} from '@saga/shared/types'

export class PaymentAnalyticsService {
  /**
   * Get comprehensive payment analytics
   */
  static async getPaymentAnalytics(options: {
    startDate?: Date
    endDate?: Date
    groupBy?: 'day' | 'week' | 'month'
  } = {}): Promise<PaymentAnalytics> {
    try {
      const { startDate, endDate, groupBy = 'day' } = options

      // Get basic payment metrics
      const metrics = await this.getPaymentMetrics({ startDate, endDate })
      
      // Get conversion funnel data
      const conversionFunnel = await this.getConversionFunnel({ startDate, endDate })
      
      // Get revenue analytics
      const revenueAnalytics = await this.getRevenueAnalytics({ startDate, endDate, groupBy })
      
      // Get payment method breakdown
      const paymentMethodBreakdown = await this.getPaymentMethodBreakdown({ startDate, endDate })
      
      // Get package performance
      const packagePerformance = await this.getPackagePerformance({ startDate, endDate })

      return {
        metrics,
        conversionFunnel,
        revenueAnalytics,
        paymentMethodBreakdown,
        packagePerformance,
        generatedAt: new Date()
      }
    } catch (error) {
      console.error('Error getting payment analytics:', error)
      throw new Error('Failed to get payment analytics')
    }
  }

  /**
   * Get basic payment metrics
   */
  static async getPaymentMetrics(options: {
    startDate?: Date
    endDate?: Date
  } = {}): Promise<PaymentMetrics> {
    try {
      const { startDate, endDate } = options

      let query = BaseModel.db('purchase_receipts')

      if (startDate) {
        query = query.where('purchase_date', '>=', startDate)
      }
      if (endDate) {
        query = query.where('purchase_date', '<=', endDate)
      }

      // Get basic metrics
      const basicMetrics = await query.clone()
        .select(
          BaseModel.db.raw('COUNT(*) as totalTransactions'),
          BaseModel.db.raw('SUM(amount) as totalRevenue'),
          BaseModel.db.raw('AVG(amount) as averageOrderValue'),
          BaseModel.db.raw('COUNT(DISTINCT user_id) as uniqueCustomers')
        )
        .first()

      // Get success rate (assuming all receipts are successful)
      const totalAttempts = await this.getPaymentAttempts({ startDate, endDate })
      const successRate = totalAttempts > 0 ? (parseInt(basicMetrics.totalTransactions) / totalAttempts) * 100 : 0

      // Get refund metrics
      const refundMetrics = await this.getRefundMetrics({ startDate, endDate })

      return {
        totalTransactions: parseInt(basicMetrics.totalTransactions) || 0,
        totalRevenue: parseInt(basicMetrics.totalRevenue) || 0,
        averageOrderValue: parseFloat(basicMetrics.averageOrderValue) || 0,
        uniqueCustomers: parseInt(basicMetrics.uniqueCustomers) || 0,
        successRate,
        refundRate: refundMetrics.refundRate,
        totalRefunds: refundMetrics.totalRefunds,
        refundAmount: refundMetrics.refundAmount
      }
    } catch (error) {
      console.error('Error getting payment metrics:', error)
      throw new Error('Failed to get payment metrics')
    }
  }

  /**
   * Get conversion funnel data
   */
  static async getConversionFunnel(options: {
    startDate?: Date
    endDate?: Date
  } = {}): Promise<ConversionFunnel> {
    try {
      // This would typically track user journey through payment flow
      // For now, we'll use simplified metrics based on available data

      const { startDate, endDate } = options

      // Get payment intent creations (would need to track these)
      const paymentIntentsCreated = await this.getPaymentIntentCount({ startDate, endDate })
      
      // Get successful purchases
      let purchaseQuery = BaseModel.db('purchase_receipts')
      if (startDate) purchaseQuery = purchaseQuery.where('purchase_date', '>=', startDate)
      if (endDate) purchaseQuery = purchaseQuery.where('purchase_date', '<=', endDate)
      
      const successfulPurchases = await purchaseQuery.count('* as count').first()
      const purchases = parseInt(successfulPurchases?.count as string) || 0

      // Calculate conversion rates
      const intentToPaymentRate = paymentIntentsCreated > 0 ? (purchases / paymentIntentsCreated) * 100 : 0

      return {
        steps: [
          {
            name: 'Payment Intent Created',
            count: paymentIntentsCreated,
            conversionRate: 100
          },
          {
            name: 'Payment Completed',
            count: purchases,
            conversionRate: intentToPaymentRate
          }
        ],
        overallConversionRate: intentToPaymentRate
      }
    } catch (error) {
      console.error('Error getting conversion funnel:', error)
      throw new Error('Failed to get conversion funnel')
    }
  }

  /**
   * Get revenue analytics over time
   */
  static async getRevenueAnalytics(options: {
    startDate?: Date
    endDate?: Date
    groupBy?: 'day' | 'week' | 'month'
  } = {}): Promise<RevenueAnalytics> {
    try {
      const { startDate, endDate, groupBy = 'day' } = options

      let query = BaseModel.db('purchase_receipts')

      if (startDate) {
        query = query.where('purchase_date', '>=', startDate)
      }
      if (endDate) {
        query = query.where('purchase_date', '<=', endDate)
      }

      // Group by time period
      let dateFormat: string
      switch (groupBy) {
        case 'week':
          dateFormat = 'YYYY-"W"WW'
          break
        case 'month':
          dateFormat = 'YYYY-MM'
          break
        default:
          dateFormat = 'YYYY-MM-DD'
      }

      const revenueOverTime = await query
        .select(
          BaseModel.db.raw(`DATE_TRUNC('${groupBy}', purchase_date) as period`),
          BaseModel.db.raw('SUM(amount) as revenue'),
          BaseModel.db.raw('COUNT(*) as transactions'),
          BaseModel.db.raw('AVG(amount) as averageOrderValue')
        )
        .groupBy(BaseModel.db.raw(`DATE_TRUNC('${groupBy}', purchase_date)`))
        .orderBy('period', 'asc')

      // Calculate growth rates
      const timeSeriesData = revenueOverTime.map((row, index) => {
        const previousRow = revenueOverTime[index - 1]
        const growthRate = previousRow 
          ? ((parseInt(row.revenue) - parseInt(previousRow.revenue)) / parseInt(previousRow.revenue)) * 100
          : 0

        return {
          period: row.period,
          revenue: parseInt(row.revenue),
          transactions: parseInt(row.transactions),
          averageOrderValue: parseFloat(row.averageOrderValue),
          growthRate
        }
      })

      // Calculate totals
      const totalRevenue = timeSeriesData.reduce((sum, item) => sum + item.revenue, 0)
      const totalTransactions = timeSeriesData.reduce((sum, item) => sum + item.transactions, 0)

      return {
        timeSeriesData,
        totalRevenue,
        totalTransactions,
        averageGrowthRate: timeSeriesData.length > 1 
          ? timeSeriesData.reduce((sum, item) => sum + item.growthRate, 0) / (timeSeriesData.length - 1)
          : 0
      }
    } catch (error) {
      console.error('Error getting revenue analytics:', error)
      throw new Error('Failed to get revenue analytics')
    }
  }

  /**
   * Get payment method breakdown
   */
  static async getPaymentMethodBreakdown(options: {
    startDate?: Date
    endDate?: Date
  } = {}): Promise<Array<{
    paymentMethod: string
    count: number
    revenue: number
    percentage: number
  }>> {
    try {
      const { startDate, endDate } = options

      let query = BaseModel.db('purchase_receipts')

      if (startDate) {
        query = query.where('purchase_date', '>=', startDate)
      }
      if (endDate) {
        query = query.where('purchase_date', '<=', endDate)
      }

      const breakdown = await query
        .select('payment_method')
        .select(BaseModel.db.raw('COUNT(*) as count'))
        .select(BaseModel.db.raw('SUM(amount) as revenue'))
        .groupBy('payment_method')
        .orderBy('revenue', 'desc')

      const totalRevenue = breakdown.reduce((sum, item) => sum + parseInt(item.revenue), 0)

      return breakdown.map(item => ({
        paymentMethod: item.payment_method || 'unknown',
        count: parseInt(item.count),
        revenue: parseInt(item.revenue),
        percentage: totalRevenue > 0 ? (parseInt(item.revenue) / totalRevenue) * 100 : 0
      }))
    } catch (error) {
      console.error('Error getting payment method breakdown:', error)
      throw new Error('Failed to get payment method breakdown')
    }
  }

  /**
   * Get package performance analytics
   */
  static async getPackagePerformance(options: {
    startDate?: Date
    endDate?: Date
  } = {}): Promise<Array<{
    packageId: string
    packageName: string
    sales: number
    revenue: number
    averageOrderValue: number
  }>> {
    try {
      const { startDate, endDate } = options

      let query = BaseModel.db('purchase_receipts')

      if (startDate) {
        query = query.where('purchase_date', '>=', startDate)
      }
      if (endDate) {
        query = query.where('purchase_date', '<=', endDate)
      }

      const performance = await query
        .select('package_id', 'package_name')
        .select(BaseModel.db.raw('COUNT(*) as sales'))
        .select(BaseModel.db.raw('SUM(amount) as revenue'))
        .select(BaseModel.db.raw('AVG(amount) as averageOrderValue'))
        .groupBy('package_id', 'package_name')
        .orderBy('revenue', 'desc')

      return performance.map(item => ({
        packageId: item.package_id,
        packageName: item.package_name,
        sales: parseInt(item.sales),
        revenue: parseInt(item.revenue),
        averageOrderValue: parseFloat(item.averageOrderValue)
      }))
    } catch (error) {
      console.error('Error getting package performance:', error)
      throw new Error('Failed to get package performance')
    }
  }

  /**
   * Get refund metrics
   */
  private static async getRefundMetrics(options: {
    startDate?: Date
    endDate?: Date
  } = {}): Promise<{
    totalRefunds: number
    refundAmount: number
    refundRate: number
  }> {
    try {
      // This would query a refunds table if it exists
      // For now, return default values
      return {
        totalRefunds: 0,
        refundAmount: 0,
        refundRate: 0
      }
    } catch (error) {
      console.error('Error getting refund metrics:', error)
      return {
        totalRefunds: 0,
        refundAmount: 0,
        refundRate: 0
      }
    }
  }

  /**
   * Get payment attempt count (would need to track payment intents)
   */
  private static async getPaymentAttempts(options: {
    startDate?: Date
    endDate?: Date
  } = {}): Promise<number> {
    try {
      // This would query payment attempts/intents table
      // For now, estimate based on successful payments
      const { startDate, endDate } = options

      let query = BaseModel.db('purchase_receipts')

      if (startDate) {
        query = query.where('purchase_date', '>=', startDate)
      }
      if (endDate) {
        query = query.where('purchase_date', '<=', endDate)
      }

      const result = await query.count('* as count').first()
      const successfulPayments = parseInt(result?.count as string) || 0

      // Estimate total attempts (assuming 80% success rate)
      return Math.round(successfulPayments / 0.8)
    } catch (error) {
      console.error('Error getting payment attempts:', error)
      return 0
    }
  }

  /**
   * Get payment intent count (would need to track these)
   */
  private static async getPaymentIntentCount(options: {
    startDate?: Date
    endDate?: Date
  } = {}): Promise<number> {
    try {
      // This would query payment intents table
      // For now, estimate based on successful payments
      return await this.getPaymentAttempts(options)
    } catch (error) {
      console.error('Error getting payment intent count:', error)
      return 0
    }
  }

  /**
   * Track payment event
   */
  static async trackPaymentEvent(event: {
    userId: string
    eventType: 'payment_intent_created' | 'payment_succeeded' | 'payment_failed' | 'refund_processed'
    paymentIntentId?: string
    amount?: number
    currency?: string
    packageId?: string
    errorCode?: string
    metadata?: any
  }): Promise<void> {
    try {
      await BaseModel.db('payment_events').insert({
        user_id: event.userId,
        event_type: event.eventType,
        payment_intent_id: event.paymentIntentId,
        amount: event.amount,
        currency: event.currency,
        package_id: event.packageId,
        error_code: event.errorCode,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        created_at: new Date()
      })
    } catch (error) {
      console.error('Error tracking payment event:', error)
      // Don't throw error - tracking failure shouldn't break payment flow
    }
  }

  /**
   * Get customer lifetime value analytics
   */
  static async getCustomerLifetimeValue(): Promise<{
    averageLifetimeValue: number
    averageOrdersPerCustomer: number
    customerRetentionRate: number
    topCustomers: Array<{
      userId: string
      totalSpent: number
      orderCount: number
      firstPurchase: Date
      lastPurchase: Date
    }>
  }> {
    try {
      // Get customer spending data
      const customerData = await BaseModel.db('purchase_receipts')
        .select('user_id')
        .select(BaseModel.db.raw('SUM(amount) as totalSpent'))
        .select(BaseModel.db.raw('COUNT(*) as orderCount'))
        .select(BaseModel.db.raw('MIN(purchase_date) as firstPurchase'))
        .select(BaseModel.db.raw('MAX(purchase_date) as lastPurchase'))
        .groupBy('user_id')
        .orderBy('totalSpent', 'desc')

      const totalCustomers = customerData.length
      const totalLifetimeValue = customerData.reduce((sum, customer) => sum + parseInt(customer.totalSpent), 0)
      const totalOrders = customerData.reduce((sum, customer) => sum + parseInt(customer.orderCount), 0)

      // Calculate repeat customers (more than 1 order)
      const repeatCustomers = customerData.filter(customer => parseInt(customer.orderCount) > 1).length
      const customerRetentionRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0

      return {
        averageLifetimeValue: totalCustomers > 0 ? totalLifetimeValue / totalCustomers : 0,
        averageOrdersPerCustomer: totalCustomers > 0 ? totalOrders / totalCustomers : 0,
        customerRetentionRate,
        topCustomers: customerData.slice(0, 10).map(customer => ({
          userId: customer.user_id,
          totalSpent: parseInt(customer.totalSpent),
          orderCount: parseInt(customer.orderCount),
          firstPurchase: new Date(customer.firstPurchase),
          lastPurchase: new Date(customer.lastPurchase)
        }))
      }
    } catch (error) {
      console.error('Error getting customer lifetime value:', error)
      throw new Error('Failed to get customer lifetime value')
    }
  }

  /**
   * Get payment failure analysis
   */
  static async getPaymentFailureAnalysis(options: {
    startDate?: Date
    endDate?: Date
  } = {}): Promise<{
    totalFailures: number
    failureRate: number
    failuresByReason: Array<{
      reason: string
      count: number
      percentage: number
    }>
    failuresByPaymentMethod: Array<{
      paymentMethod: string
      failures: number
      attempts: number
      failureRate: number
    }>
  }> {
    try {
      // This would query payment events or failure logs
      // For now, return default structure
      return {
        totalFailures: 0,
        failureRate: 0,
        failuresByReason: [],
        failuresByPaymentMethod: []
      }
    } catch (error) {
      console.error('Error getting payment failure analysis:', error)
      throw new Error('Failed to get payment failure analysis')
    }
  }
}