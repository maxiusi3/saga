import request from 'supertest'
import { app } from '../index'
import { UserModel } from '../models/user'
import { AuthConfig } from '../config/auth'

describe('Authentication Endpoints', () => {
  describe('POST /api/auth/signup', () => {
    it('should create a new user with email and password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      }

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201)

      expect(response.body.data.user).toMatchObject({
        name: userData.name,
        email: userData.email,
      })
      expect(response.body.data.accessToken).toBeDefined()
      expect(response.body.data.refreshToken).toBeDefined()
      expect(response.body.data.expiresIn).toBeDefined()
    })

    it('should create a new user with phone and password', async () => {
      const userData = {
        name: 'Jane Doe',
        phone: '+1234567890',
        password: 'Password123',
      }

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201)

      expect(response.body.data.user).toMatchObject({
        name: userData.name,
        phone: userData.phone,
      })
    })

    it('should reject signup with invalid email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'Password123',
      }

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject signup with weak password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'weak',
      }

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject signup with duplicate email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      }

      // Create first user
      await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201)

      // Try to create duplicate
      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(409)

      expect(response.body.error.code).toBe('EMAIL_EXISTS')
    })

    it('should reject signup without email or phone', async () => {
      const userData = {
        name: 'John Doe',
        password: 'Password123',
      }

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(400)

      expect(response.body.error.code).toBe('MISSING_IDENTIFIER')
    })
  })

  describe('POST /api/auth/signin', () => {
    beforeEach(async () => {
      // Create test user
      await UserModel.createUser({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
      })
    })

    it('should sign in with valid email and password', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          identifier: 'test@example.com',
          password: 'Password123',
        })
        .expect(200)

      expect(response.body.data.user.email).toBe('test@example.com')
      expect(response.body.data.accessToken).toBeDefined()
      expect(response.body.data.refreshToken).toBeDefined()
    })

    it('should reject signin with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          identifier: 'test@example.com',
          password: 'WrongPassword',
        })
        .expect(401)

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS')
    })

    it('should reject signin with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          identifier: 'nonexistent@example.com',
          password: 'Password123',
        })
        .expect(401)

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS')
    })
  })

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string

    beforeEach(async () => {
      // Create user and get refresh token
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Password123',
        })

      refreshToken = response.body.data.refreshToken
    })

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200)

      expect(response.body.data.accessToken).toBeDefined()
      expect(response.body.data.expiresIn).toBeDefined()
    })

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401)

      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN')
    })
  })

  describe('POST /api/auth/signout', () => {
    let accessToken: string
    let refreshToken: string

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Password123',
        })

      accessToken = response.body.data.accessToken
      refreshToken = response.body.data.refreshToken
    })

    it('should sign out successfully', async () => {
      const response = await request(app)
        .post('/api/auth/signout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200)

      expect(response.body.data.success).toBe(true)
    })

    it('should reject signout without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/signout')
        .send({ refreshToken })
        .expect(401)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })
  })

  describe('GET /api/auth/profile', () => {
    let accessToken: string

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Password123',
        })

      accessToken = response.body.data.accessToken
    })

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.data.name).toBe('Test User')
      expect(response.body.data.email).toBe('test@example.com')
      expect(response.body.data.roles).toBeDefined()
    })

    it('should reject profile request without authentication', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })
  })

  describe('POST /api/auth/change-password', () => {
    let accessToken: string

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Password123',
        })

      accessToken = response.body.data.accessToken
    })

    it('should change password successfully', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123',
          newPassword: 'NewPassword123',
        })
        .expect(200)

      expect(response.body.data.success).toBe(true)
    })

    it('should reject password change with wrong current password', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'NewPassword123',
        })
        .expect(401)

      expect(response.body.error.code).toBe('INVALID_CURRENT_PASSWORD')
    })
  })
})

describe('JWT Token Handling', () => {
  describe('AuthConfig', () => {
    const mockUser = {
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should generate valid token pair', () => {
      const tokens = AuthConfig.generateTokens(mockUser)

      expect(tokens.accessToken).toBeDefined()
      expect(tokens.refreshToken).toBeDefined()
      expect(tokens.expiresIn).toBeGreaterThan(0)
    })

    it('should verify access token', () => {
      const tokens = AuthConfig.generateTokens(mockUser)
      const payload = AuthConfig.verifyAccessToken(tokens.accessToken)

      expect(payload.userId).toBe(mockUser.id)
      expect(payload.email).toBe(mockUser.email)
      expect(payload.name).toBe(mockUser.name)
    })

    it('should verify refresh token', () => {
      const tokens = AuthConfig.generateTokens(mockUser)
      const payload = AuthConfig.verifyRefreshToken(tokens.refreshToken)

      expect(payload.userId).toBe(mockUser.id)
    })

    it('should refresh access token', () => {
      const tokens = AuthConfig.generateTokens(mockUser)
      const newAccessToken = AuthConfig.refreshAccessToken(tokens.refreshToken)

      expect(newAccessToken).toBeDefined()
      expect(newAccessToken).not.toBe(tokens.accessToken)

      const payload = AuthConfig.verifyAccessToken(newAccessToken)
      expect(payload.userId).toBe(mockUser.id)
    })

    it('should reject invalid tokens', () => {
      expect(() => {
        AuthConfig.verifyAccessToken('invalid-token')
      }).toThrow('Invalid access token')

      expect(() => {
        AuthConfig.verifyRefreshToken('invalid-token')
      }).toThrow('Invalid refresh token')
    })
  })
})