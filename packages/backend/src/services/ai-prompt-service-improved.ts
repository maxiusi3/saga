import OpenAI from 'openai';
import type { Chapter, ProjectPromptState } from '@saga/shared/types/chapter';

// 接口定义，便于测试和依赖注入
export interface DatabaseInterface {
  query(sql: string, params?: any[]): Promise<any[]>;
  first(table: string, conditions: any): Promise<any>;
  insert(table: string, data: any): Promise<any>;
  update(table: string, conditions: any, data: any): Promise<any>;
  delete(table: string, conditions: any): Promise<any>;
}

export interface CacheInterface {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface AIPrompt {
  id: string;
  text: string;
  audioUrl?: string;
  category: 'childhood' | 'family' | 'career' | 'relationships' | 'general';
  difficulty: 'easy' | 'medium' | 'hard';
  followUpQuestions?: string[];
  tags?: string[];
  personalizedFor?: string;
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
    recentStories?: any[];
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

// 内存缓存实现
export class MemoryCache implements CacheInterface {
  private cache = new Map<string, { value: any; expires: number }>();

  async get(key: string): Promise<any> {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: any, ttl: number = 3600000): Promise<void> {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}

// 改进的AI Prompt Service
export class ImprovedAIPromptService {
  private promptLibrary: PromptLibraryEntry[] = [];
  private performanceMetrics = new Map<string, number>();
  private rateLimitTracker = new Map<string, number>();

  constructor(
    private openai: OpenAI,
    private database: DatabaseInterface,
    private cache: CacheInterface = new MemoryCache()
  ) {
    this.initializePromptLibrary();
  }

  /**
   * 生成个性化提示
   */
  async generatePersonalizedPrompt(request: PromptGenerationRequest): Promise<AIPrompt> {
    const startTime = Date.now();
    
    try {
      // 输入验证
      if (!request.userId || request.userId.trim().length === 0) {
        throw new Error('User ID is required for prompt generation');
      }

      // 检查缓存
      const cacheKey = this.generateCacheKey(request);
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.recordPerformance('generatePersonalizedPrompt_cache_hit', Date.now() - startTime);
        return cached;
      }

      // 检查速率限制
      if (this.isRateLimited(request.userId)) {
        console.warn(`Rate limit exceeded for user ${request.userId}`);
        return this.getFallbackPrompt(request);
      }

      // 获取用户上下文
      const userContext = await this.buildUserContext(request.userId);
      
      // 生成AI提示
      const systemPrompt = this.buildSystemPrompt(userContext, request);
      const userPrompt = this.buildUserPrompt(request);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 200,
      });

      const generatedText = completion?.choices[0]?.message?.content;
      if (!generatedText || generatedText.trim().length === 0) {
        throw new Error('Empty response from AI service');
      }

      // 创建提示对象
      const prompt: AIPrompt = {
        id: this.generatePromptId(),
        text: this.sanitizePromptText(generatedText.trim()),
        category: (request.category as AIPrompt['category']) || 'general',
        difficulty: this.determineDifficulty(generatedText, request),
        followUpQuestions: await this.generateFollowUpQuestions(generatedText).catch(() => []),
        tags: this.extractTags(generatedText),
        personalizedFor: request.userId,
        createdAt: new Date(),
      };

      // 缓存结果
      await this.cache.set(cacheKey, prompt, 3600000); // 1小时

      this.recordPerformance('generatePersonalizedPrompt', Date.now() - startTime);
      return prompt;

    } catch (error: any) {
      console.error('Failed to generate personalized prompt:', {
        error: error.message,
        userId: request.userId,
        category: request.category,
        duration: Date.now() - startTime
      });
      
      this.recordPerformance('generatePersonalizedPrompt_error', Date.now() - startTime);
      const fallback = this.getFallbackPrompt(request);
      fallback.tags = [...(fallback.tags || []), 'fallback', 'ai-error'];
      
      return fallback;
    }
  }

