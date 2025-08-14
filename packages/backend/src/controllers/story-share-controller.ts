import { Request, Response } from 'express';
import { StoryShareService } from '../services/story-share-service';
import { NotificationService } from '../services/notification-service';

export class StoryShareController {
  private storyShareService: StoryShareService;
  private notificationService: NotificationService;

  constructor() {
    this.storyShareService = new StoryShareService();
    this.notificationService = new NotificationService();
  }

  async shareStory(req: Request, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;
      const { memberIds, message } = req.body;
      const sharerId = req.user.id;

      // Validate input
      if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Member IDs are required'
          }
        });
        return;
      }

      // Share the story
      const shares = await this.storyShareService.shareStory(
        storyId,
        sharerId,
        memberIds,
        message
      );

      // Send notifications to shared members
      for (const share of shares) {
        await this.notificationService.sendStoryShareNotification(
          share.sharedWithId,
          share.story,
          share.sharedBy,
          message
        );
      }

      res.status(201).json({
        message: 'Story shared successfully',
        shares: shares.length
      });
    } catch (error) {
      console.error('Error sharing story:', error);
      res.status(500).json({
        error: {
          code: 'SHARE_FAILED',
          message: 'Failed to share story'
        }
      });
    }
  }

  async getStoryShares(req: Request, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;
      const shares = await this.storyShareService.getStoryShares(storyId);

      res.json({ shares });
    } catch (error) {
      console.error('Error getting story shares:', error);
      res.status(500).json({
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch story shares'
        }
      });
    }
  }

  async getSharedStories(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      // Ensure user can only access their own shared stories
      if (userId !== req.user.id) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'Cannot access other user\'s shared stories'
          }
        });
        return;
      }

      const result = await this.storyShareService.getSharedStories(
        userId,
        Number(page),
        Number(limit)
      );

      res.json(result);
    } catch (error) {
      console.error('Error getting shared stories:', error);
      res.status(500).json({
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch shared stories'
        }
      });
    }
  }
}