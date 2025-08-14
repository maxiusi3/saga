import { Server } from 'socket.io'
import { createServer } from 'http'
import Client from 'socket.io-client'
import { setupWebSocket, getConnectionStats } from '../websocket'
import { setupTestDatabase, cleanupTestDatabase } from './setup'
import { UserModel } from '../models/user'
import { ProjectModel } from '../models/project'
import { AuthConfig } from '../config/auth'
import { WEBSOCKET_EVENTS } from '@saga/shared'

describe('WebSocket Server', () => {
  let httpServer: any
  let io: Server
  let serverSocket: any
  let clientSocket: any
  let testUser: any
  let testProject: any
  let authToken: string

  beforeAll(async () => {
    await setupTestDatabase()
    
    // Create test user and project
    testUser = await UserModel.create({
      email: 'test@example.com',
      name: 'Test User',
    })

    testProject = await ProjectModel.create({
      title: 'Test Project',
      facilitatorId: testUser.id,
    })

    // Generate auth token
    authToken = AuthConfig.generateAccessToken(testUser.id)
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach((done) => {
    httpServer = createServer()
    io = new Server(httpServer)
    setupWebSocket(io)
    
    httpServer.listen(() => {
      const port = httpServer.address().port
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: authToken
        }
      })
      
      io.on('connection', (socket) => {
        serverSocket = socket
      })
      
      clientSocket.on('connect', done)
    })
  })

  afterEach(() => {
    io.close()
    clientSocket.close()
    httpServer.close()
  })

  describe('Authentication', () => {
    it('should authenticate valid JWT token', (done) => {
      expect(clientSocket.connected).toBe(true)
      done()
    })

    it('should reject connection without token', (done) => {
      const unauthenticatedClient = Client(`http://localhost:${httpServer.address().port}`)
      
      unauthenticatedClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication token required')
        unauthenticatedClient.close()
        done()
      })
    })

    it('should reject connection with invalid token', (done) => {
      const invalidClient = Client(`http://localhost:${httpServer.address().port}`, {
        auth: {
          token: 'invalid-token'
        }
      })
      
      invalidClient.on('connect_error', (error) => {
        expect(error.message).toContain('Invalid authentication token')
        invalidClient.close()
        done()
      })
    })
  })

  describe('Project Room Management', () => {
    it('should allow joining project room with valid access', (done) => {
      clientSocket.emit(WEBSOCKET_EVENTS.JOIN_PROJECT, testProject.id)
      
      clientSocket.on('joined_project', (data: any) => {
        expect(data.projectId).toBe(testProject.id)
        done()
      })
    })

    it('should reject joining project without access', (done) => {
      const fakeProjectId = '123e4567-e89b-12d3-a456-426614174000'
      clientSocket.emit(WEBSOCKET_EVENTS.JOIN_PROJECT, fakeProjectId)
      
      clientSocket.on('error', (error: any) => {
        expect(error.code).toBe('PROJECT_ACCESS_DENIED')
        done()
      })
    })

    it('should allow leaving project room', (done) => {
      // First join the project
      clientSocket.emit(WEBSOCKET_EVENTS.JOIN_PROJECT, testProject.id)
      
      clientSocket.on('joined_project', () => {
        // Then leave the project
        clientSocket.emit(WEBSOCKET_EVENTS.LEAVE_PROJECT, testProject.id)
        
        clientSocket.on('left_project', (data: any) => {
          expect(data.projectId).toBe(testProject.id)
          done()
        })
      })
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits on events', (done) => {
      let errorReceived = false
      
      clientSocket.on('error', (error: any) => {
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
          errorReceived = true
        }
      })
      
      // Send many events quickly to trigger rate limit
      for (let i = 0; i < 150; i++) {
        clientSocket.emit('ping')
      }
      
      setTimeout(() => {
        expect(errorReceived).toBe(true)
        done()
      }, 100)
    })
  })

  describe('Heartbeat/Ping-Pong', () => {
    it('should respond to ping with pong', (done) => {
      clientSocket.emit('ping')
      
      clientSocket.on('pong', () => {
        done()
      })
    })
  })

  describe('Connection Statistics', () => {
    it('should track connection statistics', () => {
      const stats = getConnectionStats()
      
      expect(stats).toHaveProperty('totalConnections')
      expect(stats).toHaveProperty('projectCount')
      expect(stats).toHaveProperty('userCount')
      expect(stats).toHaveProperty('rateLimitStats')
      expect(typeof stats.totalConnections).toBe('number')
    })
  })

  describe('Event Broadcasting', () => {
    let secondClient: any

    beforeEach((done) => {
      secondClient = Client(`http://localhost:${httpServer.address().port}`, {
        auth: {
          token: authToken
        }
      })
      
      secondClient.on('connect', () => {
        // Both clients join the same project
        clientSocket.emit(WEBSOCKET_EVENTS.JOIN_PROJECT, testProject.id)
        secondClient.emit(WEBSOCKET_EVENTS.JOIN_PROJECT, testProject.id)
        
        let joinedCount = 0
        const checkBothJoined = () => {
          joinedCount++
          if (joinedCount === 2) done()
        }
        
        clientSocket.on('joined_project', checkBothJoined)
        secondClient.on('joined_project', checkBothJoined)
      })
    })

    afterEach(() => {
      if (secondClient) {
        secondClient.close()
      }
    })

    it('should broadcast events to all clients in project room', (done) => {
      const testEvent = 'test_event'
      const testData = { message: 'Hello World' }
      
      secondClient.on(testEvent, (data: any) => {
        expect(data).toEqual(testData)
        done()
      })
      
      // Emit to project room
      io.to(`project:${testProject.id}`).emit(testEvent, testData)
    })

    it('should not broadcast to clients not in project room', (done) => {
      const testEvent = 'test_event'
      const testData = { message: 'Hello World' }
      let eventReceived = false
      
      // Create third client that doesn't join the project
      const thirdClient = Client(`http://localhost:${httpServer.address().port}`, {
        auth: {
          token: authToken
        }
      })
      
      thirdClient.on('connect', () => {
        thirdClient.on(testEvent, () => {
          eventReceived = true
        })
        
        // Emit to project room
        io.to(`project:${testProject.id}`).emit(testEvent, testData)
        
        setTimeout(() => {
          expect(eventReceived).toBe(false)
          thirdClient.close()
          done()
        }, 100)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle socket errors gracefully', (done) => {
      serverSocket.on('error', (error: any) => {
        expect(error).toBeDefined()
        done()
      })
      
      // Trigger an error
      serverSocket.emit('error', new Error('Test error'))
    })

    it('should clean up on disconnect', (done) => {
      const initialStats = getConnectionStats()
      
      clientSocket.disconnect()
      
      setTimeout(() => {
        const finalStats = getConnectionStats()
        expect(finalStats.totalConnections).toBeLessThan(initialStats.totalConnections)
        done()
      }, 100)
    })
  })
})