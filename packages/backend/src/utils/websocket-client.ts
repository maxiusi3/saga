import { io, Socket } from 'socket.io-client'
import { WEBSOCKET_EVENTS } from '@saga/shared'

export interface WebSocketClientOptions {
  url: string
  token: string
  autoReconnect?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
}

export class WebSocketClient {
  private socket: Socket | null = null
  private options: WebSocketClientOptions
  private reconnectCount = 0
  private isConnecting = false

  constructor(options: WebSocketClientOptions) {
    this.options = {
      autoReconnect: true,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      ...options,
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve()
        return
      }

      if (this.isConnecting) {
        reject(new Error('Connection already in progress'))
        return
      }

      this.isConnecting = true

      this.socket = io(this.options.url, {
        auth: {
          token: this.options.token,
        },
        transports: ['websocket'],
        upgrade: false,
      })

      this.socket.on('connect', () => {
        console.log('WebSocket connected')
        this.isConnecting = false
        this.reconnectCount = 0
        resolve()
      })

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error)
        this.isConnecting = false
        
        if (this.options.autoReconnect && this.reconnectCount < this.options.reconnectAttempts!) {
          this.scheduleReconnect()
        } else {
          reject(error)
        }
      })

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason)
        
        if (this.options.autoReconnect && reason !== 'io client disconnect') {
          this.scheduleReconnect()
        }
      })

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error)
      })

      // Handle server shutdown gracefully
      this.socket.on(WEBSOCKET_EVENTS.SERVER_SHUTDOWN, (data) => {
        console.log('Server shutdown notification:', data.message)
        this.scheduleReconnect()
      })
    })
  }

  private scheduleReconnect(): void {
    if (this.reconnectCount >= this.options.reconnectAttempts!) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectCount++
    const delay = this.options.reconnectDelay! * Math.pow(2, this.reconnectCount - 1) // Exponential backoff

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectCount}/${this.options.reconnectAttempts})`)

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error)
      })
    }, delay)
  }

  joinProject(projectId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to WebSocket server'))
        return
      }

      this.socket.emit(WEBSOCKET_EVENTS.JOIN_PROJECT, projectId)

      const timeout = setTimeout(() => {
        reject(new Error('Join project timeout'))
      }, 5000)

      this.socket.once(WEBSOCKET_EVENTS.JOINED_PROJECT, (data) => {
        clearTimeout(timeout)
        if (data.projectId === projectId) {
          resolve()
        } else {
          reject(new Error('Joined wrong project'))
        }
      })

      this.socket.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  }

  leaveProject(projectId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to WebSocket server'))
        return
      }

      this.socket.emit(WEBSOCKET_EVENTS.LEAVE_PROJECT, projectId)

      const timeout = setTimeout(() => {
        reject(new Error('Leave project timeout'))
      }, 5000)

      this.socket.once(WEBSOCKET_EVENTS.LEFT_PROJECT, (data) => {
        clearTimeout(timeout)
        if (data.projectId === projectId) {
          resolve()
        } else {
          reject(new Error('Left wrong project'))
        }
      })

      this.socket.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  }

  onStoryUploaded(callback: (data: any) => void): void {
    this.socket?.on(WEBSOCKET_EVENTS.STORY_UPLOADED, callback)
  }

  onInteractionAdded(callback: (data: any) => void): void {
    this.socket?.on(WEBSOCKET_EVENTS.INTERACTION_ADDED, callback)
  }

  onTranscriptUpdated(callback: (data: any) => void): void {
    this.socket?.on(WEBSOCKET_EVENTS.TRANSCRIPT_UPDATED, callback)
  }

  onExportReady(callback: (data: any) => void): void {
    this.socket?.on(WEBSOCKET_EVENTS.EXPORT_READY, callback)
  }

  ping(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to WebSocket server'))
        return
      }

      this.socket.emit(WEBSOCKET_EVENTS.PING)

      const timeout = setTimeout(() => {
        reject(new Error('Ping timeout'))
      }, 5000)

      this.socket.once(WEBSOCKET_EVENTS.PONG, () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  get connected(): boolean {
    return this.socket?.connected || false
  }

  get id(): string | undefined {
    return this.socket?.id
  }
}