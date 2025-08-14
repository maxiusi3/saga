import { BaseService } from './base-service'
import { Story, Chapter } from '@saga/shared'

export interface StoryRecommendation {
  story: Story
  score: number
  reason: string
  type: 'chapter_related' | 'similar_content' | 'recent' | 'popular'
}

export interface StoryInsights {
  totalStories: number
  averageDuration: number
  totalDuration: number
  chaptersCompleted: number
  mostActiveChapter: string
  engagementScore: number
  completionRate: number
}

export interface StoryQualityMetrics {
  storyId: string
  lengthScore: number
  engagementScore: number
  interactionCount: number
  overallQuality: number
}

export class StoryDiscoveryService extends BaseService {
  /**
   * Get story recommendations based on chapters and user behavior
   */
  async getStoryRecommendations(
    projectId: string,
    userId: string,
    limit = 10
  ): Promise<StoryRecommendation[]> {
    const recommendations: StoryRecommendation[] = []

    // Get user's recent stories to understand preferences
    const recentStories = await this.db('stories')
      .where('project_id', projectId)
      .where('status', 'ready')
      .orderBy('created_at', 'desc')
      .limit(5)

    if (recentStories.length === 0) {
      // For new users, recommend popular stories
      return this.getPopularStories(projectId, limit)
    }

    // Get chapter-based recommendations
    const chapterRecommendations = await this.getChapterBasedRecommendations(
      projectId,
      recentStories,
      Math.ceil(limit * 0.6)
    )
    recommendations.push(...chapterRecommendations)

    // Get content similarity recommendations
    const similarRecommendations = await this.getSimilarContentRecommendations(
      projectId,
      recentStories,
      Math.ceil(limit * 0.3)
    )
    recommendations.push(...similarRecommendations)

    // Fill remaining slots with recent popular stories
    const remainingSlots = limit - recommendations.length
    if (remainingSlots > 0) {
      const popularStories = await this.getPopularStories(projectId, remainingSlots)
      recommendations.push(...popularStories)
    }

    // Sort by score and return top recommendations
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * Get related stories based on the same chapter
   */
  async getRelatedStories(
    storyId: string,
    limit = 5
  ): Promise<Story[]> {
    const currentStory = await this.db('stories')
      .where('id', storyId)
      .first()

    if (!currentStory) {
      return []
    }

    const relatedStories = await this.db('stories')
      .select('stories.*')
      .leftJoin('users as storytellers', 'stories.storyteller_id', 'storytellers.id')
      .where('stories.project_id', currentStory.project_id)
      .where('stories.chapter_id', currentStory.chapter_id)
      .where('stories.id', '!=', storyId)
      .where('stories.status', 'ready')
      .orderBy('stories.created_at', 'desc')
      .limit(limit)

    return relatedStories.map(this.mapStoryFromDb)
  }

  /**
   * Get story timeline for chronological navigation
   */
  async getStoryTimeline(
    projectId: string,
    options: {
      chapterId?: string
      storytellerId?: string
      dateFrom?: Date
      dateTo?: Date
    } = {}
  ): Promise<{
    stories: Story[]
    timeline: Array<{
      date: string
      stories: Story[]
    }>
  }> {
    let query = this.db('stories')
      .select('stories.*')
      .leftJoin('users as storytellers', 'stories.storyteller_id', 'storytellers.id')
      .leftJoin('chapters', 'stories.chapter_id', 'chapters.id')
      .where('stories.project_id', projectId)
      .where('stories.status', 'ready')

    if (options.chapterId) {
      query = query.where('stories.chapter_id', options.chapterId)
    }

    if (options.storytellerId) {
      query = query.where('stories.storyteller_id', options.storytellerId)
    }

    if (options.dateFrom) {
      query = query.where('stories.created_at', '>=', options.dateFrom)
    }

    if (options.dateTo) {
      query = query.where('stories.created_at', '<=', options.dateTo)
    }

    const stories = await query.orderBy('stories.created_at', 'asc')
    const mappedStories = stories.map(this.mapStoryFromDb)

    // Group stories by date
    const timeline = this.groupStoriesByDate(mappedStories)

    return {
      stories: mappedStories,
      timeline
    }
  }

  /**
   * Get story insights and statistics
   */
  async getStoryInsights(projectId: string): Promise<StoryInsights> {
    const [
      storyStats,
      chapterStats,
      interactionStats
    ] = await Promise.all([
      this.db('stories')
        .where('project_id', projectId)
        .where('status', 'ready')
        .select(
          this.db.raw('COUNT(*) as total_stories'),
          this.db.raw('AVG(audio_duration) as avg_duration'),
          this.db.raw('SUM(audio_duration) as total_duration')
        )
        .first(),
      
      this.db('stories')
        .select('chapter_id')
        .leftJoin('chapters', 'stories.chapter_id', 'chapters.id')
        .where('stories.project_id', projectId)
        .where('stories.status', 'ready')
        .groupBy('stories.chapter_id', 'chapters.name')
        .select('chapters.name as chapter_name')
        .count('* as story_count')
        .orderBy('story_count', 'desc')
        .first(),

      this.db('interactions')
        .leftJoin('stories', 'interactions.story_id', 'stories.id')
        .where('stories.project_id', projectId)
        .select(
          this.db.raw('COUNT(*) as total_interactions'),
          this.db.raw('COUNT(DISTINCT interactions.story_id) as stories_with_interactions')
        )
        .first()
    ])

    const totalStories = parseInt(storyStats?.total_stories || '0')
    const storiesWithInteractions = parseInt(interactionStats?.stories_with_interactions || '0')

    return {
      totalStories,
      averageDuration: parseFloat(storyStats?.avg_duration || '0'),
      totalDuration: parseFloat(storyStats?.total_duration || '0'),
      chaptersCompleted: await this.getCompletedChaptersCount(projectId),
      mostActiveChapter: chapterStats?.chapter_name || 'None',
      engagementScore: this.calculateEngagementScore(
        parseInt(interactionStats?.total_interactions || '0'),
        totalStories
      ),
      completionRate: totalStories > 0 ? (storiesWithInteractions / totalStories) * 100 : 0
    }
  }

  /**
   * Calculate story quality metrics
   */
  async getStoryQualityMetrics(storyId: string): Promise<StoryQualityMetrics> {
    const story = await this.db('stories')
      .leftJoin('interactions', 'stories.id', 'interactions.story_id')
      .where('stories.id', storyId)
      .select(
        'stories.*',
        this.db.raw('COUNT(interactions.id) as interaction_count')
      )
      .groupBy('stories.id')
      .first()

    if (!story) {
      throw new Error('Story not found')
    }

    const interactionCount = parseInt(story.interaction_count || '0')
    const lengthScore = this.calculateLengthScore(story.audio_duration)
    const engagementScore = this.calculateStoryEngagementScore(interactionCount)
    const overallQuality = (lengthScore + engagementScore) / 2

    return {
      storyId,
      lengthScore,
      engagementScore,
      interactionCount,
      overallQuality
    }
  }

  /**
   * Add story to favorites
   */
  async addToFavorites(userId: string, storyId: string): Promise<void> {
    await this.db('story_favorites').insert({
      user_id: userId,
      story_id: storyId,
      created_at: new Date()
    }).onConflict(['user_id', 'story_id']).ignore()
  }

  /**
   * Remove story from favorites
   */
  async removeFromFavorites(userId: string, storyId: string): Promise<void> {
    await this.db('story_favorites')
      .where('user_id', userId)
      .where('story_id', storyId)
      .delete()
  }

  /**
   * Get user's favorite stories
   */
  async getFavoriteStories(userId: string, projectId?: string): Promise<Story[]> {
    let query = this.db('story_favorites')
      .select('stories.*')
      .leftJoin('stories', 'story_favorites.story_id', 'stories.id')
      .leftJoin('users as storytellers', 'stories.storyteller_id', 'storytellers.id')
      .where('story_favorites.user_id', userId)
      .where('stories.status', 'ready')

    if (projectId) {
      query = query.where('stories.project_id', projectId)
    }

    const favorites = await query.orderBy('story_favorites.created_at', 'desc')
    return favorites.map(this.mapStoryFromDb)
  }

  // Private helper methods

  private async getChapterBasedRecommendations(
    projectId: string,
    recentStories: any[],
    limit: number
  ): Promise<StoryRecommendation[]> {
    const chapterIds = [...new Set(recentStories.map(s => s.chapter_id).filter(Boolean))]
    
    if (chapterIds.length === 0) {
      return []
    }

    const recommendations = await this.db('stories')
      .select('stories.*')
      .leftJoin('chapters', 'stories.chapter_id', 'chapters.id')
      .whereIn('stories.chapter_id', chapterIds)
      .where('stories.project_id', projectId)
      .where('stories.status', 'ready')
      .whereNotIn('stories.id', recentStories.map(s => s.id))
      .orderBy('stories.created_at', 'desc')
      .limit(limit)

    return recommendations.map(story => ({
      story: this.mapStoryFromDb(story),
      score: 0.8,
      reason: 'From the same chapter as your recent stories',
      type: 'chapter_related' as const
    }))
  }

  private async getSimilarContentRecommendations(
    projectId: string,
    recentStories: any[],
    limit: number
  ): Promise<StoryRecommendation[]> {
    // Simple content similarity based on transcript keywords
    const keywords = this.extractKeywords(recentStories)
    
    if (keywords.length === 0) {
      return []
    }

    const recommendations = await this.db('stories')
      .select('stories.*')
      .where('stories.project_id', projectId)
      .where('stories.status', 'ready')
      .whereNotIn('stories.id', recentStories.map(s => s.id))
      .where(function() {
        keywords.forEach(keyword => {
          this.orWhere('stories.transcript', 'like', `%${keyword}%`)
        })
      })
      .orderBy('stories.created_at', 'desc')
      .limit(limit)

    return recommendations.map(story => ({
      story: this.mapStoryFromDb(story),
      score: 0.6,
      reason: 'Similar content to your recent stories',
      type: 'similar_content' as const
    }))
  }

  private async getPopularStories(
    projectId: string,
    limit: number
  ): Promise<StoryRecommendation[]> {
    const popularStories = await this.db('stories')
      .select('stories.*')
      .leftJoin('interactions', 'stories.id', 'interactions.story_id')
      .where('stories.project_id', projectId)
      .where('stories.status', 'ready')
      .groupBy('stories.id')
      .orderBy(this.db.raw('COUNT(interactions.id)'), 'desc')
      .orderBy('stories.created_at', 'desc')
      .limit(limit)

    return popularStories.map(story => ({
      story: this.mapStoryFromDb(story),
      score: 0.4,
      reason: 'Popular stories in your project',
      type: 'popular' as const
    }))
  }

  private extractKeywords(stories: any[]): string[] {
    const allText = stories
      .map(s => s.transcript || '')
      .join(' ')
      .toLowerCase()

    // Simple keyword extraction - in production, use more sophisticated NLP
    const words = allText.split(/\s+/)
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'])
    
    const keywords = words
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 10)

    return [...new Set(keywords)]
  }

