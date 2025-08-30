/**
 * Invitation Seat Reservation Integration Tests
 * Tests the complete invitation workflow with seat reservation and consumption
 */

import request from 'supertest'
import { app } from '../../index'
import { setupTestDatabase, cleanupTestDatabase } from '../setup'
import { UserModel } from '../../models/user'
import { ProjectModel } from '../../models/project'
import { InvitationModel } from '../../models/invitation'
import { ResourceWalletService } from '../../services/resource-wallet-service'
import { InvitationService } from '../../services/invitation-service'

describe('Invitation Seat Reservation Integration', () => {
  let facilitatorUser: any
  let storytellerUser: any
  let testProject: any
  let facilitatorToken: string
  let storytellerToken: string

  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(async () => {
    // Create facilitator user
    facilitatorUser = await UserModel.createUser({
      name: 'Facilitator User',
      email: 'facilitator@example.com',
      phone: '+1234567890'
    })

    // Create storyteller user
    storytellerUser = await UserModel.createUser({
      name: 'Storyteller User',
      email: 'storyteller@example.com',
      phone: '+1234567891'
    })

    // Create resource wallets
    await ResourceWalletService.createWallet({
      userId: facilitatorUser.id,
      projectVouchers: 2,
      facilitatorSeats: 3,
      storytellerSeats: 5
    })

    await ResourceWalletService.createWallet({
      userId: storytellerUser.id,
      projectVouchers: 0,
      facilitatorSeats: 0,
      storytellerSeats: 0
    })

    // Create test project
    testProject = await ProjectModel.createProject({
      name: 'Test Project',
      description: 'A test project for invitation testing',
      facilitatorId: facilitatorUser.id
    })

    // Generate auth tokens
    facilitatorToken = 'Bearer facilitator-token'
    storytellerToken = 'Bearer storyteller-token'
  })

  afterEach(async () => {
    // Clean up test data
    await UserModel.db('users').whereIn('id', [facilitatorUser.id, storytellerUser.id]).del()
    await ProjectModel.db('projects').where('id', testProject.id).del()
    await InvitationModel.db('invitations').where('project_id', testProject.id).del()
    await ResourceWalletService.db('user_resource_wallets').whereIn('user_id', [facilitatorUser.id, storytellerUser.id]).del()
    await ResourceWalletService.db('seat_transactions').whereIn('user_id', [facilitatorUser.id, storytellerUser.id]).del()
  })

  describe('Invitation Creation with Seat Reservation', () => {
    it('should create invitation and reserve facilitator seat', async () => {
      const response = await request(app)
        .post('/api/invitations')
        .set('Authorization', facilitatorToken)
        .send({
          projectId: testProject.id,
          role: 'facilitator',
          email: 'new-facilitator@example.com'
        })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.seatReserved).toBe(true)
      expect(response.body.data.expiresIn).toBe('72 hours')
      expect(response.body.message).toContain('seat reserved')

      // Verify invitation was created with seat reserved
      const invitation = response.body.data.invitation
      expect(invitation.seatReserved).toBe(true)
      expect(invitation.role).toBe('facilitator')
      expect(invitation.status).toBe('pending')

      // Verify facilitator still has seats (not consumed yet, only reserved)
      const walletBalance = await ResourceWalletService.getWalletBalance(facilitatorUser.id)
      expect(walletBalance.facilitatorSeats).toBe(3) // Should still be 3, not consumed yet
    })

    it('should create invitation and reserve storyteller seat', async () => {
      const response = await request(app)
        .post('/api/invitations')
        .set('Authorization', facilitatorToken)
        .send({
          projectId: testProject.id,
          role: 'storyteller',
          email: 'new-storyteller@example.com'
        })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.seatReserved).toBe(true)
      expect(response.body.data.invitation.role).toBe('storyteller')

      // Verify storyteller seats are still available (not consumed yet)
      const walletBalance = await ResourceWalletService.getWalletBalance(facilitatorUser.id)
      expect(walletBalance.storytellerSeats).toBe(5)
    })

    it('should fail to create invitation when insufficient seats', async () => {
      // Consume all facilitator seats first
      await ResourceWalletService.consumeResources({
        userId: facilitatorUser.id,
        resourceType: 'facilitator_seat',
        amount: 3,
        description: 'Test consumption'
      })

      const response = await request(app)
        .post('/api/invitations')
        .set('Authorization', facilitatorToken)
        .send({
          projectId: testProject.id,
          role: 'facilitator',
          email: 'new-facilitator@example.com'
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Insufficient facilitator seats')
    })
  })

  describe('Invitation Acceptance with Seat Consumption', () => {
    let testInvitation: any

    beforeEach(async () => {
      // Create a test invitation
      const result = await InvitationService.createInvitation(
        testProject.id,
        facilitatorUser.id,
        'storyteller',
        'test-storyteller@example.com'
      )
      testInvitation = result.invitation
    })

    it('should accept invitation and consume reserved seat', async () => {
      // Get initial wallet balance
      const initialBalance = await ResourceWalletService.getWalletBalance(facilitatorUser.id)
      expect(initialBalance.storytellerSeats).toBe(5)

      const response = await request(app)
        .post(`/api/invitations/${testInvitation.token}/accept`)
        .set('Authorization', storytellerToken)
        .send({
          name: 'New Storyteller',
          email: 'test-storyteller@example.com'
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.seatConsumed).toBe(true)
      expect(response.body.data.role).toBe('storyteller')
      expect(response.body.message).toContain('seat consumed')

      // Verify seat was consumed from facilitator's wallet
      const finalBalance = await ResourceWalletService.getWalletBalance(facilitatorUser.id)
      expect(finalBalance.storytellerSeats).toBe(4) // Should be reduced by 1

      // Verify invitation status updated
      const updatedInvitation = await InvitationModel.findById(testInvitation.id)
      expect(updatedInvitation.status).toBe('accepted')
      expect(updatedInvitation.usedAt).toBeDefined()
    })

    it('should handle acceptance by new user', async () => {
      const response = await request(app)
        .post(`/api/invitations/${testInvitation.token}/accept`)
        .send({
          name: 'Brand New User',
          email: 'brand-new@example.com'
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.seatConsumed).toBe(true)
      expect(response.body.data.userId).toBeDefined()
      expect(response.body.message).toContain('Account created')

      // Verify seat was consumed
      const finalBalance = await ResourceWalletService.getWalletBalance(facilitatorUser.id)
      expect(finalBalance.storytellerSeats).toBe(4)
    })

    it('should fail to accept expired invitation', async () => {
      // Manually expire the invitation
      await InvitationModel.update(testInvitation.id, {
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      })

      const response = await request(app)
        .post(`/api/invitations/${testInvitation.token}/accept`)
        .set('Authorization', storytellerToken)
        .send({
          name: 'New Storyteller',
          email: 'test-storyteller@example.com'
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid or expired invitation')

      // Verify seat was not consumed
      const finalBalance = await ResourceWalletService.getWalletBalance(facilitatorUser.id)
      expect(finalBalance.storytellerSeats).toBe(5) // Should remain unchanged
    })
  })

  describe('Invitation Cancellation with Seat Release', () => {
    let testInvitation: any

    beforeEach(async () => {
      // Create a test invitation
      const result = await InvitationService.createInvitation(
        testProject.id,
        facilitatorUser.id,
        'facilitator',
        'test-facilitator@example.com'
      )
      testInvitation = result.invitation
    })

    it('should cancel invitation and release reserved seat', async () => {
      // Get initial wallet balance
      const initialBalance = await ResourceWalletService.getWalletBalance(facilitatorUser.id)
      expect(initialBalance.facilitatorSeats).toBe(3)

      const response = await request(app)
        .delete(`/api/invitations/${testInvitation.id}/cancel`)
        .set('Authorization', facilitatorToken)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.seatReleased).toBe(true)
      expect(response.body.message).toContain('cancelled and seat released')

      // Verify seat was released back to facilitator's wallet
      const finalBalance = await ResourceWalletService.getWalletBalance(facilitatorUser.id)
      expect(finalBalance.facilitatorSeats).toBe(3) // Should remain the same since seat was released

      // Verify invitation status updated
      const updatedInvitation = await InvitationModel.findById(testInvitation.id)
      expect(updatedInvitation.status).toBe('cancelled')
      expect(updatedInvitation.cancelledAt).toBeDefined()
    })

    it('should handle cancellation of already accepted invitation', async () => {
      // Accept the invitation first
      await InvitationService.acceptInvitation(
        testInvitation.token,
        storytellerUser.id,
        'Accepted User',
        'accepted@example.com'
      )

      const response = await request(app)
        .delete(`/api/invitations/${testInvitation.id}/cancel`)
        .set('Authorization', facilitatorToken)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Cannot cancel an already accepted invitation')
    })
  })

  describe('Multiple Invitations and Seat Management', () => {
    it('should handle multiple simultaneous invitations correctly', async () => {
      const initialBalance = await ResourceWalletService.getWalletBalance(facilitatorUser.id)
      expect(initialBalance.facilitatorSeats).toBe(3)

      // Create multiple invitations simultaneously
      const invitationPromises = [
        request(app)
          .post('/api/invitations')
          .set('Authorization', facilitatorToken)
          .send({
            projectId: testProject.id,
            role: 'facilitator',
            email: 'facilitator1@example.com'
          }),
        request(app)
          .post('/api/invitations')
          .set('Authorization', facilitatorToken)
          .send({
            projectId: testProject.id,
            role: 'facilitator',
            email: 'facilitator2@example.com'
          }),
        request(app)
          .post('/api/invitations')
          .set('Authorization', facilitatorToken)
          .send({
            projectId: testProject.id,
            role: 'facilitator',
            email: 'facilitator3@example.com'
          })
      ]

      const responses = await Promise.all(invitationPromises)

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201)
        expect(response.body.success).toBe(true)
        expect(response.body.data.seatReserved).toBe(true)
      })

      // Verify all seats are still available (not consumed yet, only reserved)
      const finalBalance = await ResourceWalletService.getWalletBalance(facilitatorUser.id)
      expect(finalBalance.facilitatorSeats).toBe(3)
    })

    it('should fail when trying to create more invitations than available seats', async () => {
      // Consume 2 facilitator seats first
      await ResourceWalletService.consumeResources({
        userId: facilitatorUser.id,
        resourceType: 'facilitator_seat',
        amount: 2,
        description: 'Test consumption'
      })

      // Now only 1 seat available, try to create 2 invitations
      const response1 = await request(app)
        .post('/api/invitations')
        .set('Authorization', facilitatorToken)
        .send({
          projectId: testProject.id,
          role: 'facilitator',
          email: 'facilitator1@example.com'
        })
        .expect(201)

      expect(response1.body.success).toBe(true)

      // Second invitation should fail
      const response2 = await request(app)
        .post('/api/invitations')
        .set('Authorization', facilitatorToken)
        .send({
          projectId: testProject.id,
          role: 'facilitator',
          email: 'facilitator2@example.com'
        })
        .expect(400)

      expect(response2.body.success).toBe(false)
      expect(response2.body.error).toContain('Insufficient facilitator seats')
    })
  })

  describe('Cross-Role Invitation Management', () => {
    it('should handle mixed facilitator and storyteller invitations', async () => {
      const initialBalance = await ResourceWalletService.getWalletBalance(facilitatorUser.id)
      expect(initialBalance.facilitatorSeats).toBe(3)
      expect(initialBalance.storytellerSeats).toBe(5)

      // Create facilitator invitation
      const facilitatorResponse = await request(app)
        .post('/api/invitations')
        .set('Authorization', facilitatorToken)
        .send({
          projectId: testProject.id,
          role: 'facilitator',
          email: 'new-facilitator@example.com'
        })
        .expect(201)

      // Create storyteller invitation
      const storytellerResponse = await request(app)
        .post('/api/invitations')
        .set('Authorization', facilitatorToken)
        .send({
          projectId: testProject.id,
          role: 'storyteller',
          email: 'new-storyteller@example.com'
        })
        .expect(201)

      expect(facilitatorResponse.body.data.seatReserved).toBe(true)
      expect(storytellerResponse.body.data.seatReserved).toBe(true)

      // Verify seats are still available (reserved but not consumed)
      const finalBalance = await ResourceWalletService.getWalletBalance(facilitatorUser.id)
      expect(finalBalance.facilitatorSeats).toBe(3)
      expect(finalBalance.storytellerSeats).toBe(5)
    })
  })

  describe('Audit Trail and Transaction Logging', () => {
    it('should log all seat transactions correctly', async () => {
      // Create invitation
      const invitationResponse = await request(app)
        .post('/api/invitations')
        .set('Authorization', facilitatorToken)
        .send({
          projectId: testProject.id,
          role: 'facilitator',
          email: 'test@example.com'
        })

      const invitation = invitationResponse.body.data.invitation

      // Accept invitation
      await request(app)
        .post(`/api/invitations/${invitation.token}/accept`)
        .set('Authorization', storytellerToken)
        .send({
          name: 'Test User',
          email: 'test@example.com'
        })

      // Check transaction log
      const transactions = await ResourceWalletService.getTransactionHistory(facilitatorUser.id)
      
      const consumeTransaction = transactions.find(
        tx => tx.transactionType === 'consume' && tx.resourceType === 'facilitator_seat'
      )
      
      expect(consumeTransaction).toBeDefined()
      expect(consumeTransaction.amount).toBe(-1)
      expect(consumeTransaction.description).toContain('Invitation accepted')
    })
  })
})