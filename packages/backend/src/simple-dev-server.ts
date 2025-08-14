import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// Basic middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:19006'],
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  })
})

// Basic API routes for testing
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend API is running' })
})

// Mock auth endpoints
app.post('/api/auth/signin', (req, res) => {
  const { email, password } = req.body
  
  // Simple validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Email and password are required'
      }
    })
  }

  res.json({
    success: true,
    data: {
      user: {
        id: 'demo-user-1',
        email: email,
        name: 'Demo User',
        resourceWallet: {
          projectVouchers: 1,
          facilitatorSeats: 2,
          storytellerSeats: 2
        }
      },
      accessToken: 'demo-jwt-token',
      refreshToken: 'demo-refresh-token'
    }
  })
})

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body
  
  // Simple validation
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Name, email and password are required'
      }
    })
  }

  res.json({
    success: true,
    data: {
      user: {
        id: 'demo-user-' + Date.now(),
        email: email,
        name: name,
        resourceWallet: {
          projectVouchers: 1,
          facilitatorSeats: 2,
          storytellerSeats: 2
        }
      },
      accessToken: 'demo-jwt-token',
      refreshToken: 'demo-refresh-token'
    }
  })
})

app.get('/api/auth/me', (req, res) => {
  res.json({
    success: true,
    data: {
      id: 'demo-user-1',
      email: 'demo@example.com',
      name: 'Demo User',
      resourceWallet: {
        projectVouchers: 1,
        facilitatorSeats: 2,
        storytellerSeats: 2
      }
    }
  })
})

// Add profile endpoint (alias for /me)
app.get('/api/auth/profile', (req, res) => {
  res.json({
    success: true,
    data: {
      id: 'demo-user-1',
      email: 'demo@example.com',
      name: 'Demo User',
      resourceWallet: {
        projectVouchers: 1,
        facilitatorSeats: 2,
        storytellerSeats: 2
      }
    }
  })
})

// Add signout endpoint
app.post('/api/auth/signout', (req, res) => {
  res.json({
    success: true,
    message: 'Signed out successfully'
  })
})

// Add refresh token endpoint
app.post('/api/auth/refresh', (req, res) => {
  res.json({
    success: true,
    data: {
      accessToken: 'demo-jwt-token-refreshed',
      refreshToken: 'demo-refresh-token-new'
    }
  })
})

// Add OAuth endpoints
app.post('/api/auth/oauth/google', (req, res) => {
  const { accessToken } = req.body
  
  if (!accessToken) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Google access token is required'
      }
    })
  }

  res.json({
    success: true,
    data: {
      user: {
        id: 'demo-google-user-1',
        email: 'demo@gmail.com',
        name: 'Demo Google User',
        resourceWallet: {
          projectVouchers: 1,
          facilitatorSeats: 2,
          storytellerSeats: 2
        }
      },
      accessToken: 'demo-jwt-token-google',
      refreshToken: 'demo-refresh-token-google'
    }
  })
})

app.post('/api/auth/oauth/apple', (req, res) => {
  const { idToken, user } = req.body
  
  if (!idToken) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Apple ID token is required'
      }
    })
  }

  res.json({
    success: true,
    data: {
      user: {
        id: 'demo-apple-user-1',
        email: user?.email || 'demo@icloud.com',
        name: user?.name || 'Demo Apple User',
        resourceWallet: {
          projectVouchers: 1,
          facilitatorSeats: 2,
          storytellerSeats: 2
        }
      },
      accessToken: 'demo-jwt-token-apple',
      refreshToken: 'demo-refresh-token-apple'
    }
  })
})

// Mock projects endpoints
app.get('/api/projects', (req, res) => {
  res.json([
    {
      id: 'demo-project-1',
      name: 'Family Stories',
      description: 'Our family biography project',
      status: 'active',
      createdAt: new Date().toISOString(),
      facilitators: [
        {
          id: 'demo-user-1',
          name: 'Demo User',
          email: 'demo@example.com'
        }
      ]
    }
  ])
})

app.post('/api/projects', (req, res) => {
  res.json({
    id: 'demo-project-' + Date.now(),
    name: req.body.name,
    description: req.body.description,
    status: 'active',
    createdAt: new Date().toISOString()
  })
})

app.get('/api/projects/:id', (req, res) => {
  res.json({
    id: req.params.id,
    name: 'Family Stories',
    description: 'Our family biography project',
    status: 'active',
    createdAt: new Date().toISOString(),
    facilitators: [
      {
        id: 'demo-user-1',
        name: 'Demo User',
        email: 'demo@example.com'
      }
    ],
    stories: []
  })
})

// Mock stories endpoints
app.get('/api/stories', (req, res) => {
  res.json([])
})

app.get('/api/projects/:projectId/stories', (req, res) => {
  res.json([])
})

// Mock resources endpoints
app.get('/api/users/:userId/wallet', (req, res) => {
  res.json({
    projectVouchers: 1,
    facilitatorSeats: 2,
    storytellerSeats: 2
  })
})

// Mock purchase endpoints
app.get('/api/packages', (req, res) => {
  res.json([
    {
      id: 'saga-package',
      name: 'The Saga Package',
      price: 99,
      currency: 'USD',
      features: [
        '1 Project Voucher',
        '2 Facilitator Seats',
        '2 Storyteller Seats',
        '1 Year Interactive Service'
      ]
    }
  ])
})

app.post('/api/payments/create-intent', (req, res) => {
  res.json({
    clientSecret: 'demo-client-secret',
    paymentIntentId: 'demo-payment-intent'
  })
})

// Mock exports endpoints
app.get('/api/exports', (req, res) => {
  res.json([])
})

app.post('/api/exports', (req, res) => {
  res.json({
    id: 'demo-export-' + Date.now(),
    status: 'processing',
    createdAt: new Date().toISOString()
  })
})

// Mock prompts endpoints
app.get('/api/prompts/next/:projectId', (req, res) => {
  res.json({
    id: 'demo-prompt-1',
    text: 'Tell me about your earliest childhood memory.',
    audioUrl: null,
    chapterId: 'early-life',
    chapterName: 'Early Life & Family'
  })
})

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path 
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple Backend Server running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 API URL: http://localhost:${PORT}`)
  console.log(`📈 Health Check: http://localhost:${PORT}/health`)
  console.log(`🧪 This is a simplified development server for testing`)
})

export { app }