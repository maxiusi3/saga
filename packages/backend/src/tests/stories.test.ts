import request from 'supertest'
import { app } from '../index'
import { UserModel } from '../models/user'
import { ProjectModel } from '../models/project'
import { StoryModel } from '../models/story'
import { AuthConfig } from '../config/auth'

describe('Story API Endpoints', () => {
  let facilitatorUser: any
  let storytellerUser: any
  let facilitatorToken: string
  let storytellerToken: string
  let testProject: any
  let testStory: any

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

    // Assign storyteller
    await ProjectModel.assignStoryteller(testProject.id, storytellerUser.id)

    // Add user roles
    await ProjectModel.db('user_roles').insert([
      {
        user_id: facilitatorUser.id,
        type: 'facilitator',
        project_id: testProject.id,
      },
      {
        user_id: storytellerUser.id,
        type: 'storyteller',
        project_id: testProject.id,
      },
    ])

    // Create test story
    testStory = await StoryModel.createStory({
      projectId: testProject.id,
      title: 'Test Story',
      audioUrl: 'https://example.com/audio.mp3',
      aiPrompt: 'Tell me about your childhood',
    })
  })

  describe('GET /api/projects/:projectId/stories', () => {
    it('should get project stories', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/stories`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(response.body.data.stories).toBeDefined()
      expect(Array.isArray(response.body.data.stories)).toBe(true)
      expect(response.body.data.total).toBeDefined()
      expect(response.body.data.page).toBe(1)
    })

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/stories?page=1&limit=5`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(response.body.data.page).toBe(1)
      expect(response.body.data.limit).toBe(5)
    })

    it('should filter by status', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/stories?status=processing`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(response.body.data.stories).toBeDefined()
    })
  })

  describe('POST /api/projects/:projectId/stories', () => {
    it('should create story as storyteller with audio file', async () => {
      // Create a mock audio buffer
      const audioBuffer = Buffer.from('mock audio data')

      const response = await request(app)
        .post(`/api/projects/${testProject.id}/stories`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .attach('audio', audioBuffer, 'test.mp3')
        .field('title', 'New Story')
        .field('aiPrompt', 'Tell me about your first job')
        .expect(201)

      expect(response.body.data.title).toBe('New Story')
      expect(response.body.data.project_id).toBe(testProject.id)
      expect(response.body.data.status).toBe('processing')
    })

    it('should reject story creation without audio file', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject.id}/stories`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .field('title', 'New Story')
        .expect(400)

      expect(response.body.error.code).toBe('AUDIO_FILE_REQUIRED')
    })

    it('should reject story creation by facilitator', async () => {
      const audioBuffer = Buffer.from('mock audio data')

      const response = await request(app)
        .post(`/api/projects/${testProject.id}/stories`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .attach('audio', audioBuffer, 'test.mp3')
        .field('title', 'New Story')
        .expect(403)

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('GET /api/stories/:id', () => {
    it('should get story details', async () => {
      const response = await request(app)
        .get(`/api/stories/${testStory.id}`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(response.body.data.id).toBe(testStory.id)
      expect(response.body.data.title).toBe('Test Story')
      expect(response.body.data.interactions).toBeDefined()
    })

    it('should return 404 for non-existent story', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000'

      const response = await request(app)
        .get(`/api/stories/${fakeId}`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(404)

      expect(response.body.error.code).toBe('STORY_NOT_FOUND')
    })
  })

  describe('PUT /api/stories/:id/transcript', () => {
    it('should update transcript as facilitator', async () => {
      const newTranscript = 'This is the updated transcript of the story.'

      const response = await request(app)
        .put(`/api/stories/${testStory.id}/transcript`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({ transcript: newTranscript })
        .expect(200)

      expect(response.body.data.transcript).toBe(newTranscript)
    })

    it('should reject transcript update by storyteller', async () => {
      const response = await request(app)
        .put(`/api/stories/${testStory.id}/transcript`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .send({ transcript: 'Hacked transcript' })
        .expect(403)

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
    })

    it('should reject empty transcript', async () => {
      const response = await request(app)
        .put(`/api/stories/${testStory.id}/transcript`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({ transcript: '' })
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('POST /api/stories/:id/interactions', () => {
    it('should create comment as facilitator', async () => {
      const interactionData = {
        type: 'comment',
        content: 'This is a beautiful story, thank you for sharing!',
      }

      const response = await request(app)
        .post(`/api/stories/${testStory.id}/interactions`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send(interactionData)
        .expect(201)

      expect(response.body.data.type).toBe('comment')
      expect(response.body.data.content).toBe(interactionData.content)
      expect(response.body.data.facilitator_id).toBe(facilitatorUser.id)
    })

    it('should create follow-up question as facilitator', async () => {
      const interactionData = {
        type: 'followup',
        content: 'Can you tell me more about that experience?',
      }

      const response = await request(app)
        .post(`/api/stories/${testStory.id}/interactions`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send(interactionData)
        .expect(201)

      expect(response.body.data.type).toBe('followup')
      expect(response.body.data.content).toBe(interactionData.content)
    })

    it('should reject interaction creation by storyteller', async () => {
      const response = await request(app)
        .post(`/api/stories/${testStory.id}/interactions`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .send({
          type: 'comment',
          content: 'Self comment',
        })
        .expect(403)

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS')
    })

    it('should reject invalid interaction type', async () => {
      const response = await request(app)
        .post(`/api/stories/${testStory.id}/interactions`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          type: 'invalid',
          content: 'Some content',
        })
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/stories/:id/interactions', () => {
    beforeEach(async () => {
      // Create test interactions
      await StoryModel.db('interactions').insert([
        {
          story_id: testStory.id,
          facilitator_id: facilitatorUser.id,
          type: 'comment',
          content: 'Great story!',
        },
        {
          story_id: testStory.id,
          facilitator_id: facilitatorUser.id,
          type: 'followup',
          content: 'Tell me more about that.',
        },
      ])
    })

    it('should get story interactions', async () => {
      const response = await request(app)
        .get(`/api/stories/${testStory.id}/interactions`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data.length).toBe(2)
    })
  })

  describe('GET /api/projects/:projectId/stories/search', () => {
    beforeEach(async () => {
      // Update story with transcript for search
      await StoryModel.updateTranscript(testStory.id, 'This is a story about my childhood in the countryside.')
    })

    it('should search stories by content', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/stories/search?q=childhood`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(Array.isArray(response.body.data)).toBe(true)
    })

    it('should require search query', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/stories/search`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })
})