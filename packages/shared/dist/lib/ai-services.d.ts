export interface AIGeneratedContent {
    title?: string;
    transcript?: string;
    summary?: string;
    followUpQuestions?: string[];
    chapterSummary?: string;
    processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
    confidence?: number;
}
export interface TranscriptionResult {
    text: string;
    confidence: number;
    segments?: Array<{
        start: number;
        end: number;
        text: string;
    }>;
}
export interface AITitleSuggestion {
    title: string;
    confidence: number;
    reasoning?: string;
}
export interface AIFollowUpQuestion {
    question: string;
    category: 'clarification' | 'expansion' | 'emotional' | 'factual';
    priority: number;
}
export declare class AIService {
    private static readonly MOCK_DELAY;
    /**
     * Generate AI title suggestions based on audio content
     */
    static generateTitle(audioBlob: Blob, prompt?: string): Promise<AITitleSuggestion[]>;
    /**
     * Transcribe audio to text
     */
    static transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult>;
    /**
     * Generate follow-up questions based on story content
     */
    static generateFollowUpQuestions(transcript: string, prompt: string): Promise<AIFollowUpQuestion[]>;
    /**
     * Generate chapter summary based on multiple stories
     */
    static generateChapterSummary(stories: Array<{
        title: string;
        transcript: string;
    }>, chapterTitle: string): Promise<string>;
    /**
     * Generate story summary for feed display
     */
    static generateStorySummary(transcript: string, maxLength?: number): Promise<string>;
    /**
     * Analyze story content for themes and emotions
     */
    static analyzeStoryContent(transcript: string): Promise<{
        themes: string[];
        emotions: string[];
        keyMoments: string[];
        confidence: number;
    }>;
    /**
     * Process audio file and generate all AI content
     */
    static processStoryAudio(audioBlob: Blob, prompt: string, onProgress?: (step: string, progress: number) => void): Promise<AIGeneratedContent>;
}
export declare function formatConfidence(confidence: number): string;
export declare function getProcessingStatusMessage(status: AIGeneratedContent['processingStatus']): string;
export declare function shouldShowAIContent(content: AIGeneratedContent): boolean;
//# sourceMappingURL=ai-services.d.ts.map