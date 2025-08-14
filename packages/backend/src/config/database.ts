import knex from 'knex'
const knexConfig = require('../../knexfile')

const environment = process.env.NODE_ENV || 'development'
const config = (knexConfig as any)[environment]

export const db = knex(config)

export const connectDatabase = async (): Promise<void> => {
  try {
    await db.raw('SELECT 1')
    console.log('✅ Database connected successfully')
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    throw error
  }
}

export const closeDatabase = async (): Promise<void> => {
  await db.destroy()
}