import request from 'supertest'
import { app } from '../index'
import { UserModel } from '../models/user'
import { AuthConfig } from '../config/auth'
import jwt from 'jsonwebtoken'

// Mock AWS SDK
jest.mock('aws-sdk')

// Helper functions
async function createTestUser() {
  return await UserModel.create({
    email: 'test@example.com',
    name: 'Test User',
    password: 'password123'
  })
}

function generateTestToken(userId: string) {
  return jwt.sign({ userId }, AuthConfig.jwtSecret, { expiresIn: '1h' })
}

async function cleanupTestData() {
  // Cleanup test data
  await UserModel.deleteMany({ email: 'test@example.com' })
}

describe('Upload API Endpoints', () => {
  let testUser: any
  let accessToken: string

  beforeAll(async () => {
    // Setup test user and authentication
    testUser = await createTestUser()
    accessToken = generateTestToken(testUser.id)
  })

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData()
  })

  describe('POST /api/uploads', () => {
    it('should upload a file successfully', async () => {
      const response = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('test file content'), 'test.txt')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.fileUrl).toBeDefined()
    })
  })

  describe('DELETE /api/uploads/:id', () => {
    it('should delete a file successfully', async () => {
      const response = await request(app)
        .delete('/api/uploads/test-file-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.deletedCount).toBeDefined()
    })
  })
})