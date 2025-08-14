import { BaseService } from './base-service';
import { knex } from '../config/database';

interface RecommendationRequest {
  userId: string;
  projectId?: string;
  limit?: number;
  excludeViewed?: boolean;
  categories?: string[];
}

interface RecommendedStory {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  duration?: number;
  facilitatorName: string;
  facilitatorId: string;
  categories: string[];
  tags: string[];
  thumbnailUrl?: string;
  chapterTitle?: string;
  score: number;
  reasoning: string[];
}

interface RecommendationResponse {
  recommendations: RecommendedStory[];
  algorithm: string;
  generatedAt: string;
}

export class StoryRecommendationService extends BaseService {
  async generateRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
    try {
      const {
        userId,
        projectId,
        limit = 10,
        excludeViewed = true,
        categories = []
      } = request;

      // Get user's accessible projects
      const accessibleProjects = await this.getUserAccessibleProjects(userId);
      const targetProjects = projectId ? [projectId] : accessibleProjects;

      // Get user's listening history for personalization
      const userHistory = await this.getUserListeningHistory(userId, targetProjects);
      
      // Get all available stories
      const availableStories = await this.getAvailableStories(
        targetProjects,
        excludeViewed ? userHistory.viewedStoryIds : [],
        categories
      );

      // Generate recommendations using hybrid approach
      const recommendations = await this.generateHybridRecommendations(
        userId,
        availableStories,
        userHistory,
        limit
      );

      return {
        recommendations,
        algorithm: 'hybrid',
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error generating recommendations:', error);
      throw new Error('Failed to generate story recommendations');
    }
  }

  private async getUserAccessibleProjects(userId: string): Promise<string[]> {
    const projects = await knex('projects as p')
      .select('p.id')
      .leftJoin('project_roles as pr', 'p.id', 'pr.project_id')
      .where(function() {
        this.where('p.creator_id', userId)
          .orWhere('pr.user_id', userId);
      });

    return projects.map(p => p.id);
  }

  private async getUserListeningHistory(userId: string, projectIds: string[]) {
    // Get viewed stories
    const viewedStories = await knex('listening_sessions')
      .select('story_id')
      .where('user_id', userId)
      .whereIn('story_id', function() {
        this.select('id')
          .from('stories')
          .whereIn('project_id', projectIds);
      })
      .distinct();

    // Get user's category preferences based on listening history
    const categoryPreferences = await knex('stories as s')
      .select('sc.name as category', knex.raw('COUNT(*) as count'))
      .join('story_category_assignments as sca', 's.id', 'sca.story_id')
      .join('story_categories as sc', 'sca.category_id', 'sc.id')
      .join('listening_sessions as ls', 's.id', 'ls.story_id')
      .where('ls.user_id', userId)
      .whereIn('s.project_id', projectIds)
      .groupBy('sc.name')
      .orderBy('count', 'desc');

    // Get user's facilitator preferences
    const facilitatorPreferences = await knex('stories as s')
      .select('s.facilitator_id', 'u.name as facilitator_name', knex.raw('COUNT(*) as count'))
      .join('users as u', 's.facilitator_id', 'u.id')
      .join('listening_sessions as ls', 's.id', 'ls.story_id')
      .where('ls.user_id', userId)
      .whereIn('s.project_id', projectIds)
      .groupBy('s.facilitator_id', 'u.name')
      .orderBy('count', 'desc');

    return {
      viewedStoryIds: viewedStories.map(s => s.story_id),
      categoryPreferences: categoryPreferences.map(c => ({
        name: c.category,
        score: c.count
      })),
      facilitatorPreferences: facilitatorPreferences.map(f => ({
        id: f.facilitator_id,
        name: f.facilitator_name,
        score: f.count
      }))
    };
  }

  private async getAvailableStories(
    projectIds: string[],
    excludeStoryIds: string[] = [],
    categories: string[] = []
  ) {
    let query = knex('stories as s')
      .select(
        's.id',
        's.title',
        's.description',
        's.created_at as createdAt',
        's.duration',
        's.thumbnail_url as thumbnailUrl',
        'u.name as facilitatorName',
        'u.id as facilitatorId',
        'c.title as chapterTitle'
      )
      .leftJoin('users as u', 's.facilitator_id', 'u.id')
      .leftJoin('chapters as c', 's.chapter_id', 'c.id')
      .whereIn('s.project_id', projectIds)
      .where('s.status', 'completed');

    if (excludeStoryIds.length > 0) {
      query = query.whereNotIn('s.id', excludeStoryIds);
    }

    if (categories.length > 0) {
      query = query.whereExists(function() {
        this.select('*')
          .from('story_category_assignments as sca')
          .join('story_categories as sc', 'sca.category_id', 'sc.id')
          .whereRaw('sca.story_id = s.id')
          .whereIn('sc.name', categories);
      });
    }

    const stories = await query.orderBy('s.created_at', 'desc');

    // Enrich with categories and tags
    return await this.enrichStoriesWithMetadata(stories);
  }

