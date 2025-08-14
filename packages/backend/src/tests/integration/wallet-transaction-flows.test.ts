/**
 * Wallet Transaction Flows Integration Tests
 * End-to-end tests for wallet operations with real database interactions
 */

import { ResourceWalletService } from '../../services/resource-wallet-service'
import { ResourceWalletModel } from '../../models/resource-wallet'
import { SeatTransactionModel } from '../../models/seat-transaction'
import { UserModel } from '../../models/user'
import { ProjectModel } from '../../models/project'
import { BaseModel } from '../../models/base'
import type { 
  User,
  Project,
  UserResourceWallet
} from '@saga/shared/types'

describe('Wallet Transaction Flows Integration', () => {
  let testUser: User
  let testProject: Project
  let testWallet: UserResourceWallet

  beforeAll(async () => {
    // Setup test database connection
    await BaseModel.db.migrate.latest()
  })

  beforeEach(async () => {
    // Clean up database
    await BaseModel.db('seat_transactions').del()
    await BaseModel.db('user_resource_wallets').del()
    await BaseModel.db('projects').del()
    await BaseModel.db('users').del()

    // Create test user
    testUser = await UserModel.create({
      email: 'test@example.com',
      name: 'Test User',
      authProvider: 'email',
      authProviderId: 'test-auth-id'
    })

    // Create test wallet with initial resources
    testWallet = await ResourceWalletService.createWallet({
      userId: testUser.id,
      projectVouchers: 5,
      facilitatorSeats: 3,
      storytellerSeats: 2
    })

    // Create test project
    testProject = await ProjectModel.create({
      name: 'Test Project',
      description: 'Test project for integration tests',
      facilitatorId: testUser.id
    })
  })

  afterAll(async () => {
    // Clean up and close database connection
    await BaseModel.db('seat_transactions').del()
    await BaseModel.db('user_resource_wallets').del()
    await BaseModel.db('projects').del()
    await BaseModel.db('users').del()
    await BaseModel.db.destroy()
  })

  describe('Project Creation Flow', () => {
    it('should consume project voucher when creating project', async () => {
      const initialBalance = await ResourceWalletService.getWalletBalance(testUser.id)
      expect(initialBalance.projectVouchers).toBe(5)

      // Consume project voucher
      const result = await ResourceWalletService.consumeProjectVoucher(testUser.id, testProject.id)

      expect(result.success).toBe(true)
      expect(result.remainingBalance).toBe(4)

      // Verify balance is updated
      const updatedBalance = await ResourceWalletService.getWalletBalance(testUser.id)
      expect(updatedBalance.projectVouchers).toBe(4)

      // Verify transaction is logged
      const transactions = await ResourceWalletService.getTransactionHistory(testUser.id)
      expect(transactions.length).toBeGreaterThan(0)
      
      const consumptionTransaction = transactions.find(t => t.transactionType === 'consume')
      expect(consumptionTransaction).toBeDefined()
      expect(consumptionTransaction?.resourceType).toBe('project_voucher')
      expect(consumptionTransaction?.amount).toBe(-1)
    })

    it('should fail when insufficient vouchers', async () => {
      // Consume all project vouchers
      for (let i = 0; i < 5; i++) {
        await ResourceWalletService.consumeProjectVoucher(testUser.id, `project-${i}`)
      }

      // Try to consume another voucher
      const result = await ResourceWalletService.consumeProjectVoucher(testUser.id, 'new-project')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Insufficient project_voucher')

      // Verify balance remains at 0
      const balance = await ResourceWalletService.getWalletBalance(testUser.id)
      expect(balance.projectVouchers).toBe(0)
    })
  })

  describe('Invitation Flow', () => {
    it('should consume facilitator seat when inviting facilitator', async () => {
      const initialBalance = await ResourceWalletService.getWalletBalance(testUser.id)
      expect(initialBalance.facilitatorSeats).toBe(3)

      // Consume facilitator seat
      const result = await ResourceWalletService.consumeFacilitatorSeat(testUser.id, testProject.id)

      expect(result.success).toBe(true)
      expect(result.remainingBalance).toBe(2)

      // Verify balance is updated
      const updatedBalance = await ResourceWalletService.getWalletBalance(testUser.id)
      expect(updatedBalance.facilitatorSeats).toBe(2)
    })

    it('should refund seat when invitation is rejected', async () => {
      // First consume a facilitator seat
      await ResourceWalletService.consumeFacilitatorSeat(testUser.id, testProject.id)
      
      const balanceAfterConsumption = await ResourceWalletService.getWalletBalance(testUser.id)
      expect(balanceAfterConsumption.facilitatorSeats).toBe(2)

      // Refund the seat
      const refundResult = await ResourceWalletService.refundResources(
        testUser.id,
        'facilitator_seat',
        1,
        'Invitation rejected',
        testProject.id
      )

      expect(refundResult.success).toBe(true)
      expect(refundResult.remainingBalance).toBe(3)

      // Verify balance is restored
      const finalBalance = await ResourceWalletService.getWalletBalance(testUser.id)
      expect(finalBalance.facilitatorSeats).toBe(3)
    })
  })

  describe('Package Purchase Flow', () => {
    it('should add resources when package is purchased', async () => {
      const initialBalance = await ResourceWalletService.getWalletBalance(testUser.id)

      // Add resources as if from package purchase
      const addResult = await ResourceWalletService.addResources(
        testUser.id,
        'project_voucher',
        2,
        'purchase',
        'Saga Package Purchase'
      )

      expect(addResult.success).toBe(true)
      expect(addResult.remainingBalance).toBe(7) // 5 + 2

      // Verify balance is updated
      const updatedBalance = await ResourceWalletService.getWalletBalance(testUser.id)
      expect(updatedBalance.projectVouchers).toBe(7)
    })

    it('should handle multiple resource additions in package purchase', async () => {
      // Simulate full package purchase
      await Promise.all([
        ResourceWalletService.addResources(testUser.id, 'project_voucher', 1, 'purchase', 'Package: Project Voucher'),
        ResourceWalletService.addResources(testUser.id, 'facilitator_seat', 2, 'purchase', 'Package: Facilitator Seats'),
        ResourceWalletService.addResources(testUser.id, 'storyteller_seat', 2, 'purchase', 'Package: Storyteller Seats')
      ])

      // Verify all balances are updated
      const updatedBalance = await ResourceWalletService.getWalletBalance(testUser.id)
      expect(updatedBalance.projectVouchers).toBe(6) // 5 + 1
      expect(updatedBalance.facilitatorSeats).toBe(5) // 3 + 2
      expect(updatedBalance.storytellerSeats).toBe(4) // 2 + 2
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent resource consumption correctly', async () => {
      // Create multiple concurrent consumption requests
      const consumptionPromises = Array.from({ length: 3 }, (_, i) => 
        ResourceWalletService.consumeProjectVoucher(testUser.id, `project-${i}`)
      )

      const results = await Promise.all(consumptionPromises)

      // All should succeed since we have 5 vouchers
      results.forEach(result => {
        expect(result.success).toBe(true)
      })

      // Final balance should be 2 (5 - 3)
      const finalBalance = await ResourceWalletService.getWalletBalance(testUser.id)
      expect(finalBalance.projectVouchers).toBe(2)
    })

    it('should handle concurrent operations with insufficient resources', async () => {
      // First consume 4 vouchers to leave only 1
      for (let i = 0; i < 4; i++) {
        await ResourceWalletService.consumeProjectVoucher(testUser.id, `setup-project-${i}`)
      }

      // Now try to consume 2 vouchers concurrently (should fail for one)
      const consumptionPromises = [
        ResourceWalletService.consumeProjectVoucher(testUser.id, 'concurrent-project-1'),
        ResourceWalletService.consumeProjectVoucher(testUser.id, 'concurrent-project-2')
      ]

      const results = await Promise.all(consumptionPromises)

      // One should succeed, one should fail
      const successCount = results.filter(r => r.success).length
      const failureCount = results.filter(r => !r.success).length

      expect(successCount).toBe(1)
      expect(failureCount).toBe(1)

      // Final balance should be 0
      const finalBalance = await ResourceWalletService.getWalletBalance(testUser.id)
      expect(finalBalance.projectVouchers).toBe(0)
    })
  })

  describe('Transaction History', () => {
    it('should provide accurate transaction history with filtering', async () => {
      // Perform various operations
      await ResourceWalletService.consumeProjectVoucher(testUser.id, testProject.id)
      await ResourceWalletService.consumeFacilitatorSeat(testUser.id, testProject.id)
      await ResourceWalletService.addResources(testUser.id, 'project_voucher', 1, 'purchase', 'Test purchase')

      // Get all transactions
      const allTransactions = await ResourceWalletService.getTransactionHistory(testUser.id)
      expect(allTransactions.length).toBeGreaterThan(0)

      // Get limited transactions
      const limitedTransactions = await ResourceWalletService.getTransactionHistory(testUser.id, {
        limit: 2
      })
      expect(limitedTransactions.length).toBeLessThanOrEqual(2)
    })

    it('should provide accurate wallet statistics', async () => {
      // Perform some operations
      await ResourceWalletService.consumeProjectVoucher(testUser.id, testProject.id)
      await ResourceWalletService.consumeFacilitatorSeat(testUser.id, testProject.id)

      const stats = await ResourceWalletService.getWalletStats(testUser.id)

      expect(stats.currentBalance).toEqual({
        projectVouchers: 4, // 5 - 1
        facilitatorSeats: 2, // 3 - 1
        storytellerSeats: 2  // unchanged
      })

      expect(stats.totalValue).toBeGreaterThan(0)
      expect(stats.recentTransactions).toBeDefined()
      expect(Array.isArray(stats.recentTransactions)).toBe(true)
      expect(stats.createdAt).toBeDefined()
      expect(stats.lastUpdated).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent wallet gracefully', async () => {
      // Create a user without a wallet
      const userWithoutWallet = await UserModel.create({
        email: 'nowallet@example.com',
        name: 'No Wallet User',
        authProvider: 'email',
        authProviderId: 'no-wallet-auth-id'
      })

      const result = await ResourceWalletService.consumeProjectVoucher(userWithoutWallet.id, testProject.id)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Wallet not found')
    })

    it('should validate resource types and amounts', async () => {
      // Test validation methods
      expect(ResourceWalletService.validateResourceType('project_voucher')).toBe(true)
      expect(ResourceWalletService.validateResourceType('invalid_type')).toBe(false)
      expect(ResourceWalletService.validateAmount(1)).toBe(true)
      expect(ResourceWalletService.validateAmount(0)).toBe(false)
      expect(ResourceWalletService.validateAmount(-1)).toBe(false)
      expect(ResourceWalletService.validateAmount(1.5)).toBe(false)
    })
  })

  describe('Wallet Synchronization', () => {
    it('should maintain consistency across multiple operations', async () => {
      // Perform a series of operations
      await ResourceWalletService.consumeProjectVoucher(testUser.id, 'project-1')
      await ResourceWalletService.consumeFacilitatorSeat(testUser.id, 'project-1')
      await ResourceWalletService.addResources(testUser.id, 'project_voucher', 1, 'purchase', 'Test')
      await ResourceWalletService.consumeStorytellerSeat(testUser.id, 'project-1')
      await ResourceWalletService.refundResources(testUser.id, 'facilitator_seat', 1, 'Refund test', 'project-1')

      // Verify final state
      const finalBalance = await ResourceWalletService.getWalletBalance(testUser.id)
      expect(finalBalance.projectVouchers).toBe(5) // 5 - 1 + 1 = 5
      expect(finalBalance.facilitatorSeats).toBe(3) // 3 - 1 + 1 = 3
      expect(finalBalance.storytellerSeats).toBe(1) // 2 - 1 = 1

      // Verify all transactions are recorded
      const allTransactions = await ResourceWalletService.getTransactionHistory(testUser.id)
      expect(allTransactions.length).toBeGreaterThan(5)
    })
  })
})