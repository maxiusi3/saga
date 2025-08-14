import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { createServer } from 'http'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
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

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: 'connected'
  })
})

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Saga API is running',
    timestamp: new Date().toISOString()
  })
})

// Simple test auth endpoints
app.post('/api/auth/signup', (req, res) => {
  console.log('Signup request:', req.body)
  
  const { name, email, password } = req.body
  
  // Basic validation
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      message: 'Name, email, and password are required'
    })
  }
  
  // Mock successful signup
  res.status(201).json({
    success: true,
    data: {
      user: {
        id: 'test-user-id',
        name,
        email,
        created_at: new Date().toISOString()
      },
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token'
      }
    },
    message: 'Account created successfully'
  })
})

app.post('/api/auth/signin', (req, res) => {
  console.log('Signin request:', req.body)
  
  const { identifier, password } = req.body
  
  // Basic validation
  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      error: 'Missing credentials',
      message: 'Email/phone and password are required'
    })
  }
  
  // Mock successful signin
  res.json({
    success: true,
    data: {
      user: {
        id: 'test-user-id',
        name: 'Test User',
        email: identifier,
        created_at: new Date().toISOString()
      },
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token'
      }
    },
    message: 'Signed in successfully'
  })
})

app.get('/api/auth/profile', (req, res) => {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Access token required'
    })
  }
  
  // Mock profile response
  res.json({
    success: true,
    data: {
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
      projectRoles: []
    },
    message: 'Profile retrieved successfully'
  })
})

// Mock project endpoints
app.get('/api/projects', (req, res) => {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Access token required'
    })
  }
  
  res.json({
    success: true,
    data: [
      {
        id: 'test-project-1',
        name: 'Family Stories',
        status: 'active',
        created_at: new Date().toISOString()
      }
    ],
    message: 'Projects retrieved successfully'
  })
})

app.post('/api/projects', (req, res) => {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Access token required'
    })
  }
  
  const { name } = req.body
  
  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Missing project name',
      message: 'Project name is required'
    })
  }
  
  res.status(201).json({
    success: true,
    data: {
      id: 'new-project-id',
      name,
      status: 'active',
      created_at: new Date().toISOString()
    },
    message: 'Project created successfully'
  })
})

// Error handling
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  })
})

app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', error)
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'Something went wrong'
  })
})

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Starting Saga test server...')
    
    server.listen(PORT, () => {
      console.log(`✅ Test server running on port ${PORT}`)
      console.log(`🌐 API URL: http://localhost:${PORT}`)
      console.log(`📊 Health Check: http://localhost:${PORT}/health`)
      console.log(`📝 Environment: ${process.env.NODE_ENV}`)
      console.log('')
      console.log('🧪 Available test endpoints:')
      console.log('  POST /api/auth/signup   - User registration')
      console.log('  POST /api/auth/signin   - User login')
      console.log('  GET  /api/auth/profile  - User profile (requires auth)')
      console.log('  GET  /api/projects      - List projects (requires auth)')
      console.log('  POST /api/projects      - Create project (requires auth)')
      console.log('')
      console.log('🎯 Ready for manual testing!')
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

export { app, server }