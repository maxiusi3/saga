import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'

import { errorHandler } from './middleware/error-handler'
import { connectDatabase } from './config/database'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:19006'],
    methods: ['GET', 'POST'],
  },
})

const PORT = process.env.PORT || 3001

// Basic middleware
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:19006'],
  credentials: true,
}))
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Basic logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: 'connected'
  })
})

// Basic API routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Saga API is running',
    timestamp: new Date().toISOString()
  })
})

// Simple test routes first
app.post('/api/auth/test', (req, res) => {
  res.json({ 
    message: 'Auth test endpoint working',
    timestamp: new Date().toISOString()
  })
})

// Import and use main routes (with error handling)
try {
  console.log('Attempting to load routes...')
  
  // Try to load auth routes
  try {
    const { authRoutes } = require('./routes/auth')
    app.use('/api/auth', authRoutes)
    console.log('✅ Auth routes loaded successfully')
  } catch (authError) {
    console.error('❌ Auth routes failed to load:', authError instanceof Error ? authError.message : authError)
  }
  
  // Try other routes
  try {
    const { projectRoutes } = require('./routes/projects')
    app.use('/api/projects', projectRoutes)
    console.log('✅ Project routes loaded successfully')
  } catch (projectError) {
    console.error('❌ Project routes failed to load:', projectError instanceof Error ? projectError.message : projectError)
  }
  
  try {
    const { storyRoutes } = require('./routes/stories')
    app.use('/api/stories', storyRoutes)
    console.log('✅ Story routes loaded successfully')
  } catch (storyError) {
    console.error('❌ Story routes failed to load:', storyError instanceof Error ? storyError.message : storyError)
  }
  
  try {
    const { promptRoutes } = require('./routes/prompts')
    app.use('/api/prompts', promptRoutes)
    console.log('✅ Prompt routes loaded successfully')
  } catch (promptError) {
    console.error('❌ Prompt routes failed to load:', promptError instanceof Error ? promptError.message : promptError)
  }
  
} catch (error) {
  console.error('❌ General route loading error:', error)
}

// Error handling
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use(errorHandler)

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Starting Saga development server...')
    
    // Connect to database
    await connectDatabase()
    console.log('✅ Database connected')
    
    // Start server
    server.listen(PORT, () => {
      console.log(`✅ Development server running on port ${PORT}`)
      console.log(`🌐 API URL: http://localhost:${PORT}`)
      console.log(`📊 Health Check: http://localhost:${PORT}/health`)
      console.log(`📝 Environment: ${process.env.NODE_ENV}`)
      console.log(`💾 Database: SQLite (${process.env.DATABASE_URL})`)
      console.log('')
      console.log('🎯 Ready for testing!')
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

startServer()

export { app, server, io }