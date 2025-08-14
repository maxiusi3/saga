import { Request, Response } from 'express';
import { StoryStatisticsService } from '../services/story-statistics-service';

export class StoryStatisticsController {
  private storyStatisticsService: StoryStatisticsService;

  constructor() {
    this.storyStatisticsService = new StoryStatisticsService();
  }

  async getProjectStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;

      // Verify user has access to project
      const hasAccess = await this.verifyProjectAccess(projectId, req.user.id);
      if (!hasAccess) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to this project'
          }
        });
        return;
      }

      const statistics = await this.storyStatisticsService.getProjectStatistics(projectId);
      res.json({ statistics });
    } catch (error) {
      console.error('Error getting project statistics:', error);
      res.status(500).json({
        error: {
          code: 'STATISTICS_FAILED',
          message: 'Failed to get project statistics'
        }
      });
    }
  }

  async getStoryQuality(req: Request, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;

      // Verify user has access to story
      const hasAccess = await this.verifyStoryAccess(storyId, req.user.id);
      if (!hasAccess) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to this story'
          }
        });
        return;
      }

      const quality = await this.storyStatisticsService.calculateStoryQuality(storyId);
      res.json({ quality });
    } catch (error) {
      console.error('Error getting story quality:', error);
      res.status(500).json({
        error: {
          code: 'QUALITY_CALCULATION_FAILED',
          message: 'Failed to calculate story quality'
        }
      });
    }
  }

  async getCompletionTracking(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;

      // Verify user has access to project
      const hasAccess = await this.verifyProjectAccess(projectId, req.user.id);
      if (!hasAccess) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to this project'
          }
        });
        return;
      }

      const completion = await this.storyStatisticsService.getStoryCompletionTracking(projectId);
      res.json({ completion });
    } catch (error) {
      console.error('Error getting completion tracking:', error);
      res.status(500).json({
        error: {
          code: 'COMPLETION_TRACKING_FAILED',
          message: 'Failed to get completion tracking'
        }
      });
    }
  }

  async getBatchStoryQuality(req: Request, res: Response): Promise<void> {
    try {
      const { storyIds } = req.body;

      if (!storyIds || !Array.isArray(storyIds)) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Story IDs array is required'
          }
        });
        return;
      }

      // Verify user has access to all stories
      for (const storyId of storyIds) {
        const hasAccess = await this.verifyStoryAccess(storyId, req.user.id);
        if (!hasAccess) {
          res.status(403).json({
            error: {
              code: 'ACCESS_DENIED',
              message: `You do not have access to story ${storyId}`
            }
          });
          return;
        }
      }

      // Calculate quality for all stories
      const qualityMetrics = await Promise.all(
        storyIds.map(storyId => 
          this.storyStatisticsService.calculateStoryQuality(storyId)
        )
      );

      res.json({ qualityMetrics });
    } catch (error) {
      console.error('Error getting batch story quality:', error);
      res.status(500).json({
        error: {
          code: 'BATCH_QUALITY_FAILED',
          message: 'Failed to calculate batch story quality'
        }
      });
    }
  }

  private async verifyProjectAccess(projectId: string, userId: string): Promise<boolean> {
    const knex = this.storyStatisticsService.getKnex();
    
    const access = await knex('project_roles')
      .where('project_id', projectId)
      .where('user_id', userId)
      .first();

    return !!access;
  }

  private async verifyStoryAccess(storyId: string, userId: string): Promise<boolean> {
    const knex = this.storyStatisticsService.getKnex();
    
    const access = await knex('stories')
      .join('project_roles', 'stories.project_id', 'project_roles.project_id')
      .where('stories.id', storyId)
      .where('project_roles.user_id', userId)
      .first();

    return !!access;
  }
}