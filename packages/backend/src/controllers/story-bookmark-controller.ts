import { Request, Response } from 'express';
import { StoryBookmarkService } from '../services/story-bookmark-service';
import { AuthenticatedRequest } from '../middleware/auth';

export class StoryBookmarkController {
  private bookmarkService: StoryBookmarkService;

  constructor() {
    this.bookmarkService = new StoryBookmarkService();
  }

  /**
   * Create a new bookmark
   * POST /api/bookmarks
   */
  async createBookmark(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { storyId, collectionId, notes } = req.body;

      if (!storyId) {
        res.status(400).json({
          success: false,
          error: 'Story ID is required'
        });
        return;
      }

      const bookmark = await this.bookmarkService.createBookmark({
        userId,
        storyId,
        collectionId,
        notes
      });

      res.status(201).json({
        success: true,
        data: bookmark
      });
    } catch (error) {
      console.error('Error creating bookmark:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create bookmark'
      });
    }
  }

  /**
   * Remove a bookmark
   * DELETE /api/bookmarks/story/:storyId
   */
  async removeBookmark(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { storyId } = req.params;

      await this.bookmarkService.removeBookmark(userId, storyId);

      res.json({
        success: true,
        message: 'Bookmark removed successfully'
      });
    } catch (error) {
      console.error('Error removing bookmark:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove bookmark'
      });
    }
  }

  /**
   * Get user bookmarks
   * GET /api/bookmarks
   */
  async getUserBookmarks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { collectionId, limit, offset } = req.query;

      const result = await this.bookmarkService.getUserBookmarks(userId, {
        collectionId: collectionId as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error getting user bookmarks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get bookmarks'
      });
    }
  }

  /**
   * Create a new collection
   * POST /api/bookmarks/collections
   */
  async createCollection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { name, description, isPublic, color } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          error: 'Collection name is required'
        });
        return;
      }

      const collection = await this.bookmarkService.createCollection({
        userId,
        name,
        description,
        isPublic,
        color
      });

      res.status(201).json({
        success: true,
        data: collection
      });
    } catch (error) {
      console.error('Error creating collection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create collection'
      });
    }
  }

  /**
   * Update a collection
   * PUT /api/bookmarks/collections/:collectionId
   */
  async updateCollection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { collectionId } = req.params;
      const updates = req.body;

      const collection = await this.bookmarkService.updateCollection(
        userId,
        collectionId,
        updates
      );

      res.json({
        success: true,
        data: collection
      });
    } catch (error) {
      console.error('Error updating collection:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update collection'
      });
    }
  }

  /**
   * Delete a collection
   * DELETE /api/bookmarks/collections/:collectionId
   */
  async deleteCollection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { collectionId } = req.params;

      await this.bookmarkService.deleteCollection(userId, collectionId);

      res.json({
        success: true,
        message: 'Collection deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting collection:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete collection'
      });
    }
  }

  /**
   * Get user collections
   * GET /api/bookmarks/collections
   */
  async getUserCollections(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const collections = await this.bookmarkService.getUserCollections(userId);

      res.json({
        success: true,
        data: collections
      });
    } catch (error) {
      console.error('Error getting user collections:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get collections'
      });
    }
  }

  /**
   * Move bookmark to collection
   * PUT /api/bookmarks/:bookmarkId/collection
   */
  async moveBookmarkToCollection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { bookmarkId } = req.params;
      const { collectionId } = req.body;

      await this.bookmarkService.moveBookmarkToCollection(
        userId,
        bookmarkId,
        collectionId
      );

      res.json({
        success: true,
        message: 'Bookmark moved successfully'
      });
    } catch (error) {
      console.error('Error moving bookmark:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to move bookmark'
      });
    }
  }
}