  private groupStoriesByDate(stories: Story[]): Array<{
    date: string
    stories: Story[]
  }> {
    const grouped = stories.reduce((acc, story) => {
      const date = new Date(story.createdAt).toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(story)
      return acc
    }, {} as Record<string, Story[]>)

    return Object.entries(grouped)
      .map(([date, stories]) => ({ date, stories }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  private async getCompletedChaptersCount(projectId: string): Promise<number> {
    const result = await this.db('stories')
      .select('chapter_id')
      .where('project_id', projectId)
      .where('status', 'ready')
      .whereNotNull('chapter_id')
      .groupBy('chapter_id')
      .havingRaw('COUNT(*) >= 3') // Consider chapter "completed" with 3+ stories
      .count('* as completed_chapters')

    return parseInt(result[0]?.completed_chapters || '0')
  }

  private calculateEngagementScore(totalInteractions: number, totalStories: number): number {
    if (totalStories === 0) return 0
    const avgInteractionsPerStory = totalInteractions / totalStories
    return Math.min(avgInteractionsPerStory * 20, 100) // Scale to 0-100
  }

  private calculateLengthScore(duration: number): number {
    if (!duration) return 0
    // Optimal duration is around 2-5 minutes (120-300 seconds)
    const optimalMin = 120
    const optimalMax = 300
    
    if (duration >= optimalMin && duration <= optimalMax) {
      return 100
    } else if (duration < optimalMin) {
      return (duration / optimalMin) * 100
    } else {
      return Math.max(100 - ((duration - optimalMax) / optimalMax) * 50, 20)
    }
  }

  private calculateStoryEngagementScore(interactionCount: number): number {
    // More interactions = higher engagement
    return Math.min(interactionCount * 25, 100)
  }

  private mapStoryFromDb(row: any): Story {
    return {
      id: row.id,
      projectId: row.project_id,
      storytellerId: row.storyteller_id,
      title: row.title,
      audioUrl: row.audio_url,
      audioDuration: row.audio_duration,
      transcript: row.transcript,
      originalTranscript: row.original_transcript,
      photoUrl: row.photo_url,
      promptId: row.prompt_id,
      userPromptId: row.user_prompt_id,
      chapterId: row.chapter_id,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }
}