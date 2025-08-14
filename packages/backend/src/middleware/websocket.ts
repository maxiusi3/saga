import { Request, Response, NextFunction } from 'express'
import { Server } from 'socket.io'

// Extend Express Request to include WebSocket server
declare global {
  namespace Express {
    interface Request {
      io?: Server
    }
  }
}

/**
 * Middleware to attach WebSocket server instance to request object
 * This allows controllers to emit WebSocket events
 */
export const attachWebSocket = (io: Server) => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.io = io
    next()
  }
}

/**
 * Helper function to safely emit WebSocket events from controllers
 */
export const emitWebSocketEvent = (
  req: Request,
  event: string,
  data: any,
  options?: {
    projectId?: string
    userId?: string
    excludeUserId?: string
  }
) => {
  if (!req.io) {
    console.warn('WebSocket server not available in request')
    return
  }

  try {
    if (options?.projectId) {
      // Emit to project room
      req.io.to(`project:${options.projectId}`).emit(event, data)
    } else if (options?.userId) {
      // Emit to specific user
      const userSockets = req.io.sockets.sockets
      for (const [socketId, socket] of userSockets) {
        const authSocket = socket as any
        if (authSocket.user?.id === options.userId) {
          socket.emit(event, data)
        }
      }
    } else {
      // Emit to all connected clients
      req.io.emit(event, data)
    }
  } catch (error) {
    console.error('Error emitting WebSocket event:', error)
  }
}