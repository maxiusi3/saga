export interface StoryPrompt {
    id: string;
    chapter: string;
    chapterNumber: number;
    category: string;
    text: string;
    followUpSuggestions?: string[];
    estimatedTime: number;
}
export interface PromptChapter {
    id: string;
    title: string;
    number: number;
    description: string;
    prompts: StoryPrompt[];
}
export declare const AI_PROMPT_CHAPTERS: PromptChapter[];
export declare function getAllPrompts(): StoryPrompt[];
export declare function getPromptsByChapter(chapterNumber: number): StoryPrompt[];
export declare function getNextPrompt(currentPromptId?: string): StoryPrompt | null;
export declare function getPromptById(id: string): StoryPrompt | null;
export type AIPrompt = StoryPrompt;
export declare function getChapterProgress(completedPromptIds: string[]): {
    [chapterNumber: number]: {
        completed: number;
        total: number;
    };
};
//# sourceMappingURL=ai-prompts.d.ts.map