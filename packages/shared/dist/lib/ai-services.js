"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
exports.formatConfidence = formatConfidence;
exports.getProcessingStatusMessage = getProcessingStatusMessage;
exports.shouldShowAIContent = shouldShowAIContent;
// Mock AI service functions - replace with actual AI API calls
class AIService {
    /**
     * Generate AI title suggestions based on audio content
     */
    static async generateTitle(audioBlob, prompt) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, this.MOCK_DELAY));
        // Mock title generation based on prompt keywords
        const mockTitles = [
            { title: "My First Day at the Factory", confidence: 0.92, reasoning: "Based on workplace and first experience keywords" },
            { title: "Starting My Career Journey", confidence: 0.87, reasoning: "Based on career and beginning themes" },
            { title: "Walking Into My Future", confidence: 0.81, reasoning: "Based on transition and growth themes" }
        ];
        return mockTitles;
    }
    /**
     * Transcribe audio to text
     */
    static async transcribeAudio(audioBlob) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, this.MOCK_DELAY * 1.5));
        // Mock transcription result
        return {
            text: "Well, I remember walking into that big factory building for the first time. I was just eighteen years old, and I had never seen anything like it. The sound of the machines was overwhelming, and there were people everywhere. My supervisor, Mr. Johnson, showed me around and introduced me to my coworkers. I was nervous but excited to start earning my own money and learning a trade.",
            confidence: 0.94,
            segments: [
                { start: 0, end: 15, text: "Well, I remember walking into that big factory building for the first time." },
                { start: 15, end: 30, text: "I was just eighteen years old, and I had never seen anything like it." },
                { start: 30, end: 45, text: "The sound of the machines was overwhelming, and there were people everywhere." }
            ]
        };
    }
    /**
     * Generate follow-up questions based on story content
     */
    static async generateFollowUpQuestions(transcript, prompt) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, this.MOCK_DELAY));
        // Mock follow-up questions
        return [
            {
                question: "What were your coworkers like? Did you make any lasting friendships there?",
                category: 'expansion',
                priority: 1
            },
            {
                question: "How did you feel at the end of that first day?",
                category: 'emotional',
                priority: 2
            },
            {
                question: "What was the most challenging part of learning the job?",
                category: 'clarification',
                priority: 3
            }
        ];
    }
    /**
     * Generate chapter summary based on multiple stories
     */
    static async generateChapterSummary(stories, chapterTitle) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, this.MOCK_DELAY));
        // Mock chapter summary
        return `This chapter captures the essence of early career experiences and the transition into adulthood. Through ${stories.length} stories, we see themes of courage, learning, and personal growth. The storyteller shares vivid memories of first jobs, workplace relationships, and the challenges of entering the professional world. These experiences shaped their work ethic and understanding of responsibility.`;
    }
    /**
     * Generate story summary for feed display
     */
    static async generateStorySummary(transcript, maxLength = 150) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, this.MOCK_DELAY / 2));
        // Handle null/undefined transcript
        if (!transcript || typeof transcript !== 'string') {
            return 'No content available';
        }
        // Mock summary generation
        const words = transcript.split(' ');
        if (words.length <= maxLength / 6) { // Rough estimate of words to characters
            return transcript;
        }
        // Simple truncation with ellipsis for mock
        const truncated = words.slice(0, Math.floor(maxLength / 6)).join(' ');
        return truncated + '...';
    }
    /**
     * Analyze story content for themes and emotions
     */
    static async analyzeStoryContent(transcript) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, this.MOCK_DELAY));
        // Mock content analysis
        return {
            themes: ['Career', 'First Experiences', 'Personal Growth', 'Workplace'],
            emotions: ['Nervousness', 'Excitement', 'Determination', 'Pride'],
            keyMoments: [
                'Walking into the factory for the first time',
                'Meeting the supervisor',
                'Feeling overwhelmed by the machines'
            ],
            confidence: 0.89
        };
    }
    /**
     * Process audio file and generate all AI content
     */
    static async processStoryAudio(audioBlob, prompt, onProgress) {
        try {
            onProgress?.('Starting transcription...', 10);
            const transcription = await this.transcribeAudio(audioBlob);
            onProgress?.('Generating title suggestions...', 40);
            const titleSuggestions = await this.generateTitle(audioBlob, prompt);
            onProgress?.('Creating follow-up questions...', 70);
            const followUpQuestions = await this.generateFollowUpQuestions(transcription.text, prompt);
            onProgress?.('Generating summary...', 90);
            const summary = await this.generateStorySummary(transcription.text);
            onProgress?.('Processing complete!', 100);
            return {
                title: titleSuggestions[0]?.title,
                transcript: transcription.text,
                summary,
                followUpQuestions: followUpQuestions.map(q => q.question),
                processingStatus: 'completed',
                confidence: transcription.confidence
            };
        }
        catch (error) {
            console.error('AI processing failed:', error);
            return {
                processingStatus: 'failed'
            };
        }
    }
}
exports.AIService = AIService;
AIService.MOCK_DELAY = 2000; // 2 seconds for demo
// Utility functions for AI content
function formatConfidence(confidence) {
    return `${Math.round(confidence * 100)}%`;
}
function getProcessingStatusMessage(status) {
    switch (status) {
        case 'pending':
            return 'Waiting to process...';
        case 'processing':
            return 'AI is analyzing your story...';
        case 'completed':
            return 'Processing complete!';
        case 'failed':
            return 'Processing failed. Please try again.';
        default:
            return 'Unknown status';
    }
}
function shouldShowAIContent(content) {
    return !!(content.processingStatus === 'completed' && (!!content.title ||
        !!content.transcript ||
        !!content.summary ||
        (!!content.followUpQuestions && content.followUpQuestions.length > 0)));
}
//# sourceMappingURL=ai-services.js.map