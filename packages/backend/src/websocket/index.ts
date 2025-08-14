import { Server, Socket } from 'socket.io'
import { WEBSOCKET_EVENTS } from '@saga/shared'
import { AuthConfig } from '../config/auth'
import { UserModel } from '../models/user'
import { BaseModel } from '../models/base'

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string
    email?: string
    name: string
  }
}

interface ConnectionStats {
  totalConnections: number
  projectConnections: Map<string, Set<string>>
  userConnections: Map<string, Set<string>>
}

// Connection statistics
const connectionStats: ConnectionStats = {
  totalConnections: 0,
  projectConnections: new Map(),
  userConnections: new Map(),
}

// Rate limiting map: userId -> { count, resetTime }
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_EVENTS = 100 // Max events per minute per user

export const setupWebSocket = (io: Server) => {
  // JWT authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')
      
      if (!token) {
        return next(new Error('Authentication token required'))
      }

      const payload = AuthConfig.verifyAccessToken(token)
      const user = await UserModel.findById(payload.userId)
      
      if (!user) {
        return next(new Error('User not found'))
      }

      socket.user = {
        id: user.id,
        email: user.email,
        name: user.name,
      }

      next()
    } catch (error) {
      console.error('WebSocket authentication error:', error)
      next(new Error('Invalid authentication token'))
    }
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    if (!socket.user) {
      socket.disconnect()
      return
    }

    const userId = socket.user.id
    connectionStats.totalConnections++

    // Track user connections
    if (!connectionStats.userConnections.has(userId)) {
      connectionStats.userConnections.set(userId, new Set())
    }
    connectionStats.userConnections.get(userId)!.add(socket.id)

    console.log(`Client connected: ${socket.id} (User: ${socket.user.name})`)

    // Rate limiting helper
    const checkRateLimit = (userId: string): boolean => {
      const now = Date.now()
      const userLimit = rateLimitMap.get(userId)

      if (!userLimit || now > userLimit.resetTime) {
        rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
        return true
      }

      if (userLimit.count >= RATE_LIMIT_MAX_EVENTS) {
        return false
      }

      userLimit.count++
      return true
    }

    // Join project room with authentication and authorization
    socket.on(WEBSOCKET_EVENTS.JOIN_PROJECT, async (projectId: string) => {
      try {
        if (!checkRateLimit(userId)) {
          socket.emit('error', { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' })
          return
        }

        // Verify user has access to the project
        const hasAccess = await verifyProjectAccess(userId, projectId)
        if (!hasAccess) {
          socket.emit('error', { code: 'PROJECT_ACCESS_DENIED', message: 'Access denied to project' })
          return
        }

        socket.join(`project:${projectId}`)
        
        // Track project connections
        if (!connectionStats.projectConnections.has(projectId)) {
          connectionStats.projectConnections.set(projectId, new Set())
        }
        connectionStats.projectConnections.get(projectId)!.add(socket.id)

        console.log(`Socket ${socket.id} joined project ${projectId}`)
        socket.emit('joined_project', { projectId })
      } catch (error) {
        console.error('Error joining project:', error)
        socket.emit('error', { code: 'JOIN_PROJECT_ERROR', message: 'Failed to join project' })
      }
    })

    // Leave project room
    socket.on(WEBSOCKET_EVENTS.LEAVE_PROJECT, (projectId: string) => {
      try {
        if (!checkRateLimit(userId)) {
          socket.emit('error', { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' })
          return
        }

        socket.leave(`project:${projectId}`)
        
        // Update project connections tracking
        const projectConnections = connectionStats.projectConnections.get(projectId)
        if (projectConnections) {
          projectConnections.delete(socket.id)
          if (projectConnections.size === 0) {
            connectionStats.projectConnections.delete(projectId)
          }
        }

        console.log(`Socket ${socket.id} left project ${projectId}`)
        socket.emit('left_project', { projectId })
      } catch (error) {
        console.error('Error leaving project:', error)
        socket.emit('error', { code: 'LEAVE_PROJECT_ERROR', message: 'Failed to leave project' })
      }
    })

    // Typing indicator events
    socket.on(WEBSOCKET_EVENTS.TYPING_START, (data) => {
      try {
        if (!checkRateLimit(userId)) {
          socket.emit('error', { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' })
          return
        }

        // Broadcast typing start to other users in the project
        socket.to(`project:${data.projectId}`).emit(WEBSOCKET_EVENTS.TYPING_START, {
          storyId: data.storyId,
          projectId: data.projectId,
          userId: socket.user?.id,
          userName: socket.user?.name,
        })
      } catch (error) {
        console.error('Error handling typing start:', error)
      }
    })

    socket.on(WEBSOCKET_EVENTS.TYPING_STOP, (data) => {
      try {
        if (!checkRateLimit(userId)) {
          socket.emit('error', { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' })
          return
        }

        // Broadcast typing stop to other users in the project
        socket.to(`project:${data.projectId}`).emit(WEBSOCKET_EVENTS.TYPING_STOP, {
          storyId: data.storyId,
          projectId: data.projectId,
          userId: socket.user?.id,
        })
      } catch (error) {
        console.error('Error handling typing stop:', error)
      }
    })

    // Heartbeat/ping handling for connection health
    socket.on('ping', () => {
      if (checkRateLimit(userId)) {
        socket.emit('pong')
      }
    })

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      connectionStats.totalConnections--
      
      // Clean up user connections
      const userConnections = connectionStats.userConnections.get(userId)
      if (userConnections) {
        userConnections.delete(socket.id)
        if (userConnections.size === 0) {
          connectionStats.userConnections.delete(userId)
        }
      }

      // Clean up project connections
      connectionStats.projectConnections.forEach((connections, projectId) => {
        connections.delete(socket.id)
        if (connections.size === 0) {
          connectionStats.projectConnections.delete(projectId)
        }
      })

      console.log(`Client disconnected: ${socket.id} (Reason: ${reason})`)
    })

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error)
    })
  })

  // Clean up rate limit map periodically
  setInterval(() => {
    const now = Date.now()
    for (const [userId, limit] of rateLimitMap.entries()) {
      if (now > limit.resetTime) {
        rateLimitMap.delete(userId)
      }
    }
  }, RATE_LIMIT_WINDOW)

  return io
}

