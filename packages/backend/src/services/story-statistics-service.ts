import { BaseService } from './base-service';

interface StoryStatistics {
  totalDuration: number;
  averageDuration: number;
  totalStories: number;
  interactionCount: number;
  completionRate: number;
  engagementScore: number;
  topChapters: Array<{
    chapterId: string;
    chapterName: string;
    storyCount: number;
    averageDuration: number;
  }>;
  recentActivity: Array<{
    date: string;
    storiesCount: number;
    interactionsCount: number;
  }>;
}

interface StoryQualityMetrics {
  storyId: string;
  qualityScore: number;
  durationScore: number;
  engagementScore: number;
  transcriptQuality: number;
  factors: {
    hasTranscript: boolean;
    hasPhoto: boolean;
    hasInteractions: boolean;
    optimalDuration: boolean;
    recentActivity: boolean;
  };
}

export class StoryStatisticsService extends BaseService {
  async getProjectStatistics(projectId: string): Promise<StoryStatistics> {
    // Get basic story metrics
    const basicStats = await this.db('stories')
      .where('project_id', projectId)
      .where('status', 'ready')
      .select(
        this.db.raw('COUNT(*) as total_stories'),
        this.db.raw('SUM(COALESCE(audio_duration, 0)) as total_duration'),
        this.db.raw('AVG(COALESCE(audio_duration, 0)) as average_duration')
      )
      .first();

    // Get interaction count
    const interactionStats = await this.db('interactions')
      .join('stories', 'interactions.story_id', 'stories.id')
      .where('stories.project_id', projectId)
      .count('* as interaction_count')
      .first();

    // Get chapter breakdown
    const chapterStats = await this.db('stories')
      .join('chapters', 'stories.chapter_id', 'chapters.id')
      .where('stories.project_id', projectId)
      .where('stories.status', 'ready')
      .groupBy('chapters.id', 'chapters.name')
      .select(
        'chapters.id as chapter_id',
        'chapters.name as chapter_name',
        this.db.raw('COUNT(*) as story_count'),
        this.db.raw('AVG(COALESCE(stories.audio_duration, 0)) as average_duration')
      )
      .orderBy('story_count', 'desc');

    // Get recent activity (last 30 days)
    const recentActivity = await this.db('stories')
      .leftJoin('interactions', 'stories.id', 'interactions.story_id')
      .where('stories.project_id', projectId)
      .where('stories.created_at', '>=', this.db.raw("NOW() - INTERVAL '30 days'"))
      .select(
        this.db.raw("DATE(stories.created_at) as date"),
        this.db.raw('COUNT(DISTINCT stories.id) as stories_count'),
        this.db.raw('COUNT(interactions.id) as interactions_count')
      )
      .groupBy(this.db.raw("DATE(stories.created_at)"))
      .orderBy('date', 'desc');

    // Calculate completion rate (stories with interactions vs total)
    const storiesWithInteractions = await this.db('stories')
      .join('interactions', 'stories.id', 'interactions.story_id')
      .where('stories.project_id', projectId)
      .countDistinct('stories.id as count')
      .first();

    const totalStories = Number(basicStats?.total_stories || 0);
    const totalDuration = Number(basicStats?.total_duration || 0);
    const averageDuration = Number(basicStats?.average_duration || 0);
    const interactionCount = Number(interactionStats?.interaction_count || 0);
    const storiesWithInteractionsCount = Number(storiesWithInteractions?.count || 0);
    
    const completionRate = totalStories > 0 ? storiesWithInteractionsCount / totalStories : 0;
    const engagementScore = totalStories > 0 ? interactionCount / totalStories : 0;

    return {
      totalDuration,
      averageDuration,
      totalStories,
      interactionCount,
      completionRate,
      engagementScore: Math.min(1, engagementScore / 3), // Normalize to 0-1 scale
      topChapters: chapterStats.map(chapter => ({
        chapterId: chapter.chapter_id,
        chapterName: chapter.chapter_name,
        storyCount: Number(chapter.story_count),
        averageDuration: Number(chapter.average_duration)
      })),
      recentActivity: recentActivity.map(activity => ({
        date: activity.date,
        storiesCount: Number(activity.stories_count),
        interactionsCount: Number(activity.interactions_count)
      }))
    };
  }

