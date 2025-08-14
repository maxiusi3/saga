/**
 * Unit tests for AI Prompt Service - isolated from database
 */

// Mock all external dependencies first
jest.mock('openai', () => {
  const mockCreate = jest.fn().mockResolvedValue({
    choices: [{
      message: {
        content: 'Tell me about your childhood home.'
      }
    }]
  });

  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  }
});

// Mock BaseModel to avoid database connection
jest.mock('../models/base', () => ({
  BaseModel: {
    db: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue(1),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis()
    }))
  }
}));

// Mock all model imports
jest.mock('../models/user', () => ({}));
jest.mock('../models/project', () => ({}));
jest.mock('../models/story', () => ({}));
jest.mock('../models/prompt', () => ({}));
jest.mock('../models/user-prompt', () => ({}));

import { AIPromptServiceClass } from '../services/ai-prompt-service';

describe('AIPromptService Unit Tests', () => {
  let promptService: AIPromptServiceClass;

  beforeAll(() => {
    // Set required environment variables
    process.env.OPENAI_API_KEY = 'test-key';
  });

  beforeEach(() => {
    promptService = new AIPromptServiceClass();
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should create an instance successfully', () => {
      expect(promptService).toBeDefined();
      expect(promptService).toBeInstanceOf(AIPromptServiceClass);
    });

    it('should have required methods', () => {
      expect(typeof promptService.generatePersonalizedPrompt).toBe('function');
      expect(typeof promptService.generateFollowUpQuestions).toBe('function');
      expect(typeof promptService.getNextPrompt).toBe('function');
      expect(typeof promptService.clearCaches).toBe('function');
      expect(typeof promptService.getPerformanceMetrics).toBe('function');
    });
  });

  describe('generatePersonalizedPrompt', () => {
    it('should generate a basic prompt', async () => {
      const request = {
        userId: 'test-user-123',
        category: 'general' as const
      };

      const result = await promptService.generatePersonalizedPrompt(request);

      expect(result).toBeDefined();
      expect(result.text).toBeTruthy();
      expect(result.personalizedFor).toBe('test-user-123');
      expect(result.category).toBe('general');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should reject requests without userId', async () => {
      const request = {
        userId: '',
        category: 'general' as const
      };

      await expect(promptService.generatePersonalizedPrompt(request))
        .rejects.toThrow('User ID is required');
    });

    it('should handle AI service errors gracefully', async () => {
      // Mock OpenAI to throw error
      const mockOpenAI = require('openai').default;
      const mockInstance = mockOpenAI.mock.results[0].value;
      mockInstance.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));

      const request = {
        userId: 'test-user-123',
        category: 'general' as const
      };

      const result = await promptService.generatePersonalizedPrompt(request);

      expect(result).toBeDefined();
      expect(result.tags).toContain('fallback');
      expect(result.tags).toContain('ai-error');
    });

    it('should use caching for repeated requests', async () => {
      const request = {
        userId: 'test-user-123',
        category: 'general' as const
      };

      const result1 = await promptService.generatePersonalizedPrompt(request);
      const result2 = await promptService.generatePersonalizedPrompt(request);

      expect(result1).toEqual(result2);

      // Verify OpenAI was only called once due to caching
      const mockOpenAI = require('openai').default;
      const mockInstance = mockOpenAI.mock.results[0].value;
      expect(mockInstance.chat.completions.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateFollowUpQuestions', () => {
    it('should generate follow-up questions for valid story content', async () => {
      // Mock OpenAI to return follow-up questions
      const mockOpenAI = require('openai').default;
      const mockInstance = mockOpenAI.mock.results[0].value;
      mockInstance.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'What was your favorite room?\nWho lived there with you?\nWhat do you remember most?'
          }
        }]
      });

      const storyContent = 'I grew up in a small house with my parents and siblings.';
      const questions = await promptService.generateFollowUpQuestions(storyContent);

      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions.length).toBeLessThanOrEqual(3);
      
      questions.forEach(question => {
        expect(typeof question).toBe('string');
        expect(question.length).toBeGreaterThan(5);
      });
    });

    it('should return empty array for short content', async () => {
      const questions = await promptService.generateFollowUpQuestions('Hi');
      expect(questions).toEqual([]);
    });

    it('should handle AI errors gracefully', async () => {
      // Mock OpenAI to throw error
      const mockOpenAI = require('openai').default;
      const mockInstance = mockOpenAI.mock.results[0].value;
      mockInstance.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));

      const storyContent = 'I grew up in a wonderful family home with many memories.';
      const questions = await promptService.generateFollowUpQuestions(storyContent);

      expect(questions).toEqual([]);
    });
  });

  describe('Performance and caching', () => {
    it('should track performance metrics', async () => {
      const request = {
        userId: 'test-user-123',
        category: 'general' as const
      };

      await promptService.generatePersonalizedPrompt(request);
      
      const metrics = promptService.getPerformanceMetrics();
      expect(typeof metrics).toBe('object');
    });

    it('should clear caches when requested', () => {
      // This should not throw an error
      expect(() => promptService.clearCaches()).not.toThrow();
      
      const metrics = promptService.getPerformanceMetrics();
      expect(Object.keys(metrics).length).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed AI responses', async () => {
      // Mock OpenAI to return empty response
      const mockOpenAI = require('openai').default;
      const mockInstance = mockOpenAI.mock.results[0].value;
      mockInstance.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: ''
          }
        }]
      });

      const request = {
        userId: 'test-user-123',
        category: 'general' as const
      };

      const result = await promptService.generatePersonalizedPrompt(request);
      
      expect(result).toBeDefined();
      expect(result.tags).toContain('fallback');
    });

    it('should handle network timeouts', async () => {
      // Mock OpenAI to timeout
      const mockOpenAI = require('openai').default;
      const mockInstance = mockOpenAI.mock.results[0].value;
      mockInstance.chat.completions.create.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const request = {
        userId: 'test-user-123',
        category: 'general' as const
      };

      const result = await promptService.generatePersonalizedPrompt(request);
      
      expect(result).toBeDefined();
      expect(result.tags).toContain('fallback');
    });
  });

  describe('Concurrent operations', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map((_, i) => ({
        userId: `test-user-${i}`,
        category: 'general' as const
      }));

      const startTime = Date.now();
      const promises = requests.map(req => 
        promptService.generatePersonalizedPrompt(req)
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.text).toBeTruthy();
      });
    });
  });
});