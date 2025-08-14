import { BaseModel } from './base';

export interface UserPromptData {
  id: string;
  userId: string;
  promptId: string;
  status: 'presented' | 'used' | 'skipped';
  skipReason?: string;
  storyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserPromptData {
  userId: string;
  promptId: string;
  status: UserPromptData['status'];
  skipReason?: string;
  storyId?: string;
}

export interface UpdateUserPromptData {
  status?: UserPromptData['status'];
  skipReason?: string;
  storyId?: string;
}

export class UserPrompt extends BaseModel<UserPromptData> {
  protected tableName = 'user_prompts';

  /**
   * Create a new user prompt record
   */
  static async create(data: CreateUserPromptData): Promise<UserPrompt> {
    const [created] = await this.query()
      .insert(data)
      .returning('*');

    return new UserPrompt(created);
  }

  /**
   * Find user prompts by user ID
   */
  static async findByUserId(
    userId: string,
    options: {
      status?: UserPromptData['status'];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<UserPrompt[]> {
    let query = this.query().where('user_id', userId);

    if (options.status) {
      query = query.where('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    const results = await query.orderBy('created_at', 'desc');
    return results.map(data => new UserPrompt(data));
  }

  /**
   * Find user prompt by user and prompt ID
   */
  static async findByUserAndPrompt(
    userId: string,
    promptId: string
  ): Promise<UserPrompt | null> {
    const result = await this.query()
      .where('user_id', userId)
      .where('prompt_id', promptId)
      .first();

    return result ? new UserPrompt(result) : null;
  }

  /**
   * Get user's recent prompts
   */
  static async getRecentPrompts(
    userId: string,
    days: number = 7,
    limit: number = 50
  ): Promise<UserPrompt[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const results = await this.query()
      .where('user_id', userId)
      .where('created_at', '>=', cutoffDate)
      .orderBy('created_at', 'desc')
      .limit(limit);

    return results.map(data => new UserPrompt(data));
  }

  /**
   * Get used prompts for a user
   */
  static async getUsedPrompts(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<UserPrompt[]> {
    let query = this.query()
      .where('user_id', userId)
      .where('status', 'used');

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    const results = await query.orderBy('created_at', 'desc');
    return results.map(data => new UserPrompt(data));
  }

  /**
   * Get skipped prompts for a user
   */
  static async getSkippedPrompts(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<UserPrompt[]> {
    let query = this.query()
      .where('user_id', userId)
      .where('status', 'skipped');

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    const results = await query.orderBy('created_at', 'desc');
    return results.map(data => new UserPrompt(data));
  }

  /**
   * Get prompt IDs that user has already seen
   */
  static async getSeenPromptIds(userId: string): Promise<string[]> {
    const results = await this.query()
      .where('user_id', userId)
      .select('prompt_id');

    return results.map(row => row.prompt_id);
  }

  /**
   * Mark prompt as presented to user
   */
  static async markAsPresented(userId: string, promptId: string): Promise<UserPrompt> {
    // Check if record already exists
    const existing = await this.findByUserAndPrompt(userId, promptId);
    if (existing) {
      return existing;
    }

    return this.create({
      userId,
      promptId,
      status: 'presented',
    });
  }

  /**
   * Mark prompt as used
   */
  async markAsUsed(storyId?: string): Promise<void> {
    await this.update({
      status: 'used',
      storyId,
    });
  }

  /**
   * Mark prompt as skipped
   */
  async markAsSkipped(reason?: string): Promise<void> {
    await this.update({
      status: 'skipped',
      skipReason: reason,
    });
  }

  /**
   * Update user prompt
   */
  async update(data: UpdateUserPromptData): Promise<void> {
    const updated = await UserPrompt.query()
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
   * Delete user prompt record
   */
  async delete(): Promise<void> {
    await UserPrompt.query().where('id', this.data.id).delete();
  }

  /**
   * Get prompt details (joins with prompts table)
   */
  async getPromptDetails(): Promise<any> {
    const result = await UserPrompt.query()
      .where('user_prompts.id', this.data.id)
      .join('prompts', 'user_prompts.prompt_id', 'prompts.id')
      .select(
        'user_prompts.*',
        'prompts.text',
        'prompts.category',
        'prompts.difficulty',
        'prompts.follow_up_questions',
        'prompts.tags',
        'prompts.audio_url'
      )
      .first();

    return result;
  }

  /**
   * Check if prompt was used
   */
  isUsed(): boolean {
    return this.data.status === 'used';
  }

  /**
   * Check if prompt was skipped
   */
  isSkipped(): boolean {
    return this.data.status === 'skipped';
  }

  /**
   * Check if prompt was only presented
   */
  isPresented(): boolean {
    return this.data.status === 'presented';
  }

  /**
   * Get skip reason
   */
  getSkipReason(): string | undefined {
    return this.data.skipReason;
  }

  /**
   * Get associated story ID
   */
  getStoryId(): string | undefined {
    return this.data.storyId;
  }
}