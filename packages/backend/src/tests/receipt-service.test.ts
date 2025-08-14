/**
 * Receipt Service Tests
 * Test suite for receipt generation and purchase history
 */

import { ReceiptService } from '../services/receipt-service'
import { PackageService } from '../services/package-service'
import { BaseModel } from '../models/base'

// Mock dependencies
jest.mock('../services/package-service')
jest.mock('../models/base')

const mockPackageService = PackageService as jest.Mocked<typeof PackageService>
const mockBaseModel = BaseModel as jest.Mocked<typeof BaseModel>

describe('ReceiptService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateReceipt', () => {
    it('should generate receipt successfully', async () => {
      const mockPackage = {
        id: 'pkg_test123',
        name: 'Test Package',
        description: 'A test package',
        resources: {
          projectVouchers: 1,
          facilitatorSeats: 2,
          storytellerSeats: 2
        }
      }

      const receiptData = {
        userId: 'user123',
        paymentIntentId: 'pi_test123',
        packageId: 'pkg_test123',
        amount: 9999,
        currency: 'USD',
        paymentMethod: 'card',
        metadata: { test: 'data' }
      }

      mockPackageService.getPackageById.mockResolvedValue(mockPackage as any)
      mockBaseModel.db = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue(undefined),
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(undefined)
      }) as any

      const result = await ReceiptService.generateReceipt(receiptData)

      expect(result.userId).toBe('user123')
      expect(result.paymentIntentId).toBe('pi_test123')
      expect(result.packageName).toBe('Test Package')
      expect(result.amount).toBe(9999)
      expect(result.currency).toBe('USD')
      expect(result.formattedAmount).toBe('$99.99')
      expect(result.resources).toEqual(mockPackage.resources)
      expect(result.downloadUrl).toContain('/api/receipts/')
      expect(result.emailSent).toBe(false)

      expect(mockPackageService.getPackageById).toHaveBeenCalledWith('pkg_test123')
    })

    it('should handle package not found error', async () => {
      mockPackageService.getPackageById.mockResolvedValue(null)

      const receiptData = {
        userId: 'user123',
        paymentIntentId: 'pi_test123',
        packageId: 'pkg_nonexistent',
        amount: 9999,
        currency: 'USD'
      }

      await expect(ReceiptService.generateReceipt(receiptData)).rejects.toThrow('Failed to generate receipt')
    })

    it('should handle database errors', async () => {
      const mockPackage = {
        id: 'pkg_test123',
        name: 'Test Package',
        description: 'A test package',
        resources: {}
      }

      mockPackageService.getPackageById.mockResolvedValue(mockPackage as any)
      mockBaseModel.db = jest.fn().mockReturnValue({
        insert: jest.fn().mockRejectedValue(new Error('Database error'))
      }) as any

      const receiptData = {
        userId: 'user123',
        paymentIntentId: 'pi_test123',
        packageId: 'pkg_test123',
        amount: 9999,
        currency: 'USD'
      }

      await expect(ReceiptService.generateReceipt(receiptData)).rejects.toThrow('Failed to generate receipt')
    })
  })

  describe('getPurchaseHistory', () => {
    it('should return purchase history with pagination', async () => {
      const mockReceipts = [
        {
          receipt_id: 'rcp_test123',
          purchase_date: new Date('2023-01-01'),
          package_name: 'Test Package',
          package_description: 'A test package',
          amount: 9999,
          currency: 'USD',
          payment_method: 'card',
          resources: JSON.stringify({ projectVouchers: 1 })
        }
      ]

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockReceipts),
        clone: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue([{ count: '1' }]),
        first: jest.fn().mockResolvedValue({ count: '1' })
      }

      mockBaseModel.db = jest.fn().mockReturnValue(mockQuery) as any

      const result = await ReceiptService.getPurchaseHistory('user123', {
        limit: 10,
        offset: 0
      })

      expect(result.receipts).toHaveLength(1)
      expect(result.receipts[0].receiptId).toBe('rcp_test123')
      expect(result.receipts[0].packageName).toBe('Test Package')
      expect(result.receipts[0].formattedAmount).toBe('$99.99')
      expect(result.pagination.total).toBe(1)
      expect(result.pagination.hasMore).toBe(false)
      expect(result.summary.totalSpent).toBe(9999)
      expect(result.summary.totalPurchases).toBe(1)
    })

    it('should handle date filtering', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([]),
        clone: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue([{ count: '0' }]),
        first: jest.fn().mockResolvedValue({ count: '0' })
      }

      mockBaseModel.db = jest.fn().mockReturnValue(mockQuery) as any

      await ReceiptService.getPurchaseHistory('user123', {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      })

      expect(mockQuery.where).toHaveBeenCalledWith('purchase_date', '>=', new Date('2023-01-01'))
      expect(mockQuery.where).toHaveBeenCalledWith('purchase_date', '<=', new Date('2023-12-31'))
    })

    it('should handle database errors', async () => {
      mockBaseModel.db = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockRejectedValue(new Error('Database error'))
      }) as any

      await expect(ReceiptService.getPurchaseHistory('user123')).rejects.toThrow('Failed to get purchase history')
    })
  })

  describe('getReceiptById', () => {
    it('should return receipt by ID', async () => {
      const mockReceipt = {
        receipt_id: 'rcp_test123',
        user_id: 'user123',
        payment_intent_id: 'pi_test123',
        package_id: 'pkg_test123',
        package_name: 'Test Package',
        package_description: 'A test package',
        amount: 9999,
        currency: 'USD',
        payment_method: 'card',
        resources: JSON.stringify({ projectVouchers: 1 }),
        metadata: JSON.stringify({ test: 'data' }),
        purchase_date: new Date('2023-01-01'),
        email_sent: false
      }

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockReceipt)
      }

      mockBaseModel.db = jest.fn().mockReturnValue(mockQuery) as any

      const result = await ReceiptService.getReceiptById('rcp_test123', 'user123')

      expect(result).toBeTruthy()
      expect(result!.receiptId).toBe('rcp_test123')
      expect(result!.userId).toBe('user123')
      expect(result!.packageName).toBe('Test Package')
      expect(result!.formattedAmount).toBe('$99.99')
      expect(result!.resources).toEqual({ projectVouchers: 1 })
      expect(result!.metadata).toEqual({ test: 'data' })

      expect(mockQuery.where).toHaveBeenCalledWith('receipt_id', 'rcp_test123')
      expect(mockQuery.where).toHaveBeenCalledWith('user_id', 'user123')
    })

    it('should return null when receipt not found', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      }

      mockBaseModel.db = jest.fn().mockReturnValue(mockQuery) as any

      const result = await ReceiptService.getReceiptById('rcp_nonexistent', 'user123')

      expect(result).toBeNull()
    })

    it('should work without user ID filter', async () => {
      const mockReceipt = {
        receipt_id: 'rcp_test123',
        user_id: 'user123',
        package_name: 'Test Package',
        amount: 9999,
        currency: 'USD',
        resources: JSON.stringify({}),
        metadata: JSON.stringify({})
      }

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockReceipt)
      }

      mockBaseModel.db = jest.fn().mockReturnValue(mockQuery) as any

      await ReceiptService.getReceiptById('rcp_test123')

      expect(mockQuery.where).toHaveBeenCalledWith('receipt_id', 'rcp_test123')
      expect(mockQuery.where).not.toHaveBeenCalledWith('user_id', expect.anything())
    })
  })

  describe('generatePDFReceipt', () => {
    it('should generate PDF receipt', async () => {
      const mockReceipt = {
        receiptId: 'rcp_test123',
        purchaseDate: new Date('2023-01-01'),
        packageName: 'Test Package',
        packageDescription: 'A test package',
        formattedAmount: '$99.99',
        paymentMethod: 'card',
        paymentIntentId: 'pi_test123',
        resources: {
          projectVouchers: 1,
          facilitatorSeats: 2,
          storytellerSeats: 2
        }
      }

      // Mock getReceiptById
      jest.spyOn(ReceiptService, 'getReceiptById').mockResolvedValue(mockReceipt as any)

      const result = await ReceiptService.generatePDFReceipt('rcp_test123')

      expect(result).toBeInstanceOf(Buffer)
      expect(result.toString()).toContain('SAGA FAMILY BIOGRAPHY')
      expect(result.toString()).toContain('PURCHASE RECEIPT')
      expect(result.toString()).toContain('rcp_test123')
      expect(result.toString()).toContain('Test Package')
      expect(result.toString()).toContain('$99.99')
    })

    it('should handle receipt not found', async () => {
      jest.spyOn(ReceiptService, 'getReceiptById').mockResolvedValue(null)

      await expect(ReceiptService.generatePDFReceipt('rcp_nonexistent')).rejects.toThrow('Failed to generate PDF receipt')
    })
  })

  describe('formatCurrency', () => {
    it('should format USD currency correctly', () => {
      // Access private method through any
      const formatCurrency = (ReceiptService as any).formatCurrency

      expect(formatCurrency(9999, 'USD')).toBe('$99.99')
      expect(formatCurrency(1000, 'USD')).toBe('$10.00')
      expect(formatCurrency(50, 'USD')).toBe('$0.50')
    })

    it('should format EUR currency correctly', () => {
      const formatCurrency = (ReceiptService as any).formatCurrency

      expect(formatCurrency(9999, 'EUR')).toBe('€99.99')
    })
  })

  describe('generateReceiptText', () => {
    it('should generate formatted receipt text', () => {
      const mockReceipt = {
        receiptId: 'rcp_test123',
        purchaseDate: new Date('2023-01-01T12:00:00Z'),
        packageName: 'Test Package',
        packageDescription: 'A test package',
        formattedAmount: '$99.99',
        paymentMethod: 'card',
        paymentIntentId: 'pi_test123',
        resources: {
          projectVouchers: 1,
          facilitatorSeats: 2,
          storytellerSeats: 2
        }
      }

      // Access private method
      const generateReceiptText = (ReceiptService as any).generateReceiptText

      const result = generateReceiptText(mockReceipt)

      expect(result).toContain('SAGA FAMILY BIOGRAPHY')
      expect(result).toContain('PURCHASE RECEIPT')
      expect(result).toContain('Receipt ID: rcp_test123')
      expect(result).toContain('Package: Test Package')
      expect(result).toContain('Description: A test package')
      expect(result).toContain('Amount: $99.99')
      expect(result).toContain('Payment Method: card')
      expect(result).toContain('Payment ID: pi_test123')
      expect(result).toContain('Project Vouchers: 1')
      expect(result).toContain('Facilitator Seats: 2')
      expect(result).toContain('Storyteller Seats: 2')
      expect(result).toContain('Thank you for choosing Saga Family Biography!')
    })
  })
})