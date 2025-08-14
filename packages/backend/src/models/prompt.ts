import { BaseModel } from './base';

export interface PromptData {
  id: string;
  text: string;
  audioUrl?: string;
  category: 'childhood' | 'family' | 'career' | 'relationships' | 'general';
  difficulty: 'easy' | 'medium' | 'hard';
  followUpQuestions?: string[];
  tags?: string[];
  personalizedFor?: string;
  isLibraryPrompt: boolean;
  templateId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePromptData {
  text: string;
  audioUrl?: string;
  category: PromptData['category'];
  difficulty: PromptData['difficulty'];
  followUpQuestions?: string[];
  tags?: string[];
  personalizedFor?: string;
  isLibraryPrompt?: boolean;
  templateId?: string;
}

export interface UpdatePromptData {
  text?: string;
  audioUrl?: string;
  category?: PromptData['category'];
  difficulty?: PromptData['difficulty'];
  followUpQuestions?: string[];
  tags?: string[];
}

export class Prompt extends BaseModel<PromptData> {
  protected tableName = 'prompts';

  /**
   * Create a new prompt
   */
  static async create(data: CreatePromptData): Promise<Prompt> {
    const promptData = {
      ...data,
      isLibraryPrompt: data.isLibraryPrompt ?? false,
    };

    const [created] = await this.query()
      .insert(promptData)
      .returning('*');

    return new Prompt(created);
  }

  /**
   * Find prompts by category
   */
  static async findByCategory(
    category: PromptData['category'],
    options: {
      difficulty?: PromptData['difficulty'];
      excludeIds?: string[];
      limit?: number;
      isLibraryPrompt?: boolean;
    } = {}
  ): Promise<Prompt[]> {
    let query = this.query().where('category', category);

    if (options.difficulty) {
      query = query.where('difficulty', options.difficulty);
    }

    if (options.excludeIds && options.excludeIds.length > 0) {
      query = query.whereNotIn('id', options.excludeIds);
    }

    if (options.isLibraryPrompt !== undefined) {
      query = query.where('is_library_prompt', options.isLibraryPrompt);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const results = await query.orderBy('created_at', 'desc');
    return results.map(data => new Prompt(data));
  }

  /**
   * Find personalized prompts for a user
   */
  static async findPersonalizedForUser(
    userId: string,
    options: {
      category?: PromptData['category'];
      limit?: number;
    } = {}
  ): Promise<Prompt[]> {
    let query = this.query().where('personalized_for', userId);

    if (options.category) {
      query = query.where('category', options.category);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const results = await query.orderBy('created_at', 'desc');
    return results.map(data => new Prompt(data));
  }

  /**
   * Find library prompts (curated prompts)
   */
  static async findLibraryPrompts(options: {
    category?: PromptData['category'];
    difficulty?: PromptData['difficulty'];
    tags?: string[];
    limit?: number;
  } = {}): Promise<Prompt[]> {
    let query = this.query().where('is_library_prompt', true);

    if (options.category) {
      query = query.where('category', options.category);
    }

    if (options.difficulty) {
      query = query.where('difficulty', options.difficulty);
    }

    if (options.tags && options.tags.length > 0) {
      query = query.whereRaw('tags ?& array[?]', [options.tags]);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const results = await query.orderBy('created_at', 'desc');
    return results.map(data => new Prompt(data));
  }

  /**
   * Search prompts by text content
   */
  static async search(
    searchTerm: string,
    options: {
      category?: PromptData['category'];
      difficulty?: PromptData['difficulty'];
      limit?: number;
    } = {}
  ): Promise<Prompt[]> {
    let query = this.query()
      .whereRaw('text ILIKE ?', [`%${searchTerm}%`]);

    if (options.category) {
      query = query.where('category', options.category);
    }

    if (options.difficulty) {
      query = query.where('difficulty', options.difficulty);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const results = await query.orderBy('created_at', 'desc');
    return results.map(data => new Prompt(data));
  }

  /**
   * Get random prompt from library
   */
  static async getRandomLibraryPrompt(options: {
    category?: PromptData['category'];
    difficulty?: PromptData['difficulty'];
    excludeIds?: string[];
  } = {}): Promise<Prompt | null> {
    let query = this.query()
      .where('is_library_prompt', true);

    if (options.category) {
      query = query.where('category', options.category);
    }

    if (options.difficulty) {
      query = query.where('difficulty', options.difficulty);
    }

    if (options.excludeIds && options.excludeIds.length > 0) {
      query = query.whereNotIn('id', options.excludeIds);
    }

    const results = await query.orderByRaw('RANDOM()').limit(1);
    
    if (results.length === 0) {
      return null;
    }

    return new Prompt(results[0]);
  }

  /**
   * Update prompt
   */
  async update(data: UpdatePromptData): Promise<void> {
    const updated = await Prompt.query()
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
   * Delete prompt
   */
  async delete(): Promise<void> {
    await Prompt.query().where('id', this.data.id).delete();
  }

  /**
   * Get category display name
   */
  getCategoryDisplayName(): string {
    const categoryNames = {
      childhood: 'Childhood Memories',
      family: 'Family Stories',
      career: 'Work & Career',
      relationships: 'People & Relationships',
      general: 'Life Experiences',
    };

    return categoryNames[this.data.category] || 'Stories';
  }

  /**
   * Get difficulty color
   */
  getDifficultyColor(): string {
    const colors = {
      easy: '#10b981',
      medium: '#f59e0b',
      hard: '#ef4444',
    };

    return colors[this.data.difficulty] || '#6b7280';
  }

  /**
   * Check if prompt has audio
   */
  hasAudio(): boolean {
    return !!this.data.audioUrl;
  }

  /**
   * Get follow-up questions
   */
  getFollowUpQuestions(): string[] {
    return this.data.followUpQuestions || [];
  }

  /**
   * Get tags
   */
  getTags(): string[] {
    return this.data.tags || [];
  }

  /**
   * Check if prompt is personalized
   */
  isPersonalized(): boolean {
    return !!this.data.personalizedFor;
  }

  /**
   * Check if prompt is from library
   */
  isFromLibrary(): boolean {
    return this.data.isLibraryPrompt;
  }
}