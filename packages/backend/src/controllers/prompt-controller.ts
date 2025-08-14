import { Request, Response } from 'express';
import { AIPromptService, PromptGenerationRequest } from '../services/ai-prompt-service';
import { Story } from '../models/story';

export class PromptController {
  /**
   * Get daily prompt for user
   */
  static async getDailyPrompt(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const prompt = await AIPromptService.getDailyPrompt(userId);
      res.json(prompt);
    } catch (error) {
      console.error('Error getting daily prompt:', error);
      res.status(500).json({ error: 'Failed to get daily prompt' });
    }
  }

  /**
   * Generate personalized prompt
   */
  static async getPersonalizedPrompt(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const request: PromptGenerationRequest = {
        userId,
        category: req.body.category,
        previousPrompts: req.body.previousPrompts || [],
        userPreferences: req.body.userPreferences || {},
        storyContext: req.body.storyContext,
      };

      const prompt = await AIPromptService.generatePersonalizedPrompt(request);
      res.json(prompt);
    } catch (error) {
      console.error('Error generating personalized prompt:', error);
      res.status(500).json({ error: 'Failed to generate personalized prompt' });
    }
  }

  /**
   * Get prompt by category
   */
  static async getPromptByCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const validCategories = ['childhood', 'family', 'career', 'relationships', 'general'];
      if (!validCategories.includes(category)) {
        res.status(400).json({ error: 'Invalid category' });
        return;
      }

      const excludeIds = req.query.exclude ? (req.query.exclude as string).split(',') : [];
      const difficulty = req.query.difficulty as 'easy' | 'medium' | 'hard' | undefined;

      const prompt = await AIPromptService.getLibraryPrompt(
        category as any,
        difficulty,
        excludeIds
      );

      res.json(prompt);
    } catch (error) {
      console.error('Error getting prompt by category:', error);
      res.status(500).json({ error: 'Failed to get prompt by category' });
    }
  }

  /**
   * Get follow-up prompt for a specific question
   */
  static async getFollowUpPrompt(req: Request, res: Response): Promise<void> {
    try {
      const { storyId, questionId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Verify user has access to this story
      const story = await Story.findById(storyId);
      if (!story || story.userId !== userId) {
        res.status(404).json({ error: 'Story not found' });
        return;
      }

      // For now, return a generic follow-up prompt
      // In a full implementation, this would be more sophisticated
      const prompt = await AIPromptService.getLibraryPrompt('general');
      res.json(prompt);
    } catch (error) {
      console.error('Error getting follow-up prompt:', error);
      res.status(500).json({ error: 'Failed to get follow-up prompt' });
    }
  }

  /**
   * Get related prompts based on a story
   */
  static async getRelatedPrompts(req: Request, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;
      const userId = req.user?.id;
      const count = parseInt(req.query.count as string) || 3;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Verify user has access to this story
      const story = await Story.findById(storyId);
      if (!story || story.userId !== userId) {
        res.status(404).json({ error: 'Story not found' });
        return;
      }

      const prompts = await AIPromptService.suggestRelatedPrompts(storyId, count);
      res.json(prompts);
    } catch (error) {
      console.error('Error getting related prompts:', error);
      res.status(500).json({ error: 'Failed to get related prompts' });
    }
  }

  /**
   * Mark prompt as used
   */
  static async markPromptUsed(req: Request, res: Response): Promise<void> {
    try {
      const { promptId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // In a full implementation, this would save to database
      // For now, just return success
      res.json({ success: true, message: 'Prompt marked as used' });
    } catch (error) {
      console.error('Error marking prompt as used:', error);
      res.status(500).json({ error: 'Failed to mark prompt as used' });
    }
  }

  /**
   * Skip a prompt
   */
  static async skipPrompt(req: Request, res: Response): Promise<void> {
    try {
      const { promptId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // In a full implementation, this would save skip reason to database
      // For analytics and improving prompt quality
      res.json({ success: true, message: 'Prompt skipped' });
    } catch (error) {
      console.error('Error skipping prompt:', error);
      res.status(500).json({ error: 'Failed to skip prompt' });
    }
  }

  /**
   * Get available prompt categories
   */
  static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = [
        {
          id: 'childhood',
          name: 'Childhood Memories',
          description: 'Stories from your early years',
          icon: 'child',
        },
        {
          id: 'family',
          name: 'Family Stories',
          description: 'Memories about family members and traditions',
          icon: 'people',
        },
        {
          id: 'career',
          name: 'Work & Career',
          description: 'Professional experiences and achievements',
          icon: 'briefcase',
        },
        {
          id: 'relationships',
          name: 'People & Relationships',
          description: 'Friends, love, and meaningful connections',
          icon: 'heart',
        },
        {
          id: 'general',
          name: 'Life Experiences',
          description: 'General life lessons and memorable moments',
          icon: 'star',
        },
      ];

      res.json(categories);
    } catch (error) {
      console.error('Error getting categories:', error);
      res.status(500).json({ error: 'Failed to get categories' });
    }
  }

  /**
   * Get user's prompt history
   */
  static async getPromptHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // In a full implementation, this would query the database
      // For now, return empty array
      res.json({
        prompts: [],
        total: 0,
        limit,
        offset,
      });
    } catch (error) {
      console.error('Error getting prompt history:', error);
      res.status(500).json({ error: 'Failed to get prompt history' });
    }
  }

  /**
   * Generate follow-up questions for a story
   */
  static async generateFollowUpQuestions(req: Request, res: Response): Promise<void> {
    try {
      const { storyContent, originalPrompt } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!storyContent || !originalPrompt) {
        res.status(400).json({ error: 'Story content and original prompt are required' });
        return;
      }

      const questions = await AIPromptService.generateFollowUpQuestions(
        storyContent,
        originalPrompt
      );

      res.json({ questions });
    } catch (error) {
      console.error('Error generating follow-up questions:', error);
      res.status(500).json({ error: 'Failed to generate follow-up questions' });
    }
  }

  /**
   * Customize a prompt for user preferences
   */
  static async customizePrompt(req: Request, res: Response): Promise<void> {
    try {
      const { promptId } = req.params;
      const userId = req.user?.id;
      const customizations = req.body;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const customizedPrompt = await AIPromptService.customizePrompt(
        promptId,
        userId,
        customizations
      );

      res.json(customizedPrompt);
    } catch (error) {
      console.error('Error customizing prompt:', error);
      res.status(500).json({ error: 'Failed to customize prompt' });
    }
  }

  /**
   * Get user's customization preferences
   */
  static async getCustomizationPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const preferences = await AIPromptService.getUserCustomizationPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error('Error getting customization preferences:', error);
      res.status(500).json({ error: 'Failed to get customization preferences' });
    }
  }

  /**
   * Save user's customization preferences
   */
  static async saveCustomizationPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const preferences = req.body;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      await AIPromptService.saveUserCustomizationPreferences(userId, preferences);
      res.json({ success: true, message: 'Preferences saved successfully' });
    } catch (error) {
      console.error('Error saving customization preferences:', error);
      res.status(500).json({ error: 'Failed to save customization preferences' });
    }
  }
}