"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEBSOCKET_EVENTS = exports.SUBSCRIPTION = exports.INVITATION = exports.PAGINATION = exports.FILE_LIMITS = exports.API_ENDPOINTS = void 0;
exports.API_ENDPOINTS = {
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
        GET: (id) => `/api/projects/${id}`,
        UPDATE: (id) => `/api/projects/${id}`,
        DELETE: (id) => `/api/projects/${id}`,
        INVITATION: (id) => `/api/projects/${id}/invitation`,
        STORIES: (id) => `/api/projects/${id}/stories`,
    },
    STORIES: {
        GET: (id) => `/api/stories/${id}`,
        UPDATE_TRANSCRIPT: (id) => `/api/stories/${id}/transcript`,
        INTERACTIONS: (id) => `/api/stories/${id}/interactions`,
    },
    INVITATIONS: {
        ACCEPT: (token) => `/api/invitations/${token}/accept`,
    },
    EXPORTS: {
        CREATE: (projectId) => `/api/projects/${projectId}/export`,
        STATUS: (id) => `/api/exports/${id}/status`,
        DOWNLOAD: (id) => `/api/exports/${id}/download`,
    },
};
exports.FILE_LIMITS = {
    AUDIO: {
        MAX_SIZE: 50 * 1024 * 1024, // 50MB
        MAX_DURATION: 600, // 10 minutes
        ALLOWED_TYPES: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac'],
    },
    IMAGE: {
        MAX_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    },
};
exports.PAGINATION = {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
};
exports.INVITATION = {
    EXPIRY_HOURS: 72,
};
exports.SUBSCRIPTION = {
    SAGA_PACKAGE_PRICE: 12900, // $129.00 in cents
};
exports.WEBSOCKET_EVENTS = {
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
};
//# sourceMappingURL=constants.js.map