// Helper function to verify project access
async function verifyProjectAccess(userId: string, projectId: string): Promise<boolean> {
  try {
    // Check if user has any role in the project (facilitator or storyteller)
    const roleRecord = await BaseModel.db('project_roles')
      .where('user_id', userId)
      .where('project_id', projectId)
      .first()

    return !!roleRecord
  } catch (error) {
    console.error('Error verifying project access:', error)
    return false
  }
}

// Helper functions to emit events
export const emitToProject = (io: Server, projectId: string, event: string, data: any) => {
  io.to(`project:${projectId}`).emit(event, data)
}

export const emitStoryUploaded = (io: Server, projectId: string, story: any) => {
  emitToProject(io, projectId, WEBSOCKET_EVENTS.STORY_UPLOADED, story)
}

export const emitInteractionAdded = (io: Server, projectId: string, interaction: any) => {
  emitToProject(io, projectId, WEBSOCKET_EVENTS.INTERACTION_ADDED, interaction)
}

export const emitTranscriptUpdated = (io: Server, projectId: string, storyId: string, transcript: string) => {
  emitToProject(io, projectId, WEBSOCKET_EVENTS.TRANSCRIPT_UPDATED, { storyId, transcript })
}

export const emitExportReady = (io: Server, projectId: string, exportId: string, downloadUrl: string) => {
  emitToProject(io, projectId, WEBSOCKET_EVENTS.EXPORT_READY, { exportId, downloadUrl })
}

// Enhanced helper functions with error handling and logging
export const emitToUser = (io: Server, userId: string, event: string, data: any) => {
  try {
    const userSockets = connectionStats.userConnections.get(userId)
    if (userSockets && userSockets.size > 0) {
      userSockets.forEach(socketId => {
        io.to(socketId).emit(event, data)
      })
      console.log(`Emitted ${event} to user ${userId} (${userSockets.size} connections)`)
    }
  } catch (error) {
    console.error(`Error emitting to user ${userId}:`, error)
  }
}

export const emitToProjectWithAuth = async (io: Server, projectId: string, event: string, data: any, excludeUserId?: string) => {
  try {
    const projectSockets = connectionStats.projectConnections.get(projectId)
    if (!projectSockets || projectSockets.size === 0) {
      return
    }

    // Get all sockets in the project room
    const room = io.sockets.adapter.rooms.get(`project:${projectId}`)
    if (!room) {
      return
    }

    let emittedCount = 0
    for (const socketId of room) {
      const socket = io.sockets.sockets.get(socketId) as AuthenticatedSocket
      if (socket && socket.user && socket.user.id !== excludeUserId) {
        socket.emit(event, data)
        emittedCount++
      }
    }

    console.log(`Emitted ${event} to project ${projectId} (${emittedCount} recipients)`)
  } catch (error) {
    console.error(`Error emitting to project ${projectId}:`, error)
  }
}

// Connection statistics and health monitoring
export const getConnectionStats = () => {
  return {
    totalConnections: connectionStats.totalConnections,
    projectCount: connectionStats.projectConnections.size,
    userCount: connectionStats.userConnections.size,
    projectConnections: Array.from(connectionStats.projectConnections.entries()).map(([projectId, sockets]) => ({
      projectId,
      connectionCount: sockets.size
    })),
    rateLimitStats: {
      activeUsers: rateLimitMap.size,
      rateLimitWindow: RATE_LIMIT_WINDOW,
      maxEventsPerWindow: RATE_LIMIT_MAX_EVENTS
    }
  }
}

// Graceful shutdown helper
export const shutdownWebSocket = (io: Server) => {
  console.log('Shutting down WebSocket server...')
  
  // Notify all connected clients
  io.emit('server_shutdown', { message: 'Server is shutting down. Please reconnect in a moment.' })
  
  // Close all connections
  io.close(() => {
    console.log('WebSocket server shut down successfully')
  })
}