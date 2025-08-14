import { Request, Response } from 'express';
import { ChapterSummaryService } from '../services/chapter-summary-service';
import { 
  GetChapterSummariesResponse,
  GetChapterSummaryResponse,
  CreateChapterSummaryResponse,
  AnalyzeStoriesForChaptersResponse,
  CreateChapterSummaryInput
} from '@saga/shared';

export class ChapterSummaryController {
  /**
   * Get all chapter summaries for a project
   */
  static async getChapterSummaries(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PROJECT_ID',
            message: 'Project ID is required',
          },
        });
        return;
      }

      const chapters = await ChapterSummaryService.getChapterSummariesByProject(projectId);

      const response: GetChapterSummariesResponse = {
        success: true,
        data: chapters,
      };

      res.json(response);
    } catch (error) {
      console.error('Failed to get chapter summaries:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve chapter summaries',
        },
      });
    }
  }

  /**
   * Get a specific chapter summary with stories
   */
  static async getChapterSummary(req: Request, res: Response): Promise<void> {
    try {
      const { chapterId } = req.params;
      
      if (!chapterId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CHAPTER_ID',
            message: 'Chapter ID is required',
          },
        });
        return;
      }

      const chapter = await ChapterSummaryService.getChapterSummaryWithStories(chapterId);

      if (!chapter) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CHAPTER_NOT_FOUND',
            message: 'Chapter summary not found',
          },
        });
        return;
      }

      const response: GetChapterSummaryResponse = {
        success: true,
        data: chapter,
      };

      res.json(response);
    } catch (error) {
      console.error('Failed to get chapter summary:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve chapter summary',
        },
      });
    }
  }

  /**
   * Create a new chapter summary
   */
  static async createChapterSummary(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { storyIds, theme, title } = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PROJECT_ID',
            message: 'Project ID is required',
          },
        });
        return;
      }

      if (!storyIds || !Array.isArray(storyIds) || storyIds.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STORY_IDS',
            message: 'Story IDs must be a non-empty array',
          },
        });
        return;
      }

      const input: CreateChapterSummaryInput = {
        projectId,
        storyIds,
        theme,
        title,
      };

      const chapter = await ChapterSummaryService.createChapterSummary(input);

      const response: CreateChapterSummaryResponse = {
        success: true,
        data: chapter,
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Failed to create chapter summary:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create chapter summary',
        },
      });
    }
  }

  /**
   * Auto-generate chapter summaries for a project
   */
  static async autoGenerateChapters(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PROJECT_ID',
            message: 'Project ID is required',
          },
        });
        return;
      }

      const chapters = await ChapterSummaryService.autoGenerateChapters(projectId);

      const response: GetChapterSummariesResponse = {
        success: true,
        data: chapters,
      };

      res.json(response);
    } catch (error) {
      console.error('Failed to auto-generate chapters:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to auto-generate chapters',
        },
      });
    }
  }

  /**
   * Analyze stories for potential chapter groupings
   */
  static async analyzeStoriesForChapters(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PROJECT_ID',
            message: 'Project ID is required',
          },
        });
        return;
      }

      const analysis = await ChapterSummaryService.analyzeStoriesForChapters(projectId);

      const response: AnalyzeStoriesForChaptersResponse = {
        success: true,
        data: analysis,
      };

      res.json(response);
    } catch (error) {
      console.error('Failed to analyze stories for chapters:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to analyze stories',
        },
      });
    }
  }

  /**
   * Update a chapter summary
   */
  static async updateChapterSummary(req: Request, res: Response): Promise<void> {
    try {
      const { chapterId } = req.params;
      const { title, description, keyHighlights } = req.body;

      if (!chapterId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CHAPTER_ID',
            message: 'Chapter ID is required',
          },
        });
        return;
      }

      const updates = {
        ...(title && { title }),
        ...(description && { description }),
        ...(keyHighlights && { keyHighlights }),
      };

      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_UPDATES',
            message: 'No valid updates provided',
          },
        });
        return;
      }

      const chapter = await ChapterSummaryService.updateChapterSummary(chapterId, updates);

      if (!chapter) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CHAPTER_NOT_FOUND',
            message: 'Chapter summary not found',
          },
        });
        return;
      }

      const response: GetChapterSummaryResponse = {
        success: true,
        data: chapter,
      };

      res.json(response);
    } catch (error) {
      console.error('Failed to update chapter summary:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update chapter summary',
        },
      });
    }
  }

  /**
   * Delete a chapter summary
   */
  static async deleteChapterSummary(req: Request, res: Response): Promise<void> {
    try {
      const { chapterId } = req.params;

      if (!chapterId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CHAPTER_ID',
            message: 'Chapter ID is required',
          },
        });
        return;
      }

      const deleted = await ChapterSummaryService.deleteChapterSummary(chapterId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CHAPTER_NOT_FOUND',
            message: 'Chapter summary not found',
          },
        });
        return;
      }

      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete chapter summary:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete chapter summary',
        },
      });
    }
  }
}