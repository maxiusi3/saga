/**
 * 改进的AI Prompt Service测试套件
 * 使用依赖注入，完全独立于数据库
 */

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
};

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockOpenAI)
  };
});

import { 
  ImprovedAIPromptService, 
  DatabaseInterface, 
  CacheInterface, 
  MemoryCache,
  PromptGenerationRequest 
} from '../services/ai-prompt-service-improved';
import OpenAI from 'openai';

// Mock数据库实现
class MockDatabase implements DatabaseInterface {
  private data: Record<string, any[]> = {
    users: [
      { id: 'user-123', name: 'Test User', preferences: { language: 'en' } }
    ],
    project_prompt_state: [
      { 
        project_id: 'project-123', 
        current_chapter: 'childhood', 
        used_prompt_ids: [], 
        last_prompt_at: null 
      }
    ],
    user_prompts: [],
    prompts: [
      {
        id: 'db-prompt-1',
        text: 'Tell me about your first day of school.',
        chapter: 'childhood',
        category: 'childhood',
        difficulty: 'easy',
        tags: '["school", "childhood"]',
        created_at: new Date()
      }
    ]
  };

  async query(sql: string, params?: any[]): Promise<any[]> {
    // 简单的SQL模拟
    if (sql.includes('SELECT * FROM prompts')) {
      return this.data.prompts.filter(p => !params?.[1]?.includes(p.id));
    }
    return [];
  }

  async first(table: string, conditions: any): Promise<any> {
    const records = this.data[table] || [];
    return records.find(record => 
      Object.keys(conditions).every(key => record[key] === conditions[key])
    ) || null;
  }

  async insert(table: string, data: any): Promise<any> {
    if (!this.data[table]) this.data[table] = [];
    this.data[table].push({ ...data, id: `${table}-${Date.now()}` });
    return [data];
  }

  async update(table: string, conditions: any, data: any): Promise<any> {
    const records = this.data[table] || [];
    const index = records.findIndex(record => 
      Object.keys(conditions).every(key => record[key] === conditions[key])
    );
    if (index >= 0) {
      records[index] = { ...records[index], ...data };
    }
    return 1;
  }

  async delete(table: string, conditions: any): Promise<any> {
    if (!this.data[table]) return 0;
    const originalLength = this.data[table].length;
    this.data[table] = this.data[table].filter(record => 
      !Object.keys(conditions).every(key => record[key] === conditions[key])
    );
    return originalLength - this.data[table].length;
  }
}

