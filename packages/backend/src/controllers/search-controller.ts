import { Request, Response } from 'express'
import { SearchService } from '../services/search-service'
import { ProjectModel } from '../models/project'

export class SearchController {
  private searchService: SearchService

  constructor() {
    this.searchService = new SearchService()
  }

  /**
   * Search stories within a project
   * GET /api/projects/:projectId/search
   */
  searchStories = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params
      const {
        q: query,
        page = '1',
        limit = '20',
        chapters,
        facilitators,
        dateFrom,
        dateTo,
        sortBy = 'relevance'
      } = req.query

      // Validate project access
      const project = await ProjectModel.findById(projectId)
      if (!project) {
        res.status(404).json({
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found'
          }
        })
        return
      }

      // Check if user has access to this project
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

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          error: {
            code: 'MISSING_QUERY',
            message: 'Search query is required'
          }
        })
        return
      }

      // Parse filters
      const chapterIds = chapters ? (Array.isArray(chapters) ? chapters : [chapters]) as string[] : undefined
      const facilitatorIds = facilitators ? (Array.isArray(facilitators) ? facilitators : [facilitators]) as string[] : undefined

      const searchOptions = {
        page: parseInt(page as string),
        limit: Math.min(parseInt(limit as string), 100), // Cap at 100 results per page
        chapterIds,
        facilitatorIds,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        sortBy: sortBy as 'relevance' | 'date'
      }

      const results = await this.searchService.searchStories(projectId, query, searchOptions)

      // Track search analytics
      await this.searchService.trackSearchAnalytics({
        query,
        projectId,
        userId: req.user.id,
        resultCount: results.total,
        searchTime: results.searchTime
      })

      res.json({
        success: true,
        data: results
      })
    } catch (error) {
      console.error('Search error:', error)
      res.status(500).json({
        error: {
          code: 'SEARCH_ERROR',
          message: 'An error occurred while searching stories'
        }
      })
    }
  }

  /**
   * Get search suggestions
   * GET /api/projects/:projectId/search/suggestions
   */
  getSearchSuggestions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params
      const { q: query, limit = '5' } = req.query

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

      if (!query || typeof query !== 'string') {
        res.json({
          success: true,
          data: { suggestions: [] }
        })
        return
      }

      const suggestions = await this.searchService.getSearchSuggestions(
        projectId,
        query,
        parseInt(limit as string)
      )

      res.json({
        success: true,
        data: { suggestions }
      })
    } catch (error) {
      console.error('Search suggestions error:', error)
      res.status(500).json({
        error: {
          code: 'SUGGESTIONS_ERROR',
          message: 'An error occurred while getting search suggestions'
        }
      })
    }
  }

  /**
   * Get search analytics for a project
   * GET /api/projects/:projectId/search/analytics
   */
  getSearchAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params
      const { dateFrom, dateTo, limit = '10' } = req.query

      // Validate project access (only facilitators can view analytics)
      const project = await ProjectModel.findById(projectId)
      if (!project) {
        res.status(404).json({
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found'
          }
        })
        return
      }

      const userRole = await ProjectModel.getUserRole(projectId, req.user.id)
      if (userRole !== 'facilitator') {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'Only facilitators can view search analytics'
          }
        })
        return
      }

      const analytics = await this.searchService.getSearchAnalytics(projectId, {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        limit: parseInt(limit as string)
      })

      res.json({
        success: true,
        data: analytics
      })
    } catch (error) {
      console.error('Search analytics error:', error)
      res.status(500).json({
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'An error occurred while retrieving search analytics'
        }
      })
    }
  }

  /**
   * Reindex stories for better search performance
   * POST /api/projects/:projectId/search/reindex
   */
  reindexProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params

      // Validate project access (only facilitators can reindex)
      const project = await ProjectModel.findById(projectId)
      if (!project) {
        res.status(404).json({
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found'
          }
        })
        return
      }

      const userRole = await ProjectModel.getUserRole(projectId, req.user.id)
      if (userRole !== 'facilitator') {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'Only facilitators can reindex stories'
          }
        })
        return
      }

      const reindexedCount = await this.searchService.reindexProject(projectId)

      res.json({
        success: true,
        data: {
          message: `Successfully reindexed ${reindexedCount} stories`,
          reindexedCount
        }
      })
    } catch (error) {
      console.error('Reindex error:', error)
      res.status(500).json({
        error: {
          code: 'REINDEX_ERROR',
          message: 'An error occurred while reindexing stories'
        }
      })
    }
  }
}