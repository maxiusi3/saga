import { Request, Response } from 'express';
import { StoryRecommendationService } from '../services/story-recommendation-service';
import { AuthenticatedRequest } from '../middleware/auth';

export class StoryRecommendationController {
  private recommendationService: StoryRecommendationService;

  constructor() {
    this.recommendationService = new StoryRecommendationService();
  }

  /**
   * Get story recommendations for user
   * GET /api/recommendations/stories
   */
  async getRecommendations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const {
        projectId,
        limit,
        excludeViewed,
        categories
      } = req.query;

      const request = {
        userId,
        projectId: projectId as string,
        limit: limit ? parseInt(limit as string) : undefined,
        excludeViewed: excludeViewed === 'true',
        categories: categories ? (categories as string).split(',') : undefined
      };

      const recommendations = await this.recommendationService.generateRecommendations(request);

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      console.error('Error getting recommendations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get story recommendations'
      });
    }
  }

  /**
   * Track recommendation interaction
   * POST /api/recommendations/track
   */
  async trackInteraction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { storyId, action } = req.body;

      if (!storyId || !action) {
        res.status(400).json({
          success: false,
          error: 'Story ID and action are required'
        });
        return;
      }

      if (!['click', 'dismiss', 'like', 'dislike'].includes(action)) {
        res.status(400).json({
          success: false,
          error: 'Invalid action. Must be one of: click, dismiss, like, dislike'
        });
        return;
      }

      await this.recommendationService.trackRecommendationInteraction(
        userId,
        storyId,
        action
      );

      res.json({
        success: true,
        message: 'Interaction tracked successfully'
      });
    } catch (error) {
      console.error('Error tracking recommendation interaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track interaction'
      });
    }
  }

  /**
   * Get recommendation statistics
   * GET /api/recommendations/stats
   */
  async getRecommendationStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { projectId } = req.query;

      // This would be implemented to show recommendation effectiveness
      // For now, return basic stats
      const stats = {
        totalRecommendations: 0,
        clickedRecommendations: 0,
        clickThroughRate: 0,
        topCategories: [],
        topFacilitators: []
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting recommendation stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recommendation statistics'
      });
    }
  }
}