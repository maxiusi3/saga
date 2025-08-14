import { db } from '../config/database'

// Mock Redis client for tests
const mockRedisClient = {
  flushAll: jest.fn().mockResolvedValue('OK'),
  quit: jest.fn().mockResolvedValue('OK'),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(-1)
}

// Mock the Redis module
jest.mock('../config/redis', () => ({
  redisClient: mockRedisClient,
  connectRedis: jest.fn().mockResolvedValue(undefined),
  closeRedis: jest.fn().mockResolvedValue(undefined)
}))

const redisClient = mockRedisClient

// Setup test environment
beforeAll(async () => {
  // Run migrations
  await db.migrate.latest()
})

// Clean up after each test
afterEach(async () => {
  // Clear Redis
  await redisClient.flushAll()
  
  // Clean database tables in correct order (respecting foreign keys)
  await db('export_requests').del()
  await db('interactions').del()
  await db('stories').del()
  await db('invitations').del()
  await db('subscriptions').del()
  await db('user_roles').del()
  await db('projects').del()
  await db('users').del()
})

// Cleanup after all tests
afterAll(async () => {
  await db.destroy()
  await redisClient.quit()
})