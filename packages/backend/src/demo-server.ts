import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { createServer } from 'http'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}))
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Mock data
const mockUsers = new Map()
const mockProjects = new Map()
const mockStories = new Map()

// Helper function to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9)

// Helper function to generate JWT token (mock)
const generateToken = (userId: string) => {
  return Buffer.from(JSON.stringify({ userId, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64')
}

// Helper function to verify token (mock)
const verifyToken = (token: string) => {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString())
    if (payload.exp > Date.now()) {
      return payload
    }
  } catch (e) {
    // Invalid token
  }
  return null
}

// Auth middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }

  req.user = { id: payload.userId }
  next()
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mode: 'demo',
    message: 'Saga API is running in demo mode'
  })
})

// Auth routes
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body

  if (!name || !email || !password) {
    return res.status(400).json({ 
      error: 'All fields are required',
      details: { name: !name, email: !email, password: !password }
    })
  }

  // Basic validation
  if (name.trim().length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters' })
  }

  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email format' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  // Check if user already exists
  for (const [id, user] of mockUsers) {
    if ((user as any).email === email) {
      return res.status(400).json({ error: 'User with this email already exists' })
    }
  }

  const userId = generateId()
  const user = {
    id: userId,
    email,
    name: name.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  mockUsers.set(userId, user)
  const accessToken = generateToken(userId)
  const refreshToken = generateToken(userId)

  res.status(201).json({
    data: {
      user,
      accessToken,
      refreshToken,
      expiresIn: 86400
    },
    message: 'Account created successfully',
    timestamp: new Date().toISOString()
  })
})

app.post('/api/auth/signin', (req, res) => {
  const { identifier, password } = req.body

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  // Find user by email (identifier)
  let foundUser = null
  for (const [id, user] of mockUsers) {
    if ((user as any).email === identifier) {
      foundUser = { id, ...user }
      break
    }
  }

  if (!foundUser) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const accessToken = generateToken(foundUser.id)
  const refreshToken = generateToken(foundUser.id)

  res.json({
    data: {
      user: foundUser,
      accessToken,
      refreshToken,
      expiresIn: 86400
    },
    message: 'Signed in successfully',
    timestamp: new Date().toISOString()
  })
})

app.get('/api/auth/profile', authenticateToken, (req: any, res) => {
  const user = mockUsers.get(req.user.id)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  
  res.json({
    data: { id: req.user.id, ...user },
    message: 'Profile retrieved successfully',
    timestamp: new Date().toISOString()
  })
})

app.post('/api/auth/signout', authenticateToken, (req, res) => {
  res.json({ message: 'Signed out successfully' })
})

// Projects routes
app.get('/api/projects', authenticateToken, (req: any, res) => {
  const userProjects = Array.from(mockProjects.values()).filter(
    (project: any) => project.facilitatorId === req.user.id
  )
  res.json(userProjects)
})

app.post('/api/projects', authenticateToken, (req: any, res) => {
  const { name, description } = req.body

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' })
  }

  const projectId = generateId()
  const project = {
    id: projectId,
    name,
    description: description || '',
    facilitatorId: req.user.id,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  mockProjects.set(projectId, project)
  res.status(201).json(project)
})

app.get('/api/projects/:id', authenticateToken, (req: any, res) => {
  const project = mockProjects.get(req.params.id)
  if (!project) {
    return res.status(404).json({ error: 'Project not found' })
  }
  if ((project as any).facilitatorId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' })
  }
  res.json(project)
})

// Stories routes
app.get('/api/stories', authenticateToken, (req: any, res) => {
  const { projectId } = req.query
  let stories = Array.from(mockStories.values())
  
  if (projectId) {
    stories = stories.filter((story: any) => story.projectId === projectId)
  }
  
  res.json(stories)
})

app.post('/api/stories', authenticateToken, (req: any, res) => {
  const { projectId, title, transcript } = req.body

  if (!projectId || !title) {
    return res.status(400).json({ error: 'Project ID and title are required' })
  }

  const storyId = generateId()
  const story = {
    id: storyId,
    projectId,
    title,
    transcript: transcript || '',
    audioUrl: `https://demo-audio-${storyId}.mp3`,
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  mockStories.set(storyId, story)
  res.status(201).json(story)
})

// Default demo data
const initDemoData = () => {
  // Create demo user
  const demoUserId = 'demo-user-1'
  mockUsers.set(demoUserId, {
    id: demoUserId,
    email: 'demo@saga.app',
    name: 'Demo User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  // Create demo project
  const demoProjectId = 'demo-project-1'
  mockProjects.set(demoProjectId, {
    id: demoProjectId,
    name: 'My Family Stories',
    description: 'A collection of our family memories',
    facilitatorId: demoUserId,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  // Create demo stories
  const demoStories = [
    {
      id: 'demo-story-1',
      projectId: demoProjectId,
      title: 'Childhood Memories',
      transcript: 'I remember when I was a child, we used to play in the garden every summer...',
      audioUrl: 'https://demo-audio-1.mp3',
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-story-2',
      projectId: demoProjectId,
      title: 'Wedding Day',
      transcript: 'Our wedding day was the most beautiful day of our lives...',
      audioUrl: 'https://demo-audio-2.mp3',
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]

  demoStories.forEach(story => {
    mockStories.set(story.id, story)
  })
}

// Error handling
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal Server Error' })
})

// Start server
const startServer = async () => {
  try {
    initDemoData()
    
    server.listen(PORT, () => {
      console.log(`🚀 Saga Demo Server running on port ${PORT}`)
      console.log(`📊 Environment: ${process.env.NODE_ENV}`)
      console.log(`🔗 API URL: http://localhost:${PORT}`)
      console.log(`📈 Health Check: http://localhost:${PORT}/health`)
      console.log(`🎭 Demo Mode: Enabled`)
      console.log(``)
      console.log(`📝 Demo Credentials:`)
      console.log(`   Email: demo@saga.app`)
      console.log(`   Password: any password`)
      console.log(``)
      console.log(`🌐 Frontend: http://localhost:3000`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

export { app, server }