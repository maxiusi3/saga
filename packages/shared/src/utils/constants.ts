export const API_ENDPOINTS = {
  AUTH: {
    SIGNUP: '/api/auth/signup',
    SIGNIN: '/api/auth/signin',
    OAUTH_GOOGLE: '/api/auth/oauth/google',
    OAUTH_APPLE: '/api/auth/oauth/apple',
    REFRESH: '/api/auth/refresh',
    SIGNOUT: '/api/auth/signout',
  },
  PROJECTS: {
    LIST: '/api/projects',
    CREATE: '/api/projects',
    GET: (id: string) => `/api/projects/${id}`,
    UPDATE: (id: string) => `/api/projects/${id}`,
    DELETE: (id: string) => `/api/projects/${id}`,
    INVITATION: (id: string) => `/api/projects/${id}/invitation`,
    STORIES: (id: string) => `/api/projects/${id}/stories`,
  },
  STORIES: {
    GET: (id: string) => `/api/stories/${id}`,
    UPDATE_TRANSCRIPT: (id: string) => `/api/stories/${id}/transcript`,
    INTERACTIONS: (id: string) => `/api/stories/${id}/interactions`,
  },
  INVITATIONS: {
    ACCEPT: (token: string) => `/api/invitations/${token}/accept`,
  },
  EXPORTS: {
    CREATE: (projectId: string) => `/api/projects/${projectId}/export`,
    STATUS: (id: string) => `/api/exports/${id}/status`,
    DOWNLOAD: (id: string) => `/api/exports/${id}/download`,
  },
} as const

export const FILE_LIMITS = {
  AUDIO: {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    MAX_DURATION: 600, // 10 minutes
    ALLOWED_TYPES: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac'],
  },
  IMAGE: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  },
} as const

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const

export const INVITATION = {
  EXPIRY_HOURS: 72,
} as const

export const SUBSCRIPTION = {
  SAGA_PACKAGE_PRICE: 12900, // $129.00 in cents
} as const

export const WEBSOCKET_EVENTS = {
  // Connection events
  JOIN_PROJECT: 'join_project',
  LEAVE_PROJECT: 'leave_project',
  JOINED_PROJECT: 'joined_project',
  LEFT_PROJECT: 'left_project',
  
  // Story events
  STORY_UPLOADED: 'story_uploaded',
  STORY_PROCESSING: 'story_processing',
  STORY_PROCESSED: 'story_processed',
  TRANSCRIPT_UPDATED: 'transcript_updated',
  
  // Interaction events
  INTERACTION_ADDED: 'interaction_added',
  INTERACTION_UPDATED: 'interaction_updated',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  
  // Export events
  EXPORT_STARTED: 'export_started',
  EXPORT_PROGRESS: 'export_progress',
  EXPORT_READY: 'export_ready',
  EXPORT_FAILED: 'export_failed',
  
  // System events
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  SERVER_SHUTDOWN: 'server_shutdown',
  
  // Health check
  PING: 'ping',
  PONG: 'pong',
  
  // Error events
  ERROR: 'error',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
} as const