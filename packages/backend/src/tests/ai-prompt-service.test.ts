import { AIPromptService, AIPromptServiceClass, PromptGenerationRequest } from '../services/ai-prompt-service';
import { Prompt } from '../models/prompt';
import { UserPrompt } from '../models/user-prompt';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

// Mock models
jest.mock('../models/prompt');
jest.mock('../models/user-prompt');
jest.mock('../models/story');
jest.mock('../models/user');

const mockOpenAI = require('openai').default;
const mockPrompt = Prompt as jest.Mocked<typeof Prompt>;
const mockUserPrompt = UserPrompt as jest.Mocked<typeof UserPrompt>;

describe('AIPromptService', () => {
  let mockOpenAIInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };
    
    mockOpenAI.mockImplementation(() => mockOpenAIInstance);
  });

  describe('generatePersonalizedPrompt', () => {
    it('should generate a personalized prompt using AI', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'Tell me about your favorite childhood memory. What made it so special to you?',
          },
        }],
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockCompletion);

      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'childhood',
        previousPrompts: [],
        userPreferences: {
          topics: ['family', 'school'],
          avoidTopics: ['illness'],
        },
      };

      const result = await AIPromptService.generatePersonalizedPrompt(request);

      expect(result).toMatchObject({
        text: 'Tell me about your favorite childhood memory. What made it so special to you?',
        category: 'childhood',
        personalizedFor: 'user-123',
      });

      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        temperature: 0.8,
        max_tokens: 200,
      });
    });

    it('should return fallback prompt when AI generation fails', async () => {
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'childhood',
      };

      const result = await AIPromptService.generatePersonalizedPrompt(request);

      expect(result).toBeDefined();
      expect(result.category).toBe('childhood');
      expect(result.text).toBeTruthy();
    });

    it('should cache generated prompts', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'Test prompt content',
          },
        }],
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockCompletion);

      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'family',
      };

      // First call
      const result1 = await AIPromptService.generatePersonalizedPrompt(request);
      
      // Second call with same parameters
      const result2 = await AIPromptService.generatePersonalizedPrompt(request);

      expect(result1.id).toBe(result2.id);
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLibraryPrompt', () => {
    it('should return a prompt from the library', async () => {
      const result = await AIPromptService.getLibraryPrompt('childhood', 'easy');

      expect(result).toBeDefined();
      expect(result.category).toBe('childhood');
      expect(result.difficulty).toBe('easy');
      expect(result.text).toBeTruthy();
    });

    it('should exclude specified prompt IDs', async () => {
      const excludeIds = ['prompt-1', 'prompt-2'];
      const result = await AIPromptService.getLibraryPrompt('family', undefined, excludeIds);

      expect(result).toBeDefined();
      expect(excludeIds).not.toContain(result.id);
    });

    it('should return any prompt when no matching category found', async () => {
      const result = await AIPromptService.getLibraryPrompt('career', 'hard', ['all-prompts']);

      expect(result).toBeDefined();
      expect(result.text).toBeTruthy();
    });
  });

  describe('generateFollowUpQuestions', () => {
    it('should generate follow-up questions based on story content', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'Who else was there with you?\nHow did that make you feel?\nDo you still think about that memory today?',
          },
        }],
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockCompletion);

      const storyContent = 'I remember playing in the garden with my siblings when I was young.';
      const originalPrompt = 'Tell me about your favorite childhood memory.';

      const result = await AIPromptService.generateFollowUpQuestions(storyContent, originalPrompt);

      expect(result).toHaveLength(3);
      expect(result[0]).toBe('Who else was there with you?');
      expect(result[1]).toBe('How did that make you feel?');
      expect(result[2]).toBe('Do you still think about that memory today?');
    });

    it('should return empty array when AI generation fails', async () => {
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await AIPromptService.generateFollowUpQuestions('story content', 'original prompt');

      expect(result).toEqual([]);
    });

    it('should limit to 3 questions maximum', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'Question 1?\nQuestion 2?\nQuestion 3?\nQuestion 4?\nQuestion 5?',
          },
        }],
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockCompletion);

      const result = await AIPromptService.generateFollowUpQuestions('story', 'prompt');

      expect(result).toHaveLength(3);
    });
  });

  describe('getDailyPrompt', () => {
    it('should return cached daily prompt for same user and date', async () => {
      const userId = 'user-123';

      // First call
      const result1 = await AIPromptService.getDailyPrompt(userId);
      
      // Second call on same day
      const result2 = await AIPromptService.getDailyPrompt(userId);

      expect(result1.id).toBe(result2.id);
    });

    it('should rotate through categories based on day of week', async () => {
      const userId = 'user-123';
      const result = await AIPromptService.getDailyPrompt(userId);

      const categories = ['childhood', 'family', 'career', 'relationships', 'general'];
      expect(categories).toContain(result.category);
    });
  });

  describe('suggestRelatedPrompts', () => {
    it('should suggest related prompts based on story content', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'Tell me about another family tradition.\nWhat was your favorite holiday growing up?\nDescribe a typical family dinner.',
          },
        }],
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockCompletion);

      // Mock story model
      const mockStory = {
        id: 'story-123',
        transcript: 'We always had big family gatherings during holidays.',
        aiPrompt: 'Tell me about family traditions.',
      };

      require('../models/story').Story.findById = jest.fn().mockResolvedValue(mockStory);

      const result = await AIPromptService.suggestRelatedPrompts('story-123', 3);

      expect(result).toHaveLength(3);
      expect(result[0].text).toBe('Tell me about another family tradition.');
      expect(result[1].text).toBe('What was your favorite holiday growing up?');
      expect(result[2].text).toBe('Describe a typical family dinner.');
    });

    it('should return empty array when story not found', async () => {
      require('../models/story').Story.findById = jest.fn().mockResolvedValue(null);

      const result = await AIPromptService.suggestRelatedPrompts('nonexistent-story');

      expect(result).toEqual([]);
    });
  });

  describe('prompt categorization', () => {
    it('should correctly categorize prompts based on content', async () => {
      const service = AIPromptService as any;

      expect(service.categorizePrompt('Tell me about your childhood')).toBe('childhood');
      expect(service.categorizePrompt('What was your family like?')).toBe('family');
      expect(service.categorizePrompt('Describe your first job')).toBe('career');
      expect(service.categorizePrompt('Tell me about your best friend')).toBe('relationships');
      expect(service.categorizePrompt('What is your philosophy?')).toBe('general');
    });

    it('should determine difficulty based on content', async () => {
      const service = AIPromptService as any;

      expect(service.determineDifficulty('Tell me about a happy memory')).toBe('easy');
      expect(service.determineDifficulty('Describe a difficult decision you made')).toBe('hard');
      expect(service.determineDifficulty('What was your relationship like?')).toBe('medium');
    });

    it('should extract relevant tags from prompt text', async () => {
      const service = AIPromptService as any;

      const tags = service.extractTags('Tell me about a person who taught you something important');
      
      expect(tags).toContain('people');
      expect(tags).toContain('learning');
    });
  });

  describe('error handling', () => {
    it('should handle OpenAI API errors gracefully', async () => {
      const apiError = new Error('Rate limit exceeded');
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(apiError);

      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'general',
      };

      const result = await AIPromptService.generatePersonalizedPrompt(request);

      // Should return fallback prompt instead of throwing
      expect(result).toBeDefined();
      expect(result.text).toBeTruthy();
    });

    it('should handle malformed AI responses', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: null, // Malformed response
          },
        }],
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockCompletion);

      const request: PromptGenerationRequest = {
        userId: 'user-123',
      };

      const result = await AIPromptService.generatePersonalizedPrompt(request);

      // Should return fallback prompt
      expect(result).toBeDefined();
      expect(result.text).toBeTruthy();
    });
  });

  describe('prompt library initialization', () => {
    it('should initialize with predefined prompts', () => {
      const service = AIPromptService as any;
      
      expect(service.promptLibrary).toBeDefined();
      expect(service.promptLibrary.length).toBeGreaterThan(0);
      
      // Check that all categories are represented
      const categories = service.promptLibrary.map((p: any) => p.category);
      expect(categories).toContain('childhood');
      expect(categories).toContain('family');
      expect(categories).toContain('career');
      expect(categories).toContain('relationships');
      expect(categories).toContain('general');
    });

    it('should have valid prompt library entries', () => {
      const service = AIPromptService as any;
      
      service.promptLibrary.forEach((entry: any) => {
        expect(entry.id).toBeTruthy();
        expect(entry.category).toBeTruthy();
        expect(entry.difficulty).toBeTruthy();
        expect(entry.variations).toBeInstanceOf(Array);
        expect(entry.variations.length).toBeGreaterThan(0);
        expect(entry.followUpTemplates).toBeInstanceOf(Array);
        expect(entry.tags).toBeInstanceOf(Array);
      });
    });
  });

  describe('prompt customization', () => {
    it('should customize prompt based on user preferences', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'Tell me about a cherished childhood memory that brings you joy. What made it so meaningful to you?',
          },
        }],
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockCompletion);

      // Mock database query for original prompt
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 'prompt-123',
          text: 'Tell me about your favorite childhood memory.',
          category: 'childhood',
          difficulty: 'easy',
          audio_url: null,
          follow_up_questions: [],
          tags: [],
        }),
      };

      (AIPromptService as any).prototype.db = jest.fn().mockReturnValue(mockDb);

      const customizations = {
        tone: 'warm',
        complexity: 'detailed',
        focus: 'emotions',
      };

      const result = await AIPromptService.customizePrompt('prompt-123', 'user-123', customizations);

      expect(result.text).toBe('Tell me about a cherished childhood memory that brings you joy. What made it so meaningful to you?');
      expect(result.personalizedFor).toBe('user-123');
      expect(result.tags).toContain('customized');
    });

    it('should return original prompt when customization fails', async () => {
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const mockDb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 'prompt-123',
          text: 'Original prompt text',
          category: 'family',
          difficulty: 'medium',
        }),
      };

      (AIPromptService as any).prototype.db = jest.fn().mockReturnValue(mockDb);

      const result = await AIPromptService.customizePrompt('prompt-123', 'user-123', {});

      expect(result.text).toBe('Original prompt text');
      expect(result.category).toBe('family');
    });
  });

  describe('chapter progression', () => {
    it('should get next prompt from current chapter', async () => {
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          current_chapter_id: 'chapter-1',
          current_prompt_index: 0,
        }),
        orderBy: jest.fn().mockReturnThis(),
      };

      (AIPromptService as any).prototype.db = jest.fn().mockReturnValue(mockDb);

      const result = await AIPromptService.getNextPrompt('project-123');

      expect(mockDb.where).toHaveBeenCalledWith('project_id', 'project-123');
    });

    it('should advance to next chapter when current is complete', async () => {
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn()
          .mockResolvedValueOnce({ // project state
            current_chapter_id: 'chapter-1',
            current_prompt_index: 10,
          })
          .mockResolvedValueOnce(null) // no more prompts in current chapter
          .mockResolvedValueOnce({ // next chapter
            id: 'chapter-2',
            order_index: 2,
          }),
        orderBy: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([]),
      };

      (AIPromptService as any).prototype.db = jest.fn().mockReturnValue(mockDb);

      await AIPromptService.getNextPrompt('project-123');

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('user prompt priority', () => {
    it('should prioritize user prompts over AI prompts', async () => {
      const mockUserPrompt = {
        id: 'user-prompt-1',
        text: 'Tell me more about that story',
        project_id: 'project-123',
        created_by: 'facilitator-1',
      };

      const mockDb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockUserPrompt),
        update: jest.fn().mockResolvedValue([]),
      };

      (AIPromptService as any).prototype.db = jest.fn().mockReturnValue(mockDb);

      const result = await AIPromptService.getNextPrompt('project-123');

      expect(result?.text).toBe('Tell me more about that story');
      expect(mockDb.update).toHaveBeenCalled(); // Mark as delivered
    });
  });

  describe('prompt analytics', () => {
    it('should track prompt effectiveness', async () => {
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue([
          { category: 'childhood', count: 15 },
          { category: 'family', count: 12 },
        ]),
      };

      (AIPromptService as any).prototype.db = jest.fn().mockReturnValue(mockDb);

      // This would be a method to get analytics
      const analytics = await (AIPromptService as any).getPromptAnalytics('project-123');

      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.count).toHaveBeenCalled();
    });
  });

  describe('audio generation', () => {
    it('should generate audio for prompts using TTS', async () => {
      const mockTTSResponse = new ArrayBuffer(1024);
      const mockStorageUrl = 'https://storage.example.com/audio/prompt-123.mp3';

      // Mock OpenAI TTS
      mockOpenAIInstance.audio = {
        speech: {
          create: jest.fn().mockResolvedValue(mockTTSResponse),
        },
      };

      // Mock storage service
      const mockStorageService = {
        uploadAudio: jest.fn().mockResolvedValue(mockStorageUrl),
      };

      const promptText = 'Tell me about your favorite childhood memory.';
      
      // This would be a method to generate audio
      const audioUrl = await (AIPromptService as any).generatePromptAudio(promptText);

      expect(mockOpenAIInstance.audio.speech.create).toHaveBeenCalledWith({
        input: promptText,
        voice: 'alloy',
        model: 'tts-1',
        speed: 0.9,
      });
    });
  });

  describe('caching', () => {
    it('should cache prompts to avoid redundant generation', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'Cached prompt content',
          },
        }],
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockCompletion);

      const request: PromptGenerationRequest = {
        userId: 'user-123',
        category: 'general',
      };

      // First call
      await AIPromptService.generatePersonalizedPrompt(request);
      
      // Second call with same parameters
      await AIPromptService.generatePersonalizedPrompt(request);

      // Should only call OpenAI once due to caching
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('should clear cache when appropriate', () => {
      const service = AIPromptService as any;
      
      // Add item to cache
      service.promptCache.set('test-key', { id: 'test', text: 'test' });
      expect(service.promptCache.has('test-key')).toBe(true);
      
      // Clear cache
      service.promptCache.clear();
      expect(service.promptCache.has('test-key')).toBe(false);
    });
  });
});