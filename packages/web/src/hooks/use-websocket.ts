import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/auth-store'
import { WEBSOCKET_EVENTS } from '@saga/shared'
import { toast } from 'react-hot-toast'

interface UseWebSocketOptions {
  autoConnect?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
}

interface WebSocketState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  reconnectCount: number
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
  } = options

  const socketRef = useRef<Socket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { isAuthenticated } = useAuthStore()

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectCount: 0,
  })

  const connect = () => {
    if (socketRef.current?.connected || state.isConnecting || !isAuthenticated) {
      return
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    const token = localStorage.getItem('accessToken')
    if (!token) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: 'No authentication token available',
      }))
      return
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'
    
    socketRef.current = io(wsUrl, {
      auth: { token },
      transports: ['websocket'],
      upgrade: false,
    })

    const socket = socketRef.current

    socket.on('connect', () => {
      console.log('WebSocket connected')
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        error: null,
        reconnectCount: 0,
      }))
    })

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
      }))

      // Auto-reconnect unless manually disconnected
      if (reason !== 'io client disconnect' && state.reconnectCount < reconnectAttempts) {
        scheduleReconnect()
      }
    })

    socket.on('connect_error', (error) => {
      console.log('WebSocket connection error (demo mode):', error.message)
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: error.message,
      }))

      // In demo mode, don't show error toasts or attempt reconnection
      // if (state.reconnectCount < reconnectAttempts) {
      //   scheduleReconnect()
      // } else {
      //   toast.error('Failed to connect to real-time updates')
      // }
    })

    socket.on('error', (error) => {
      console.error('WebSocket error:', error)
      if (error.code === 'PROJECT_ACCESS_DENIED') {
        toast.error('Access denied to project')
      } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
        toast.error('Too many requests. Please slow down.')
      }
    })

    socket.on(WEBSOCKET_EVENTS.SERVER_SHUTDOWN, (data) => {
      toast('Server is restarting. Reconnecting...', { icon: '🔄' })
      scheduleReconnect()
    })
  }

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    const delay = reconnectDelay * Math.pow(2, state.reconnectCount) // Exponential backoff
    
    setState(prev => ({ ...prev, reconnectCount: prev.reconnectCount + 1 }))

    reconnectTimeoutRef.current = setTimeout(() => {
      if (isAuthenticated) {
        connect()
      }
    }, delay)
  }

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    setState({
      isConnected: false,
      isConnecting: false,
      error: null,
      reconnectCount: 0,
    })
  }

  const joinProject = (projectId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(WEBSOCKET_EVENTS.JOIN_PROJECT, projectId)
    }
  }

  const leaveProject = (projectId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(WEBSOCKET_EVENTS.LEAVE_PROJECT, projectId)
    }
  }

  const on = (event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback)
    }
  }

  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback)
    }
  }

  const emit = (event: string, ...args: any[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, ...args)
    }
  }

  // Auto-connect when authenticated
  useEffect(() => {
    if (autoConnect && isAuthenticated && !socketRef.current) {
      connect()
    } else if (!isAuthenticated && socketRef.current) {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [isAuthenticated, autoConnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  return {
    ...state,
    connect,
    disconnect,
    joinProject,
    leaveProject,
    on,
    off,
    emit,
    socket: socketRef.current,
  }
}

// Hook for project-specific WebSocket events
export const useProjectWebSocket = (projectId: string | null) => {
  const websocket = useWebSocket()

  useEffect(() => {
    if (projectId && websocket.isConnected) {
      websocket.joinProject(projectId)
      
      return () => {
        websocket.leaveProject(projectId)
      }
    }
  }, [projectId, websocket.isConnected])

  const onStoryUploaded = (callback: (data: any) => void) => {
    websocket.on(WEBSOCKET_EVENTS.STORY_UPLOADED, callback)
    return () => websocket.off(WEBSOCKET_EVENTS.STORY_UPLOADED, callback)
  }

  const onInteractionAdded = (callback: (data: any) => void) => {
    websocket.on(WEBSOCKET_EVENTS.INTERACTION_ADDED, callback)
    return () => websocket.off(WEBSOCKET_EVENTS.INTERACTION_ADDED, callback)
  }

  const onTranscriptUpdated = (callback: (data: any) => void) => {
    websocket.on(WEBSOCKET_EVENTS.TRANSCRIPT_UPDATED, callback)
    return () => websocket.off(WEBSOCKET_EVENTS.TRANSCRIPT_UPDATED, callback)
  }

  const onExportReady = (callback: (data: any) => void) => {
    websocket.on(WEBSOCKET_EVENTS.EXPORT_READY, callback)
    return () => websocket.off(WEBSOCKET_EVENTS.EXPORT_READY, callback)
  }

  return {
    ...websocket,
    onStoryUploaded,
    onInteractionAdded,
    onTranscriptUpdated,
    onExportReady,
  }
}