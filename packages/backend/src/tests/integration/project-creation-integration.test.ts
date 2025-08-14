/**
 * Project Creation Integration Tests
 * Comprehensive tests for project creation with resource consumption and subscription initialization
 */

import request from 'supertest'
import { app } from '../../index'
import { BaseModel } from '../../models/base'
import { UserModel } from '../../models/user'
import { ResourceWalletModel } from '../../models/resource-wallet'
import { ProjectModel } from '../../models/project'
import { SubscriptionModel } from '../../models/subscription'
import { generateAccessToken } from '../../services/auth-service'

describe('Project Creation Integration Tests', () => {
  let testUserId: string
  let authToken: string

  beforeAll(async () => {
    // Setup test database
    await BaseModel.db.migrate.latest()
  })

  afterAll(async () => {
    // Clean up and close database connection
    await BaseModel.db.destroy()
  })

  beforeEach(async () => {
    // Clean up database
    await BaseModel.db('analytics_events').del()
    await BaseModel.db('project_analytics_events').del()
    await BaseModel.db('subscriptions').del()
    await BaseModel.db('project_roles').del()
    await BaseModel.db('seat_transactions').del()
    await BaseModel.db('projects').del()
    await BaseModel.db('user_resource_wallets').del()
    await BaseModel.db('users').del()

    // Create test user
    const testUser = await UserModel.create({
      email: 'project-test@example.com',
      name: 'Project Test User',
      authProvider: 'email',
      authProviderId: 'project-test-auth-id'
    })
    testUserId = testUser.id
    authToken = generateAccessToken(testUser)

    // Create resource wallet with vouchers
    await ResourceWalletModel.create({
      userId: testUserId,
      projectVouchers: 3,
      facilitatorSeats: 5,
      storytellerSeats: 5
    })
  })

  describe('Successful Project Creation', () => {
    it('should create project with sufficient vouchers', async () => {
      const projectData = {
        name: 'Test Family Stories',
        description: 'A test project for family storytelling'
      }

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe(projectData.name)
      expect(response.body.data.description).toBe(projectData.description)
      expect(response.body.data.id).toBeDefined()

      // Verify project was created in database
      const project = await ProjectModel.findById(response.body.data.id)
      expect(project).toBeTruthy()
      expect(project?.name).toBe(projectData.name)
    })

    it('should consume project voucher atomically', async () => {
      const initialWallet = await ResourceWalletModel.findByUserId(testUserId)
      expect(initialWallet?.projectVouchers).toBe(3)

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: 'Test description'
        })
        .expect(201)

      // Verify voucher was consumed
      const updatedWallet = await ResourceWalletModel.findByUserId(testUserId)
      expect(updatedWallet?.projectVouchers).toBe(2)

      // Verify transaction was logged
      const transactions = await BaseModel.db('seat_transactions')
        .where('user_id', testUserId)
        .where('resource_type', 'project_voucher')
        .where('transaction_type', 'consume')

      expect(transactions).toHaveLength(1)
      expect(transactions[0].amount).toBe(1)
      expect(transactions[0].project_id).toBe(response.body.data.id)
    })

    it('should create facilitator role for creator', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: 'Test description'
        })
        .expect(201)

      // Verify facilitator role was created
      const roles = await BaseModel.db('project_roles')
        .where('project_id', response.body.data.id)
        .where('user_id', testUserId)

      expect(roles).toHaveLength(1)
      expect(roles[0].role).toBe('facilitator')
      expect(roles[0].status).toBe('active')
    })

    it('should initialize 1-year subscription', async () => {
      const beforeCreation = new Date()

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: 'Test description'
        })
        .expect(201)

      const afterCreation = new Date()

      // Verify subscription was created
      const subscription = await SubscriptionModel.findByProjectId(response.body.data.id)
      expect(subscription).toBeTruthy()
      expect(subscription?.status).toBe('active')
      expect(subscription?.facilitatorId).toBe(testUserId)

      // Verify subscription duration is approximately 1 year
      const subscriptionEnd = new Date(subscription!.currentPeriodEnd)
      const subscriptionStart = new Date(subscription!.currentPeriodStart)
      const durationMs = subscriptionEnd.getTime() - subscriptionStart.getTime()
      const durationDays = durationMs / (1000 * 60 * 60 * 24)

      expect(durationDays).toBeGreaterThan(360) // At least 360 days
      expect(durationDays).toBeLessThan(370) // At most 370 days
    })

    it('should track project creation analytics', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Analytics Test Project',
          description: 'Testing analytics tracking'
        })
        .expect(201)

      // Verify analytics event was created
      const analyticsEvents = await BaseModel.db('project_analytics_events')
        .where('event_type', 'project_created')
        .where('user_id', testUserId)
        .where('project_id', response.body.data.id)

      expect(analyticsEvents).toHaveLength(1)

      const eventData = JSON.parse(analyticsEvents[0].event_data)
      expect(eventData.projectName).toBe('Analytics Test Project')
      expect(eventData.hasDescription).toBe(true)
      expect(eventData.vouchersConsumed).toBe(1)
      expect(eventData.walletBalanceBefore.projectVouchers).toBe(3)
      expect(eventData.walletBalanceAfter.projectVouchers).toBe(2)
    })

    it('should handle project creation without description', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Project Without Description'
        })
        .expect(201)

      expect(response.body.data.name).toBe('Project Without Description')
      expect(response.body.data.description).toBeNull()

      // Verify analytics tracked the lack of description
      const analyticsEvents = await BaseModel.db('project_analytics_events')
        .where('event_type', 'project_created')
        .where('project_id', response.body.data.id)

      const eventData = JSON.parse(analyticsEvents[0].event_data)
      expect(eventData.hasDescription).toBe(false)
    })
  })

  describe('Project Creation Failures', () => {
    it('should fail when user has no project vouchers', async () => {
      // Remove all vouchers
      await ResourceWalletModel.update(testUserId, { projectVouchers: 0 })

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Should Fail Project'
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('voucher')

      // Verify no project was created
      const projects = await BaseModel.db('projects').where('name', 'Should Fail Project')
      expect(projects).toHaveLength(0)

      // Verify no subscription was created
      const subscriptions = await BaseModel.db('subscriptions').where('facilitator_id', testUserId)
      expect(subscriptions).toHaveLength(0)
    })

    it('should fail with invalid project name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '', // Empty name
          description: 'Valid description'
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('validation')

      // Verify no voucher was consumed
      const wallet = await ResourceWalletModel.findByUserId(testUserId)
      expect(wallet?.projectVouchers).toBe(3)
    })

    it('should fail with name too long', async () => {
      const longName = 'A'.repeat(256) // Exceeds 255 character limit

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: longName,
          description: 'Valid description'
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('validation')
    })

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          name: 'Unauthorized Project'
        })
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Authentication')
    })

    it('should rollback on database error', async () => {
      // Mock a database error during subscription creation
      const originalCreate = SubscriptionModel.createProjectSubscription
      SubscriptionModel.createProjectSubscription = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      )

      const initialWallet = await ResourceWalletModel.findByUserId(testUserId)

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Rollback Test Project'
        })
        .expect(500)

      // Verify rollback occurred - wallet should be unchanged
      const finalWallet = await ResourceWalletModel.findByUserId(testUserId)
      expect(finalWallet?.projectVouchers).toBe(initialWallet?.projectVouchers)

      // Verify no project was created
      const projects = await BaseModel.db('projects').where('name', 'Rollback Test Project')
      expect(projects).toHaveLength(0)

      // Restore original method
      SubscriptionModel.createProjectSubscription = originalCreate
    })
  })

  describe('Concurrent Project Creation', () => {
    it('should handle concurrent project creation attempts', async () => {
      const projectPromises = Array.from({ length: 3 }, (_, index) =>
        request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Concurrent Project ${index + 1}`,
            description: `Description ${index + 1}`
          })
      )

      const responses = await Promise.all(projectPromises)

      // All should succeed since user has 3 vouchers
      responses.forEach((response, index) => {
        expect(response.status).toBe(201)
        expect(response.body.success).toBe(true)
        expect(response.body.data.name).toBe(`Concurrent Project ${index + 1}`)
      })

      // Verify all vouchers were consumed
      const finalWallet = await ResourceWalletModel.findByUserId(testUserId)
      expect(finalWallet?.projectVouchers).toBe(0)

      // Verify all projects were created
      const projects = await BaseModel.db('projects').where('name', 'like', 'Concurrent Project%')
      expect(projects).toHaveLength(3)
    })

    it('should fail gracefully when vouchers run out during concurrent creation', async () => {
      // Set user to have only 1 voucher
      await ResourceWalletModel.update(testUserId, { projectVouchers: 1 })

      const projectPromises = Array.from({ length: 3 }, (_, index) =>
        request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Insufficient Voucher Project ${index + 1}`,
            description: `Description ${index + 1}`
          })
      )

      const responses = await Promise.allSettled(projectPromises)

      // Only one should succeed, others should fail
      const successful = responses.filter(r => r.status === 'fulfilled' && (r.value as any).status === 201)
      const failed = responses.filter(r => r.status === 'fulfilled' && (r.value as any).status === 400)

      expect(successful).toHaveLength(1)
      expect(failed.length).toBeGreaterThan(0)

      // Verify final wallet state
      const finalWallet = await ResourceWalletModel.findByUserId(testUserId)
      expect(finalWallet?.projectVouchers).toBe(0)
    })
  })

  describe('Project Creation Edge Cases', () => {
    it('should handle special characters in project name', async () => {
      const specialName = 'Family Stories: Mom & Dad\'s "Adventures" (1950-2020)'

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: specialName,
          description: 'Testing special characters'
        })
        .expect(201)

      expect(response.body.data.name).toBe(specialName)
    })

    it('should handle unicode characters in project name', async () => {
      const unicodeName = '家族の物語 - Family Stories 🏠👨‍👩‍👧‍👦'

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: unicodeName,
          description: 'Testing unicode characters'
        })
        .expect(201)

      expect(response.body.data.name).toBe(unicodeName)
    })

    it('should handle very long description', async () => {
      const longDescription = 'A'.repeat(1000) // Long but valid description

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Long Description Project',
          description: longDescription
        })
        .expect(201)

      expect(response.body.data.description).toBe(longDescription)
    })

    it('should create project with minimum valid data', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'A' // Minimum length name
        })
        .expect(201)

      expect(response.body.data.name).toBe('A')
      expect(response.body.data.description).toBeNull()
    })
  })

  describe('Project Creation Performance', () => {
    it('should create project within reasonable time', async () => {
      const startTime = Date.now()

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Performance Test Project',
          description: 'Testing creation performance'
        })
        .expect(201)

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
      expect(response.body.data.name).toBe('Performance Test Project')
    })

    it('should handle multiple sequential project creations efficiently', async () => {
      const startTime = Date.now()

      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Sequential Project ${i + 1}`,
            description: `Sequential description ${i + 1}`
          })
          .expect(201)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(10000) // All 3 should complete within 10 seconds

      // Verify all projects were created
      const projects = await BaseModel.db('projects').where('name', 'like', 'Sequential Project%')
      expect(projects).toHaveLength(3)
    })
  })
})