  async calculateStoryQuality(storyId: string): Promise<StoryQualityMetrics> {
    const story = await this.db('stories')
      .leftJoin('interactions', 'stories.id', 'interactions.story_id')
      .where('stories.id', storyId)
      .select(
        'stories.*',
        this.db.raw('COUNT(interactions.id) as interaction_count')
      )
      .groupBy('stories.id')
      .first();

    if (!story) {
      throw new Error('Story not found');
    }

    const factors = {
      hasTranscript: !!story.transcript,
      hasPhoto: !!story.photo_url,
      hasInteractions: Number(story.interaction_count) > 0,
      optimalDuration: story.audio_duration >= 30 && story.audio_duration <= 600, // 30s to 10min
      recentActivity: new Date(story.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    };

    // Calculate individual scores
    const durationScore = this.calculateDurationScore(story.audio_duration || 0);
    const engagementScore = Math.min(1, Number(story.interaction_count) / 5); // Max score at 5 interactions
    const transcriptQuality = this.calculateTranscriptQuality(story.transcript);

    // Calculate overall quality score
    const qualityScore = (
      (factors.hasTranscript ? 0.3 : 0) +
      (factors.hasPhoto ? 0.1 : 0) +
      (factors.hasInteractions ? 0.2 : 0) +
      (durationScore * 0.2) +
      (engagementScore * 0.1) +
      (transcriptQuality * 0.1)
    );

    return {
      storyId,
      qualityScore: Math.min(1, qualityScore),
      durationScore,
      engagementScore,
      transcriptQuality,
      factors
    };
  }

  async getStoryCompletionTracking(projectId: string): Promise<{
    totalPrompts: number;
    answeredPrompts: number;
    completionRate: number;
    chapterProgress: Array<{
      chapterId: string;
      chapterName: string;
      totalPrompts: number;
      answeredPrompts: number;
      completionRate: number;
    }>;
  }> {
    // Get total prompts available
    const totalPrompts = await this.db('prompts')
      .join('chapters', 'prompts.chapter_id', 'chapters.id')
      .where('prompts.is_active', true)
      .count('* as count')
      .first();

    // Get answered prompts for this project
    const answeredPrompts = await this.db('stories')
      .where('project_id', projectId)
      .where('status', 'ready')
      .whereNotNull('prompt_id')
      .countDistinct('prompt_id as count')
      .first();

    // Get chapter-level progress
    const chapterProgress = await this.db('chapters')
      .leftJoin('prompts', 'chapters.id', 'prompts.chapter_id')
      .leftJoin('stories', function() {
        this.on('prompts.id', 'stories.prompt_id')
            .andOn('stories.project_id', this.db.raw('?', [projectId]))
            .andOn('stories.status', this.db.raw('?', ['ready']));
      })
      .where('prompts.is_active', true)
      .groupBy('chapters.id', 'chapters.name')
      .select(
        'chapters.id as chapter_id',
        'chapters.name as chapter_name',
        this.db.raw('COUNT(DISTINCT prompts.id) as total_prompts'),
        this.db.raw('COUNT(DISTINCT stories.id) as answered_prompts')
      )
      .orderBy('chapters.order_index');

    const totalPromptsCount = Number(totalPrompts?.count || 0);
    const answeredPromptsCount = Number(answeredPrompts?.count || 0);

    return {
      totalPrompts: totalPromptsCount,
      answeredPrompts: answeredPromptsCount,
      completionRate: totalPromptsCount > 0 ? answeredPromptsCount / totalPromptsCount : 0,
      chapterProgress: chapterProgress.map(chapter => ({
        chapterId: chapter.chapter_id,
        chapterName: chapter.chapter_name,
        totalPrompts: Number(chapter.total_prompts),
        answeredPrompts: Number(chapter.answered_prompts),
        completionRate: Number(chapter.total_prompts) > 0 
          ? Number(chapter.answered_prompts) / Number(chapter.total_prompts) 
          : 0
      }))
    };
  }

  private calculateDurationScore(duration: number): number {
    if (duration < 10) return 0.1; // Too short
    if (duration < 30) return 0.5; // Short but acceptable
    if (duration <= 300) return 1.0; // Optimal range (30s - 5min)
    if (duration <= 600) return 0.8; // Good but long (5-10min)
    return 0.6; // Very long but still valuable
  }

  private calculateTranscriptQuality(transcript?: string): number {
    if (!transcript) return 0;
    
    const wordCount = transcript.split(/\s+/).length;
    const sentenceCount = transcript.split(/[.!?]+/).length;
    const avgWordsPerSentence = wordCount / Math.max(1, sentenceCount);
    
    // Quality based on length and structure
    let score = 0;
    
    if (wordCount >= 10) score += 0.3; // Has substantial content
    if (wordCount >= 50) score += 0.2; // Good length
    if (avgWordsPerSentence >= 5 && avgWordsPerSentence <= 20) score += 0.3; // Good sentence structure
    if (transcript.includes('?') || transcript.includes('!')) score += 0.1; // Has emotional content
    if (!/\b(um|uh|er)\b/gi.test(transcript)) score += 0.1; // Clean transcript
    
    return Math.min(1, score);
  }
}