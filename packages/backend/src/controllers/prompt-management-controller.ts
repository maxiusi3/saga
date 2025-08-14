import { Request, Response } from 'express';
import { Prompt } from '../models/prompt';
import { AIPromptService } from '../services/ai-prompt-service';

export class PromptManagementController {
  /**
   * Get all library prompts with pagination and filtering
   */
  static async getLibraryPrompts(req: Request, res: Response): Promise<void> {
    try {
      const {
        category,
        difficulty,
        page = '1',
        limit = '20',
        search,
        tags
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let prompts;
      
      if (search) {
        prompts = await Prompt.search(search as string, {
          category: category as any,
          difficulty: difficulty as any,
          limit: limitNum,
        });
      } else {
        prompts = await Prompt.findLibraryPrompts({
          category: category as any,
          difficulty: difficulty as any,
          tags: tags ? (tags as string).split(',') : undefined,
          limit: limitNum,
        });
      }

      // Get total count for pagination
      const totalPrompts = await Prompt.findLibraryPrompts();
      const total = totalPrompts.length;

      res.json({
        success: true,
        data: {
          prompts: prompts.map(p => ({
            id: p.data.id,
            text: p.data.text,
            category: p.data.category,
            difficulty: p.data.difficulty,
            tags: p.getTags(),
            followUpQuestions: p.getFollowUpQuestions(),
            hasAudio: p.hasAudio(),
            audioUrl: p.data.audioUrl,
            createdAt: p.data.createdAt,
            updatedAt: p.data.updatedAt,
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      console.error('Error getting library prompts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get library prompts',
      });
    }
  }  
/**
   * Create a new library prompt
   */
  static async createPrompt(req: Request, res: Response): Promise<void> {
    try {
      const {
        text,
        category,
        difficulty,
        tags = [],
        followUpQuestions = [],
        generateAudio = false
      } = req.body;

      if (!text || !category || !difficulty) {
        res.status(400).json({
          success: false,
          error: 'Text, category, and difficulty are required',
        });
        return;
      }

      const validCategories = ['childhood', 'family', 'career', 'relationships', 'general'];
      const validDifficulties = ['easy', 'medium', 'hard'];

      if (!validCategories.includes(category)) {
        res.status(400).json({
          success: false,
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        });
        return;
      }

      if (!validDifficulties.includes(difficulty)) {
        res.status(400).json({
          success: false,
          error: `Invalid difficulty. Must be one of: ${validDifficulties.join(', ')}`,
        });
        return;
      }

      let audioUrl;
      if (generateAudio) {
        try {
          // Generate audio using TTS
          audioUrl = await AIPromptService.generatePromptAudio(text);
        } catch (error) {
          console.warn('Failed to generate audio for prompt:', error);
        }
      }

      const prompt = await Prompt.create({
        text,
        category,
        difficulty,
        tags: Array.isArray(tags) ? tags : [],
        followUpQuestions: Array.isArray(followUpQuestions) ? followUpQuestions : [],
        audioUrl,
        isLibraryPrompt: true,
      });

      res.status(201).json({
        success: true,
        data: {
          id: prompt.data.id,
          text: prompt.data.text,
          category: prompt.data.category,
          difficulty: prompt.data.difficulty,
          tags: prompt.getTags(),
          followUpQuestions: prompt.getFollowUpQuestions(),
          hasAudio: prompt.hasAudio(),
          audioUrl: prompt.data.audioUrl,
          createdAt: prompt.data.createdAt,
          updatedAt: prompt.data.updatedAt,
        },
      });
    } catch (error) {
      console.error('Error creating prompt:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create prompt',
      });
    }
  }  /**

   * Update an existing prompt
   */
  static async updatePrompt(req: Request, res: Response): Promise<void> {
    try {
      const { promptId } = req.params;
      const {
        text,
        category,
        difficulty,
        tags,
        followUpQuestions,
        regenerateAudio = false
      } = req.body;

      const prompt = await Prompt.findById(promptId);
      if (!prompt) {
        res.status(404).json({
          success: false,
          error: 'Prompt not found',
        });
        return;
      }

      const updates: any = {};
      if (text) updates.text = text;
      if (category) updates.category = category;
      if (difficulty) updates.difficulty = difficulty;
      if (tags) updates.tags = Array.isArray(tags) ? tags : [];
      if (followUpQuestions) updates.followUpQuestions = Array.isArray(followUpQuestions) ? followUpQuestions : [];

      // Regenerate audio if requested or if text changed
      if (regenerateAudio || (text && text !== prompt.data.text)) {
        try {
          const audioUrl = await AIPromptService.generatePromptAudio(text || prompt.data.text);
          updates.audioUrl = audioUrl;
        } catch (error) {
          console.warn('Failed to regenerate audio for prompt:', error);
        }
      }

      await prompt.update(updates);

      res.json({
        success: true,
        data: {
          id: prompt.data.id,
          text: prompt.data.text,
          category: prompt.data.category,
          difficulty: prompt.data.difficulty,
          tags: prompt.getTags(),
          followUpQuestions: prompt.getFollowUpQuestions(),
          hasAudio: prompt.hasAudio(),
          audioUrl: prompt.data.audioUrl,
          createdAt: prompt.data.createdAt,
          updatedAt: prompt.data.updatedAt,
        },
      });
    } catch (error) {
      console.error('Error updating prompt:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update prompt',
      });
    }
  }  
/**
   * Delete a prompt
   */
  static async deletePrompt(req: Request, res: Response): Promise<void> {
    try {
      const { promptId } = req.params;

      const prompt = await Prompt.findById(promptId);
      if (!prompt) {
        res.status(404).json({
          success: false,
          error: 'Prompt not found',
        });
        return;
      }

      await prompt.delete();

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete prompt',
      });
    }
  }

  /**
   * Get prompt analytics and effectiveness data
   */
  static async getPromptAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { timeframe = '30d' } = req.query;

      // This would typically query usage data from the database
      // For now, we'll return mock analytics data
      const analytics = {
        totalPrompts: 0,
        activePrompts: 0,
        promptsByCategory: {},
        promptsByDifficulty: {},
        topPerformingPrompts: [],
        averageEngagement: 0,
        completionRates: {},
        skipRates: {},
        timeframe,
      };

      // Get basic prompt statistics
      const allPrompts = await Prompt.findLibraryPrompts();
      analytics.totalPrompts = allPrompts.length;
      analytics.activePrompts = allPrompts.length;

      // Count by category and difficulty
      const categoryCount: Record<string, number> = {};
      const difficultyCount: Record<string, number> = {};

      allPrompts.forEach(prompt => {
        categoryCount[prompt.data.category] = (categoryCount[prompt.data.category] || 0) + 1;
        difficultyCount[prompt.data.difficulty] = (difficultyCount[prompt.data.difficulty] || 0) + 1;
      });

      analytics.promptsByCategory = categoryCount;
      analytics.promptsByDifficulty = difficultyCount;

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error('Error getting prompt analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get prompt analytics',
      });
    }
  }

  /**
   * Regenerate audio for a prompt
   */
  static async regenerateAudio(req: Request, res: Response): Promise<void> {
    try {
      const { promptId } = req.params;

      const prompt = await Prompt.findById(promptId);
      if (!prompt) {
        res.status(404).json({
          success: false,
          error: 'Prompt not found',
        });
        return;
      }

      const audioUrl = await AIPromptService.generatePromptAudio(prompt.data.text);
      await prompt.update({ audioUrl });

      res.json({
        success: true,
        data: {
          audioUrl,
        },
      });
    } catch (error) {
      console.error('Error regenerating audio:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to regenerate audio',
      });
    }
  }

  /**
   * Get supported languages for localization
   */
  static async getSupportedLanguages(req: Request, res: Response): Promise<void> {
    try {
      const { PromptLocalizationService } = await import('../services/prompt-localization-service');
      const languages = PromptLocalizationService.getSupportedLanguages();

      res.json({
        success: true,
        data: languages,
      });
    } catch (error) {
      console.error('Error getting supported languages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get supported languages',
      });
    }
  }

  /**
   * Create localized version of a prompt
   */
  static async createLocalizedPrompt(req: Request, res: Response): Promise<void> {
    try {
      const { promptId } = req.params;
      const { targetLanguage, culturalContext, translatorNotes } = req.body;

      if (!targetLanguage) {
        res.status(400).json({
          success: false,
          error: 'Target language is required',
        });
        return;
      }

      const { PromptLocalizationService } = await import('../services/prompt-localization-service');
      const localizedPrompt = await PromptLocalizationService.createLocalizedPrompt({
        promptId,
        targetLanguage,
        culturalContext,
        translatorNotes,
      });

      res.status(201).json({
        success: true,
        data: localizedPrompt,
      });
    } catch (error) {
      console.error('Error creating localized prompt:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create localized prompt',
      });
    }
  }

  /**
   * Get localization coverage report
   */
  static async getLocalizationCoverage(req: Request, res: Response): Promise<void> {
    try {
      const { PromptLocalizationService } = await import('../services/prompt-localization-service');
      const coverage = await PromptLocalizationService.getLocalizationCoverage();

      res.json({
        success: true,
        data: coverage,
      });
    } catch (error) {
      console.error('Error getting localization coverage:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get localization coverage',
      });
    }
  }

  /**
   * Create backup of all prompts
   */
  static async createBackup(req: Request, res: Response): Promise<void> {
    try {
      const { backupType = 'manual' } = req.body;
      const createdBy = req.user?.id;

      const { PromptBackupService } = await import('../services/prompt-backup-service');
      const backup = await PromptBackupService.createBackup(backupType, createdBy);

      res.status(201).json({
        success: true,
        data: backup,
      });
    } catch (error) {
      console.error('Error creating backup:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create backup',
      });
    }
  }

  /**
   * Get all backups
   */
  static async getBackups(req: Request, res: Response): Promise<void> {
    try {
      const { PromptBackupService } = await import('../services/prompt-backup-service');
      const backups = await PromptBackupService.getBackups();

      res.json({
        success: true,
        data: backups,
      });
    } catch (error) {
      console.error('Error getting backups:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get backups',
      });
    }
  }

  /**
   * Restore from backup
   */
  static async restoreFromBackup(req: Request, res: Response): Promise<void> {
    try {
      const { backupId } = req.params;
      const { promptIds, overwriteExisting = false, createVersions = true } = req.body;

      const { PromptBackupService } = await import('../services/prompt-backup-service');
      const result = await PromptBackupService.restoreFromBackup({
        backupId,
        promptIds,
        overwriteExisting,
        createVersions,
      });

      res.json({
        success: result.success,
        data: {
          restoredCount: result.restoredCount,
          errors: result.errors,
        },
      });
    } catch (error) {
      console.error('Error restoring from backup:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to restore from backup',
      });
    }
  }

  /**
   * Get version history for a prompt
   */
  static async getPromptVersionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { promptId } = req.params;

      const { PromptBackupService } = await import('../services/prompt-backup-service');
      const versions = await PromptBackupService.getPromptVersionHistory(promptId);

      res.json({
        success: true,
        data: versions,
      });
    } catch (error) {
      console.error('Error getting prompt version history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get prompt version history',
      });
    }
  }

  /**
   * Revert prompt to a previous version
   */
  static async revertPromptToVersion(req: Request, res: Response): Promise<void> {
    try {
      const { promptId } = req.params;
      const { version } = req.body;
      const revertedBy = req.user?.id;

      if (!version) {
        res.status(400).json({
          success: false,
          error: 'Version number is required',
        });
        return;
      }

      const { PromptBackupService } = await import('../services/prompt-backup-service');
      const success = await PromptBackupService.revertPromptToVersion(
        promptId,
        version,
        revertedBy
      );

      if (success) {
        res.json({
          success: true,
          message: `Prompt reverted to version ${version}`,
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to revert prompt',
        });
      }
    } catch (error) {
      console.error('Error reverting prompt to version:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revert prompt to version',
      });
    }
  }