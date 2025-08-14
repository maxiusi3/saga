import OpenAI from 'openai';
import { Story } from '../models/story';
import { User } from '../models/user';
import { Prompt } from '../models/prompt';
import { UserPrompt } from '../models/user-prompt';
import { BaseModel } from '../models/base';
import type { Chapter, ProjectPromptState } from '@saga/shared/types/chapter';

export interface AIPrompt {
  id: string;
  text: string;
  audioUrl?: string;
  category: 'childhood' | 'family' | 'career' | 'relationships' | 'general';
  difficulty: 'easy' | 'medium' | 'hard';
  followUpQuestions?: string[];
  tags?: string[];
  personalizedFor?: string; // user ID
  createdAt: Date;
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
    recentStories?: Story[];
    themes?: string[];
  };
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

class AIPromptServiceClass {
  private openai: OpenAI;
  private promptLibrary: PromptLibraryEntry[] = [];
  private promptCache: Map<string, AIPrompt> = new Map();
  private db = BaseModel.db;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.initializePromptLibrary();
  }

  /**
   * Generate a personalized prompt using AI
   */
  async generatePersonalizedPrompt(request: PromptGenerationRequest): Promise<AIPrompt> {
    try {
      // Input validation
      if (!request.userId) {
        throw new Error('User ID is required for prompt generation');
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      if (this.promptCache.has(cacheKey)) {
        return this.promptCache.get(cacheKey)!;
      }

      // Get user context with timeout
      const userContext = await Promise.race([
        this.buildUserContext(request.userId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('User context timeout')), 5000)
        )
      ]) as any;
      
      // Generate prompt using OpenAI with retry logic
      const systemPrompt = this.buildSystemPrompt(userContext, request);
      const userPrompt = this.buildUserPrompt(request);

      let completion;
      let retries = 3;
      
      while (retries > 0) {
        try {
          completion = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.8,
            max_tokens: 200,
          });
          break;
        } catch (apiError: any) {
          retries--;
          if (retries === 0) throw apiError;
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
        }
      }

      const generatedText = completion?.choices[0]?.message?.content;
      if (!generatedText || generatedText.trim().length === 0) {
        throw new Error('Empty response from AI service');
      }

      // Validate generated content
      const cleanText = this.sanitizePromptText(generatedText.trim());
      if (cleanText.length < 10) {
        throw new Error('Generated prompt too short');
      }

      // Create prompt object
      const prompt: AIPrompt = {
        id: this.generatePromptId(),
        text: cleanText,
        category: (request.category as AIPrompt['category']) || 'general',
        difficulty: this.determineDifficulty(cleanText, request),
        followUpQuestions: await this.generateFollowUpQuestions(cleanText).catch(() => []),
        tags: this.extractTags(cleanText),
        personalizedFor: request.userId,
        createdAt: new Date(),
      };

      // Cache the prompt with TTL
      this.promptCache.set(cacheKey, prompt);
      
      // Auto-cleanup cache after 1 hour
      setTimeout(() => {
        this.promptCache.delete(cacheKey);
      }, 3600000);

      return prompt;
    } catch (error: any) {
      console.error('Failed to generate personalized prompt:', {
        error: error.message,
        userId: request.userId,
        category: request.category,
        stack: error.stack
      });
      
      // Return fallback prompt with error tracking
      const fallback = this.getFallbackPrompt(request);
      fallback.tags = [...(fallback.tags || []), 'fallback', 'ai-error'];
      
      return fallback;
    }
  }

  /**
   * Sanitize prompt text to ensure quality and safety
   */
  private sanitizePromptText(text: string): string {
    // Remove excessive whitespace
    let cleaned = text.replace(/\s+/g, ' ').trim();
    
    // Remove markdown formatting that might interfere
    cleaned = cleaned.replace(/[*_`]/g, '');
    
    // Ensure it ends with proper punctuation
    if (!/[.!?]$/.test(cleaned)) {
      cleaned += '.';
    }
    
    // Capitalize first letter
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    
    return cleaned;
  }

  /**
   * Get the next prompt for a project (implements priority queue logic)
   * User prompts always take priority over AI prompts
   */
  async getNextPrompt(projectId: string): Promise<AIPrompt | null> {
    try {
      // 1. Check for pending user follow-ups (highest priority)
      const userPrompt = await this.getPendingUserPrompt(projectId);
      if (userPrompt) {
        await this.markUserPromptAsDelivered(userPrompt.id);
        return this.convertUserPromptToAIPrompt(userPrompt);
      }
      
      // 2. Get next AI prompt from current chapter
      const aiPrompt = await this.getNextAIPrompt(projectId);
      if (aiPrompt) {
        await this.updateProjectPromptState(projectId, aiPrompt);
        return aiPrompt;
      }
      
      // 3. Advance to next chapter if current is complete
      return await this.advanceToNextChapter(projectId);
    } catch (error) {
      console.error('Failed to get next prompt:', error);
      return null;
    }
  }

  /**
   * Get pending user prompt (follow-up questions from facilitators)
   */
  private async getPendingUserPrompt(projectId: string): Promise<any> {
    const result = await this.db('user_prompts')
      .where('project_id', projectId)
      .where('is_delivered', false)
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'asc')
      .first();
    
    return result;
  }

  /**
   * Mark user prompt as delivered
   */
  private async markUserPromptAsDelivered(userPromptId: string): Promise<void> {
    await this.db('user_prompts')
      .where('id', userPromptId)
      .update({
        is_delivered: true,
        delivered_at: new Date(),
      });
  }

  /**
   * Convert user prompt to AI prompt format
   */
  private convertUserPromptToAIPrompt(userPrompt: any): AIPrompt {
    return {
      id: userPrompt.id,
      text: userPrompt.text,
      audioUrl: userPrompt.audio_url,
      category: 'general',
      difficulty: 'medium',
      followUpQuestions: [],
      tags: ['user-generated', 'follow-up'],
      personalizedFor: userPrompt.project_id,
      createdAt: new Date(userPrompt.created_at),
    };
  }

  /**
   * Get next AI prompt from current chapter
   */
  private async getNextAIPrompt(projectId: string): Promise<AIPrompt | null> {
    // Get current project prompt state
    const promptState = await this.getProjectPromptState(projectId);
    if (!promptState) {
      return null;
    }

    // Get next prompt from current chapter
    const prompt = await this.db('prompts')
      .where('chapter_id', promptState.current_chapter_id)
      .where('order_index', '>', promptState.current_prompt_index)
      .orderBy('order_index', 'asc')
      .first();

    if (!prompt) {
      return null;
    }

    return {
      id: prompt.id,
      text: prompt.text,
      audioUrl: prompt.audio_url,
      category: 'general',
      difficulty: 'medium',
      followUpQuestions: [],
      tags: prompt.tags || [],
      createdAt: new Date(prompt.created_at),
    };
  }

  /**
   * Get project prompt state
   */
  private async getProjectPromptState(projectId: string): Promise<any> {
    return await this.db('project_prompt_state')
      .where('project_id', projectId)
      .first();
  }

  /**
   * Update project prompt state
   */
  private async updateProjectPromptState(projectId: string, prompt: AIPrompt): Promise<void> {
    const promptData = await this.db('prompts').where('id', prompt.id).first();
    if (!promptData) return;

    await this.db('project_prompt_state')
      .where('project_id', projectId)
      .update({
        current_prompt_index: promptData.order_index,
        last_prompt_delivered_at: new Date(),
        updated_at: new Date(),
      });
  }

  /**
   * Advance to next chapter
   */
  private async advanceToNextChapter(projectId: string): Promise<AIPrompt | null> {
    const currentState = await this.getProjectPromptState(projectId);
    if (!currentState) return null;

    // Get next chapter
    const nextChapter = await this.db('chapters')
      .where('order_index', '>', currentState.current_chapter_order || 0)
      .where('is_active', true)
      .orderBy('order_index', 'asc')
      .first();

    if (!nextChapter) {
      // No more chapters available
      return null;
    }

    // Update project state to new chapter
    await this.db('project_prompt_state')
      .where('project_id', projectId)
      .update({
        current_chapter_id: nextChapter.id,
        current_chapter_order: nextChapter.order_index,
        current_prompt_index: 0,
        updated_at: new Date(),
      });

    // Get first prompt from new chapter
    return await this.getNextAIPrompt(projectId);
  }

  /**
   * Get a prompt from the curated library
   */
  async getLibraryPrompt(
    category?: AIPrompt['category'],
    difficulty?: AIPrompt['difficulty'],
    excludeIds: string[] = []
  ): Promise<AIPrompt> {
    let availablePrompts = this.promptLibrary.filter(p => !excludeIds.includes(p.id));

    if (category) {
      availablePrompts = availablePrompts.filter(p => p.category === category);
    }

    if (difficulty) {
      availablePrompts = availablePrompts.filter(p => p.difficulty === difficulty);
    }

    if (availablePrompts.length === 0) {
      availablePrompts = this.promptLibrary;
    }

    const selectedTemplate = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
    const variation = selectedTemplate.variations[Math.floor(Math.random() * selectedTemplate.variations.length)];

    return {
      id: this.generatePromptId(),
      text: variation,
      category: selectedTemplate.category,
      difficulty: selectedTemplate.difficulty,
      followUpQuestions: selectedTemplate.followUpTemplates,
      tags: selectedTemplate.tags,
      createdAt: new Date(),
    };
  }

  /**
   * Generate context-aware follow-up questions with improved error handling
   */
  async generateFollowUpQuestions(storyContent: string, originalPrompt?: string): Promise<string[]> {
    try {
      // Input validation
      if (!storyContent || storyContent.trim().length < 10) {
        console.warn('Story content too short for follow-up generation');
        return [];
      }

      // Rate limiting check
      const rateLimitKey = `followup_generation_${Date.now()}`;
      if (this.promptCache.has(rateLimitKey)) {
        console.warn('Rate limit hit for follow-up generation');
        return [];
      }

      const systemPrompt = `You are an empathetic interviewer helping families preserve their stories. 
      Generate 2-3 thoughtful follow-up questions based on the story content that would help the storyteller 
      share more details or related memories. Questions should be:
      - Specific to the content shared
      - Emotionally sensitive and respectful
      - Designed to elicit rich, detailed responses
      - Appropriate for elderly storytellers
      - Under 100 characters each
      
      Return only the questions, one per line, without numbering.`;

      const userPrompt = originalPrompt 
        ? `Original prompt: "${originalPrompt}"\n\nStory content: "${storyContent}"\n\nGenerate follow-up questions:`
        : `Story content: "${storyContent}"\n\nGenerate follow-up questions:`;

      // Set rate limit cache
      this.promptCache.set(rateLimitKey, true);
      setTimeout(() => this.promptCache.delete(rateLimitKey), 5000);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response || response.trim().length === 0) {
        console.warn('Empty response from AI for follow-up generation');
        return [];
      }

      const questions = response
        .split('\n')
        .filter(q => q.trim().length > 0)
        .map(q => q.replace(/^\d+\.\s*/, '').trim())
        .filter(q => q.length > 10 && q.length < 200) // Quality filter
        .slice(0, 3);

      return questions;
    } catch (error: any) {
      console.error('Failed to generate follow-up questions:', {
        error: error.message,
        storyLength: storyContent?.length || 0,
        hasOriginalPrompt: !!originalPrompt
      });
      return [];
    }
  }

  /**
   * Get daily prompt with rotation logic
   */
  async getDailyPrompt(userId: string): Promise<AIPrompt> {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `daily_${userId}_${today}`;

    if (this.promptCache.has(cacheKey)) {
      return this.promptCache.get(cacheKey)!;
    }

    // Get user's recent prompts to avoid repetition
    const recentPrompts = await this.getUserRecentPrompts(userId, 7);
    const excludeIds = recentPrompts.map(p => p.id);

    // Rotate through categories
    const dayOfWeek = new Date().getDay();
    const categories: AIPrompt['category'][] = ['childhood', 'family', 'career', 'relationships', 'general'];
    const todayCategory = categories[dayOfWeek % categories.length];

    const prompt = await this.getLibraryPrompt(todayCategory, undefined, excludeIds);
    
    this.promptCache.set(cacheKey, prompt);
    return prompt;
  }

  /**
   * Analyze story themes and suggest related prompts
   */
  async suggestRelatedPrompts(storyId: string, count: number = 3): Promise<AIPrompt[]> {
    try {
      // This would typically fetch the story from database
      // For now, we'll use a placeholder implementation
      const story = await Story.findById(storyId);
      if (!story) return [];

      const systemPrompt = `Based on the following story, suggest ${count} related prompts that would help 
      the storyteller share more memories on similar themes or time periods. Prompts should be:
      - Related but not repetitive
      - Emotionally resonant
      - Specific enough to trigger detailed memories
      - Appropriate for the storyteller's age and background`;

      const userPrompt = `Story: "${story.transcript || story.aiPrompt}"
      
      Suggest ${count} related prompts:`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 300,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) return [];

      const promptTexts = response
        .split('\n')
        .filter(p => p.trim().length > 0)
        .map(p => p.replace(/^\d+\.\s*/, '').trim())
        .slice(0, count);

      return promptTexts.map(text => ({
        id: this.generatePromptId(),
        text,
        category: this.categorizePrompt(text),
        difficulty: this.determineDifficulty(text),
        createdAt: new Date(),
      }));
    } catch (error) {
      console.error('Failed to suggest related prompts:', error);
      return [];
    }
  }

  /**
   * Build system prompt for AI generation
   */
  private buildSystemPrompt(userContext: any, request: PromptGenerationRequest): string {
    return `You are an empathetic AI interviewer helping families preserve their stories through meaningful conversations.

Your role is to generate thoughtful, engaging prompts that help elderly storytellers share their life experiences with their adult children.

Guidelines:
- Create prompts that are emotionally resonant but not overwhelming
- Use warm, respectful language appropriate for elderly users
- Focus on specific memories rather than broad generalizations
- Avoid sensitive topics unless specifically requested
- Consider cultural background and personal preferences
- Make prompts accessible and easy to understand

User Context:
- Age range: ${userContext.ageRange || 'Senior'}
- Cultural background: ${userContext.culturalBackground || 'Not specified'}
- Previous story themes: ${userContext.recentThemes?.join(', ') || 'None'}
- Preferred topics: ${request.userPreferences?.topics?.join(', ') || 'Any'}
- Topics to avoid: ${request.userPreferences?.avoidTopics?.join(', ') || 'None'}

Generate a single, specific prompt that would help this person share a meaningful memory.`;
  }

  /**
   * Build user prompt for AI generation
   */
  private buildUserPrompt(request: PromptGenerationRequest): string {
    let prompt = `Generate a storytelling prompt`;
    
    if (request.category) {
      prompt += ` about ${request.category}`;
    }
    
    if (request.previousPrompts && request.previousPrompts.length > 0) {
      prompt += `\n\nAvoid repeating these recent prompts:\n${request.previousPrompts.join('\n')}`;
    }

    return prompt;
  }

  /**
   * Build user context from database
   */
  private async buildUserContext(userId: string): Promise<any> {
    try {
      // This would fetch user data and recent stories from database
      const user = await User.findById(userId);
      const recentStories = await Story.findByUserId(userId, { limit: 10 });

      return {
        ageRange: user?.profile?.ageRange,
        culturalBackground: user?.profile?.culturalBackground,
        recentThemes: this.extractThemesFromStories(recentStories),
      };
    } catch (error) {
      console.error('Failed to build user context:', error);
      return {};
    }
  }

  /**
   * Extract themes from recent stories
   */
  private extractThemesFromStories(stories: Story[]): string[] {
    // Simple keyword extraction - in production, this could use NLP
    const themes = new Set<string>();
    
    stories.forEach(story => {
      const text = (story.transcript || story.aiPrompt || '').toLowerCase();
      
      // Common life themes
      if (text.includes('family') || text.includes('parent') || text.includes('child')) themes.add('family');
      if (text.includes('work') || text.includes('job') || text.includes('career')) themes.add('career');
      if (text.includes('school') || text.includes('education') || text.includes('learn')) themes.add('education');
      if (text.includes('travel') || text.includes('trip') || text.includes('vacation')) themes.add('travel');
      if (text.includes('friend') || text.includes('relationship')) themes.add('relationships');
      if (text.includes('childhood') || text.includes('young') || text.includes('kid')) themes.add('childhood');
    });

    return Array.from(themes);
  }

  /**
   * Determine prompt difficulty based on content
   */
  private determineDifficulty(text: string, request?: PromptGenerationRequest): AIPrompt['difficulty'] {
    const lowerText = text.toLowerCase();
    
    // Hard topics
    if (lowerText.includes('difficult') || lowerText.includes('challenge') || 
        lowerText.includes('loss') || lowerText.includes('regret')) {
      return 'hard';
    }
    
    // Medium topics
    if (lowerText.includes('decision') || lowerText.includes('change') || 
        lowerText.includes('relationship') || lowerText.includes('career')) {
      return 'medium';
    }
    
    // Easy topics (default)
    return 'easy';
  }

  /**
   * Categorize prompt based on content
   */
  private categorizePrompt(text: string): AIPrompt['category'] {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('childhood') || lowerText.includes('young') || lowerText.includes('kid')) {
      return 'childhood';
    }
    if (lowerText.includes('family') || lowerText.includes('parent') || lowerText.includes('sibling')) {
      return 'family';
    }
    if (lowerText.includes('work') || lowerText.includes('job') || lowerText.includes('career')) {
      return 'career';
    }
    if (lowerText.includes('friend') || lowerText.includes('relationship') || lowerText.includes('love')) {
      return 'relationships';
    }
    
    return 'general';
  }

  /**
   * Extract relevant tags from prompt text
   */
  private extractTags(text: string): string[] {
    const tags = new Set<string>();
    const lowerText = text.toLowerCase();
    
    // Common tags
    const tagKeywords = {
      'memory': ['remember', 'memory', 'recall'],
      'emotion': ['feel', 'emotion', 'happy', 'sad', 'proud'],
      'people': ['person', 'people', 'friend', 'family'],
      'place': ['place', 'location', 'home', 'town'],
      'time': ['time', 'when', 'age', 'year'],
      'learning': ['learn', 'teach', 'lesson', 'advice'],
    };

    Object.entries(tagKeywords).forEach(([tag, keywords]) => {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        tags.add(tag);
      }
    });

    return Array.from(tags);
  }

  /**
   * Get user's recent prompts
   */
  private async getUserRecentPrompts(userId: string, days: number): Promise<AIPrompt[]> {
    // This would query the database for recent prompts
    // For now, return empty array
    return [];
  }

  /**
   * Get fallback prompt when AI generation fails
   */
  private getFallbackPrompt(request: PromptGenerationRequest): AIPrompt {
    const fallbacks: PromptLibraryEntry[] = this.promptLibrary.filter(p => 
      !request.category || p.category === request.category
    );
    
    const selected = fallbacks[Math.floor(Math.random() * fallbacks.length)] || this.promptLibrary[0];
    const variation = selected.variations[Math.floor(Math.random() * selected.variations.length)];

    return {
      id: this.generatePromptId(),
      text: variation,
      category: selected.category,
      difficulty: selected.difficulty,
      followUpQuestions: selected.followUpTemplates,
      tags: selected.tags,
      createdAt: new Date(),
    };
  }

  /**
   * Generate cache key for prompt requests
   */
  private generateCacheKey(request: PromptGenerationRequest): string {
    const key = [
      request.userId,
      request.category || 'any',
      request.previousPrompts?.join(',') || '',
      JSON.stringify(request.userPreferences || {}),
    ].join('|');
    
    return Buffer.from(key).toString('base64');
  }

  /**
   * Generate unique prompt ID
   */
  private generatePromptId(): string {
    return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize the curated prompt library
   */
  private initializePromptLibrary(): void {
    this.promptLibrary = [
      // Childhood prompts
      {
        id: 'childhood_001',
        template: 'childhood_memory',
        category: 'childhood',
        difficulty: 'easy',
        tags: ['memory', 'emotion', 'place'],
        variations: [
          'Tell me about your favorite childhood memory. What made it so special?',
          'What was your favorite place to play when you were a child?',
          'Describe a typical day when you were 8 years old.',
          'What was your favorite toy or game growing up?',
          'Tell me about a childhood friend who was important to you.',
        ],
        followUpTemplates: [
          'Who else was there with you?',
          'How did that make you feel?',
          'Do you still think about that memory today?',
        ],
      },
      {
        id: 'childhood_002',
        template: 'school_memories',
        category: 'childhood',
        difficulty: 'medium',
        tags: ['learning', 'people', 'emotion'],
        variations: [
          'What was your favorite subject in school and why?',
          'Tell me about a teacher who made a difference in your life.',
          'What was the most challenging thing about school for you?',
          'Describe your first day of school.',
          'What was recess like when you were in elementary school?',
        ],
        followUpTemplates: [
          'What did you learn from that experience?',
          'How did your classmates react?',
          'Did that influence your later choices?',
        ],
      },

      // Family prompts
      {
        id: 'family_001',
        template: 'family_traditions',
        category: 'family',
        difficulty: 'easy',
        tags: ['tradition', 'emotion', 'people'],
        variations: [
          'What was your favorite family tradition growing up?',
          'Tell me about holiday celebrations in your family.',
          'What was dinnertime like in your household?',
          'Describe a typical Sunday when you were young.',
          'What family stories were passed down to you?',
        ],
        followUpTemplates: [
          'Do you still celebrate this tradition?',
          'What did this tradition mean to your family?',
          'Have you passed this tradition to your children?',
        ],
      },
      {
        id: 'family_002',
        template: 'parents_grandparents',
        category: 'family',
        difficulty: 'medium',
        tags: ['people', 'learning', 'emotion'],
        variations: [
          'What was your mother like? What do you remember most about her?',
          'Tell me about your father. What kind of person was he?',
          'What did you learn from your grandparents?',
          'What was the best advice your parents gave you?',
          'How did your parents meet? Do you know their love story?',
        ],
        followUpTemplates: [
          'What values did they teach you?',
          'How are you similar to them?',
          'What would you want them to know about your life now?',
        ],
      },

      // Career prompts
      {
        id: 'career_001',
        template: 'first_job',
        category: 'career',
        difficulty: 'easy',
        tags: ['work', 'learning', 'people'],
        variations: [
          'What was your first job? How did you get it?',
          'Tell me about your first day at work.',
          'What was the most important lesson you learned from your first job?',
          'Who was your first boss like?',
          'What did you want to be when you grew up?',
        ],
        followUpTemplates: [
          'What skills did you develop?',
          'How did that job shape your career?',
          'What would you tell young people starting their first job?',
        ],
      },
      {
        id: 'career_002',
        template: 'career_highlights',
        category: 'career',
        difficulty: 'medium',
        tags: ['achievement', 'learning', 'emotion'],
        variations: [
          'What was your proudest moment in your career?',
          'Tell me about a time when you had to overcome a challenge at work.',
          'What was the most interesting project you ever worked on?',
          'How did your career evolve over the years?',
          'What was it like being a working parent?',
        ],
        followUpTemplates: [
          'What did you learn from that experience?',
          'How did you balance work and family?',
          'What advice would you give to someone in that situation?',
        ],
      },

      // Relationship prompts
      {
        id: 'relationships_001',
        template: 'friendships',
        category: 'relationships',
        difficulty: 'easy',
        tags: ['people', 'emotion', 'memory'],
        variations: [
          'Tell me about your best friend growing up.',
          'What was your social life like as a teenager?',
          'Describe a friendship that has lasted many years.',
          'Tell me about someone who made you laugh.',
          'What was dating like when you were young?',
        ],
        followUpTemplates: [
          'Are you still in touch with them?',
          'What made that friendship special?',
          'How did you meet?',
        ],
      },
      {
        id: 'relationships_002',
        template: 'love_marriage',
        category: 'relationships',
        difficulty: 'medium',
        tags: ['love', 'emotion', 'memory'],
        variations: [
          'How did you meet your spouse/partner?',
          'What was your wedding day like?',
          'Tell me about your first date.',
          'What attracted you to your partner?',
          'What has been the secret to a lasting relationship?',
        ],
        followUpTemplates: [
          'What was going through your mind that day?',
          'How did your families react?',
          'What advice would you give to newlyweds?',
        ],
      },

      // General life prompts
      {
        id: 'general_001',
        template: 'life_lessons',
        category: 'general',
        difficulty: 'medium',
        tags: ['learning', 'emotion', 'advice'],
        variations: [
          'What is the most important lesson life has taught you?',
          'If you could give your younger self one piece of advice, what would it be?',
          'What are you most grateful for in your life?',
          'Tell me about a time when you had to be brave.',
          'What has surprised you most about getting older?',
        ],
        followUpTemplates: [
          'How did you come to realize this?',
          'When did you learn this lesson?',
          'How has this shaped who you are?',
        ],
      },
      {
        id: 'general_002',
        template: 'historical_moments',
        category: 'general',
        difficulty: 'hard',
        tags: ['history', 'memory', 'emotion'],
        variations: [
          'What major historical event do you remember most clearly?',
          'How did world events affect your daily life?',
          'What was it like living through [specific era]?',
          'Tell me about a time when the world felt like it was changing.',
          'What invention or change has most impacted your lifetime?',
        ],
        followUpTemplates: [
          'How did people around you react?',
          'What was different about life before and after?',
          'What did you think would happen next?',
        ],
      },
    ];
  }
  /**
   * Generate audio for prompts using TTS
   */
  async generatePromptAudio(text: string): Promise<string> {
    try {
      const audioBuffer = await this.openai.audio.speech.create({
        input: text,
        voice: 'alloy', // Warm, conversational voice
        model: 'tts-1',
        speed: 0.9 // Slightly slower for clarity
      });

      // Convert to buffer and upload to storage
      const buffer = Buffer.from(await audioBuffer.arrayBuffer());
      
      // This would typically upload to S3 or similar storage
      // For now, return a placeholder URL
      const audioUrl = `https://storage.example.com/audio/prompt-${Date.now()}.mp3`;
      
      return audioUrl;
    } catch (error) {
      console.error('Failed to generate prompt audio:', error);
      throw error;
    }
  }

  /**
   * Create a user prompt (follow-up question from facilitator)
   */
  async createUserPrompt(
    projectId: string, 
    createdBy: string, 
    parentStoryId: string, 
    text: string,
    priority: number = 1
  ): Promise<any> {
    const userPrompt = {
      project_id: projectId,
      created_by: createdBy,
      parent_story_id: parentStoryId,
      text: text.trim(),
      priority,
      is_delivered: false,
      created_at: new Date(),
    };

    const [created] = await this.db('user_prompts')
      .insert(userPrompt)
      .returning('*');

    return created;
  }

  /**
   * Customize prompt for specific user preferences (future-ready)
   */
  async customizePrompt(
    promptId: string,
    userId: string,
    customizations: {
      tone?: 'formal' | 'casual' | 'warm' | 'professional';
      complexity?: 'simple' | 'detailed' | 'comprehensive';
      focus?: 'emotions' | 'facts' | 'relationships' | 'timeline';
      culturalContext?: string;
      personalTriggers?: string[];
    }
  ): Promise<AIPrompt> {
    try {
      // Get original prompt
      const originalPrompt = await this.db('prompts')
        .where('id', promptId)
        .first();

      if (!originalPrompt) {
        throw new Error('Prompt not found');
      }

      // Build customization prompt for AI
      const customizationPrompt = this.buildCustomizationPrompt(originalPrompt.text, customizations);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: this.getCustomizationSystemPrompt() },
          { role: 'user', content: customizationPrompt }
        ],
        temperature: 0.7,
        max_tokens: 250,
      });

      const customizedText = completion.choices[0]?.message?.content;
      if (!customizedText) {
        // Return original if customization fails
        return this.convertDbPromptToAIPrompt(originalPrompt);
      }

      // Create customized prompt
      const customizedPrompt: AIPrompt = {
        id: this.generatePromptId(),
        text: customizedText.trim(),
        audioUrl: originalPrompt.audio_url,
        category: originalPrompt.category,
        difficulty: originalPrompt.difficulty,
        followUpQuestions: originalPrompt.follow_up_questions || [],
        tags: [...(originalPrompt.tags || []), 'customized'],
        personalizedFor: userId,
        createdAt: new Date(),
      };

      // Cache customized prompt
      const cacheKey = `customized_${promptId}_${userId}`;
      this.promptCache.set(cacheKey, customizedPrompt);

      return customizedPrompt;
    } catch (error) {
      console.error('Failed to customize prompt:', error);
      // Return original prompt as fallback
      const originalPrompt = await this.db('prompts').where('id', promptId).first();
      return originalPrompt ? this.convertDbPromptToAIPrompt(originalPrompt) : this.getFallbackPrompt({ userId });
    }
  }

  /**
   * Build customization prompt for AI
   */
  private buildCustomizationPrompt(originalText: string, customizations: any): string {
    let prompt = `Original prompt: "${originalText}"\n\nCustomize this prompt with the following preferences:\n`;

    if (customizations.tone) {
      prompt += `- Tone: ${customizations.tone}\n`;
    }

    if (customizations.complexity) {
      prompt += `- Complexity level: ${customizations.complexity}\n`;
    }

    if (customizations.focus) {
      prompt += `- Focus on: ${customizations.focus}\n`;
    }

    if (customizations.culturalContext) {
      prompt += `- Cultural context: ${customizations.culturalContext}\n`;
    }

    if (customizations.personalTriggers && customizations.personalTriggers.length > 0) {
      prompt += `- Include these personal elements: ${customizations.personalTriggers.join(', ')}\n`;
    }

    prompt += '\nProvide the customized prompt:';
    return prompt;
  }

  /**
   * Get system prompt for customization
   */
  private getCustomizationSystemPrompt(): string {
    return `You are an expert at customizing storytelling prompts for elderly users.

Your role is to adapt prompts based on user preferences while maintaining their core intent and emotional resonance.

Guidelines:
- Preserve the essential meaning and purpose of the original prompt
- Adapt the language, tone, and complexity as requested
- Ensure the customized prompt remains appropriate for elderly storytellers
- Maintain cultural sensitivity and respect
- Keep prompts engaging and specific
- Ensure the result is still a clear, actionable storytelling prompt

Return only the customized prompt text, nothing else.`;
  }

  /**
   * Convert database prompt to AIPrompt format
   */
  private convertDbPromptToAIPrompt(dbPrompt: any): AIPrompt {
    return {
      id: dbPrompt.id,
      text: dbPrompt.text,
      audioUrl: dbPrompt.audio_url,
      category: dbPrompt.category,
      difficulty: dbPrompt.difficulty,
      followUpQuestions: dbPrompt.follow_up_questions || [],
      tags: dbPrompt.tags || [],
      personalizedFor: dbPrompt.personalized_for,
      createdAt: new Date(dbPrompt.created_at),
    };
  }

  /**
   * Get user's prompt customization preferences
   */
  async getUserCustomizationPreferences(userId: string): Promise<any> {
    try {
      const preferences = await this.db('user_preferences')
        .where('user_id', userId)
        .where('category', 'prompt_customization')
        .first();

      return preferences ? JSON.parse(preferences.settings) : {
        tone: 'warm',
        complexity: 'simple',
        focus: 'emotions',
      };
    } catch (error) {
      console.error('Failed to get user customization preferences:', error);
      return {
        tone: 'warm',
        complexity: 'simple',
        focus: 'emotions',
      };
    }
  }

  /**
   * Save user's prompt customization preferences
   */
  async saveUserCustomizationPreferences(userId: string, preferences: any): Promise<void> {
    try {
      await this.db('user_preferences')
        .insert({
          user_id: userId,
          category: 'prompt_customization',
          settings: JSON.stringify(preferences),
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict(['user_id', 'category'])
        .merge({
          settings: JSON.stringify(preferences),
          updated_at: new Date(),
        });
    } catch (error) {
      console.error('Failed to save user customization preferences:', error);
    }
  }

  /**
   * Get all user prompts for a project
   */
  async getUserPrompts(projectId: string, includeDelivered: boolean = false): Promise<any[]> {
    let query = this.db('user_prompts')
      .where('project_id', projectId);

    if (!includeDelivered) {
      query = query.where('is_delivered', false);
    }

    return await query
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'asc');
  }

  /**
   * Update user prompt priority
   */
  async updateUserPromptPriority(userPromptId: string, priority: number): Promise<void> {
    await this.db('user_prompts')
      .where('id', userPromptId)
      .update({
        priority,
        updated_at: new Date(),
      });
  }

  /**
   * Check if a chapter is completed for a project
   */
  async isChapterCompleted(projectId: string, chapterId: string): Promise<boolean> {
    // Get total prompts in chapter
    const totalPrompts = await this.db('prompts')
      .where('chapter_id', chapterId)
      .where('is_active', true)
      .count('id as count')
      .first();

    const totalCount = parseInt(totalPrompts?.count as string) || 0;
    if (totalCount === 0) return true;

    // Get stories created for this chapter
    const storiesCount = await this.db('stories')
      .where('project_id', projectId)
      .where('chapter_id', chapterId)
      .where('status', 'ready')
      .count('id as count')
      .first();

    const completedCount = parseInt(storiesCount?.count as string) || 0;

    // Chapter is completed if we have stories for at least 80% of prompts
    const completionThreshold = Math.ceil(totalCount * 0.8);
    return completedCount >= completionThreshold;
  }

  /**
   * Get chapter completion status for a project
   */
  async getChapterCompletionStatus(projectId: string): Promise<{
    chapterId: string;
    chapterName: string;
    totalPrompts: number;
    completedStories: number;
    completionPercentage: number;
    isCompleted: boolean;
  }[]> {
    const chapters = await this.db('chapters')
      .where('is_active', true)
      .orderBy('order_index', 'asc');

    const results = [];

    for (const chapter of chapters) {
      const totalPrompts = await this.db('prompts')
        .where('chapter_id', chapter.id)
        .where('is_active', true)
        .count('id as count')
        .first();

      const completedStories = await this.db('stories')
        .where('project_id', projectId)
        .where('chapter_id', chapter.id)
        .where('status', 'ready')
        .count('id as count')
        .first();

      const total = parseInt(totalPrompts?.count as string) || 0;
      const completed = parseInt(completedStories?.count as string) || 0;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      const isCompleted = await this.isChapterCompleted(projectId, chapter.id);

      results.push({
        chapterId: chapter.id,
        chapterName: chapter.name,
        totalPrompts: total,
        completedStories: completed,
        completionPercentage: percentage,
        isCompleted,
      });
    }

    return results;
  }

  /**
   * Detect and handle chapter completion
   */
  async detectChapterCompletion(projectId: string, storyId: string): Promise<void> {
    // Get the story to find its chapter
    const story = await this.db('stories')
      .where('id', storyId)
      .first();

    if (!story || !story.chapter_id) return;

    // Check if chapter is now completed
    const isCompleted = await this.isChapterCompleted(projectId, story.chapter_id);
    
    if (isCompleted) {
      // Trigger chapter summary generation
      await this.triggerChapterSummaryGeneration(projectId, story.chapter_id);
      
      // Update project prompt state to advance to next chapter
      await this.advanceToNextChapter(projectId);
    }
  }

  /**
   * Trigger chapter summary generation (placeholder for Task 4.2)
   */
  private async triggerChapterSummaryGeneration(projectId: string, chapterId: string): Promise<void> {
    // This will be implemented in Task 4.2
    console.log(`Chapter ${chapterId} completed for project ${projectId} - triggering summary generation`);
  }

  /**
   * Initialize prompt state for a new project
   */
  async initializeProjectPromptState(projectId: string): Promise<void> {
    // Get first chapter
    const firstChapter = await this.db('chapters')
      .where('is_active', true)
      .orderBy('order_index', 'asc')
      .first();

    if (!firstChapter) {
      throw new Error('No active chapters found');
    }

    // Create initial prompt state
    await this.db('project_prompt_state')
      .insert({
        project_id: projectId,
        current_chapter_id: firstChapter.id,
        current_chapter_order: firstChapter.order_index,
        current_prompt_index: 0,
        last_prompt_delivered_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
  }

  /**
   * Get detailed prompt state for a project
   */
  async getDetailedPromptState(projectId: string): Promise<{
    currentChapter: any;
    currentPromptIndex: number;
    totalPromptsInChapter: number;
    lastPromptDeliveredAt: Date | null;
    nextPrompt: AIPrompt | null;
    pendingUserPrompts: number;
    chapterProgress: number;
  } | null> {
    const state = await this.getProjectPromptState(projectId);
    if (!state) return null;

    // Get current chapter info
    const currentChapter = await this.db('chapters')
      .where('id', state.current_chapter_id)
      .first();

    // Get total prompts in current chapter
    const totalPrompts = await this.db('prompts')
      .where('chapter_id', state.current_chapter_id)
      .where('is_active', true)
      .count('id as count')
      .first();

    // Get pending user prompts count
    const pendingUserPrompts = await this.db('user_prompts')
      .where('project_id', projectId)
      .where('is_delivered', false)
      .count('id as count')
      .first();

    // Get next prompt
    const nextPrompt = await this.getNextPrompt(projectId);

    const totalCount = parseInt(totalPrompts?.count as string) || 0;
    const progress = totalCount > 0 ? Math.round((state.current_prompt_index / totalCount) * 100) : 0;

    return {
      currentChapter,
      currentPromptIndex: state.current_prompt_index,
      totalPromptsInChapter: totalCount,
      lastPromptDeliveredAt: state.last_prompt_delivered_at,
      nextPrompt,
      pendingUserPrompts: parseInt(pendingUserPrompts?.count as string) || 0,
      chapterProgress: progress,
    };
  }

  /**
   * Reset project prompt state (for testing or admin purposes)
   */
  async resetProjectPromptState(projectId: string): Promise<void> {
    await this.db('project_prompt_state')
      .where('project_id', projectId)
      .delete();

    await this.initializeProjectPromptState(projectId);
  }

  /**
   * Generate audio for a prompt using OpenAI TTS
   */
  async generatePromptAudio(promptText: string, voice: string = 'alloy'): Promise<string> {
    try {
      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: voice as any,
        input: promptText,
        speed: 0.9, // Slightly slower for clarity
      });

      // Convert response to buffer
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Generate unique filename
      const filename = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.mp3`;
      
      // Save to storage (this would typically use AWS S3 or similar)
      const audioUrl = await this.saveAudioToStorage(buffer, filename);
      
      return audioUrl;
    } catch (error) {
      console.error('Failed to generate prompt audio:', error);
      throw new Error('Failed to generate audio for prompt');
    }
  }

  /**
   * Save audio buffer to storage and return URL
   */
  private async saveAudioToStorage(buffer: Buffer, filename: string): Promise<string> {
    // This is a placeholder - in production this would use AWS S3 or similar
    // For now, we'll return a mock URL
    return `https://storage.saga.com/prompts/audio/${filename}`;
  }

  /**
   * Generate and cache audio for all prompts in a chapter
   */
  async generateChapterAudio(chapterId: string): Promise<void> {
    const prompts = await this.db('prompts')
      .where('chapter_id', chapterId)
      .where('is_active', true)
      .whereNull('audio_url');

    for (const prompt of prompts) {
      try {
        const audioUrl = await this.generatePromptAudio(prompt.text);
        
        await this.db('prompts')
          .where('id', prompt.id)
          .update({
            audio_url: audioUrl,
            updated_at: new Date(),
          });

        console.log(`Generated audio for prompt ${prompt.id}`);
      } catch (error) {
        console.error(`Failed to generate audio for prompt ${prompt.id}:`, error);
      }
    }
  }

  /**
   * Regenerate audio for a specific prompt
   */
  async regeneratePromptAudio(promptId: string, voice: string = 'alloy'): Promise<string> {
    const prompt = await this.db('prompts')
      .where('id', promptId)
      .first();

    if (!prompt) {
      throw new Error('Prompt not found');
    }

    const audioUrl = await this.generatePromptAudio(prompt.text, voice);
    
    await this.db('prompts')
      .where('id', promptId)
      .update({
        audio_url: audioUrl,
        updated_at: new Date(),
      });

    return audioUrl;
  }

  /**
   * Cache prompt for faster retrieval
   */
  private cachePrompt(key: string, prompt: AIPrompt): void {
    // Implement LRU cache with size limit
    if (this.promptCache.size >= 1000) {
      // Remove oldest entry
      const firstKey = this.promptCache.keys().next().value;
      this.promptCache.delete(firstKey);
    }
    
    this.promptCache.set(key, prompt);
  }

  /**
   * Get cached prompt
   */
  private getCachedPrompt(key: string): AIPrompt | null {
    return this.promptCache.get(key) || null;
  }

  /**
   * Clear prompt cache
   */
  clearCache(): void {
    this.promptCache.clear();
  }

  /**
   * Preload prompts for a project to optimize performance
   */
  async preloadProjectPrompts(projectId: string): Promise<void> {
    const state = await this.getProjectPromptState(projectId);
    if (!state) return;

    // Preload next 5 prompts from current chapter
    const upcomingPrompts = await this.db('prompts')
      .where('chapter_id', state.current_chapter_id)
      .where('order_index', '>', state.current_prompt_index)
      .orderBy('order_index', 'asc')
      .limit(5);

    for (const prompt of upcomingPrompts) {
      const aiPrompt: AIPrompt = {
        id: prompt.id,
        text: prompt.text,
        audioUrl: prompt.audio_url,
        category: 'general',
        difficulty: 'medium',
        followUpQuestions: [],
        tags: prompt.tags || [],
        createdAt: new Date(prompt.created_at),
      };

      const cacheKey = `project:${projectId}:prompt:${prompt.id}`;
      this.cachePrompt(cacheKey, aiPrompt);
    }
  }

  /**
   * Optimize prompt delivery by prefetching and caching
   */
  async optimizePromptDelivery(projectId: string): Promise<void> {
    // Preload upcoming prompts
    await this.preloadProjectPrompts(projectId);

    // Generate audio for prompts without audio URLs
    const state = await this.getProjectPromptState(projectId);
    if (state) {
      const promptsWithoutAudio = await this.db('prompts')
        .where('chapter_id', state.current_chapter_id)
        .whereNull('audio_url')
        .limit(3);

      for (const prompt of promptsWithoutAudio) {
        try {
          await this.regeneratePromptAudio(prompt.id);
        } catch (error) {
          console.error(`Failed to generate audio for prompt ${prompt.id}:`, error);
        }
      }
    }
  }

  /**
   * Track prompt delivery analytics
   */
  async trackPromptDelivery(projectId: string, promptId: string, deliveryMethod: 'ai' | 'user'): Promise<void> {
    await this.db('prompt_analytics').insert({
      project_id: projectId,
      prompt_id: promptId,
      event_type: 'delivered',
      delivery_method: deliveryMethod,
      created_at: new Date(),
    });
  }

  /**
   * Track prompt response (when user records a story)
   */
  async trackPromptResponse(projectId: string, promptId: string, storyId: string, responseTime: number): Promise<void> {
    await this.db('prompt_analytics').insert({
      project_id: projectId,
      prompt_id: promptId,
      story_id: storyId,
      event_type: 'responded',
      response_time_minutes: responseTime,
      created_at: new Date(),
    });
  }

  /**
   * Get prompt effectiveness metrics
   */
  async getPromptEffectiveness(promptId?: string, chapterId?: string): Promise<{
    promptId: string;
    promptText: string;
    deliveryCount: number;
    responseCount: number;
    responseRate: number;
    averageResponseTime: number;
    averageStoryLength: number;
  }[]> {
    let query = this.db('prompts as p')
      .leftJoin('prompt_analytics as pa_delivered', function() {
        this.on('p.id', '=', 'pa_delivered.prompt_id')
            .andOn('pa_delivered.event_type', '=', this.db.raw('?', ['delivered']));
      })
      .leftJoin('prompt_analytics as pa_responded', function() {
        this.on('p.id', '=', 'pa_responded.prompt_id')
            .andOn('pa_responded.event_type', '=', this.db.raw('?', ['responded']));
      })
      .leftJoin('stories as s', 'pa_responded.story_id', 's.id')
      .select(
        'p.id as promptId',
        'p.text as promptText',
        this.db.raw('COUNT(DISTINCT pa_delivered.id) as deliveryCount'),
        this.db.raw('COUNT(DISTINCT pa_responded.id) as responseCount'),
        this.db.raw('AVG(pa_responded.response_time_minutes) as averageResponseTime'),
        this.db.raw('AVG(LENGTH(s.transcript)) as averageStoryLength')
      )
      .groupBy('p.id', 'p.text');

    if (promptId) {
      query = query.where('p.id', promptId);
    }

    if (chapterId) {
      query = query.where('p.chapter_id', chapterId);
    }

    const results = await query;

    return results.map(row => ({
      promptId: row.promptId,
      promptText: row.promptText,
      deliveryCount: parseInt(row.deliveryCount) || 0,
      responseCount: parseInt(row.responseCount) || 0,
      responseRate: row.deliveryCount > 0 ? Math.round((row.responseCount / row.deliveryCount) * 100) : 0,
      averageResponseTime: Math.round(row.averageResponseTime || 0),
      averageStoryLength: Math.round(row.averageStoryLength || 0),
    }));
  }

  /**
   * Get chapter analytics
   */
  async getChapterAnalytics(chapterId: string): Promise<{
    chapterId: string;
    chapterName: string;
    totalPrompts: number;
    averageResponseRate: number;
    averageCompletionTime: number;
    mostEffectivePrompt: string;
    leastEffectivePrompt: string;
  }> {
    const chapter = await this.db('chapters').where('id', chapterId).first();
    const promptEffectiveness = await this.getPromptEffectiveness(undefined, chapterId);

    const totalPrompts = promptEffectiveness.length;
    const averageResponseRate = totalPrompts > 0 
      ? Math.round(promptEffectiveness.reduce((sum, p) => sum + p.responseRate, 0) / totalPrompts)
      : 0;
    
    const averageCompletionTime = totalPrompts > 0
      ? Math.round(promptEffectiveness.reduce((sum, p) => sum + p.averageResponseTime, 0) / totalPrompts)
      : 0;

    const sortedByEffectiveness = promptEffectiveness.sort((a, b) => b.responseRate - a.responseRate);
    const mostEffective = sortedByEffectiveness[0]?.promptText || 'N/A';
    const leastEffective = sortedByEffectiveness[sortedByEffectiveness.length - 1]?.promptText || 'N/A';

    return {
      chapterId,
      chapterName: chapter?.name || 'Unknown',
      totalPrompts,
      averageResponseRate,
      averageCompletionTime,
      mostEffectivePrompt: mostEffective,
      leastEffectivePrompt: leastEffective,
    };
  }
}

export const AIPromptService = new AIPromptServiceClass();
export { AIPromptServiceClass };