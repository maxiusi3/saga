import { ApiClient } from './api-client';
import type { 
  AIPrompt, 
  PromptGenerationRequest,
  PromptCategory,
  UserPromptHistory,
  FollowUpQuestionsRequest,
} from '@saga/shared/types/prompt';

class PromptServiceClass {
  private currentPrompt: AIPrompt | null = null;
  private promptHistory: AIPrompt[] = [];

  async getDailyPrompt(): Promise<AIPrompt | null> {
    try {
      const response = await ApiClient.get('/prompts/daily');
      const prompt = response.data;
      
      this.currentPrompt = prompt;
      return prompt;
    } catch (error) {
      console.error('Failed to get daily prompt:', error);
      return this.getFallbackPrompt();
    }
  }

  async getPersonalizedPrompt(request: Partial<PromptGenerationRequest> = {}): Promise<AIPrompt | null> {
    try {
      const response = await ApiClient.post('/prompts/personalized', {
        ...request,
        previousPrompts: this.promptHistory.map(p => p.id),
      });
      
      const prompt = response.data;
      this.currentPrompt = prompt;
      
      return prompt;
    } catch (error) {
      console.error('Failed to get personalized prompt:', error);
      return this.getFallbackPrompt();
    }
  }

  async getPromptByCategory(category: AIPrompt['category']): Promise<AIPrompt | null> {
    try {
      const response = await ApiClient.get(`/prompts/category/${category}`);
      const prompt = response.data;
      
      this.currentPrompt = prompt;
      return prompt;
    } catch (error) {
      console.error('Failed to get prompt by category:', error);
      return this.getFallbackPrompt();
    }
  }

  async getFollowUpPrompt(storyId: string, questionId: string): Promise<AIPrompt | null> {
    try {
      const response = await ApiClient.get(`/prompts/follow-up/${storyId}/${questionId}`);
      const prompt = response.data;
      
      this.currentPrompt = prompt;
      return prompt;
    } catch (error) {
      console.error('Failed to get follow-up prompt:', error);
      return this.getFallbackPrompt();
    }
  }

  async markPromptUsed(promptId: string): Promise<void> {
    try {
      await ApiClient.post(`/prompts/${promptId}/used`);
      
      // Add to history
      if (this.currentPrompt && this.currentPrompt.id === promptId) {
        this.promptHistory.push(this.currentPrompt);
        
        // Keep only last 50 prompts in history
        if (this.promptHistory.length > 50) {
          this.promptHistory = this.promptHistory.slice(-50);
        }
      }
    } catch (error) {
      console.error('Failed to mark prompt as used:', error);
    }
  }

  async skipPrompt(promptId: string, reason?: string): Promise<void> {
    try {
      await ApiClient.post(`/prompts/${promptId}/skip`, { reason });
    } catch (error) {
      console.error('Failed to skip prompt:', error);
    }
  }

  getCurrentPrompt(): AIPrompt | null {
    return this.currentPrompt;
  }

  getPromptHistory(): AIPrompt[] {
    return [...this.promptHistory];
  }

  private getFallbackPrompt(): AIPrompt {
    const fallbackPrompts: AIPrompt[] = [
      {
        id: 'fallback-1',
        text: 'Tell me about a favorite childhood memory. What made it special?',
        category: 'childhood',
        difficulty: 'easy',
      },
      {
        id: 'fallback-2',
        text: 'Describe a person who had a big influence on your life. How did they shape who you are?',
        category: 'relationships',
        difficulty: 'medium',
      },
      {
        id: 'fallback-3',
        text: 'What was your first job like? What did you learn from that experience?',
        category: 'career',
        difficulty: 'easy',
      },
      {
        id: 'fallback-4',
        text: 'Tell me about a family tradition that was important to you growing up.',
        category: 'family',
        difficulty: 'easy',
      },
      {
        id: 'fallback-5',
        text: 'What was the most challenging time in your life, and how did you get through it?',
        category: 'general',
        difficulty: 'hard',
      },
    ];

    // Return a random fallback prompt that hasn't been used recently
    const usedIds = this.promptHistory.slice(-10).map(p => p.id);
    const availablePrompts = fallbackPrompts.filter(p => !usedIds.includes(p.id));
    
    if (availablePrompts.length === 0) {
      return fallbackPrompts[0];
    }

    const randomIndex = Math.floor(Math.random() * availablePrompts.length);
    return availablePrompts[randomIndex];
  }

  // Text-to-speech functionality
  async playPromptAudio(prompt: AIPrompt): Promise<boolean> {
    try {
      if (prompt.audioUrl) {
        // Play pre-generated audio
        const { Audio } = await import('expo-av');
        const { sound } = await Audio.Sound.createAsync({ uri: prompt.audioUrl });
        await sound.playAsync();
        return true;
      } else {
        // Use device text-to-speech
        const { Speech } = await import('expo-speech');
        
        const options = {
          language: 'en-US',
          pitch: 1.0,
          rate: 0.8, // Slightly slower for elderly users
          voice: undefined, // Use system default
        };

        Speech.speak(prompt.text, options);
        return true;
      }
    } catch (error) {
      console.error('Failed to play prompt audio:', error);
      return false;
    }
  }

  async stopPromptAudio(): Promise<void> {
    try {
      const { Speech } = await import('expo-speech');
      Speech.stop();
    } catch (error) {
      console.error('Failed to stop prompt audio:', error);
    }
  }

  // Utility methods
  getCategoryDisplayName(category: AIPrompt['category']): string {
    const categoryNames = {
      childhood: 'Childhood Memories',
      family: 'Family Stories',
      career: 'Work & Career',
      relationships: 'People & Relationships',
      general: 'Life Experiences',
    };
    
    return categoryNames[category] || 'Stories';
  }

  getDifficultyColor(difficulty: AIPrompt['difficulty']): string {
    const colors = {
      easy: '#10b981',
      medium: '#f59e0b',
      hard: '#ef4444',
    };
    
    return colors[difficulty] || '#6b7280';
  }
}

export const PromptService = new PromptServiceClass();