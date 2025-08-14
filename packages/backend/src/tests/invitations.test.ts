import request from 'supertest'
import { app } from '../index'
import { UserModel } from '../models/user'
import { ProjectModel } from '../models/project'
import { InvitationModel } from '../models/invitation'
import { AuthConfig } from '../config/auth'

describe('Invitation API Endpoints', () => {
  let facilitatorUser: any
  let facilitatorToken: string
  let testProject: any
  let testInvitation: any

  beforeEach(async () => {
    // Create test user
    facilitatorUser = await UserModel.createUser({
      name: 'Facilitator User',
      email: 'facilitator@example.com',
      password: 'Password123',
    })

    // Generate token
    facilitatorToken = AuthConfig.generateTokens(facilitatorUser).accessToken

    // Create test project
    testProject = await ProjectModel.createProject({
      name: 'Test Project',
      facilitatorId: facilitatorUser.id,
    })

    // Add facilitator role
    await ProjectModel.db('user_roles').insert({
      user_id: facilitatorUser.id,
      type: 'facilitator',
      project_id: testProject.id,
    })

    // Create test invitation
    testInvitation = await InvitationModel.createInvitation({
      projectId: testProject.id,
    })
  })

  describe('GET /api/invitations/:token', () => {
    it('should get invitation details with valid token', async () => {
      const response = await request(app)
        .get(`/api/invitations/${testInvitation.token}`)
        .expect(200)

      expect(response.body.data.invitation.token).toBe(testInvitation.token)
      expect(response.body.data.invitation.project.name).toBe('Test Project')
      expect(response.body.data.invitation.project.facilitator.name).toBe('Facilitator User')
    })

    it('should return 404 for invalid token', async () => {
      const response = await request(app)
        .get('/api/invitations/invalid-token')
        .expect(404)

      expect(response.body.error.code).toBe('INVITATION_NOT_FOUND')
    })

    it('should reject expired invitation', async () => {
      // Create expired invitation
      const expiredInvitation = await InvitationModel.createInvitation({
        projectId: testProject.id,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      })

      const response = await request(app)
        .get(`/api/invitations/${expiredInvitation.token}`)
        .expect(400)

      expect(response.body.error.code).toBe('INVITATION_EXPIRED')
    })

    it('should reject used invitation', async () => {
      // Mark invitation as used
      await InvitationModel.acceptInvitation(testInvitation.token)

      const response = await request(app)
        .get(`/api/invitations/${testInvitation.token}`)
        .expect(400)

      expect(response.body.error.code).toBe('INVITATION_USED')
    })
  })

  describe('POST /api/invitations/:token/accept', () => {
    it('should accept invitation and create new user', async () => {
      const userData = {
        name: 'New Storyteller',
        email: 'storyteller@example.com',
      }

      const response = await request(app)
        .post(`/api/invitations/${testInvitation.token}/accept`)
        .send(userData)
        .expect(200)

      expect(response.body.data.project.storyteller).toBeDefined()
      expect(response.body.data.project.storyteller.name).toBe(userData.name)
      expect(response.body.data.project.status).toBe('active')

      // Verify user was created
      const newUser = await UserModel.findByEmail(userData.email)
      expect(newUser).toBeDefined()
      expect(newUser!.name).toBe(userData.name)
    })

    it('should accept invitation for existing authenticated user', async () => {
      // Create existing user
      const existingUser = await UserModel.createUser({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'Password123',
      })

      const existingUserToken = AuthConfig.generateTokens(existingUser).accessToken

      const response = await request(app)
        .post(`/api/invitations/${testInvitation.token}/accept`)
        .set('Authorization', `Bearer ${existingUserToken}`)
        .expect(200)

      expect(response.body.data.storytellerId).toBe(existingUser.id)
      expect(response.body.data.project.storyteller.name).toBe('Existing User')
    })

    it('should reject invitation acceptance without name for new user', async () => {
      const response = await request(app)
        .post(`/api/invitations/${testInvitation.token}/accept`)
        .send({ email: 'test@example.com' })
        .expect(400)

      expect(response.body.error.code).toBe('NAME_REQUIRED')
    })

    it('should reject invitation acceptance without contact info', async () => {
      const response = await request(app)
        .post(`/api/invitations/${testInvitation.token}/accept`)
        .send({ name: 'Test User' })
        .expect(400)

      expect(response.body.error.code).toBe('CONTACT_REQUIRED')
    })

    it('should reject invitation acceptance for existing user email', async () => {
      // Create existing user
      await UserModel.createUser({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'Password123',
      })

      const response = await request(app)
        .post(`/api/invitations/${testInvitation.token}/accept`)
        .send({
          name: 'New User',
          email: 'existing@example.com',
        })
        .expect(409)

      expect(response.body.error.code).toBe('USER_EXISTS')
    })

    it('should reject invalid invitation token', async () => {
      const response = await request(app)
        .post('/api/invitations/invalid-token/accept')
        .send({
          name: 'Test User',
          email: 'test@example.com',
        })
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_INVITATION')
    })
  })

  describe('GET /api/projects/:id/invitations', () => {
    it('should get project invitations as facilitator', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/invitations`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data.length).toBeGreaterThan(0)
      expect(response.body.data[0].project_id).toBe(testProject.id)
    })
  })

  describe('GET /api/projects/:id/invitations/stats', () => {
    it('should get invitation statistics', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/invitations/stats`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(response.body.data.totalInvitations).toBeDefined()
      expect(response.body.data.usedInvitations).toBeDefined()
      expect(response.body.data.activeInvitations).toBeDefined()
      expect(response.body.data.expiredInvitations).toBeDefined()
    })
  })

  describe('DELETE /api/projects/:id/invitations', () => {
    it('should invalidate project invitations as facilitator', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProject.id}/invitations`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(response.body.data.success).toBe(true)

      // Verify invitation is invalidated
      const invalidatedInvitation = await InvitationModel.findByToken(testInvitation.token)
      expect(invalidatedInvitation!.used_at).toBeDefined()
    })
  })

  describe('DELETE /api/invitations/cleanup/expired', () => {
    it('should cleanup expired invitations', async () => {
      // Create expired invitation
      await InvitationModel.createInvitation({
        projectId: testProject.id,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      })

      const response = await request(app)
        .delete('/api/invitations/cleanup/expired')
        .expect(200)

      expect(response.body.data.deletedCount).toBeGreaterThanOrEqual(0)
    })
  })
})