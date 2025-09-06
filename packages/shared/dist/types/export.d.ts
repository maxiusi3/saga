export interface ExportRequest {
    id: string;
    projectId: string;
    facilitatorId: string;
    status: 'pending' | 'processing' | 'ready' | 'failed' | 'expired';
    downloadUrl?: string;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateExportRequestInput {
    projectId: string;
    facilitatorId: string;
}
export interface UpdateExportRequestInput {
    status?: 'pending' | 'processing' | 'ready' | 'failed' | 'expired';
    downloadUrl?: string;
    expiresAt?: Date;
}
export interface ArchivalExportOptions {
    includeAudio: boolean;
    includePhotos: boolean;
    includeTranscripts: boolean;
    includeInteractions: boolean;
    includeChapterSummaries: boolean;
    includeMetadata: boolean;
    format: 'zip' | 'json';
    dateRange?: {
        startDate: Date;
        endDate: Date;
    };
    chapters?: string[];
}
export interface ExportManifest {
    projectInfo: {
        id: string;
        name: string;
        description: string;
        status: string;
        createdAt: Date;
        archivedAt?: Date;
        facilitators: Array<{
            id: string;
            name: string;
            email: string;
            role: string;
        }>;
        storyteller?: {
            id: string;
            name: string;
            email: string;
        };
    };
    exportInfo: {
        exportedAt: Date;
        exportedBy: string;
        options: ArchivalExportOptions;
        totalStories: number;
        totalInteractions: number;
        totalChapters: number;
        totalFiles: number;
        totalSize: number;
    };
    structure: {
        folders: string[];
        files: Array<{
            path: string;
            type: string;
            size: number;
            description: string;
        }>;
    };
}
//# sourceMappingURL=export.d.ts.map