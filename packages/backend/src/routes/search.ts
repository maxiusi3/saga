import { Router } from 'express'
import { SearchController } from '../controllers/search-controller'
import { authMiddleware } from '../middleware/auth'
import { archivalMiddleware } from '../middleware/archival'

const router = Router()
const searchController = new SearchController()

// Apply authentication middleware to all search routes
router.use(authMiddleware)

/**
 * Search stories within a project
 * GET /api/projects/:projectId/search
 * Query params:
 * - q: search query (required)
 * - page: page number (default: 1)
 * - limit: results per page (default: 20, max: 100)
 * - chapters: filter by chapter IDs (array)
 * - facilitators: filter by facilitator IDs (array)
 * - dateFrom: filter stories from this date
 * - dateTo: filter stories until this date
 * - sortBy: 'relevance' or 'date' (default: 'relevance')
 */
router.get('/projects/:projectId/search', archivalMiddleware, searchController.searchStories)

/**
 * Get search suggestions for autocomplete
 * GET /api/projects/:projectId/search/suggestions
 * Query params:
 * - q: partial search query (required)
 * - limit: number of suggestions (default: 5)
 */
router.get('/projects/:projectId/search/suggestions', archivalMiddleware, searchController.getSearchSuggestions)

/**
 * Get search analytics for a project (facilitators only)
 * GET /api/projects/:projectId/search/analytics
 * Query params:
 * - dateFrom: analytics from this date
 * - dateTo: analytics until this date
 * - limit: number of top queries to return (default: 10)
 */
router.get('/projects/:projectId/search/analytics', archivalMiddleware, searchController.getSearchAnalytics)

/**
 * Reindex stories for better search performance (facilitators only)
 * POST /api/projects/:projectId/search/reindex
 */
router.post('/projects/:projectId/search/reindex', archivalMiddleware, searchController.reindexProject)

export default router