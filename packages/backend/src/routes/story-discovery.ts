import { Router } from 'express'
import { StoryDiscoveryController } from '../controllers/story-discovery-controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()
const storyDiscoveryController = new StoryDiscoveryController()

// Apply authentication middleware to all routes
router.use(authMiddleware)

// Project-level discovery routes
router.get('/projects/:projectId/recommendations', storyDiscoveryController.getRecommendations)
router.get('/projects/:projectId/timeline', storyDiscoveryController.getTimeline)
router.get('/projects/:projectId/insights', storyDiscoveryController.getInsights)

// Story-level discovery routes
router.get('/stories/:storyId/related', storyDiscoveryController.getRelatedStories)
router.get('/stories/:storyId/quality', storyDiscoveryController.getQualityMetrics)

// Favorites routes
router.post('/stories/:storyId/favorite', storyDiscoveryController.addToFavorites)
router.delete('/stories/:storyId/favorite', storyDiscoveryController.removeFromFavorites)
router.get('/users/favorites', storyDiscoveryController.getFavorites)

export default router