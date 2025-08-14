/**
 * Receipt Service
 * Handles receipt generation and purchase history management
 */

import { BaseModel } from '../models/base'
import { PackageService } from './package-service'
import type { 
  PurchaseReceipt, 
  PurchaseHistory, 
  ReceiptData,
  PurchaseTransaction 
} from '@saga/shared/types'

export class ReceiptService {
  /**
   * Generate receipt for successful purchase
   */
  static async generateReceipt(data: {
    userId: string
    paymentIntentId: string
    packageId: string
    amount: number
    currency: string
    paymentMethod?: string
    metadata?: any
  }): Promise<PurchaseReceipt> {
    try {
      const packageInfo = await PackageService.getPackageById(data.packageId)
      if (!packageInfo) {
        throw new Error('Package not found')
      }

      const receiptData: ReceiptData = {
        receiptId: `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        purchaseDate: new Date(),
        userId: data.userId,
        paymentIntentId: data.paymentIntentId,
        packageId: data.packageId,
        packageName: packageInfo.name,
        packageDescription: packageInfo.description,
        amount: data.amount,
        currency: data.currency.toUpperCase(),
        paymentMethod: data.paymentMethod || 'card',
        resources: packageInfo.resources,
        metadata: data.metadata || {}
      }

      // Store receipt in database
      await this.storeReceipt(receiptData)

      // Generate formatted receipt
      const receipt: PurchaseReceipt = {
        ...receiptData,
        formattedAmount: this.formatCurrency(data.amount, data.currency),
        downloadUrl: `/api/receipts/${receiptData.receiptId}/download`,
        emailSent: false
      }

      // Send receipt email (async)
      this.sendReceiptEmail(receipt).catch(error => {
        console.error('Failed to send receipt email:', error)
      })

      return receipt
    } catch (error) {
      console.error('Error generating receipt:', error)
      throw new Error('Failed to generate receipt')
    }
  }

  /**
   * Store receipt in database
   */
  private static async storeReceipt(receiptData: ReceiptData): Promise<void> {
    await BaseModel.db('purchase_receipts').insert({
      receipt_id: receiptData.receiptId,
      user_id: receiptData.userId,
      payment_intent_id: receiptData.paymentIntentId,
      package_id: receiptData.packageId,
      package_name: receiptData.packageName,
      package_description: receiptData.packageDescription,
      amount: receiptData.amount,
      currency: receiptData.currency,
      payment_method: receiptData.paymentMethod,
      resources: JSON.stringify(receiptData.resources),
      metadata: JSON.stringify(receiptData.metadata),
      purchase_date: receiptData.purchaseDate,
      created_at: new Date(),
      updated_at: new Date()
    })
  }

  /**
   * Get purchase history for user
   */
  static async getPurchaseHistory(
    userId: string,
    options: {
      limit?: number
      offset?: number
      startDate?: Date
      endDate?: Date
    } = {}
  ): Promise<PurchaseHistory> {
    try {
      const { limit = 20, offset = 0, startDate, endDate } = options

      let query = BaseModel.db('purchase_receipts')
        .where('user_id', userId)
        .orderBy('purchase_date', 'desc')

      if (startDate) {
        query = query.where('purchase_date', '>=', startDate)
      }
      if (endDate) {
        query = query.where('purchase_date', '<=', endDate)
      }

      // Get total count
      const totalQuery = query.clone()
      const totalResult = await totalQuery.count('* as count').first()
      const total = parseInt(totalResult?.count as string) || 0

      // Get paginated results
      const receipts = await query
        .limit(limit)
        .offset(offset)
        .select('*')

      const formattedReceipts = receipts.map(receipt => ({
        receiptId: receipt.receipt_id,
        purchaseDate: receipt.purchase_date,
        packageName: receipt.package_name,
        packageDescription: receipt.package_description,
        amount: receipt.amount,
        currency: receipt.currency,
        formattedAmount: this.formatCurrency(receipt.amount, receipt.currency),
        paymentMethod: receipt.payment_method,
        resources: JSON.parse(receipt.resources || '{}'),
        downloadUrl: `/api/receipts/${receipt.receipt_id}/download`
      }))

      // Calculate summary statistics
      const totalSpent = receipts.reduce((sum, receipt) => sum + receipt.amount, 0)
      const totalPurchases = total

      return {
        receipts: formattedReceipts,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        },
        summary: {
          totalSpent,
          totalPurchases,
          formattedTotalSpent: this.formatCurrency(totalSpent, receipts[0]?.currency || 'USD')
        }
      }
    } catch (error) {
      console.error('Error getting purchase history:', error)
      throw new Error('Failed to get purchase history')
    }
  }

  /**
   * Get receipt by ID
   */
  static async getReceiptById(receiptId: string, userId?: string): Promise<PurchaseReceipt | null> {
    try {
      let query = BaseModel.db('purchase_receipts')
        .where('receipt_id', receiptId)

      if (userId) {
        query = query.where('user_id', userId)
      }

      const receipt = await query.first()
      if (!receipt) {
        return null
      }

      return {
        receiptId: receipt.receipt_id,
        purchaseDate: receipt.purchase_date,
        userId: receipt.user_id,
        paymentIntentId: receipt.payment_intent_id,
        packageId: receipt.package_id,
        packageName: receipt.package_name,
        packageDescription: receipt.package_description,
        amount: receipt.amount,
        currency: receipt.currency,
        formattedAmount: this.formatCurrency(receipt.amount, receipt.currency),
        paymentMethod: receipt.payment_method,
        resources: JSON.parse(receipt.resources || '{}'),
        metadata: JSON.parse(receipt.metadata || '{}'),
        downloadUrl: `/api/receipts/${receipt.receipt_id}/download`,
        emailSent: receipt.email_sent || false
      }
    } catch (error) {
      console.error('Error getting receipt:', error)
      return null
    }
  }

  /**
   * Generate PDF receipt
   */
  static async generatePDFReceipt(receiptId: string): Promise<Buffer> {
    try {
      const receipt = await this.getReceiptById(receiptId)
      if (!receipt) {
        throw new Error('Receipt not found')
      }

      // For now, return a simple text-based receipt
      // In production, you'd use a PDF library like puppeteer or pdfkit
      const receiptText = this.generateReceiptText(receipt)
      return Buffer.from(receiptText, 'utf-8')
    } catch (error) {
      console.error('Error generating PDF receipt:', error)
      throw new Error('Failed to generate PDF receipt')
    }
  }

  /**
   * Generate text receipt
   */
  private static generateReceiptText(receipt: PurchaseReceipt): string {
    const lines = [
      '='.repeat(50),
      '           SAGA FAMILY BIOGRAPHY',
      '              PURCHASE RECEIPT',
      '='.repeat(50),
      '',
      `Receipt ID: ${receipt.receiptId}`,
      `Date: ${receipt.purchaseDate.toLocaleDateString()}`,
      `Time: ${receipt.purchaseDate.toLocaleTimeString()}`,
      '',
      '-'.repeat(50),
      'PURCHASE DETAILS',
      '-'.repeat(50),
      '',
      `Package: ${receipt.packageName}`,
      `Description: ${receipt.packageDescription}`,
      '',
      'Resources Included:',
      `• Project Vouchers: ${receipt.resources.projectVouchers || 0}`,
      `• Facilitator Seats: ${receipt.resources.facilitatorSeats || 0}`,
      `• Storyteller Seats: ${receipt.resources.storytellerSeats || 0}`,
      '',
      '-'.repeat(50),
      'PAYMENT DETAILS',
      '-'.repeat(50),
      '',
      `Amount: ${receipt.formattedAmount}`,
      `Payment Method: ${receipt.paymentMethod}`,
      `Payment ID: ${receipt.paymentIntentId}`,
      '',
      '-'.repeat(50),
      '',
      'Thank you for choosing Saga Family Biography!',
      'Start creating your family stories today.',
      '',
      'Questions? Contact us at support@sagafamilybiography.com',
      '',
      '='.repeat(50)
    ]

    return lines.join('\n')
  }

  /**
   * Send receipt email
   */
  private static async sendReceiptEmail(receipt: PurchaseReceipt): Promise<void> {
    try {
      // TODO: Implement email sending
      // This would integrate with your email service (SendGrid, etc.)
      console.log(`Sending receipt email for ${receipt.receiptId}`)

      // Mark email as sent
      await BaseModel.db('purchase_receipts')
        .where('receipt_id', receipt.receiptId)
        .update({ 
          email_sent: true,
          email_sent_at: new Date(),
          updated_at: new Date()
        })
    } catch (error) {
      console.error('Error sending receipt email:', error)
      // Don't throw error - email failure shouldn't break receipt generation
    }
  }

  /**
   * Format currency amount
   */
  private static formatCurrency(amount: number, currency: string): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2
    })
    return formatter.format(amount / 100) // Convert from cents
  }
}