import { createClient } from 'redis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

export const redisClient = createClient({
  url: redisUrl,
})

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err)
})

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully')
})

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect()
  } catch (error) {
    console.error('❌ Redis connection failed:', error)
    throw error
  }
}

export const closeRedis = async (): Promise<void> => {
  await redisClient.quit()
}