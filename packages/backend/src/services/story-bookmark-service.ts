import { BaseService } from './base-service';
import { knex } from '../config/database';

interface CreateBookmarkRequest {
  userId: string;
  storyId: string;
  collectionId?: string;
  notes?: string;
}

interface CreateCollectionRequest {
  userId: string;
  name: string;
  description?: string;
  isPublic?: boolean;
  color?: string;
}

interface Bookmark {
  id: string;
  userId: string;
  storyId: string;
  collectionId?: string;
  notes?: string;
  createdAt: string;
  story: {
    id: string;
    title: string;
    description?: string;
    duration?: number;
    facilitatorName: string;
    chapterTitle?: string;
  };
}

interface BookmarkCollection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isPublic: boolean;
  color: string;
  createdAt: string;
  bookmarkCount: number;
}

export class StoryBookmarkService extends BaseService {
  async createBookmark(request: CreateBookmarkRequest): Promise<Bookmark> {
    try {
      const { userId, storyId, collectionId, notes } = request;

      // Check if bookmark already exists
      const existingBookmark = await knex('story_bookmarks')
        .where({ user_id: userId, story_id: storyId })
        .first();

      if (existingBookmark) {
        throw new Error('Story is already bookmarked');
      }

      // Verify story exists and user has access
      const story = await this.verifyStoryAccess(userId, storyId);
      if (!story) {
        throw new Error('Story not found or access denied');
      }

      // Verify collection if provided
      if (collectionId) {
        const collection = await knex('bookmark_collections')
          .where({ id: collectionId, user_id: userId })
          .first();
        
        if (!collection) {
          throw new Error('Collection not found or access denied');
        }
      }

      // Create bookmark
      const [bookmarkId] = await knex('story_bookmarks').insert({
        user_id: userId,
        story_id: storyId,
        collection_id: collectionId,
        notes,
        created_at: new Date()
      }).returning('id');

      // Return bookmark with story details
      return await this.getBookmarkById(bookmarkId);
    } catch (error) {
      this.logger.error('Error creating bookmark:', error);
      throw error;
    }
  }

  async removeBookmark(userId: string, storyId: string): Promise<void> {
    try {
      const deleted = await knex('story_bookmarks')
        .where({ user_id: userId, story_id: storyId })
        .del();

      if (deleted === 0) {
        throw new Error('Bookmark not found');
      }
    } catch (error) {
      this.logger.error('Error removing bookmark:', error);
      throw error;
    }
  }

