import request from 'supertest'
import express from 'express'
import { authenticateToken, requireRole, requireProjectAccess } from '../middleware/auth'
import { UserModel } from '../models/user'
import { ProjectModel } from '../models/project'
import { AuthConfig } from '../config/auth'

// Create test app
const createTestApp = () => {
  const app = express()
  app.use(express.json())
  
  // Test routes
  app.get('/protected', authenticateToken, (req, res) => {
    res.json({ user: (req as any).user })
  })
  
  app.get('/facilitator-only', authenticateToken, requireRole(['facilitator']), (req, res) => {
    res.json({ message: 'Facilitator access granted' })
  })
  
  app.get('/project/:id', authenticateToken, requireProjectAccess, (req, res) => {
    res.json({ message: 'Project access granted' })
  })
  
  return app
}

describe('Authentication Middleware', () => {
  let app: express.Application
  let testUser: any
  let accessToken: string

  beforeEach(async () => {
    app = createTestApp()
    
    // Create test user
    testUser = await UserModel.createUser({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123',
    })
    
    // Generate token
    const tokens = AuthConfig.generateTokens(testUser)
    accessToken = tokens.accessToken
  })

  describe('authenticateToken middleware', () => {
    it('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.user.id).toBe(testUser.id)
      expect(response.body.user.email).toBe(testUser.email)
    })

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/protected')
        .expect(401)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      expect(response.body.error.code).toBe('INVALID_TOKEN')
    })

    it('should reject request with malformed authorization header', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'InvalidFormat')
        .expect(401)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })
  })

  describe('requireRole middleware', () => {
    beforeEach(async () => {
      // Create project and assign facilitator role
      const project = await ProjectModel.createProject({
        name: 'Test Project',
        facilitatorId: testUser.id,
      })

      // Add facilitator role
      await UserModel.db('user_roles').insert({
        user_id: testUser.id,
        type: 'facilitator',
        project_id: project.id,
      })
    })

    it('should allow access with required role', async () => {
      const response = await request(app)
        .get('/facilitator-only')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.message).toBe('Facilitator access granted')
    })

    it('should reject access without required role', async () => {
      // Create user without facilitator role
      const storyteller = await UserModel.createUser({
        name: 'Storyteller User',
        email: 'storyteller@example.com',
        password: 'Password123',
      })

      const storytellerToken = AuthConfig.generateTokens(storyteller).accessToken

      const response = await request(app)
        .get('/facilitator-only')
        .set('Authorization', `Bearer ${storytellerToken}`)
        .expect(403)

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('requireProjectAccess middleware', () => {
    let projectId: string

    beforeEach(async () => {
      // Create project with test user as facilitator
      const project = await ProjectModel.createProject({
        name: 'Test Project',
        facilitatorId: testUser.id,
      })
      projectId = project.id
    })

    it('should allow access to authorized project', async () => {
      const response = await request(app)
        .get(`/project/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.message).toBe('Project access granted')
    })

    it('should reject access to unauthorized project', async () => {
      // Create another user
      const otherUser = await UserModel.createUser({
        name: 'Other User',
        email: 'other@example.com',
        password: 'Password123',
      })

      const otherToken = AuthConfig.generateTokens(otherUser).accessToken

      const response = await request(app)
        .get(`/project/${projectId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403)

      expect(response.body.error.code).toBe('PROJECT_ACCESS_DENIED')
    })

    it('should reject access to non-existent project', async () => {
      const fakeProjectId = '550e8400-e29b-41d4-a716-446655440000'

      const response = await request(app)
        .get(`/project/${fakeProjectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403)

      expect(response.body.error.code).toBe('PROJECT_ACCESS_DENIED')
    })
  })
})