import request from 'supertest'
import { app } from '../index'
import { UserModel } from '../models/user'
import { ProjectModel } from '../models/project'
import { AuthConfig } from '../config/auth'

describe('Project API Endpoints', () => {
  let facilitatorUser: any
  let storytellerUser: any
  let facilitatorToken: string
  let storytellerToken: string
  let testProject: any

  beforeEach(async () => {
    // Create test users
    facilitatorUser = await UserModel.createUser({
      name: 'Facilitator User',
      email: 'facilitator@example.com',
      password: 'Password123',
    })

    storytellerUser = await UserModel.createUser({
      name: 'Storyteller User',
      email: 'storyteller@example.com',
      password: 'Password123',
    })

    // Generate tokens
    facilitatorToken = AuthConfig.generateTokens(facilitatorUser).accessToken
    storytellerToken = AuthConfig.generateTokens(storytellerUser).accessToken

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
  })

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const projectData = {
        name: 'New Test Project',
      }

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send(projectData)
        .expect(201)

      expect(response.body.data.name).toBe(projectData.name)
      expect(response.body.data.facilitator_id).toBe(facilitatorUser.id)
      expect(response.body.data.status).toBe('pending')
    })

    it('should reject project creation without authentication', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project' })
        .expect(401)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })

    it('should reject project creation with invalid name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({ name: '' })
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/projects', () => {
    it('should get user projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data.length).toBeGreaterThan(0)
      expect(response.body.data[0].name).toBe('Test Project')
    })

    it('should filter projects by role', async () => {
      const response = await request(app)
        .get('/api/projects?role=facilitator')
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(Array.isArray(response.body.data)).toBe(true)
    })
  })

  describe('GET /api/projects/:id', () => {
    it('should get project details', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(response.body.data.id).toBe(testProject.id)
      expect(response.body.data.name).toBe('Test Project')
    })

    it('should reject access to unauthorized project', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .expect(403)

      expect(response.body.error.code).toBe('PROJECT_ACCESS_DENIED')
    })

    it('should reject invalid project ID', async () => {
      const response = await request(app)
        .get('/api/projects/invalid-id')
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('PUT /api/projects/:id', () => {
    it('should update project as facilitator', async () => {
      const updateData = {
        name: 'Updated Project Name',
        status: 'active',
      }

      const response = await request(app)
        .put(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.data.name).toBe(updateData.name)
      expect(response.body.data.status).toBe(updateData.status)
    })

    it('should reject update by non-facilitator', async () => {
      // Add storyteller role to project
      await ProjectModel.assignStoryteller(testProject.id, storytellerUser.id)
      await ProjectModel.db('user_roles').insert({
        user_id: storytellerUser.id,
        type: 'storyteller',
        project_id: testProject.id,
      })

      const response = await request(app)
        .put(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403)

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('DELETE /api/projects/:id', () => {
    it('should delete project as facilitator', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(response.body.data.success).toBe(true)

      // Verify project is deleted
      const deletedProject = await ProjectModel.findById(testProject.id)
      expect(deletedProject).toBeUndefined()
    })
  })

  describe('POST /api/projects/:id/invitation', () => {
    it('should generate invitation as facilitator', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject.id}/invitation`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(response.body.data.token).toBeDefined()
      expect(response.body.data.project_id).toBe(testProject.id)
      expect(response.body.data.expires_at).toBeDefined()
    })

    it('should reject invitation generation for project with storyteller', async () => {
      // Assign storyteller to project
      await ProjectModel.assignStoryteller(testProject.id, storytellerUser.id)

      const response = await request(app)
        .post(`/api/projects/${testProject.id}/invitation`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('PROJECT_HAS_STORYTELLER')
    })
  })

  describe('GET /api/projects/:id/stats', () => {
    it('should get project statistics', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/stats`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(response.body.data.totalStories).toBeDefined()
      expect(response.body.data.totalDuration).toBeDefined()
      expect(response.body.data.completedChapters).toBeDefined()
    })
  })
})