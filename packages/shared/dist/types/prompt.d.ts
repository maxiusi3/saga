export interface Prompt {
    id: string;
    text: string;
    audio_url?: string;
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
    follow_up_questions?: string[];
    tags?: string[];
    personalized_for?: string;
    is_library_prompt: boolean;
    template_id?: string;
    chapter_id?: string;
    order_index: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface UserPrompt {
    id: string;
    project_id: string;
    created_by: string;
    parent_story_id?: string;
    text: string;
    priority: number;
    is_delivered: boolean;
    created_at: Date;
}
export interface PromptDelivery {
    prompt: Prompt;
    audio_url?: string;
    follow_up_questions?: string[];
    chapter_context?: {
        id: string;
        name: string;
        description?: string;
        order_index: number;
    };
}
export interface PromptResponse {
    prompt_id: string;
    response_text?: string;
    audio_file?: File;
    skip_reason?: string;
}
export interface NextPromptRequest {
    project_id: string;
    current_chapter_id?: string;
    skip_current?: boolean;
}
export interface PromptProgress {
    current_chapter: {
        id: string;
        name: string;
        order_index: number;
    };
    current_prompt: Prompt;
    chapter_progress: number;
    overall_progress: number;
    remaining_prompts: number;
}
export interface AIPrompt extends Prompt {
}
export interface PromptCategory {
    id: string;
    name: string;
    description: string;
    icon: string;
}
export interface PromptGenerationRequest {
    userId: string;
    category?: string;
    previousPrompts?: string[];
    userPreferences?: {
        topics?: string[];
        avoidTopics?: string[];
        culturalBackground?: string;
        ageRange?: string;
    };
    storyContext?: {
        recentStories?: any[];
        themes?: string[];
    };
}
export interface UserPromptHistory {
    id: string;
    userId: string;
    promptId: string;
    status: 'presented' | 'used' | 'skipped';
    skipReason?: string;
    storyId?: string;
    createdAt: Date;
    updatedAt: Date;
    prompt?: AIPrompt;
}
export interface PromptLibraryEntry {
    id: string;
    template: string;
    category: AIPrompt['category'];
    difficulty: AIPrompt['difficulty'];
    tags: string[];
    variations: string[];
    followUpTemplates: string[];
}
export interface DailyPromptResponse {
    prompt: AIPrompt;
    isPersonalized: boolean;
    category: string;
    dayOfWeek: number;
}
export interface RelatedPromptsResponse {
    prompts: AIPrompt[];
    basedOnStory: {
        id: string;
        title?: string;
        themes: string[];
    };
}
export interface FollowUpQuestionsRequest {
    storyContent: string;
    originalPrompt: string;
}
export interface FollowUpQuestionsResponse {
    questions: string[];
    generatedAt: Date;
}
export interface PromptHistoryResponse {
    prompts: UserPromptHistory[];
    total: number;
    limit: number;
    offset: number;
}
export interface PromptUsageStats {
    totalPrompts: number;
    usedPrompts: number;
    skippedPrompts: number;
    favoriteCategory: string;
    averageDifficulty: string;
    streakDays: number;
}
export type PromptStatus = 'presented' | 'used' | 'skipped';
export type PromptDifficulty = 'easy' | 'medium' | 'hard';
export type PromptCategoryType = 'childhood' | 'family' | 'career' | 'relationships' | 'general';
export interface GetDailyPromptResponse {
    success: boolean;
    data: DailyPromptResponse;
}
export interface GetPersonalizedPromptResponse {
    success: boolean;
    data: AIPrompt;
}
export interface GetPromptByCategoryResponse {
    success: boolean;
    data: AIPrompt;
}
export interface GetRelatedPromptsResponse {
    success: boolean;
    data: RelatedPromptsResponse;
}
export interface GetPromptCategoriesResponse {
    success: boolean;
    data: PromptCategory[];
}
export interface GetPromptHistoryResponse {
    success: boolean;
    data: PromptHistoryResponse;
}
export interface GenerateFollowUpQuestionsResponse {
    success: boolean;
    data: FollowUpQuestionsResponse;
}
export interface PromptError {
    code: string;
    message: string;
    details?: any;
}
export interface PromptApiError {
    success: false;
    error: PromptError;
}
//# sourceMappingURL=prompt.d.ts.map