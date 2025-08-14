import { Router } from 'express';
import { StoryShareController } from '../controllers/story-share-controller';
import { authMiddleware } from '../middleware/auth';
import { archivalMiddleware } from '../middleware/archival';

const router = Router();
const storyShareController = new StoryShareController();

// Share story with project members
router.post('/stories/:storyId/share', 
  authMiddleware, 
  archivalMiddleware,
  storyShareController.shareStory.bind(storyShareController)
);

// Get story shares for a story
router.get('/stories/:storyId/shares',
  authMiddleware,
  storyShareController.getStoryShares.bind(storyShareController)
);

// Get shared stories for a user
router.get('/users/:userId/shared-stories',
  authMiddleware,
  storyShareController.getSharedStories.bind(storyShareController)
);

export default router;