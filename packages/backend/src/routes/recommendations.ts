import { Router } from 'express';
import { StoryRecommendationController } from '../controllers/story-recommendation-controller';
import { authenticateToken } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rate-limiting';

const router = Router();
const recommendationController = new StoryRecommendationController();

// Apply authentication to all recommendation routes
router.use(authenticateToken);

// Apply rate limiting
router.use(generalRateLimit);

/**
 * @route GET /api/recommendations/stories
 * @desc Get story recommendations for the authenticated user
 * @access Private
 * @query {
 *   projectId?: string,
 *   limit?: number,
 *   excludeViewed?: boolean,
 *   categories?: string (comma-separated)
 * }
 */
router.get('/stories', recommendationController.getRecommendations.bind(recommendationController));

/**
 * @route POST /api/recommendations/track
 * @desc Track user interaction with recommendations
 * @access Private
 * @body {
 *   storyId: string,
 *   action: 'click' | 'dismiss' | 'like' | 'dislike'
 * }
 */
router.post('/track', recommendationController.trackInteraction.bind(recommendationController));

/**
 * @route GET /api/recommendations/stats
 * @desc Get recommendation statistics for the user
 * @access Private
 * @query {
 *   projectId?: string
 * }
 */
router.get('/stats', recommendationController.getRecommendationStats.bind(recommendationController));

export default router;