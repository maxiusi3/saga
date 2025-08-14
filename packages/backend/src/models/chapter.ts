import { BaseModel } from './base';
import type { Chapter } from '@saga/shared/types/chapter';

export interface ChapterData extends Chapter {}

export interface CreateChapterData {
  name: string;
  description?: string;
  order_index: number;
  is_active?: boolean;
}

export interface UpdateChapterData {
  name?: string;
  description?: string;
  order_index?: number;
  is_active?: boolean;
}

export class ChapterModel extends BaseModel<ChapterData> {
  protected tableName = 'chapters';

  /**
   * Create a new chapter
   */
  static async create(data: CreateChapterData): Promise<ChapterModel> {
    const chapterData = {
      ...data,
      is_active: data.is_active ?? true,
    };

    const [created] = await this.query()
      .insert(chapterData)
      .returning('*');

    return new ChapterModel(created);
  }

  /**
   * Find all active chapters in order
   */
  static async findAllActive(): Promise<ChapterModel[]> {
    const results = await this.query()
      .where('is_active', true)
      .orderBy('order_index', 'asc');

    return results.map(data => new ChapterModel(data));
  }

  /**
   * Find chapter by order index
   */
  static async findByOrderIndex(orderIndex: number): Promise<ChapterModel | null> {
    const result = await this.query()
      .where('order_index', orderIndex)
      .where('is_active', true)
      .first();

    return result ? new ChapterModel(result) : null;
  }

  /**
   * Get next chapter after current one
   */
  static async getNextChapter(currentChapterId: string): Promise<ChapterModel | null> {
    const currentChapter = await this.findById(currentChapterId);
    if (!currentChapter) return null;

    const result = await this.query()
      .where('order_index', '>', currentChapter.data.order_index)
      .where('is_active', true)
      .orderBy('order_index', 'asc')
      .first();

    return result ? new ChapterModel(result) : null;
  }

  /**
   * Get first chapter
   */
  static async getFirstChapter(): Promise<ChapterModel | null> {
    const result = await this.query()
      .where('is_active', true)
      .orderBy('order_index', 'asc')
      .first();

    return result ? new ChapterModel(result) : null;
  }

  /**
   * Update chapter
   */
  async update(data: UpdateChapterData): Promise<void> {
    const updated = await ChapterModel.query()
      .where('id', this.data.id)
      .update({
        ...data,
        updated_at: new Date(),
      })
      .returning('*');

    if (updated.length > 0) {
      this.data = updated[0];
    }
  }

  /**
   * Delete chapter
   */
  async delete(): Promise<void> {
    await ChapterModel.query().where('id', this.data.id).delete();
  }

  /**
   * Get prompts for this chapter
   */
  async getPrompts(): Promise<any[]> {
    // This would join with prompts table when we have chapter_id in prompts
    // For now, return empty array
    return [];
  }

  /**
   * Check if chapter is complete for a project
   */
  async isCompleteForProject(projectId: string): Promise<boolean> {
    // This would check if all prompts in this chapter have been answered
    // For now, return false
    return false;
  }
}