import { Story } from './story';
export interface StoryRecommendation {
    story: Story;
    score: number;
    reason: string;
    type: 'chapter_related' | 'similar_content' | 'recent' | 'popular';
}
export interface StoryInsights {
    totalStories: number;
    averageDuration: number;
    totalDuration: number;
    chaptersCompleted: number;
    mostActiveChapter: string;
    engagementScore: number;
    completionRate: number;
}
export interface StoryQualityMetrics {
    storyId: string;
    lengthScore: number;
    engagementScore: number;
    interactionCount: number;
    overallQuality: number;
}
export interface StoryTimeline {
    stories: Story[];
    timeline: Array<{
        date: string;
        stories: Story[];
    }>;
}
export interface StoryFavorite {
    id: string;
    userId: string;
    storyId: string;
    createdAt: Date;
}
export interface DiscoveryFilters {
    chapterId?: string;
    storytellerId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
}
//# sourceMappingURL=story-discovery.d.ts.map