  /**
   * 生成跟进问题
   */
  async generateFollowUpQuestions(storyContent: string, originalPrompt?: string): Promise<string[]> {
    try {
      // 输入验证
      if (!storyContent || storyContent.trim().length < 10) {
        console.warn('Story content too short for follow-up generation');
        return [];
      }

      // 速率限制检查
      const rateLimitKey = `followup_generation_${Date.now()}`;
      const cached = await this.cache.get(rateLimitKey);
      if (cached) {
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

      // 设置速率限制缓存
      await this.cache.set(rateLimitKey, true, 5000);

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
        .filter(q => q.length > 10 && q.length < 200)
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
   * 获取下一个提示
   */
  async getNextPrompt(projectId: string, userId: string): Promise<AIPrompt | null> {
    const startTime = Date.now();
    const cacheKey = `next_prompt_${projectId}_${userId}`;
    
    try {
      // 检查速率限制
      if (this.isRateLimited(userId)) {
        console.warn(`Rate limit exceeded for user ${userId}`);
        return this.getFallbackPrompt({ userId, category: 'general' });
      }

      // 检查缓存
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.recordPerformance('getNextPrompt', Date.now() - startTime);
        return cached;
      }

      // 获取项目提示状态
      const projectState = await this.getProjectPromptState(projectId);
      
      // 检查待处理的用户提示（优先级更高）
      const userPrompt = await this.getPendingUserPrompt(projectId, userId);
      if (userPrompt) {
        const aiPrompt = this.convertUserPromptToAIPrompt(userPrompt);
        await this.cache.set(cacheKey, aiPrompt, 300000); // 5分钟缓存
        this.recordPerformance('getNextPrompt', Date.now() - startTime);
        return aiPrompt;
      }

      // 获取基于章节的提示
      const chapterPrompt = await this.getChapterPrompt(projectState.currentChapter, projectState.usedPromptIds);
      if (chapterPrompt) {
        // 更新项目状态
        await this.updateProjectPromptState(projectId, {
          usedPromptIds: [...projectState.usedPromptIds, chapterPrompt.id],
          lastPromptAt: new Date()
        });
        
        await this.cache.set(cacheKey, chapterPrompt, 300000);
        this.recordPerformance('getNextPrompt', Date.now() - startTime);
        return chapterPrompt;
      }

      // 回退到库提示
      const libraryPrompt = await this.getLibraryPrompt(projectState.usedPromptIds);
      if (libraryPrompt) {
        await this.cache.set(cacheKey, libraryPrompt, 300000);
      }
      
      this.recordPerformance('getNextPrompt', Date.now() - startTime);
      return libraryPrompt;
    } catch (error: any) {
      console.error('Failed to get next prompt:', {
        error: error.message,
        projectId,
        userId,
        duration: Date.now() - startTime
      });
      
      this.recordPerformance('getNextPrompt_error', Date.now() - startTime);
      return this.getFallbackPrompt({ userId, category: 'general' });
    }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): Record<string, number> {
    const metrics: Record<string, number> = {};
    this.performanceMetrics.forEach((value, key) => {
      metrics[key] = Math.round(value);
    });
    return metrics;
  }

  /**
   * 清除缓存
   */
  async clearCaches(): Promise<void> {
    await this.cache.clear();
    this.rateLimitTracker.clear();
    this.performanceMetrics.clear();
  }

  // 私有辅助方法
  private initializePromptLibrary(): void {
    this.promptLibrary = [
      {
        id: 'childhood-001',
        template: 'Tell me about your childhood home. What made it special?',
        category: 'childhood',
        difficulty: 'easy',
        tags: ['home', 'family', 'memories'],
        variations: [
          'Describe the house where you grew up.',
          'What do you remember most about your childhood home?'
        ],
        followUpTemplates: [
          'What was your favorite room?',
          'Who else lived there with you?'
        ]
      },
      {
        id: 'family-001',
        template: 'Tell me about a family tradition that was important to you.',
        category: 'family',
        difficulty: 'easy',
        tags: ['tradition', 'family', 'culture'],
        variations: [
          'What family traditions did you enjoy growing up?',
          'Describe a special family celebration.'
        ],
        followUpTemplates: [
          'How did this tradition start?',
          'Do you still practice it today?'
        ]
      },
      {
        id: 'general-001',
        template: 'What is one of your happiest memories?',
        category: 'general',
        difficulty: 'easy',
        tags: ['happiness', 'memories', 'life'],
        variations: [
          'Tell me about a time when you felt truly happy.',
          'What memory always makes you smile?'
        ],
        followUpTemplates: [
          'What made that moment so special?',
          'Who was with you during that time?'
        ]
      }
    ];
  }

  private generateCacheKey(request: PromptGenerationRequest): string {
    // 添加时间窗口以确保缓存的时效性
    const timeWindow = Math.floor(Date.now() / 300000); // 5分钟窗口
    const key = [
      request.userId,
      request.category || 'general',
      timeWindow,
      JSON.stringify(request.userPreferences || {}),
      JSON.stringify(request.previousPrompts || [])
    ].join('|');
    
    return `prompt_${Buffer.from(key).toString('base64').slice(0, 32)}`;
  }

  private isRateLimited(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.rateLimitTracker.get(userId) || 0;
    
    // 允许每分钟10个请求
    if (userRequests > 10) {
      return true;
    }
    
    this.rateLimitTracker.set(userId, userRequests + 1);
    
    // 每分钟重置计数器
    setTimeout(() => {
      this.rateLimitTracker.delete(userId);
    }, 60000);
    
    return false;
  }

  private recordPerformance(operation: string, duration: number): void {
    const existing = this.performanceMetrics.get(operation) || 0;
    this.performanceMetrics.set(operation, (existing + duration) / 2); // 移动平均
    
    // 记录慢操作
    if (duration > 2000) {
      console.warn(`Slow operation detected: ${operation} took ${duration}ms`);
    }
  }

  private async buildUserContext(userId: string): Promise<any> {
    try {
      // 这里会从数据库获取用户数据和最近的故事
      const user = await this.database.first('users', { id: userId });
      return {
        user,
        preferences: user?.preferences || {},
        recentStories: [] // 从数据库获取
      };
    } catch (error) {
      console.error('Failed to build user context:', error);
      return { user: null, preferences: {}, recentStories: [] };
    }
  }

  private buildSystemPrompt(userContext: any, request: PromptGenerationRequest): string {
    return `You are an empathetic interviewer helping families preserve their stories. 
    Generate a thoughtful, open-ended question that encourages storytelling.
    
    User context: ${JSON.stringify(userContext)}
    Category: ${request.category || 'general'}
    
    The question should be:
    - Personal and engaging
    - Appropriate for elderly storytellers
    - Designed to elicit rich, detailed responses
    - Culturally sensitive
    
    Return only the question, no additional text.`;
  }

  private buildUserPrompt(request: PromptGenerationRequest): string {
    return `Generate a ${request.category || 'general'} storytelling prompt.`;
  }

  private sanitizePromptText(text: string): string {
    // 移除多余的空白
    let cleaned = text.replace(/\s+/g, ' ').trim();
    
    // 移除可能干扰的markdown格式
    cleaned = cleaned.replace(/[*_`]/g, '');
    
    // 确保以适当的标点结尾
    if (!/[.!?]$/.test(cleaned)) {
      cleaned += '.';
    }
    
    // 首字母大写
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    
    return cleaned;
  }

  private determineDifficulty(text: string, request: PromptGenerationRequest): AIPrompt['difficulty'] {
    // 简单的难度判断逻辑
    if (text.length < 50) return 'easy';
    if (text.length > 100) return 'hard';
    return 'medium';
  }

  private extractTags(text: string): string[] {
    // 简单的标签提取逻辑
    const commonTags = ['family', 'childhood', 'memories', 'home', 'tradition', 'happiness'];
    return commonTags.filter(tag => 
      text.toLowerCase().includes(tag)
    );
  }

  private generatePromptId(): string {
    return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getFallbackPrompt(request: PromptGenerationRequest): AIPrompt {
    const fallbacks = this.promptLibrary.filter(p => 
      !request.category || p.category === request.category
    );
    
    const selected = fallbacks[Math.floor(Math.random() * fallbacks.length)] || this.promptLibrary[0];
    
    return {
      id: this.generatePromptId(),
      text: selected.template,
      category: selected.category,
      difficulty: selected.difficulty,
      tags: [...selected.tags, 'fallback'],
      personalizedFor: request.userId,
      createdAt: new Date(),
    };
  }

  // 数据库相关的私有方法（需要实现）
  private async getProjectPromptState(projectId: string): Promise<any> {
    try {
      const state = await this.database.first('project_prompt_state', { project_id: projectId });
      return {
        currentChapter: state?.current_chapter || 'childhood',
        usedPromptIds: Array.isArray(state?.used_prompt_ids) ? state.used_prompt_ids : [],
        lastPromptAt: state?.last_prompt_at || null
      };
    } catch (error) {
      console.error('Failed to get project prompt state:', error);
      return {
        currentChapter: 'childhood',
        usedPromptIds: [],
        lastPromptAt: null
      };
    }
  }

  private async getPendingUserPrompt(projectId: string, userId: string): Promise<any> {
    try {
      return await this.database.first('user_prompts', {
        project_id: projectId,
        is_delivered: false
      });
    } catch (error) {
      console.error('Failed to get pending user prompt:', error);
      return null;
    }
  }

  private async getChapterPrompt(chapter: string, usedPromptIds: string[]): Promise<AIPrompt | null> {
    try {
      // 从数据库获取章节提示
      const prompts = await this.database.query(
        'SELECT * FROM prompts WHERE chapter = ? AND id NOT IN (?)',
        [chapter, usedPromptIds]
      );
      
      if (prompts.length === 0) return null;
      
      const selected = prompts[Math.floor(Math.random() * prompts.length)];
      return this.convertDbPromptToAIPrompt(selected);
    } catch (error) {
      console.error('Failed to get chapter prompt:', error);
      return null;
    }
  }

  private async getLibraryPrompt(usedPromptIds: string[]): Promise<AIPrompt | null> {
    const availablePrompts = this.promptLibrary.filter(p => !usedPromptIds.includes(p.id));
    
    if (availablePrompts.length === 0) {
      // 如果没有可用提示，重置循环
      const selected = this.promptLibrary[Math.floor(Math.random() * this.promptLibrary.length)];
      return this.convertLibraryPromptToAIPrompt(selected);
    }
    
    const selected = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
    return this.convertLibraryPromptToAIPrompt(selected);
  }

  private async updateProjectPromptState(projectId: string, updates: any): Promise<void> {
    try {
      await this.database.update('project_prompt_state', { project_id: projectId }, updates);
    } catch (error) {
      console.error('Failed to update project prompt state:', error);
    }
  }

  private convertUserPromptToAIPrompt(userPrompt: any): AIPrompt {
    return {
      id: userPrompt.id,
      text: userPrompt.text,
      category: 'general',
      difficulty: 'medium',
      tags: ['user-generated'],
      personalizedFor: userPrompt.created_by,
      createdAt: new Date(userPrompt.created_at),
    };
  }

  private convertDbPromptToAIPrompt(dbPrompt: any): AIPrompt {
    return {
      id: dbPrompt.id,
      text: dbPrompt.text,
      audioUrl: dbPrompt.audio_url,
      category: dbPrompt.category,
      difficulty: dbPrompt.difficulty,
      tags: dbPrompt.tags ? JSON.parse(dbPrompt.tags) : [],
      createdAt: new Date(dbPrompt.created_at),
    };
  }

  private convertLibraryPromptToAIPrompt(libraryPrompt: PromptLibraryEntry): AIPrompt {
    return {
      id: libraryPrompt.id,
      text: libraryPrompt.template,
      category: libraryPrompt.category,
      difficulty: libraryPrompt.difficulty,
      tags: libraryPrompt.tags,
      createdAt: new Date(),
    };
  }
}

// 导出改进的服务
export const improvedAIPromptService = new ImprovedAIPromptService(
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  // 这里需要实际的数据库实现
  {} as DatabaseInterface
);