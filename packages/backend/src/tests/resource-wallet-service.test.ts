/**
 * Resource Wallet Service Tests
 * Comprehensive unit tests for wallet operations with mocked dependencies
 */

import { ResourceWalletService } from '../services/resource-wallet-service'
import { ResourceWalletModel } from '../models/resource-wallet'
import { SeatTransactionModel } from '../models/seat-transaction'
import type { 
  UserResourceWallet,
  ResourceConsumptionRequest,
  PackagePurchaseRequest,
  ResourceType,
  TransactionType
} from '@saga/shared/types'

// Mock dependencies
jest.mock('../models/resource-wallet')
jest.mock('../models/seat-transaction')

const mockResourceWalletModel = ResourceWalletModel as jest.Mocked<typeof ResourceWalletModel>
const mockSeatTransactionModel = SeatTransactionModel as jest.Mocked<typeof SeatTransactionModel>

// Mock database transaction
const mockTrx = {
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined)
}

// Mock BaseModel properly
class MockBaseModel {
  static db = {
    transaction: jest.fn()
  }
}

jest.mock('../models/base', () => ({
  BaseModel: MockBaseModel
}))

const mockDb = MockBaseModel.db

describe('ResourceWalletService', () => {
  const mockWallet: UserResourceWallet = {
    id: 'wallet-1',
    userId: 'user-1',
    projectVouchers: 2,
    facilitatorSeats: 3,
    storytellerSeats: 4,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const mockTransaction = {
    id: 'transaction-1',
    userId: 'user-1',
    transactionType: 'consume' as const,
    resourceType: 'project_voucher' as const,
    amount: -1,
    description: 'Test transaction',
    createdAt: new Date()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mocks
    mockResourceWalletModel.findByUserId.mockResolvedValue(mockWallet)
    mockResourceWalletModel.create.mockResolvedValue(mockWallet)
    mockResourceWalletModel.update.mockResolvedValue(mockWallet)
    mockSeatTransactionModel.create.mockResolvedValue(mockTransaction)
    mockSeatTransactionModel.findByUserId.mockResolvedValue([mockTransaction])
    
    // Reset transaction mocks
    mockTrx.commit.mockClear()
    mockTrx.rollback.mockClear()
    mockDb.transaction.mockResolvedValue(mockTrx)
  })

  describe('createWallet', () => {
    it('should create a new wallet successfully', async () => {
      const input = {
        userId: 'user-1',
        projectVouchers: 1,
        facilitatorSeats: 2,
        storytellerSeats: 2
      }

      const result = await ResourceWalletService.createWallet(input)

      expect(result).toEqual(mockWallet)
      expect(mockResourceWalletModel.create).toHaveBeenCalledWith(input)
      expect(mockSeatTransactionModel.create).toHaveBeenCalledTimes(3) // One for each resource type
    })

    it('should handle wallet creation errors', async () => {
      mockResourceWalletModel.create.mockRejectedValue(new Error('Database error'))

      await expect(
        ResourceWalletService.createWallet({ userId: 'user-1' })
      ).rejects.toThrow('Failed to create resource wallet')
    })
  })

  describe('getOrCreateWallet', () => {
    it('should return existing wallet', async () => {
      const result = await ResourceWalletService.getOrCreateWallet('user-1')

      expect(result).toEqual(mockWallet)
      expect(mockResourceWalletModel.findByUserId).toHaveBeenCalledWith('user-1')
      expect(mockResourceWalletModel.create).not.toHaveBeenCalled()
    })

    it('should create wallet if it does not exist', async () => {
      mockResourceWalletModel.findByUserId.mockResolvedValue(null)

      const result = await ResourceWalletService.getOrCreateWallet('user-1')

      expect(result).toEqual(mockWallet)
      expect(mockResourceWalletModel.create).toHaveBeenCalledWith({
        userId: 'user-1',
        projectVouchers: 0,
        facilitatorSeats: 0,
        storytellerSeats: 0
      })
    })
  })

  describe('getWalletBalance', () => {
    it('should return wallet balance with calculated total value', async () => {
      const result = await ResourceWalletService.getWalletBalance('user-1')

      expect(result).toEqual({
        projectVouchers: 2,
        facilitatorSeats: 3,
        storytellerSeats: 4,
        totalValue: expect.any(Number)
      })
    })
  })

  describe('hasSufficientResources', () => {
    it('should return true when user has sufficient project vouchers', async () => {
      const result = await ResourceWalletService.hasSufficientResources(
        'user-1',
        'project_voucher',
        1
      )

      expect(result).toBe(true)
    })

    it('should return false when user has insufficient project vouchers', async () => {
      const result = await ResourceWalletService.hasSufficientResources(
        'user-1',
        'project_voucher',
        5
      )

      expect(result).toBe(false)
    })

    it('should return true when user has sufficient facilitator seats', async () => {
      const result = await ResourceWalletService.hasSufficientResources(
        'user-1',
        'facilitator_seat',
        2
      )

      expect(result).toBe(true)
    })

    it('should return false when user has insufficient storyteller seats', async () => {
      const result = await ResourceWalletService.hasSufficientResources(
        'user-1',
        'storyteller_seat',
        10
      )

      expect(result).toBe(false)
    })

    it('should handle errors gracefully', async () => {
      mockResourceWalletModel.findByUserId.mockRejectedValue(new Error('Database error'))

      const result = await ResourceWalletService.hasSufficientResources(
        'user-1',
        'project_voucher',
        1
      )

      expect(result).toBe(false)
    })
  })

  describe('consumeResources', () => {
    beforeEach(() => {
      mockDb.transaction.mockResolvedValue(mockTrx)
      mockResourceWalletModel.findByUserId.mockResolvedValue(mockWallet)
      mockResourceWalletModel.update.mockResolvedValue({
        ...mockWallet,
        projectVouchers: 1
      })
    })

    it('should consume resources successfully', async () => {
      const request: ResourceConsumptionRequest = {
        userId: 'user-1',
        resourceType: 'project_voucher',
        amount: 1,
        description: 'Project creation'
      }

      const result = await ResourceWalletService.consumeResources(request)

      expect(result.success).toBe(true)
      expect(result.remainingBalance).toBe(1)
      expect(result.transactionId).toBe('transaction-1')
      expect(mockTrx.commit).toHaveBeenCalled()
    })

    it('should fail when wallet not found', async () => {
      mockResourceWalletModel.findByUserId.mockResolvedValue(null)

      const request: ResourceConsumptionRequest = {
        userId: 'user-1',
        resourceType: 'project_voucher',
        amount: 1
      }

      const result = await ResourceWalletService.consumeResources(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Wallet not found')
      expect(mockTrx.rollback).toHaveBeenCalled()
    })

    it('should fail when insufficient resources', async () => {
      const request: ResourceConsumptionRequest = {
        userId: 'user-1',
        resourceType: 'project_voucher',
        amount: 10 // More than available
      }

      const result = await ResourceWalletService.consumeResources(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Insufficient project_voucher')
      expect(mockTrx.rollback).toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      mockResourceWalletModel.update.mockRejectedValue(new Error('Database error'))

      const request: ResourceConsumptionRequest = {
        userId: 'user-1',
        resourceType: 'project_voucher',
        amount: 1
      }

      const result = await ResourceWalletService.consumeResources(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to consume resources')
      expect(mockTrx.rollback).toHaveBeenCalled()
    })
  })

  describe('addResources', () => {
    beforeEach(() => {
      mockDb.transaction.mockResolvedValue(mockTrx)
      mockResourceWalletModel.update.mockResolvedValue({
        ...mockWallet,
        projectVouchers: 3
      })
    })

    it('should add resources successfully', async () => {
      const result = await ResourceWalletService.addResources(
        'user-1',
        'project_voucher',
        1,
        'purchase',
        'Package purchase'
      )

      expect(result.success).toBe(true)
      expect(result.remainingBalance).toBe(3)
      expect(result.transactionId).toBe('transaction-1')
      expect(mockTrx.commit).toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      mockResourceWalletModel.update.mockRejectedValue(new Error('Database error'))

      const result = await ResourceWalletService.addResources(
        'user-1',
        'project_voucher',
        1
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to add resources')
      expect(mockTrx.rollback).toHaveBeenCalled()
    })
  })

  describe('purchasePackage', () => {
    it('should process package purchase successfully', async () => {
      // Mock successful payment processing
      jest.spyOn(ResourceWalletService as any, 'processPayment').mockResolvedValue({
        success: true,
        transactionId: 'payment-123'
      })

      jest.spyOn(ResourceWalletService as any, 'getPackageDetails').mockResolvedValue({
        id: 'saga-package-v1',
        name: 'The Saga Package',
        price: 99.00,
        currency: 'USD',
        resources: {
          projectVouchers: 1,
          facilitatorSeats: 2,
          storytellerSeats: 2
        }
      })

      // Mock successful resource additions
      jest.spyOn(ResourceWalletService, 'addResources')
        .mockResolvedValue({
          success: true,
          remainingBalance: 1,
          transactionId: 'transaction-1'
        })

      const request: PackagePurchaseRequest = {
        packageId: 'saga-package-v1',
        userId: 'user-1'
      }

      const result = await ResourceWalletService.purchasePackage(request)

      expect(result.success).toBe(true)
      expect(result.transactionId).toBe('payment-123')
      expect(result.walletBalance).toBeDefined()
    })

    it('should fail when package not found', async () => {
      jest.spyOn(ResourceWalletService as any, 'getPackageDetails').mockResolvedValue(null)

      const request: PackagePurchaseRequest = {
        packageId: 'invalid-package',
        userId: 'user-1'
      }

      const result = await ResourceWalletService.purchasePackage(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Package not found')
    })

    it('should fail when payment processing fails', async () => {
      jest.spyOn(ResourceWalletService as any, 'getPackageDetails').mockResolvedValue({
        id: 'saga-package-v1',
        name: 'The Saga Package',
        price: 99.00,
        currency: 'USD',
        resources: {
          projectVouchers: 1,
          facilitatorSeats: 2,
          storytellerSeats: 2
        }
      })

      jest.spyOn(ResourceWalletService as any, 'processPayment').mockResolvedValue({
        success: false,
        error: 'Payment failed'
      })

      const request: PackagePurchaseRequest = {
        packageId: 'saga-package-v1',
        userId: 'user-1'
      }

      const result = await ResourceWalletService.purchasePackage(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Payment failed')
    })
  })

  describe('refundResources', () => {
    it('should process refund successfully', async () => {
      jest.spyOn(ResourceWalletService, 'addResources').mockResolvedValue({
        success: true,
        remainingBalance: 3,
        transactionId: 'refund-1'
      })

      const result = await ResourceWalletService.refundResources(
        'user-1',
        'project_voucher',
        1,
        'Failed invitation refund',
        'project-1'
      )

      expect(result.success).toBe(true)
      expect(result.remainingBalance).toBe(3)
      expect(ResourceWalletService.addResources).toHaveBeenCalledWith(
        'user-1',
        'project_voucher',
        1,
        'refund',
        'Failed invitation refund',
        'project-1'
      )
    })
  })

  describe('getTransactionHistory', () => {
    it('should return transaction history', async () => {
      const mockHistory = [mockTransaction]
      mockSeatTransactionModel.findByUserId.mockResolvedValue(mockHistory)

      const result = await ResourceWalletService.getTransactionHistory('user-1')

      expect(result).toEqual(mockHistory)
      expect(mockSeatTransactionModel.findByUserId).toHaveBeenCalledWith('user-1', {})
    })

    it('should pass options to transaction model', async () => {
      const options = {
        limit: 10,
        offset: 0,
        resourceType: 'project_voucher' as const
      }

      await ResourceWalletService.getTransactionHistory('user-1', options)

      expect(mockSeatTransactionModel.findByUserId).toHaveBeenCalledWith('user-1', options)
    })
  })

  describe('getWalletStats', () => {
    it('should return wallet statistics', async () => {
      const mockHistory = [mockTransaction]
      mockSeatTransactionModel.findByUserId.mockResolvedValue(mockHistory)

      const result = await ResourceWalletService.getWalletStats('user-1')

      expect(result).toEqual({
        currentBalance: {
          projectVouchers: 2,
          facilitatorSeats: 3,
          storytellerSeats: 4
        },
        totalValue: expect.any(Number),
        recentTransactions: mockHistory,
        createdAt: mockWallet.createdAt,
        lastUpdated: mockWallet.updatedAt
      })
    })
  })

  describe('Utility methods', () => {
    describe('canCreateProject', () => {
      it('should return true when user has project vouchers', async () => {
        const result = await ResourceWalletService.canCreateProject('user-1')
        expect(result).toBe(true)
      })

      it('should return false when user has no project vouchers', async () => {
        mockResourceWalletModel.findByUserId.mockResolvedValue({
          ...mockWallet,
          projectVouchers: 0
        })

        const result = await ResourceWalletService.canCreateProject('user-1')
        expect(result).toBe(false)
      })
    })

    describe('canInviteFacilitator', () => {
      it('should return true when user has facilitator seats', async () => {
        const result = await ResourceWalletService.canInviteFacilitator('user-1')
        expect(result).toBe(true)
      })

      it('should return false when user has no facilitator seats', async () => {
        mockResourceWalletModel.findByUserId.mockResolvedValue({
          ...mockWallet,
          facilitatorSeats: 0
        })

        const result = await ResourceWalletService.canInviteFacilitator('user-1')
        expect(result).toBe(false)
      })
    })

    describe('canInviteStoryteller', () => {
      it('should return true when user has storyteller seats', async () => {
        const result = await ResourceWalletService.canInviteStoryteller('user-1')
        expect(result).toBe(true)
      })

      it('should return false when user has no storyteller seats', async () => {
        mockResourceWalletModel.findByUserId.mockResolvedValue({
          ...mockWallet,
          storytellerSeats: 0
        })

        const result = await ResourceWalletService.canInviteStoryteller('user-1')
        expect(result).toBe(false)
      })
    })
  })

  describe('Validation methods', () => {
    describe('validateResourceType', () => {
      it('should return true for valid resource types', () => {
        expect(ResourceWalletService.validateResourceType('project_voucher')).toBe(true)
        expect(ResourceWalletService.validateResourceType('facilitator_seat')).toBe(true)
        expect(ResourceWalletService.validateResourceType('storyteller_seat')).toBe(true)
      })

      it('should return false for invalid resource types', () => {
        expect(ResourceWalletService.validateResourceType('invalid_type')).toBe(false)
        expect(ResourceWalletService.validateResourceType('')).toBe(false)
      })
    })

    describe('validateTransactionType', () => {
      it('should return true for valid transaction types', () => {
        expect(ResourceWalletService.validateTransactionType('purchase')).toBe(true)
        expect(ResourceWalletService.validateTransactionType('consume')).toBe(true)
        expect(ResourceWalletService.validateTransactionType('refund')).toBe(true)
        expect(ResourceWalletService.validateTransactionType('grant')).toBe(true)
        expect(ResourceWalletService.validateTransactionType('expire')).toBe(true)
      })

      it('should return false for invalid transaction types', () => {
        expect(ResourceWalletService.validateTransactionType('invalid_type')).toBe(false)
        expect(ResourceWalletService.validateTransactionType('')).toBe(false)
      })
    })

    describe('validateAmount', () => {
      it('should return true for valid amounts', () => {
        expect(ResourceWalletService.validateAmount(1)).toBe(true)
        expect(ResourceWalletService.validateAmount(10)).toBe(true)
        expect(ResourceWalletService.validateAmount(100)).toBe(true)
      })

      it('should return false for invalid amounts', () => {
        expect(ResourceWalletService.validateAmount(0)).toBe(false)
        expect(ResourceWalletService.validateAmount(-1)).toBe(false)
        expect(ResourceWalletService.validateAmount(1.5)).toBe(false)
        expect(ResourceWalletService.validateAmount(NaN)).toBe(false)
      })
    })
  })

  describe('Error handling', () => {
    it('should handle database connection errors', async () => {
      mockResourceWalletModel.findByUserId.mockRejectedValue(new Error('Connection failed'))

      await expect(
        ResourceWalletService.getWallet('user-1')
      ).rejects.toThrow('Failed to get wallet')
    })

    it('should handle transaction rollback on errors', async () => {
      const localMockTrx = {
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined)
      }
      mockDb.transaction.mockResolvedValue(localMockTrx)
      mockResourceWalletModel.findByUserId.mockResolvedValue(mockWallet)
      mockResourceWalletModel.update.mockRejectedValue(new Error('Update failed'))

      const request: ResourceConsumptionRequest = {
        userId: 'user-1',
        resourceType: 'project_voucher',
        amount: 1
      }

      const result = await ResourceWalletService.consumeResources(request)

      expect(result.success).toBe(false)
      expect(localMockTrx.rollback).toHaveBeenCalled()
      expect(localMockTrx.commit).not.toHaveBeenCalled()
    })
  })

  describe('Concurrent operations', () => {
    it('should handle concurrent resource consumption', async () => {
      const mockTrx1 = {
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined)
      }
      const mockTrx2 = {
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined)
      }

      mockDb.transaction
        .mockResolvedValueOnce(mockTrx1)
        .mockResolvedValueOnce(mockTrx2)

      mockResourceWalletModel.findByUserId.mockResolvedValue(mockWallet)
      mockResourceWalletModel.update
        .mockResolvedValueOnce({ ...mockWallet, projectVouchers: 1 })
        .mockResolvedValueOnce({ ...mockWallet, projectVouchers: 0 })

      const request1: ResourceConsumptionRequest = {
        userId: 'user-1',
        resourceType: 'project_voucher',
        amount: 1
      }

      const request2: ResourceConsumptionRequest = {
        userId: 'user-1',
        resourceType: 'project_voucher',
        amount: 1
      }

      const [result1, result2] = await Promise.all([
        ResourceWalletService.consumeResources(request1),
        ResourceWalletService.consumeResources(request2)
      ])

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(mockTrx1.commit).toHaveBeenCalled()
      expect(mockTrx2.commit).toHaveBeenCalled()
    })
  })
})