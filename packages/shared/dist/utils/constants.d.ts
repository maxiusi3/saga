export declare const API_ENDPOINTS: {
    readonly AUTH: {
        readonly SIGNUP: "/api/auth/signup";
        readonly SIGNIN: "/api/auth/signin";
        readonly OAUTH_GOOGLE: "/api/auth/oauth/google";
        readonly OAUTH_APPLE: "/api/auth/oauth/apple";
        readonly REFRESH: "/api/auth/refresh";
        readonly SIGNOUT: "/api/auth/signout";
    };
    readonly PROJECTS: {
        readonly LIST: "/api/projects";
        readonly CREATE: "/api/projects";
        readonly GET: (id: string) => string;
        readonly UPDATE: (id: string) => string;
        readonly DELETE: (id: string) => string;
        readonly INVITATION: (id: string) => string;
        readonly STORIES: (id: string) => string;
    };
    readonly STORIES: {
        readonly GET: (id: string) => string;
        readonly UPDATE_TRANSCRIPT: (id: string) => string;
        readonly INTERACTIONS: (id: string) => string;
    };
    readonly INVITATIONS: {
        readonly ACCEPT: (token: string) => string;
    };
    readonly EXPORTS: {
        readonly CREATE: (projectId: string) => string;
        readonly STATUS: (id: string) => string;
        readonly DOWNLOAD: (id: string) => string;
    };
};
export declare const FILE_LIMITS: {
    readonly AUDIO: {
        readonly MAX_SIZE: number;
        readonly MAX_DURATION: 600;
        readonly ALLOWED_TYPES: readonly ["audio/mpeg", "audio/wav", "audio/mp4", "audio/aac"];
    };
    readonly IMAGE: {
        readonly MAX_SIZE: number;
        readonly ALLOWED_TYPES: readonly ["image/jpeg", "image/png", "image/webp"];
    };
};
export declare const PAGINATION: {
    readonly DEFAULT_LIMIT: 20;
    readonly MAX_LIMIT: 100;
};
export declare const INVITATION: {
    readonly EXPIRY_HOURS: 72;
};
export declare const SUBSCRIPTION: {
    readonly SAGA_PACKAGE_PRICE: 12900;
};
export declare const WEBSOCKET_EVENTS: {
    readonly JOIN_PROJECT: "join_project";
    readonly LEAVE_PROJECT: "leave_project";
    readonly JOINED_PROJECT: "joined_project";
    readonly LEFT_PROJECT: "left_project";
    readonly STORY_UPLOADED: "story_uploaded";
    readonly STORY_PROCESSING: "story_processing";
    readonly STORY_PROCESSED: "story_processed";
    readonly TRANSCRIPT_UPDATED: "transcript_updated";
    readonly INTERACTION_ADDED: "interaction_added";
    readonly INTERACTION_UPDATED: "interaction_updated";
    readonly TYPING_START: "typing_start";
    readonly TYPING_STOP: "typing_stop";
    readonly EXPORT_STARTED: "export_started";
    readonly EXPORT_PROGRESS: "export_progress";
    readonly EXPORT_READY: "export_ready";
    readonly EXPORT_FAILED: "export_failed";
    readonly USER_ONLINE: "user_online";
    readonly USER_OFFLINE: "user_offline";
    readonly SERVER_SHUTDOWN: "server_shutdown";
    readonly PING: "ping";
    readonly PONG: "pong";
    readonly ERROR: "error";
    readonly RATE_LIMIT_EXCEEDED: "rate_limit_exceeded";
};
//# sourceMappingURL=constants.d.ts.map