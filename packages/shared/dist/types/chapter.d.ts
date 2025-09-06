export interface Chapter {
    id: string;
    name: string;
    description?: string;
    order_index: number;
    is_active: boolean;
    created_at: Date;
}
export interface ChapterSummary {
    id: string;
    project_id: string;
    chapter_id?: string;
    summary: string;
    story_count: number;
    created_at: Date;
}
export interface ProjectPromptState {
    project_id: string;
    current_chapter_id?: string;
    current_prompt_index: number;
    last_prompt_delivered_at?: Date;
    updated_at: Date;
}
export interface ChapterProgress {
    chapter: Chapter;
    completed_prompts: number;
    total_prompts: number;
    stories_count: number;
    is_current: boolean;
}
export interface CreateChapterSummaryInput {
    projectId: string;
    storyIds: string[];
    theme?: string;
    title?: string;
}
export interface ChapterSummaryGenerationRequest {
    projectId: string;
    stories: {
        id: string;
        transcript?: string;
        aiPrompt?: string;
        createdAt: Date;
        title?: string;
    }[];
    theme?: string;
}
export interface ChapterSummaryResponse {
    title: string;
    description: string;
    theme: string;
    keyHighlights: string[];
    timeframe?: {
        start?: string;
        end?: string;
    };
    emotionalTone: 'positive' | 'neutral' | 'reflective' | 'bittersweet';
}
export interface ThematicGroup {
    theme: string;
    stories: {
        id: string;
        transcript?: string;
        aiPrompt?: string;
        createdAt: Date;
        title?: string;
    }[];
    confidence: number;
    keywords: string[];
}
export interface ChapterAnalysisResult {
    groups: ThematicGroup[];
    suggestedChapters: {
        theme: string;
        storyIds: string[];
        confidence: number;
    }[];
}
export interface GetChapterSummariesResponse {
    success: boolean;
    data: ChapterSummary[];
}
export interface GetChapterSummaryResponse {
    success: boolean;
    data: ChapterSummary;
}
export interface CreateChapterSummaryResponse {
    success: boolean;
    data: ChapterSummary;
}
export interface AnalyzeStoriesForChaptersResponse {
    success: boolean;
    data: ChapterAnalysisResult;
}
//# sourceMappingURL=chapter.d.ts.map