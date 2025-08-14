import { Request, Response } from 'express'
import { StoryDiscoveryService } from '../services/story-discovery-service'
import { ProjectModel } from '../models/project'

export class StoryDiscoveryController {
  private storyDiscoveryService: StoryDiscoveryService

  constructor() {
    this.storyDiscoveryService = new StoryDiscoveryService()
  }

  /**
   * Get story recommendations for a project
   * GET /api/projects/:projectId/recommendations
   */
  getRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params
      const { limit = '10' } = req.query

      // Validate project access
      const hasAccess = await ProjectModel.hasUserAccess(projectId, req.user.id)
      if (!hasAccess) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to this project'
          }
        })
        return
      }

      const recommendations = await this.storyDiscoveryService.getStoryRecommendations(
        projectId,
        req.user.id,
        parseInt(limit as string)
      )

      res.json({
        success: true,
        data: { recommendations }
      })
    } catch (error) {
      console.error('Get recommendations error:', error)
      res.status(500).json({
        error: {
          code: 'RECOMMENDATIONS_ERROR',
          message: 'An error occurred while getting story recommendations'
        }
      })
    }
  }

  /**
   * Get related stories for a specific story
   * GET /api/stories/:storyId/related
   */
  getRelatedStories = async (req: Request, res: Response): Promise<void> => {
    try {
      const { storyId } = req.params
      const { limit = '5' } = req.query

      // TODO: Add story access validation
      const relatedStories = await this.storyDiscoveryService.getRelatedStories(
        storyId,
        parseInt(limit as string)
      )

      res.json({
        success: true,
        data: { relatedStories }
      })
    } catch (error) {
      console.error('Get related stories error:', error)
      res.status(500).json({
        error: {
          code: 'RELATED_STORIES_ERROR',
          message: 'An error occurred while getting related stories'
        }
      })
    }
  }

  /**
   * Get story timeline for a project
   * GET /api/projects/:projectId/timeline
   */
  getTimeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params
      const { chapterId, storytellerId, dateFrom, dateTo } = req.query

      // Validate project access
      const hasAccess = await ProjectModel.hasUserAccess(projectId, req.user.id)
      if (!hasAccess) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to this project'
          }
        })
        return
      }

      const timeline = await this.storyDiscoveryService.getStoryTimeline(projectId, {
        chapterId: chapterId as string,
        storytellerId: storytellerId as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined
      })

      res.json({
        success: true,
        data: timeline
      })
    } catch (error) {
      console.error('Get timeline error:', error)
      res.status(500).json({
        error: {
          code: 'TIMELINE_ERROR',
          message: 'An error occurred while getting story timeline'
        }
      })
    }
  }

  /**
   * Get story insights for a project
   * GET /api/projects/:projectId/insights
   */
  getInsights = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params

      // Validate project access (only facilitators can view insights)
      const userRole = await ProjectModel.getUserRole(projectId, req.user.id)
      if (userRole !== 'facilitator') {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'Only facilitators can view project insights'
          }
        })
        return
      }

      const insights = await this.storyDiscoveryService.getStoryInsights(projectId)

      res.json({
        success: true,
        data: insights
      })
    } catch (error) {
      console.error('Get insights error:', error)
      res.status(500).json({
        error: {
          code: 'INSIGHTS_ERROR',
          message: 'An error occurred while getting story insights'
        }
      })
    }
  }

  /**
   * Get story quality metrics
   * GET /api/stories/:storyId/quality
   */
  getQualityMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { storyId } = req.params

      // TODO: Add story access validation
      const qualityMetrics = await this.storyDiscoveryService.getStoryQualityMetrics(storyId)

      res.json({
        success: true,
        data: qualityMetrics
      })
    } catch (error) {
      console.error('Get quality metrics error:', error)
      res.status(500).json({
        error: {
          code: 'QUALITY_METRICS_ERROR',
          message: 'An error occurred while getting story quality metrics'
        }
      })
    }
  }

  /**
   * Add story to favorites
   * POST /api/stories/:storyId/favorite
   */
  addToFavorites = async (req: Request, res: Response): Promise<void> => {
    try {
      const { storyId } = req.params

      // TODO: Add story access validation
      await this.storyDiscoveryService.addToFavorites(req.user.id, storyId)

      res.json({
        success: true,
        data: { message: 'Story added to favorites' }
      })
    } catch (error) {
      console.error('Add to favorites error:', error)
      res.status(500).json({
        error: {
          code: 'FAVORITES_ERROR',
          message: 'An error occurred while adding story to favorites'
        }
      })
    }
  }

  /**
   * Remove story from favorites
   * DELETE /api/stories/:storyId/favorite
   */
  removeFromFavorites = async (req: Request, res: Response): Promise<void> => {
    try {
      const { storyId } = req.params

      await this.storyDiscoveryService.removeFromFavorites(req.user.id, storyId)

      res.json({
        success: true,
        data: { message: 'Story removed from favorites' }
      })
    } catch (error) {
      console.error('Remove from favorites error:', error)
      res.status(500).json({
        error: {
          code: 'FAVORITES_ERROR',
          message: 'An error occurred while removing story from favorites'
        }
      })
    }
  }

  /**
   * Get user's favorite stories
   * GET /api/users/favorites
   */
  getFavorites = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.query

      const favorites = await this.storyDiscoveryService.getFavoriteStories(
        req.user.id,
        projectId as string
      )

      res.json({
        success: true,
        data: { favorites }
      })
    } catch (error) {
      console.error('Get favorites error:', error)
      res.status(500).json({
        error: {
          code: 'FAVORITES_ERROR',
          message: 'An error occurred while getting favorite stories'
        }
      })
    }
  }
}