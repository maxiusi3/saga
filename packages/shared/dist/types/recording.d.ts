/**
 * Recording-related types for v1.5 confirmation workflow
 */
/**
 * Local recording draft for client-side persistence
 * Used for "Review & Send" workflow and crash recovery
 */
export interface LocalRecordingDraft {
    sessionId: string;
    userId: string;
    projectId: string;
    localAudioUri: string;
    duration: number;
    localPhotoUri?: string;
    createdAt: Date;
    promptId?: string;
    userPromptId?: string;
    chapterId?: string;
}
/**
 * Recording quality validation result
 */
export interface RecordingQuality {
    isValid: boolean;
    duration: number;
    fileSize: number;
    format: string;
    sampleRate?: number;
    bitRate?: number;
    issues: RecordingIssue[];
}
/**
 * Recording quality issues
 */
export interface RecordingIssue {
    type: 'duration' | 'fileSize' | 'format' | 'quality' | 'corruption';
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
}
/**
 * Recording upload progress
 */
export interface RecordingUploadProgress {
    sessionId: string;
    bytesUploaded: number;
    totalBytes: number;
    percentage: number;
    status: 'uploading' | 'processing' | 'completed' | 'failed';
    error?: string;
}
/**
 * Recording metadata for analytics
 */
export interface RecordingMetadata {
    deviceInfo: {
        platform: 'ios' | 'android';
        version: string;
        model?: string;
    };
    recordingEnvironment: {
        hasHeadphones: boolean;
        backgroundNoise?: 'low' | 'medium' | 'high';
        location?: 'indoor' | 'outdoor';
    };
    userBehavior: {
        retryCount: number;
        reviewDuration: number;
        editedTranscript: boolean;
    };
}
//# sourceMappingURL=recording.d.ts.map