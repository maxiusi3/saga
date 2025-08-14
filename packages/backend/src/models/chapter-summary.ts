import { BaseModel } from './base';
import { ChapterSummary, CreateChapterSummaryInput } from '@saga/shared';

export interface ChapterSummaryData {
  id: string;
  project_id: string;
  title: string;
  description: string;
  theme: string;
  story_ids: string[];
  key_highlights: string[];
  timeframe?: {
    start?: string;
    end?: string;
  };
  emotional_tone: 'positive' | 'neutral' | 'reflective' | 'bittersweet';
  status: 'generating' | 'ready' | 'failed';
  created_at: Date;
  updated_at: Date;
}

export interface CreateChapterSummaryData {
  project_id: string;
  title: string;
  description: string;
  theme: string;
  story_ids: string[];
  key_highlights: string[];
  timeframe?: {
    start?: string;
    end?: string;
  };
  emotional_tone?: 'positive' | 'neutral' | 'reflective' | 'bittersweet';
  status?: 'generating' | 'ready' | 'failed';
}

export interface UpdateChapterSummaryData {
  title?: string;
  description?: string;
  theme?: string;
  story_ids?: string[];
  key_highlights?: string[];
  timeframe?: {
    start?: string;
    end?: string;
  };
  emotional_tone?: 'positive' | 'neutral' | 'reflective' | 'bittersweet';
  status?: 'generating' | 'ready' | 'failed';
}

export class ChapterSummaryModel extends BaseModel<ChapterSummaryData> {
  protected tableName = 'chapter_summaries';

  /**
   * Create a new chapter summary
   */
  static async create(data: CreateChapterSummaryData): Promise<ChapterSummary> {
    const [created] = await this.query()
      .insert({
        ...data,
        emotional_tone: data.emotional_tone || 'neutral',
        status: data.status || 'generating',
      })
      .returning('*');

    return this.transformToApiFormat(created);
  }

  /**
   * Find chapter summaries by project
   */
  static async findByProject(projectId: string): Promise<ChapterSummary[]> {
    const results = await this.query()
      .where('project_id', projectId)
      .where('status', 'ready')
      .orderBy('created_at', 'desc');

    return results.map(this.transformToApiFormat);
  }

  /**
   * Find chapter summary by ID
   */
  static async findById(id: string): Promise<ChapterSummary | null> {
    const result = await this.query()
      .where('id', id)
      .first();

    if (!result) return null;
    return this.transformToApiFormat(result);
  }

  /**
   * Find chapter summaries by theme
   */
  static async findByTheme(projectId: string, theme: string): Promise<ChapterSummary[]> {
    const results = await this.query()
      .where('project_id', projectId)
      .where('theme', theme)
      .where('status', 'ready')
      .orderBy('created_at', 'desc');

    return results.map(this.transformToApiFormat);
  }

  /**
   * Find chapter summaries containing specific story IDs
   */
  static async findByStoryIds(projectId: string, storyIds: string[]): Promise<ChapterSummary[]> {
    const results = await this.query()
      .where('project_id', projectId)
      .where('status', 'ready')
      .whereRaw('story_ids ?| array[?]', [storyIds]);

    return results.map(this.transformToApiFormat);
  }

  /**
   * Update chapter summary
   */
  static async updateById(id: string, data: UpdateChapterSummaryData): Promise<ChapterSummary | null> {
    const [updated] = await this.query()
      .where('id', id)
      .update({
        ...data,
        updated_at: new Date(),
      })
      .returning('*');

    if (!updated) return null;
    return this.transformToApiFormat(updated);
  }

  /**
   * Update chapter summary status
   */
  static async updateStatus(
    id: string, 
    status: 'generating' | 'ready' | 'failed'
  ): Promise<ChapterSummary | null> {
    const [updated] = await this.query()
      .where('id', id)
      .update({
        status,
        updated_at: new Date(),
      })
      .returning('*');

    if (!updated) return null;
    return this.transformToApiFormat(updated);
  }

  /**
   * Delete chapter summary
   */
  static async deleteById(id: string): Promise<boolean> {
    const deleted = await this.query()
      .where('id', id)
      .delete();

    return deleted > 0;
  }

  /**
   * Get chapter summaries with story count
   */
  static async findByProjectWithStats(projectId: string): Promise<(ChapterSummary & { storyCount: number })[]> {
    const results = await this.query()
      .where('project_id', projectId)
      .where('status', 'ready')
      .orderBy('created_at', 'desc');

    return results.map(result => ({
      ...this.transformToApiFormat(result),
      storyCount: Array.isArray(result.story_ids) ? result.story_ids.length : 0,
    }));
  }

  /**
   * Get all themes for a project
   */
  static async getThemesByProject(projectId: string): Promise<string[]> {
    const results = await this.query()
      .where('project_id', projectId)
      .where('status', 'ready')
      .distinct('theme')
      .orderBy('theme');

    return results.map(r => r.theme);
  }

  /**
   * Check if stories are already in a chapter
   */
  static async areStoriesInChapter(projectId: string, storyIds: string[]): Promise<boolean> {
    const result = await this.query()
      .where('project_id', projectId)
      .where('status', 'ready')
      .whereRaw('story_ids ?& array[?]', [storyIds])
      .first();

    return !!result;
  }

  /**
   * Transform database format to API format
   */
  private static transformToApiFormat(data: ChapterSummaryData): ChapterSummary {
    return {
      id: data.id,
      projectId: data.project_id,
      title: data.title,
      description: data.description,
      theme: data.theme,
      storyIds: Array.isArray(data.story_ids) ? data.story_ids : [],
      keyHighlights: Array.isArray(data.key_highlights) ? data.key_highlights : [],
      timeframe: data.timeframe,
      emotionalTone: data.emotional_tone,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}