  async getUserBookmarks(
    userId: string,
    options: {
      collectionId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ bookmarks: Bookmark[]; totalCount: number }> {
    try {
      const { collectionId, limit = 50, offset = 0 } = options;

      let query = knex('story_bookmarks as sb')
        .select(
          'sb.id',
          'sb.user_id as userId',
          'sb.story_id as storyId',
          'sb.collection_id as collectionId',
          'sb.notes',
          'sb.created_at as createdAt',
          's.title as story_title',
          's.description as story_description',
          's.duration as story_duration',
          'u.name as facilitator_name',
          'c.title as chapter_title'
        )
        .join('stories as s', 'sb.story_id', 's.id')
        .join('users as u', 's.facilitator_id', 'u.id')
        .leftJoin('chapters as c', 's.chapter_id', 'c.id')
        .where('sb.user_id', userId);

      if (collectionId) {
        query = query.where('sb.collection_id', collectionId);
      }

      // Get total count
      const countQuery = query.clone().count('* as count').first();
      const { count } = await countQuery;

      // Get bookmarks with pagination
      const bookmarks = await query
        .orderBy('sb.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      return {
        bookmarks: bookmarks.map(bookmark => ({
          id: bookmark.id,
          userId: bookmark.userId,
          storyId: bookmark.storyId,
          collectionId: bookmark.collectionId,
          notes: bookmark.notes,
          createdAt: bookmark.createdAt,
          story: {
            id: bookmark.storyId,
            title: bookmark.story_title,
            description: bookmark.story_description,
            duration: bookmark.story_duration,
            facilitatorName: bookmark.facilitator_name,
            chapterTitle: bookmark.chapter_title
          }
        })),
        totalCount: parseInt(count as string)
      };
    } catch (error) {
      this.logger.error('Error getting user bookmarks:', error);
      throw new Error('Failed to get bookmarks');
    }
  }

  async createCollection(request: CreateCollectionRequest): Promise<BookmarkCollection> {
    try {
      const { userId, name, description, isPublic = false, color = '#6B7280' } = request;

      const [collectionId] = await knex('bookmark_collections').insert({
        user_id: userId,
        name,
        description,
        is_public: isPublic,
        color,
        created_at: new Date()
      }).returning('id');

      return await this.getCollectionById(collectionId);
    } catch (error) {
      this.logger.error('Error creating collection:', error);
      throw new Error('Failed to create collection');
    }
  }

  async updateCollection(
    userId: string,
    collectionId: string,
    updates: Partial<CreateCollectionRequest>
  ): Promise<BookmarkCollection> {
    try {
      // Verify ownership
      const collection = await knex('bookmark_collections')
        .where({ id: collectionId, user_id: userId })
        .first();

      if (!collection) {
        throw new Error('Collection not found or access denied');
      }

      await knex('bookmark_collections')
        .where({ id: collectionId, user_id: userId })
        .update({
          ...updates,
          updated_at: new Date()
        });

      return await this.getCollectionById(collectionId);
    } catch (error) {
      this.logger.error('Error updating collection:', error);
      throw error;
    }
  }

  async deleteCollection(userId: string, collectionId: string): Promise<void> {
    try {
      // Move bookmarks to no collection
      await knex('story_bookmarks')
        .where({ collection_id: collectionId, user_id: userId })
        .update({ collection_id: null });

      // Delete collection
      const deleted = await knex('bookmark_collections')
        .where({ id: collectionId, user_id: userId })
        .del();

      if (deleted === 0) {
        throw new Error('Collection not found or access denied');
      }
    } catch (error) {
      this.logger.error('Error deleting collection:', error);
      throw error;
    }
  }

  async getUserCollections(userId: string): Promise<BookmarkCollection[]> {
    try {
      const collections = await knex('bookmark_collections as bc')
        .select(
          'bc.*',
          knex.raw('COUNT(sb.id) as bookmark_count')
        )
        .leftJoin('story_bookmarks as sb', 'bc.id', 'sb.collection_id')
        .where('bc.user_id', userId)
        .groupBy('bc.id')
        .orderBy('bc.created_at', 'desc');

      return collections.map(collection => ({
        id: collection.id,
        userId: collection.user_id,
        name: collection.name,
        description: collection.description,
        isPublic: collection.is_public,
        color: collection.color,
        createdAt: collection.created_at,
        bookmarkCount: parseInt(collection.bookmark_count)
      }));
    } catch (error) {
      this.logger.error('Error getting user collections:', error);
      throw new Error('Failed to get collections');
    }
  }

  async moveBookmarkToCollection(
    userId: string,
    bookmarkId: string,
    collectionId?: string
  ): Promise<void> {
    try {
      // Verify bookmark ownership
      const bookmark = await knex('story_bookmarks')
        .where({ id: bookmarkId, user_id: userId })
        .first();

      if (!bookmark) {
        throw new Error('Bookmark not found or access denied');
      }

      // Verify collection if provided
      if (collectionId) {
        const collection = await knex('bookmark_collections')
          .where({ id: collectionId, user_id: userId })
          .first();
        
        if (!collection) {
          throw new Error('Collection not found or access denied');
        }
      }

      await knex('story_bookmarks')
        .where({ id: bookmarkId, user_id: userId })
        .update({
          collection_id: collectionId,
          updated_at: new Date()
        });
    } catch (error) {
      this.logger.error('Error moving bookmark to collection:', error);
      throw error;
    }
  }

  private async verifyStoryAccess(userId: string, storyId: string): Promise<boolean> {
    const story = await knex('stories as s')
      .select('s.id')
      .join('projects as p', 's.project_id', 'p.id')
      .leftJoin('project_roles as pr', 'p.id', 'pr.project_id')
      .where('s.id', storyId)
      .where(function() {
        this.where('p.creator_id', userId)
          .orWhere('pr.user_id', userId);
      })
      .first();

    return !!story;
  }

  private async getBookmarkById(bookmarkId: string): Promise<Bookmark> {
    const bookmark = await knex('story_bookmarks as sb')
      .select(
        'sb.*',
        's.title as story_title',
        's.description as story_description',
        's.duration as story_duration',
        'u.name as facilitator_name',
        'c.title as chapter_title'
      )
      .join('stories as s', 'sb.story_id', 's.id')
      .join('users as u', 's.facilitator_id', 'u.id')
      .leftJoin('chapters as c', 's.chapter_id', 'c.id')
      .where('sb.id', bookmarkId)
      .first();

    return {
      id: bookmark.id,
      userId: bookmark.user_id,
      storyId: bookmark.story_id,
      collectionId: bookmark.collection_id,
      notes: bookmark.notes,
      createdAt: bookmark.created_at,
      story: {
        id: bookmark.story_id,
        title: bookmark.story_title,
        description: bookmark.story_description,
        duration: bookmark.story_duration,
        facilitatorName: bookmark.facilitator_name,
        chapterTitle: bookmark.chapter_title
      }
    };
  }

  private async getCollectionById(collectionId: string): Promise<BookmarkCollection> {
    const collection = await knex('bookmark_collections as bc')
      .select(
        'bc.*',
        knex.raw('COUNT(sb.id) as bookmark_count')
      )
      .leftJoin('story_bookmarks as sb', 'bc.id', 'sb.collection_id')
      .where('bc.id', collectionId)
      .groupBy('bc.id')
      .first();

    return {
      id: collection.id,
      userId: collection.user_id,
      name: collection.name,
      description: collection.description,
      isPublic: collection.is_public,
      color: collection.color,
      createdAt: collection.created_at,
      bookmarkCount: parseInt(collection.bookmark_count)
    };
  }
}