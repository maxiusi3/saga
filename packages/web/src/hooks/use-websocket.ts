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
    // WebSocket is disabled in serverless architecture
    // Real-time updates are handled by Supabase Realtime instead
    console.log('WebSocket connect called - using Supabase Realtime instead')
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      error: 'WebSocket not available in serverless mode. Use Supabase Realtime.',
    }))
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