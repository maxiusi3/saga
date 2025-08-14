import { PromptService } from '../prompt-service';

// Mock API client
jest.mock('../api-client', () => ({
  ApiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock expo-speech
jest.mock('expo-speech', () => ({
  Speech: {
    speak: jest.fn(),
    stop: jest.fn(),
  },
}));

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

describe('PromptService', () => {
  const mockApiClient = require('../api-client').ApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDailyPrompt', () => {
    it('should fetch daily prompt successfully', async () => {
      const mockPrompt = {
        id: 'prompt-1',
        text: 'Tell me about your childhood',
        category: 'childhood',
        difficulty: 'easy',
      };

      mockApiClient.get.mockResolvedValue({ data: mockPrompt });

      const result = await PromptService.getDailyPrompt();

      expect(result).toEqual(mockPrompt);
      expect(mockApiClient.get).toHaveBeenCalledWith('/prompts/daily');
    });

    it('should return fallback prompt on API failure', async () => {
      mockApiClient.get.mockRejectedValue(new Error('API Error'));

      const result = await PromptService.getDailyPrompt();

      expect(result).toBeTruthy();
      expect(result?.id).toContain('fallback');
    });
  });

  describe('getPersonalizedPrompt', () => {
    it('should fetch personalized prompt with request data', async () => {
      const mockPrompt = {
        id: 'prompt-2',
        text: 'Tell me about your career',
        category: 'career',
        difficulty: 'medium',
      };

      const request = {
        category: 'career',
        userPreferences: { topics: ['work'] },
      };

      mockApiClient.post.mockResolvedValue({ data: mockPrompt });

      const result = await PromptService.getPersonalizedPrompt(request);

      expect(result).toEqual(mockPrompt);
      expect(mockApiClient.post).toHaveBeenCalledWith('/prompts/personalized', {
        ...request,
        previousPrompts: [],
      });
    });
  });

  describe('getPromptByCategory', () => {
    it('should fetch prompt by category', async () => {
      const mockPrompt = {
        id: 'prompt-3',
        text: 'Tell me about your family',
        category: 'family',
        difficulty: 'easy',
      };

      mockApiClient.get.mockResolvedValue({ data: mockPrompt });

      const result = await PromptService.getPromptByCategory('family');

      expect(result).toEqual(mockPrompt);
      expect(mockApiClient.get).toHaveBeenCalledWith('/prompts/category/family');
    });
  });

  describe('markPromptUsed', () => {
    it('should mark prompt as used and add to history', async () => {
      const promptId = 'prompt-1';
      const mockPrompt = {
        id: promptId,
        text: 'Test prompt',
        category: 'general' as const,
        difficulty: 'easy' as const,
      };

      // Set current prompt
      PromptService['currentPrompt'] = mockPrompt;

      await PromptService.markPromptUsed(promptId);

      expect(mockApiClient.post).toHaveBeenCalledWith(`/prompts/${promptId}/used`);
      expect(PromptService.getPromptHistory()).toContain(mockPrompt);
    });
  });

  describe('skipPrompt', () => {
    it('should skip prompt with reason', async () => {
      const promptId = 'prompt-1';
      const reason = 'Not interested';

      await PromptService.skipPrompt(promptId, reason);

      expect(mockApiClient.post).toHaveBeenCalledWith(`/prompts/${promptId}/skip`, { reason });
    });
  });

  describe('playPromptAudio', () => {
    it('should play pre-generated audio if available', async () => {
      const mockPrompt = {
        id: 'prompt-1',
        text: 'Test prompt',
        audioUrl: 'https://example.com/audio.mp3',
        category: 'general' as const,
        difficulty: 'easy' as const,
      };

      const mockSound = {
        playAsync: jest.fn(),
      };

      const mockAudio = require('expo-av').Audio;
      mockAudio.Sound.createAsync.mockResolvedValue({ sound: mockSound });

      const result = await PromptService.playPromptAudio(mockPrompt);

      expect(result).toBe(true);
      expect(mockAudio.Sound.createAsync).toHaveBeenCalledWith({ uri: mockPrompt.audioUrl });
      expect(mockSound.playAsync).toHaveBeenCalled();
    });

    it('should use text-to-speech if no audio URL', async () => {
      const mockPrompt = {
        id: 'prompt-1',
        text: 'Test prompt',
        category: 'general' as const,
        difficulty: 'easy' as const,
      };

      const mockSpeech = require('expo-speech').Speech;

      const result = await PromptService.playPromptAudio(mockPrompt);

      expect(result).toBe(true);
      expect(mockSpeech.speak).toHaveBeenCalledWith(mockPrompt.text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.8,
        voice: undefined,
      });
    });
  });

  describe('utility methods', () => {
    it('should get category display name', () => {
      expect(PromptService.getCategoryDisplayName('childhood')).toBe('Childhood Memories');
      expect(PromptService.getCategoryDisplayName('family')).toBe('Family Stories');
      expect(PromptService.getCategoryDisplayName('career')).toBe('Work & Career');
      expect(PromptService.getCategoryDisplayName('relationships')).toBe('People & Relationships');
      expect(PromptService.getCategoryDisplayName('general')).toBe('Life Experiences');
    });

    it('should get difficulty color', () => {
      expect(PromptService.getDifficultyColor('easy')).toBe('#10b981');
      expect(PromptService.getDifficultyColor('medium')).toBe('#f59e0b');
      expect(PromptService.getDifficultyColor('hard')).toBe('#ef4444');
    });
  });

  describe('fallback prompts', () => {
    it('should return different fallback prompts', () => {
      // Clear history to test fallback selection
      PromptService['promptHistory'] = [];

      const prompt1 = PromptService['getFallbackPrompt']();
      const prompt2 = PromptService['getFallbackPrompt']();

      expect(prompt1).toBeTruthy();
      expect(prompt2).toBeTruthy();
      expect(prompt1.id).toContain('fallback');
      expect(prompt2.id).toContain('fallback');
    });

    it('should avoid recently used fallback prompts', () => {
      // Add some prompts to history
      const usedPrompts = [
        { id: 'fallback-1', text: 'Test 1', category: 'general' as const, difficulty: 'easy' as const },
        { id: 'fallback-2', text: 'Test 2', category: 'general' as const, difficulty: 'easy' as const },
      ];

      PromptService['promptHistory'] = usedPrompts;

      const fallbackPrompt = PromptService['getFallbackPrompt']();

      expect(fallbackPrompt.id).not.toBe('fallback-1');
      expect(fallbackPrompt.id).not.toBe('fallback-2');
    });
  });
});