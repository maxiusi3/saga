import { Router } from 'express';
import { StoryStatisticsController } from '../controllers/story-statistics-controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const storyStatisticsController = new StoryStatisticsController();

// Get project statistics
router.get('/projects/:projectId/statistics',
  authMiddleware,
  storyStatisticsController.getProjectStatistics.bind(storyStatisticsController)
);

// Get story quality metrics
router.get('/stories/:storyId/quality',
  authMiddleware,
  storyStatisticsController.getStoryQuality.bind(storyStatisticsController)
);

// Get completion tracking
router.get('/projects/:projectId/completion',
  authMiddleware,
  storyStatisticsController.getCompletionTracking.bind(storyStatisticsController)
);

// Batch quality calculation for multiple stories
router.post('/stories/quality/batch',
  authMiddleware,
  storyStatisticsController.getBatchStoryQuality.bind(storyStatisticsController)
);

export default router;