  private async enrichStoriesWithMetadata(stories: any[]) {
    if (stories.length === 0) return stories;

    const storyIds = stories.map(s => s.id);

    // Get categories
    const categoryData = await knex('story_category_assignments as sca')
      .select('sca.story_id', 'sc.name as category_name')
      .join('story_categories as sc', 'sca.category_id', 'sc.id')
      .whereIn('sca.story_id', storyIds);

    // Get tags
    const tagData = await knex('story_tag_assignments as sta')
      .select('sta.story_id', 'st.name as tag_name')
      .join('story_tags as st', 'sta.tag_id', 'st.id')
      .whereIn('sta.story_id', storyIds);

    // Group by story ID
    const categoriesByStory = this.groupBy(categoryData, 'story_id');
    const tagsByStory = this.groupBy(tagData, 'story_id');

    return stories.map(story => ({
      ...story,
      categories: (categoriesByStory[story.id] || []).map((c: any) => c.category_name),
      tags: (tagsByStory[story.id] || []).map((t: any) => t.tag_name)
    }));
  }

  private async generateHybridRecommendations(
    userId: string,
    availableStories: any[],
    userHistory: any,
    limit: number
  ): Promise<RecommendedStory[]> {
    const scoredStories = availableStories.map(story => {
      const scores = {
        category: this.calculateCategoryScore(story, userHistory.categoryPreferences),
        facilitator: this.calculateFacilitatorScore(story, userHistory.facilitatorPreferences),
        recency: this.calculateRecencyScore(story),
        chapter: this.calculateChapterScore(story),
        popularity: 0 // Will be calculated separately
      };

      const reasoning = [];
      
      if (scores.category > 0.5) {
        reasoning.push('Matches your preferred categories');
      }
      if (scores.facilitator > 0.5) {
        reasoning.push('From a facilitator you often listen to');
      }
      if (scores.recency > 0.7) {
        reasoning.push('Recently added story');
      }
      if (scores.chapter > 0.5) {
        reasoning.push('Part of an interesting chapter');
      }

      // Weighted combination
      const totalScore = (
        scores.category * 0.3 +
        scores.facilitator * 0.25 +
        scores.recency * 0.2 +
        scores.chapter * 0.15 +
        scores.popularity * 0.1
      );

      return {
        ...story,
        score: Math.round(totalScore * 100) / 100,
        reasoning: reasoning.length > 0 ? reasoning : ['Recommended for you']
      };
    });

    // Sort by score and return top recommendations
    return scoredStories
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private calculateCategoryScore(story: any, categoryPreferences: any[]): number {
    if (!story.categories || story.categories.length === 0) return 0;
    if (!categoryPreferences || categoryPreferences.length === 0) return 0.5;

    const maxPreferenceScore = Math.max(...categoryPreferences.map(c => c.score));
    let totalScore = 0;
    let matchCount = 0;

    story.categories.forEach((category: string) => {
      const preference = categoryPreferences.find(p => p.name === category);
      if (preference) {
        totalScore += preference.score / maxPreferenceScore;
        matchCount++;
      }
    });

    return matchCount > 0 ? totalScore / matchCount : 0.3;
  }

  private calculateFacilitatorScore(story: any, facilitatorPreferences: any[]): number {
    if (!facilitatorPreferences || facilitatorPreferences.length === 0) return 0.5;

    const preference = facilitatorPreferences.find(p => p.id === story.facilitatorId);
    if (!preference) return 0.3;

    const maxPreferenceScore = Math.max(...facilitatorPreferences.map(f => f.score));
    return preference.score / maxPreferenceScore;
  }

  private calculateRecencyScore(story: any): number {
    const storyDate = new Date(story.createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - storyDate.getTime()) / (1000 * 60 * 60 * 24);

    // Stories get higher scores if they're more recent
    if (daysDiff <= 7) return 1.0;
    if (daysDiff <= 30) return 0.8;
    if (daysDiff <= 90) return 0.6;
    if (daysDiff <= 180) return 0.4;
    return 0.2;
  }

  private calculateChapterScore(story: any): number {
    // Stories with chapter information get a slight boost
    return story.chapterTitle ? 0.7 : 0.5;
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  async trackRecommendationInteraction(
    userId: string,
    storyId: string,
    action: 'click' | 'dismiss' | 'like' | 'dislike'
  ): Promise<void> {
    try {
      // Update recommendation record
      await knex('story_recommendations')
        .where({ user_id: userId, story_id: storyId })
        .update({
          clicked: action === 'click',
          dismissed: action === 'dismiss',
          updated_at: new Date()
        });

      // Log interaction for analytics
      await knex('recommendation_analytics').insert({
        user_id: userId,
        story_id: storyId,
        action,
        created_at: new Date()
      });
    } catch (error) {
      this.logger.error('Error tracking recommendation interaction:', error);
      // Don't throw - analytics shouldn't break the main flow
    }
  }
}