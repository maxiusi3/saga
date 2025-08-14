import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import request from 'supertest'
import { app } from '../index'
import { InvitationModel } from '../models/invitation'
import { ProjectRoleModel } from '../models/project-role'
import { ResourceWalletService } from '../services/resource-wallet-service'
import { UserModel } from '../models/user'
import { ProjectModel } from '../models/project'
import { setupTestDatabase, cleanupTestDatabase } from './setup'

describe('Enhanced Invitation System', () => {
  let facilitatorUser: any
  let testProject: any
  let authToken: string

  beforeEach(async () => {
    await setupTestDatabase()

    // Create facilitator user
    facilitatorUser = await UserModel.createUser({
      name: 'Test Facilitator',
      email: 'facilitator@test.com',
    })

    // Create resource wallet with seats
    await ResourceWalletService.createWallet({
      userId: facilitatorUser.id,
      projectVouchers: 2,
      facilitatorSeats: 3,
      storytellerSeats: 2,
    })

    // Create test project
    testProject = await ProjectModel.create({
      name: 'Test Family Stories',
      created_by: facilitatorUser.id,
    })

    // Assign facilitator role
    await ProjectRoleModel.assignRole(facilitatorUser.id, testProject.id, 'facilitator')

    // Mock auth token
    authToken = 'mock-jwt-token'
  })

  afterEach(async () => {
    await cleanupTestDatabase()
  })

  describe('Role-Specific Invitation Creation', () => {
    it('should create a facilitator invitation successfully', async () => {
      const response = await request(app)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId: testProject.id,
          role: 'facilitator',
        })

      expect(response.status).toBe(201)
      expect(response.body.data.role).toBe('facilitator')
      expect(response.body.data.status).toBe('pending')
      expect(response.body.data.token).toBeDefined()
    })

    it('should create a storyteller invitation successfully', async () => {
      const response = await request(app)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId: testProject.id,
          role: 'storyteller',
        })

      expect(response.status).toBe(201)
      expect(response.body.data.role).toBe('storyteller')
      expect(response.body.data.status).toBe('pending')
    })

    it('should fail when user lacks required seats', async () => {
      // Consume all facilitator seats
      await ResourceWalletService.consumeResources({
        userId: facilitatorUser.id,
        resourceType: 'facilitator_seat',
        amount: 3,
        projectId: testProject.id,
      })

      const response = await request(app)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId: testProject.id,
          role: 'facilitator',
        })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INSUFFICIENT_RESOURCES')
    })

    it('should fail when project already has storyteller', async () => {
      // Create another user and assign as storyteller
      const storytellerUser = await UserModel.createUser({
        name: 'Existing Storyteller',
        email: 'storyteller@test.com',
      })
      await ProjectRoleModel.assignRole(storytellerUser.id, testProject.id, 'storyteller')

      const response = await request(app)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId: testProject.id,
          role: 'storyteller',
        })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('PROJECT_HAS_STORYTELLER')
    })

    it('should fail when non-facilitator tries to create invitation', async () => {
      const regularUser = await UserModel.createUser({
        name: 'Regular User',
        email: 'regular@test.com',
      })

      const response = await request(app)
        .post('/api/invitations')
        .set('Authorization', `Bearer mock-token-regular`)
        .send({
          projectId: testProject.id,
          role: 'facilitator',
        })

      expect(response.status).toBe(403)
      expect(response.body.error.code).toBe('ACCESS_DENIED')
    })
  })

  describe('Invitation Acceptance with Seat Consumption', () => {
    let facilitatorInvitation: any
    let storytellerInvitation: any

    beforeEach(async () => {
      // Create test invitations
      facilitatorInvitation = await InvitationModel.createInvitation({
        projectId: testProject.id,
        role: 'facilitator',
      })

      storytellerInvitation = await InvitationModel.createInvitation({
        projectId: testProject.id,
        role: 'storyteller',
      })
    })

    it('should accept facilitator invitation and consume seat', async () => {
      const newUser = await UserModel.createUser({
        name: 'New Facilitator',
        email: 'newfacilitator@test.com',
      })

      const response = await request(app)
        .post(`/api/invitations/${facilitatorInvitation.token}/accept`)
        .set('Authorization', `Bearer mock-token-new-user`)
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.data.role).toBe('facilitator')

      // Check that seat was consumed
      const wallet = await ResourceWalletService.getWallet(facilitatorUser.id)
      expect(wallet?.facilitatorSeats).toBe(2) // Started with 3, consumed 1

      // Check that role was assigned
      const hasRole = await ProjectRoleModel.hasRole(newUser.id, testProject.id, 'facilitator')
      expect(hasRole).toBe(true)

      // Check invitation status
      const updatedInvitation = await InvitationModel.findById(facilitatorInvitation.id)
      expect(updatedInvitation?.status).toBe('accepted')
    })

    it('should accept storyteller invitation and consume seat', async () => {
      const newUser = await UserModel.createUser({
        name: 'New Storyteller',
        email: 'newstoryteller@test.com',
      })

      const response = await request(app)
        .post(`/api/invitations/${storytellerInvitation.token}/accept`)
        .set('Authorization', `Bearer mock-token-new-user`)
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.data.role).toBe('storyteller')

      // Check that seat was consumed
      const wallet = await ResourceWalletService.getWallet(facilitatorUser.id)
      expect(wallet?.storytellerSeats).toBe(1) // Started with 2, consumed 1

      // Check that role was assigned
      const hasRole = await ProjectRoleModel.hasRole(newUser.id, testProject.id, 'storyteller')
      expect(hasRole).toBe(true)
    })

    it('should fail when facilitator lacks seats', async () => {
      // Consume all facilitator seats
      await ResourceWalletService.consumeResources({
        userId: facilitatorUser.id,
        resourceType: 'facilitator_seat',
        amount: 3,
        projectId: testProject.id,
      })

      const newUser = await UserModel.createUser({
        name: 'New Facilitator',
        email: 'newfacilitator@test.com',
      })

      const response = await request(app)
        .post(`/api/invitations/${facilitatorInvitation.token}/accept`)
        .set('Authorization', `Bearer mock-token-new-user`)
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INSUFFICIENT_RESOURCES')
    })

    it('should create new user account when accepting invitation', async () => {
      const response = await request(app)
        .post(`/api/invitations/${storytellerInvitation.token}/accept`)
        .send({
          name: 'New Storyteller',
          email: 'newstoryteller@test.com',
        })

      expect(response.status).toBe(200)
      expect(response.body.data.message).toContain('Account created')

      // Check that user was created
      const newUser = await UserModel.findByEmail('newstoryteller@test.com')
      expect(newUser).toBeDefined()
      expect(newUser?.name).toBe('New Storyteller')
    })
  })

  describe('Global Storyteller Role Enforcement', () => {
    it('should prevent user from being storyteller in multiple projects', async () => {
      // Create another project
      const secondProject = await ProjectModel.create({
        name: 'Second Project',
        created_by: facilitatorUser.id,
      })

      // Create storyteller user and assign to first project
      const storytellerUser = await UserModel.createUser({
        name: 'Storyteller',
        email: 'storyteller@test.com',
      })
      await ProjectRoleModel.assignRole(storytellerUser.id, testProject.id, 'storyteller')

      // Try to assign same user as storyteller to second project
      const validation = await ProjectRoleModel.validateRoleAssignment(
        storytellerUser.id,
        secondProject.id,
        'storyteller'
      )

      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('already a storyteller')
    })

    it('should allow user to be facilitator in multiple projects', async () => {
      // Create another project
      const secondProject = await ProjectModel.create({
        name: 'Second Project',
        created_by: facilitatorUser.id,
      })

      // Create user and assign as facilitator to first project
      const facilitatorUser2 = await UserModel.createUser({
        name: 'Facilitator 2',
        email: 'facilitator2@test.com',
      })
      await ProjectRoleModel.assignRole(facilitatorUser2.id, testProject.id, 'facilitator')

      // Should be able to assign same user as facilitator to second project
      const validation = await ProjectRoleModel.validateRoleAssignment(
        facilitatorUser2.id,
        secondProject.id,
        'facilitator'
      )

      expect(validation.valid).toBe(true)
    })
  })

  describe('Invitation Status Tracking', () => {
    let testInvitation: any

    beforeEach(async () => {
      testInvitation = await InvitationModel.createInvitation({
        projectId: testProject.id,
        role: 'facilitator',
      })
    })

    it('should mark invitations as expired', async () => {
      // Manually set expiry date to past
      await InvitationModel.update(testInvitation.id, {
        expires_at: new Date(Date.now() - 1000), // 1 second ago
      })

      const expiredCount = await InvitationModel.markExpiredInvitations()
      expect(expiredCount).toBe(1)

      const updatedInvitation = await InvitationModel.findById(testInvitation.id)
      expect(updatedInvitation?.status).toBe('expired')
    })

    it('should get invitation statistics', async () => {
      // Create various invitations
      await InvitationModel.createInvitation({
        projectId: testProject.id,
        role: 'storyteller',
      })

      const expiredInvitation = await InvitationModel.createInvitation({
        projectId: testProject.id,
        role: 'facilitator',
      })
      await InvitationModel.update(expiredInvitation.id, { status: 'expired' })

      const stats = await InvitationModel.getInvitationStats(testProject.id)

      expect(stats.totalInvitations).toBe(3)
      expect(stats.pendingInvitations).toBe(2)
      expect(stats.expiredInvitations).toBe(1)
      expect(stats.facilitatorInvitations).toBe(2)
      expect(stats.storytellerInvitations).toBe(1)
    })
  })

  describe('Invitation Resending', () => {
    let testInvitation: any

    beforeEach(async () => {
      testInvitation = await InvitationModel.createInvitation({
        projectId: testProject.id,
        role: 'facilitator',
      })
    })

    it('should resend invitation with new token and expiry', async () => {
      const originalToken = testInvitation.token
      const originalExpiry = testInvitation.expires_at

      const response = await request(app)
        .post(`/api/invitations/${testInvitation.id}/resend`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)

      const updatedInvitation = await InvitationModel.findById(testInvitation.id)
      expect(updatedInvitation?.token).not.toBe(originalToken)
      expect(updatedInvitation?.expires_at.getTime()).toBeGreaterThan(originalExpiry.getTime())
      expect(updatedInvitation?.status).toBe('pending')
    })

    it('should fail to resend accepted invitation', async () => {
      // Mark invitation as accepted
      await InvitationModel.update(testInvitation.id, { status: 'accepted' })

      expect(async () => {
        await InvitationModel.resendInvitation(testInvitation.id)
      }).rejects.toThrow('Cannot resend an accepted invitation')
    })
  })

  describe('Project Role Management', () => {
    it('should get project roles with user information', async () => {
      // Add another facilitator
      const facilitator2 = await UserModel.createUser({
        name: 'Facilitator 2',
        email: 'facilitator2@test.com',
      })
      await ProjectRoleModel.assignRole(facilitator2.id, testProject.id, 'facilitator')

      // Add storyteller
      const storyteller = await UserModel.createUser({
        name: 'Storyteller',
        email: 'storyteller@test.com',
      })
      await ProjectRoleModel.assignRole(storyteller.id, testProject.id, 'storyteller')

      const roles = await ProjectRoleModel.getProjectRoles(testProject.id)

      expect(roles).toHaveLength(3) // 2 facilitators + 1 storyteller
      expect(roles.some(r => r.role === 'facilitator')).toBe(true)
      expect(roles.some(r => r.role === 'storyteller')).toBe(true)
    })

    it('should count project facilitators', async () => {
      // Add another facilitator
      const facilitator2 = await UserModel.createUser({
        name: 'Facilitator 2',
        email: 'facilitator2@test.com',
      })
      await ProjectRoleModel.assignRole(facilitator2.id, testProject.id, 'facilitator')

      const count = await ProjectRoleModel.countProjectFacilitators(testProject.id)
      expect(count).toBe(2)
    })

    it('should check if project has storyteller', async () => {
      let hasStoryteller = await ProjectRoleModel.projectHasStoryteller(testProject.id)
      expect(hasStoryteller).toBe(false)

      // Add storyteller
      const storyteller = await UserModel.createUser({
        name: 'Storyteller',
        email: 'storyteller@test.com',
      })
      await ProjectRoleModel.assignRole(storyteller.id, testProject.id, 'storyteller')

      hasStoryteller = await ProjectRoleModel.projectHasStoryteller(testProject.id)
      expect(hasStoryteller).toBe(true)
    })
  })
})