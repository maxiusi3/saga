import { BaseService } from './base-service';
import { Story, User } from '@saga/shared';

interface StoryShare {
  id: string;
  storyId: string;
  sharedById: string;
  sharedWithId: string;
  message?: string;
  createdAt: Date;
  story?: Story;
  sharedBy?: User;
  sharedWith?: User;
}

export class StoryShareService extends BaseService {
  async shareStory(
    storyId: string,
    sharerId: string,
    memberIds: string[],
    message?: string
  ): Promise<StoryShare[]> {
    const trx = await this.db.transaction();

    try {
      // Verify story exists and user has access
      const story = await trx('stories')
        .join('projects', 'stories.project_id', 'projects.id')
        .join('project_roles', 'projects.id', 'project_roles.project_id')
        .where('stories.id', storyId)
        .where('project_roles.user_id', sharerId)
        .first();

      if (!story) {
        throw new Error('Story not found or access denied');
      }

      // Verify all members are part of the same project
      const projectMembers = await trx('project_roles')
        .where('project_id', story.project_id)
        .whereIn('user_id', memberIds)
        .select('user_id');

      const validMemberIds = projectMembers.map(m => m.user_id);
      const invalidMembers = memberIds.filter(id => !validMemberIds.includes(id));

      if (invalidMembers.length > 0) {
        throw new Error('Some members are not part of this project');
      }

      // Create share records
      const shareData = validMemberIds.map(memberId => ({
        id: this.generateId(),
        story_id: storyId,
        shared_by_id: sharerId,
        shared_with_id: memberId,
        message: message || null,
        created_at: new Date()
      }));

      await trx('story_shares').insert(shareData);

      // Get complete share data with relationships
      const shares = await trx('story_shares')
        .join('stories', 'story_shares.story_id', 'stories.id')
        .join('users as sharer', 'story_shares.shared_by_id', 'sharer.id')
        .join('users as recipient', 'story_shares.shared_with_id', 'recipient.id')
        .whereIn('story_shares.id', shareData.map(s => s.id))
        .select(
          'story_shares.*',
          'stories.title as story_title',
          'stories.audio_url as story_audio_url',
          'sharer.name as sharer_name',
          'recipient.name as recipient_name'
        );

      await trx.commit();

      return shares.map(share => ({
        id: share.id,
        storyId: share.story_id,
        sharedById: share.shared_by_id,
        sharedWithId: share.shared_with_id,
        message: share.message,
        createdAt: share.created_at,
        story: {
          id: storyId,
          title: share.story_title,
          audioUrl: share.story_audio_url
        } as Story,
        sharedBy: {
          id: share.shared_by_id,
          name: share.sharer_name
        } as User
      }));
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async getStoryShares(storyId: string): Promise<StoryShare[]> {
    const shares = await this.db('story_shares')
      .join('users as sharer', 'story_shares.shared_by_id', 'sharer.id')
      .join('users as recipient', 'story_shares.shared_with_id', 'recipient.id')
      .where('story_shares.story_id', storyId)
      .select(
        'story_shares.*',
        'sharer.name as sharer_name',
        'recipient.name as recipient_name'
      )
      .orderBy('story_shares.created_at', 'desc');

    return shares.map(share => ({
      id: share.id,
      storyId: share.story_id,
      sharedById: share.shared_by_id,
      sharedWithId: share.shared_with_id,
      message: share.message,
      createdAt: share.created_at,
      sharedBy: {
        id: share.shared_by_id,
        name: share.sharer_name
      } as User,
      sharedWith: {
        id: share.shared_with_id,
        name: share.recipient_name
      } as User
    }));
  }

  async getSharedStories(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ stories: StoryShare[]; total: number; hasMore: boolean }> {
    const offset = (page - 1) * limit;

    // Get shared stories with full story details
    const stories = await this.db('story_shares')
      .join('stories', 'story_shares.story_id', 'stories.id')
      .join('users as sharer', 'story_shares.shared_by_id', 'sharer.id')
      .join('users as storyteller', 'stories.storyteller_id', 'storyteller.id')
      .where('story_shares.shared_with_id', userId)
      .select(
        'story_shares.*',
        'stories.title as story_title',
        'stories.audio_url as story_audio_url',
        'stories.transcript',
        'stories.photo_url as story_photo_url',
        'stories.created_at as story_created_at',
        'sharer.name as sharer_name',
        'storyteller.name as storyteller_name'
      )
      .orderBy('story_shares.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await this.db('story_shares')
      .where('shared_with_id', userId)
      .count('* as count');

    const total = Number(count);
    const hasMore = offset + stories.length < total;

    return {
      stories: stories.map(share => ({
        id: share.id,
        storyId: share.story_id,
        sharedById: share.shared_by_id,
        sharedWithId: share.shared_with_id,
        message: share.message,
        createdAt: share.created_at,
        story: {
          id: share.story_id,
          title: share.story_title,
          audioUrl: share.story_audio_url,
          transcript: share.transcript,
          photoUrl: share.story_photo_url,
          createdAt: share.story_created_at,
          storyteller: {
            name: share.storyteller_name
          }
        } as Story,
        sharedBy: {
          id: share.shared_by_id,
          name: share.sharer_name
        } as User
      })),
      total,
      hasMore
    };
  }

  private generateId(): string {
    return require('crypto').randomUUID();
  }
}