describe('ImprovedAIPromptService', () => {
  let service: ImprovedAIPromptService;
  let mockDatabase: MockDatabase;
  let mockCache: CacheInterface;

  beforeEach(() => {
    // 重置mocks
    jest.clearAllMocks();
    
    // 设置OpenAI mock默认响应
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: 'Tell me about your childhood home.'
        }
      }]
    });

    // 创建mock依赖
    mockDatabase = new MockDatabase();
    mockCache = new MemoryCache();
    
    // 创建服务实例
    service = new ImprovedAIPromptService(
      new OpenAI({ apiKey: 'test-key' }),
      mockDatabase,
      mockCache
    );
  });

  describe('构造函数和初始化', () => {
    it('应该成功创建服务实例', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ImprovedAIPromptService);
    });

    it('应该有所有必需的方法', () => {
      expect(typeof service.generatePersonalizedPrompt).toBe('function');
      expect(typeof service.generateFollowUpQuestions).toBe('function');
      expect(typeof service.getNextPrompt).toBe('function');
      expect(typeof service.getPerformanceMetrics).toBe('function');
      expect(typeof service.clearCaches).toBe('function');
    });
  });

  describe('generatePersonalizedPrompt', () => {
    it('应该生成个性化提示', async () => {
      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'childhood'
      };

      const result = await service.generatePersonalizedPrompt(request);

      expect(result).toBeDefined();
      expect(result.text).toBe('Tell me about your childhood home.');
      expect(result.category).toBe('childhood');
      expect(result.personalizedFor).toBe('user-123');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('应该验证输入并拒绝无效请求', async () => {
      const request: PromptGenerationRequest = {
        userId: '', // 无效的空用户ID
        category: 'general'
      };

      await expect(service.generatePersonalizedPrompt(request))
        .rejects.toThrow('User ID is required');
    });

    it('应该使用缓存避免重复的API调用', async () => {
      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'general'
      };

      // 第一次调用
      const result1 = await service.generatePersonalizedPrompt(request);
      // 第二次调用应该使用缓存
      const result2 = await service.generatePersonalizedPrompt(request);

      expect(result1).toEqual(result2);
      // 验证OpenAI只被调用一次（由于缓存）
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('应该优雅地处理AI服务错误', async () => {
      // Mock OpenAI抛出错误
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));

      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'general'
      };

      const result = await service.generatePersonalizedPrompt(request);

      expect(result).toBeDefined();
      expect(result.tags).toContain('fallback');
      expect(result.tags).toContain('ai-error');
    });

    it('应该处理空的AI响应', async () => {
      // Mock OpenAI返回空响应
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: ''
          }
        }]
      });

      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'general'
      };

      const result = await service.generatePersonalizedPrompt(request);

      expect(result).toBeDefined();
      expect(result.tags).toContain('fallback');
    });
  });

  describe('generateFollowUpQuestions', () => {
    it('应该为有效的故事内容生成跟进问题', async () => {
      // Mock OpenAI返回跟进问题
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'What was your favorite room?\nWho lived there with you?\nWhat do you remember most?'
          }
        }]
      });

      const storyContent = 'I grew up in a small house with my parents and siblings.';
      const questions = await service.generateFollowUpQuestions(storyContent);

      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions.length).toBeLessThanOrEqual(3);
      
      questions.forEach(question => {
        expect(typeof question).toBe('string');
        expect(question.length).toBeGreaterThan(5);
      });
    });

    it('应该对短内容返回空数组', async () => {
      const questions = await service.generateFollowUpQuestions('Hi');
      expect(questions).toEqual([]);
    });

    it('应该优雅地处理AI错误', async () => {
      // Mock OpenAI抛出错误
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));

      const storyContent = 'I grew up in a wonderful family home with many memories.';
      const questions = await service.generateFollowUpQuestions(storyContent);

      expect(questions).toEqual([]);
    });

    it('应该处理速率限制', async () => {
      const storyContent = 'A story about childhood memories and family traditions.';
      
      // 第一次调用应该成功
      const questions1 = await service.generateFollowUpQuestions(storyContent);
      // 立即的第二次调用应该被速率限制
      const questions2 = await service.generateFollowUpQuestions(storyContent);

      expect(questions2).toEqual([]);
    });
  });

  describe('getNextPrompt', () => {
    it('应该为项目返回下一个提示', async () => {
      const prompt = await service.getNextPrompt('project-123', 'user-123');
      
      expect(prompt).toBeDefined();
      if (prompt) {
        expect(prompt.text).toBeTruthy();
        expect(prompt.category).toBeDefined();
      }
    });

    it('应该处理速率限制', async () => {
      // 模拟速率限制场景
      const promises = Array(15).fill(null).map(() => 
        service.getNextPrompt('project-123', 'user-123')
      );
      
      const results = await Promise.all(promises);
      
      // 所有结果都应该返回某种提示（真实提示或回退提示）
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('应该使用缓存', async () => {
      const prompt1 = await service.getNextPrompt('project-123', 'user-123');
      const prompt2 = await service.getNextPrompt('project-123', 'user-123');

      expect(prompt1).toEqual(prompt2);
    });
  });

  describe('性能和缓存', () => {
    it('应该跟踪性能指标', async () => {
      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'general'
      };

      await service.generatePersonalizedPrompt(request);
      
      const metrics = service.getPerformanceMetrics();
      expect(typeof metrics).toBe('object');
      expect(Object.keys(metrics).length).toBeGreaterThan(0);
    });

    it('应该在请求时清除缓存', async () => {
      // 添加一些数据到缓存
      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'general'
      };

      await service.generatePersonalizedPrompt(request);

      // 清除缓存
      await service.clearCaches();
      
      // 验证缓存已清除
      const metrics = service.getPerformanceMetrics();
      expect(Object.keys(metrics).length).toBe(0);
    });

    it('应该高效处理并发请求', async () => {
      const requests = Array(5).fill(null).map((_, i) => ({
        userId: `user-${i}`,
        category: 'general' as const
      }));

      const startTime = Date.now();
      const promises = requests.map(req => 
        service.generatePersonalizedPrompt(req)
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5);
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
      
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.text).toBeTruthy();
      });
    });
  });

  describe('错误处理和弹性', () => {
    it('应该优雅地处理格式错误的AI响应', async () => {
      // Mock OpenAI返回格式错误的响应
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: null
          }
        }]
      });

      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'general'
      };

      const result = await service.generatePersonalizedPrompt(request);
      
      expect(result).toBeDefined();
      expect(result.tags).toContain('fallback');
    });

    it('应该处理网络超时', async () => {
      // Mock OpenAI超时
      mockOpenAI.chat.completions.create.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'general'
      };

      const result = await service.generatePersonalizedPrompt(request);
      
      expect(result).toBeDefined();
      expect(result.tags).toContain('fallback');
    });

    it('应该处理数据库错误', async () => {
      // Mock数据库抛出错误
      const errorDatabase = {
        query: jest.fn().mockRejectedValue(new Error('Database error')),
        first: jest.fn().mockRejectedValue(new Error('Database error')),
        insert: jest.fn().mockRejectedValue(new Error('Database error')),
        update: jest.fn().mockRejectedValue(new Error('Database error')),
        delete: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      const errorService = new ImprovedAIPromptService(
        new OpenAI({ apiKey: 'test-key' }),
        errorDatabase,
        mockCache
      );

      const prompt = await errorService.getNextPrompt('project-123', 'user-123');
      
      // 应该返回回退提示而不是崩溃
      expect(prompt).toBeDefined();
    });
  });

  describe('缓存功能', () => {
    it('应该正确实现内存缓存', async () => {
      const cache = new MemoryCache();
      
      // 测试设置和获取
      await cache.set('test-key', 'test-value', 1000);
      const value = await cache.get('test-key');
      expect(value).toBe('test-value');
      
      // 测试过期
      await cache.set('expire-key', 'expire-value', 1);
      await new Promise(resolve => setTimeout(resolve, 10));
      const expiredValue = await cache.get('expire-key');
      expect(expiredValue).toBeNull();
      
      // 测试删除
      await cache.set('delete-key', 'delete-value');
      await cache.delete('delete-key');
      const deletedValue = await cache.get('delete-key');
      expect(deletedValue).toBeNull();
      
      // 测试清除
      await cache.set('clear-key', 'clear-value');
      await cache.clear();
      const clearedValue = await cache.get('clear-key');
      expect(clearedValue).toBeNull();
    });
  });

  describe('文本处理', () => {
    it('应该正确清理提示文本', async () => {
      // Mock OpenAI返回需要清理的文本
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: '  tell me about your *childhood* home  '
          }
        }]
      });

      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'childhood'
      };

      const result = await service.generatePersonalizedPrompt(request);

      expect(result.text).toBe('Tell me about your childhood home.');
      expect(result.text).not.toContain('*');
      expect(result.text.charAt(0)).toBe(result.text.charAt(0).toUpperCase());
    });
  });
});