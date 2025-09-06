export interface StoryShare {
    id: string;
    storyId: string;
    sharedById: string;
    sharedWithId: string;
    message?: string;
    createdAt: Date;
    story?: {
        id: string;
        title?: string;
        audioUrl: string;
        transcript?: string;
        photoUrl?: string;
        createdAt: Date;
        storyteller?: {
            name: string;
        };
    };
    sharedBy?: {
        id: string;
        name: string;
    };
    sharedWith?: {
        id: string;
        name: string;
    };
}
export interface ShareStoryRequest {
    memberIds: string[];
    message?: string;
}
export interface StoryStatistics {
    totalDuration: number;
    averageDuration: number;
    totalStories: number;
    interactionCount: number;
    completionRate: number;
    engagementScore: number;
    topChapters: Array<{
        chapterId: string;
        chapterName: string;
        storyCount: number;
        averageDuration: number;
    }>;
    recentActivity: Array<{
        date: string;
        storiesCount: number;
        interactionsCount: number;
    }>;
}
export interface CompletionTracking {
    totalPrompts: number;
    answeredPrompts: number;
    completionRate: number;
    chapterProgress: Array<{
        chapterId: string;
        chapterName: string;
        totalPrompts: number;
        answeredPrompts: number;
        completionRate: number;
    }>;
}
//# sourceMappingURL=story-sharing.d.ts.map