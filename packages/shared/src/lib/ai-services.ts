export interface AIGeneratedContent {
  title?: string
  transcript?: string
  summary?: string
  followUpQuestions?: string[]
  chapterSummary?: string
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed'
  confidence?: number
}

export interface TranscriptionResult {
  text: string
  confidence: number
  segments?: Array<{
    start: number
    end: number
    text: string
  }>
}

export interface AITitleSuggestion {
  title: string
  confidence: number
  reasoning?: string
}

export interface AIFollowUpQuestion {
  question: string
  category: 'clarification' | 'expansion' | 'emotional' | 'factual'
  priority: number
}

// Mock AI service functions - replace with actual AI API calls
export class AIService {
  private static readonly MOCK_DELAY = 2000 // 2 seconds for demo

  /**
   * Generate AI title suggestions based on audio content
   */
  static async generateTitle(audioBlob: Blob, prompt?: string): Promise<AITitleSuggestion[]> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, this.MOCK_DELAY))
    
    // Mock title generation based on prompt keywords
    const mockTitles = [
      { title: "My First Day at the Factory", confidence: 0.92, reasoning: "Based on workplace and first experience keywords" },
      { title: "Starting My Career Journey", confidence: 0.87, reasoning: "Based on career and beginning themes" },
      { title: "Walking Into My Future", confidence: 0.81, reasoning: "Based on transition and growth themes" }
    ]
    
    return mockTitles
  }

  /**
   * Transcribe audio to text
   */
  static async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, this.MOCK_DELAY * 1.5))
    
    // Mock transcription result
    return {
      text: "Well, I remember walking into that big factory building for the first time. I was just eighteen years old, and I had never seen anything like it. The sound of the machines was overwhelming, and there were people everywhere. My supervisor, Mr. Johnson, showed me around and introduced me to my coworkers. I was nervous but excited to start earning my own money and learning a trade.",
      confidence: 0.94,
      segments: [
        { start: 0, end: 15, text: "Well, I remember walking into that big factory building for the first time." },
        { start: 15, end: 30, text: "I was just eighteen years old, and I had never seen anything like it." },
        { start: 30, end: 45, text: "The sound of the machines was overwhelming, and there were people everywhere." }
      ]
    }
  }

  /**
   * Generate follow-up questions based on story content
   */
  static async generateFollowUpQuestions(transcript: string, prompt: string): Promise<AIFollowUpQuestion[]> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, this.MOCK_DELAY))
    
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
    ]
  }

  /**
   * Generate chapter summary based on multiple stories
   */
  static async generateChapterSummary(stories: Array<{ title: string; transcript: string }>, chapterTitle: string): Promise<string> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, this.MOCK_DELAY))
    
    // Mock chapter summary
    return `This chapter captures the essence of early career experiences and the transition into adulthood. Through ${stories.length} stories, we see themes of courage, learning, and personal growth. The storyteller shares vivid memories of first jobs, workplace relationships, and the challenges of entering the professional world. These experiences shaped their work ethic and understanding of responsibility.`
  }

  /**
   * Generate story summary for feed display
   */
  static async generateStorySummary(transcript: string, maxLength: number = 150): Promise<string> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, this.MOCK_DELAY / 2))
    
    // Mock summary generation
    const words = transcript.split(' ')
    if (words.length <= maxLength / 6) { // Rough estimate of words to characters
      return transcript
    }
    
    // Simple truncation with ellipsis for mock
    const truncated = words.slice(0, Math.floor(maxLength / 6)).join(' ')
    return truncated + '...'
  }

  /**
   * Analyze story content for themes and emotions
   */
  static async analyzeStoryContent(transcript: string): Promise<{
    themes: string[]
    emotions: string[]
    keyMoments: string[]
    confidence: number
  }> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, this.MOCK_DELAY))
    
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
    }
  }

  /**
   * Process audio file and generate all AI content
   */
  static async processStoryAudio(
    audioBlob: Blob, 
    prompt: string,
    onProgress?: (step: string, progress: number) => void
  ): Promise<AIGeneratedContent> {
    try {
      onProgress?.('Starting transcription...', 10)
      const transcription = await this.transcribeAudio(audioBlob)
      
      onProgress?.('Generating title suggestions...', 40)
      const titleSuggestions = await this.generateTitle(audioBlob, prompt)
      
      onProgress?.('Creating follow-up questions...', 70)
      const followUpQuestions = await this.generateFollowUpQuestions(transcription.text, prompt)
      
      onProgress?.('Generating summary...', 90)
      const summary = await this.generateStorySummary(transcription.text)
      
      onProgress?.('Processing complete!', 100)
      
      return {
        title: titleSuggestions[0]?.title,
        transcript: transcription.text,
        summary,
        followUpQuestions: followUpQuestions.map(q => q.question),
        processingStatus: 'completed',
        confidence: transcription.confidence
      }
    } catch (error) {
      console.error('AI processing failed:', error)
      return {
        processingStatus: 'failed'
      }
    }
  }
}

// Utility functions for AI content
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

export function getProcessingStatusMessage(status: AIGeneratedContent['processingStatus']): string {
  switch (status) {
    case 'pending':
      return 'Waiting to process...'
    case 'processing':
      return 'AI is analyzing your story...'
    case 'completed':
      return 'Processing complete!'
    case 'failed':
      return 'Processing failed. Please try again.'
    default:
      return 'Unknown status'
  }
}

export function shouldShowAIContent(content: AIGeneratedContent): boolean {
  return content.processingStatus === 'completed' && (
    !!content.title || 
    !!content.transcript || 
    !!content.summary || 
    (content.followUpQuestions && content.followUpQuestions.length > 0)
  )
}
