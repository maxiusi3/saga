import request from 'supertest'
import { app } from '../index'
import { UserModel } from '../models/user'
import { ProjectModel } from '../models/project'
import { StoryModel } from '../models/story'
import { db } from '../config/database'
import { generateJWT } from '../services/auth-service'

describe('SearchController', () => {
  let testUser: any
  let testProject: any
  let testStories: any[]
  let authToken: string

  beforeAll(async () => {
    // Create test user
    testUser = await UserModel.create({
      name: 'Test User',
      email: 'test@example.com'
    })

    authToken = generateJWT(testUser.id)

    // Create test project
    testProject = await ProjectModel.createProject({
      name: 'Test Project',
      createdBy: testUser.id
    })

    // Add user as facilitator
    await db('project_roles').insert({
      project_id: testProject.id,
      user_id: testUser.id,
      role: 'facilitator',
      status: 'active'
    })

    // Create test stories
    testStories = await Promise.all([
      StoryModel.createStory({
        projectId: testProject.id,
        title: 'Childhood adventures',
        audioUrl: 'https://example.com/audio1.mp3',
        transcript: 'I remember playing in the backyard with my dog Rex. We would run around and play fetch for hours.',
        status: 'ready'
      }),
      StoryModel.createStory({
        projectId: testProject.id,
        title: 'School memories',
        audioUrl: 'https://example.com/audio2.mp3',
        transcript: 'My favorite teacher was Mrs. Johnson. She taught us mathematics and always encouraged us to ask questions.',
        status: 'ready'
      })
    ])

    // Wait for search vectors to be updated
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  afterAll(async () => {
    // Clean up test data
    await db('project_roles').where('project_id', testProject.id).del()
    await db('stories').where('project_id', testProject.id).del()
    await db('projects').where('id', testProject.id).del()
    await db('users').where('id', testUser.id).del()
  })

  describe('GET /api/projects/:projectId/search', () => {
    it('should search stories successfully', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/search`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'childhood' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('results')
      expect(response.body.data).toHaveProperty('total')
      expect(response.body.data).toHaveProperty('searchTime')
      expect(Array.isArray(response.body.data.results)).toBe(true)
    })

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/projects/${testProject.id}/search`)
        .query({ q: 'test' })
        .expect(401)
    })

    it('should require search query', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/search`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('MISSING_QUERY')
    })

    it('should handle non-existent project', async () => {
      await request(app)
        .get('/api/projects/non-existent-id/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'test' })
        .expect(404)
    })

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/search`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'the', page: 1, limit: 1 })
        .expect(200)

      expect(response.body.data.page).toBe(1)
      expect(response.body.data.limit).toBe(1)
    })

    it('should support sorting', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/search`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'the', sortBy: 'date' })
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should support filtering by date', async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const response = await request(app)
        .get(`/api/projects/${testProject.id}/search`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          q: 'the',
          dateFrom: yesterday.toISOString(),
          dateTo: tomorrow.toISOString()
        })
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should limit results per page', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/search`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'the', limit: 200 }) // Try to exceed limit
        .expect(200)

      // Should be capped at 100
      expect(response.body.data.limit).toBeLessThanOrEqual(100)
    })
  })

  describe('GET /api/projects/:projectId/search/suggestions', () => {
    it('should return search suggestions', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/search/suggestions`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'child' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('suggestions')
      expect(Array.isArray(response.body.data.suggestions)).toBe(true)
    })

    it('should handle empty query', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/search/suggestions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.suggestions).toEqual([])
    })

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/projects/${testProject.id}/search/suggestions`)
        .query({ q: 'test' })
        .expect(401)
    })
  })

  describe('GET /api/projects/:projectId/search/analytics', () => {
    it('should return search analytics for facilitators', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/search/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('topQueries')
      expect(response.body.data).toHaveProperty('totalSearches')
      expect(response.body.data).toHaveProperty('averageResultCount')
      expect(response.body.data).toHaveProperty('averageSearchTime')
    })

    it('should require facilitator role', async () => {
      // Create storyteller user
      const storytellerUser = await UserModel.create({
        name: 'Storyteller User',
        email: 'storyteller@example.com'
      })

      const storytellerToken = generateJWT(storytellerUser.id)

      // Add as storyteller
      await db('project_roles').insert({
        project_id: testProject.id,
        user_id: storytellerUser.id,
        role: 'storyteller',
        status: 'active'
      })

      await request(app)
        .get(`/api/projects/${testProject.id}/search/analytics`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .expect(403)

      // Clean up
      await db('project_roles').where('user_id', storytellerUser.id).del()
      await db('users').where('id', storytellerUser.id).del()
    })

    it('should support date filtering', async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const response = await request(app)
        .get(`/api/projects/${testProject.id}/search/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ dateFrom: yesterday.toISOString() })
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  describe('POST /api/projects/:projectId/search/reindex', () => {
    it('should reindex project stories for facilitators', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject.id}/search/reindex`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('reindexedCount')
      expect(typeof response.body.data.reindexedCount).toBe('number')
    })

    it('should require facilitator role', async () => {
      // Create storyteller user
      const storytellerUser = await UserModel.create({
        name: 'Storyteller User',
        email: 'storyteller2@example.com'
      })

      const storytellerToken = generateJWT(storytellerUser.id)

      // Add as storyteller
      await db('project_roles').insert({
        project_id: testProject.id,
        user_id: storytellerUser.id,
        role: 'storyteller',
        status: 'active'
      })

      await request(app)
        .post(`/api/projects/${testProject.id}/search/reindex`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .expect(403)

      // Clean up
      await db('project_roles').where('user_id', storytellerUser.id).del()
      await db('users').where('id', storytellerUser.id).del()
    })

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/projects/${testProject.id}/search/reindex`)
        .expect(401)
    })
  })
})