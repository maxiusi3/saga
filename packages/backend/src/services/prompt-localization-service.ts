import { BaseModel } from '../models/base';
import { Prompt } from '../models/prompt';

interface LocalizedPrompt {
  id: string;
  originalPromptId: string;
  language: string;
  text: string;
  followUpQuestions?: string[];
  culturalAdaptations?: string[];
  translatedBy?: string;
  reviewedBy?: string;
  status: 'draft' | 'review' | 'approved' | 'deprecated';
  createdAt: Date;
  updatedAt: Date;
}

interface LocalizationRequest {
  promptId: string;
  targetLanguage: string;
  culturalContext?: string;
  translatorNotes?: string;
}

interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
  culturalContexts: string[];
  status: 'active' | 'beta' | 'planned';
}

class PromptLocalizationServiceClass {
  private db = BaseModel.db;

  // Supported languages configuration
  private supportedLanguages: SupportedLanguage[] = [
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      rtl: false,
      culturalContexts: ['US', 'UK', 'CA', 'AU'],
      status: 'active',
    },
    {
      code: 'es',
      name: 'Spanish',
      nativeName: 'Español',
      rtl: false,
      culturalContexts: ['ES', 'MX', 'AR', 'CO'],
      status: 'beta',
    },
    {
      code: 'fr',
      name: 'French',
      nativeName: 'Français',
      rtl: false,
      culturalContexts: ['FR', 'CA', 'BE'],
      status: 'beta',
    },
    {
      code: 'de',
      name: 'German',
      nativeName: 'Deutsch',
      rtl: false,
      culturalContexts: ['DE', 'AT', 'CH'],
      status: 'planned',
    },
    {
      code: 'it',
      name: 'Italian',
      nativeName: 'Italiano',
      rtl: false,
      culturalContexts: ['IT'],
      status: 'planned',
    },
    {
      code: 'pt',
      name: 'Portuguese',
      nativeName: 'Português',
      rtl: false,
      culturalContexts: ['PT', 'BR'],
      status: 'planned',
    },
    {
      code: 'zh',
      name: 'Chinese',
      nativeName: '中文',
      rtl: false,
      culturalContexts: ['CN', 'TW', 'HK'],
      status: 'planned',
    },
    {
      code: 'ja',
      name: 'Japanese',
      nativeName: '日本語',
      rtl: false,
      culturalContexts: ['JP'],
      status: 'planned',
    },
  ];

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return this.supportedLanguages;
  }

  /**
   * Get active languages only
   */
  getActiveLanguages(): SupportedLanguage[] {
    return this.supportedLanguages.filter(lang => lang.status === 'active');
  }

  /**
   * Create localized version of a prompt
   */
  async createLocalizedPrompt(request: LocalizationRequest): Promise<LocalizedPrompt> {
    try {
      // Validate original prompt exists
      const originalPrompt = await Prompt.findById(request.promptId);
      if (!originalPrompt) {
        throw new Error('Original prompt not found');
      }

      // Validate target language is supported
      const targetLang = this.supportedLanguages.find(lang => lang.code === request.targetLanguage);
      if (!targetLang) {
        throw new Error(`Language ${request.targetLanguage} is not supported`);
      }

      // Check if localization already exists
      const existing = await this.getLocalizedPrompt(request.promptId, request.targetLanguage);
      if (existing) {
        throw new Error(`Localization for ${request.targetLanguage} already exists`);
      }

      // Create placeholder localized prompt (would integrate with translation service)
      const localizedPrompt: Omit<LocalizedPrompt, 'id' | 'createdAt' | 'updatedAt'> = {
        originalPromptId: request.promptId,
        language: request.targetLanguage,
        text: `[${request.targetLanguage.toUpperCase()}] ${originalPrompt.data.text}`, // Placeholder
        followUpQuestions: originalPrompt.getFollowUpQuestions().map(q => `[${request.targetLanguage.toUpperCase()}] ${q}`),
        culturalAdaptations: [],
        status: 'draft',
      };

      const [created] = await this.db('localized_prompts').insert({
        original_prompt_id: localizedPrompt.originalPromptId,
        language: localizedPrompt.language,
        text: localizedPrompt.text,
        follow_up_questions: JSON.stringify(localizedPrompt.followUpQuestions || []),
        cultural_adaptations: JSON.stringify(localizedPrompt.culturalAdaptations || []),
        status: localizedPrompt.status,
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*');

      return this.transformDbToLocalizedPrompt(created);
    } catch (error) {
      console.error('Failed to create localized prompt:', error);
      throw error;
    }
  }

  /**
   * Get localized prompt
   */
  async getLocalizedPrompt(promptId: string, language: string): Promise<LocalizedPrompt | null> {
    try {
      const result = await this.db('localized_prompts')
        .where('original_prompt_id', promptId)
        .where('language', language)
        .first();

      return result ? this.transformDbToLocalizedPrompt(result) : null;
    } catch (error) {
      console.error('Failed to get localized prompt:', error);
      return null;
    }
  }

  /**
   * Get all localizations for a prompt
   */
  async getPromptLocalizations(promptId: string): Promise<LocalizedPrompt[]> {
    try {
      const results = await this.db('localized_prompts')
        .where('original_prompt_id', promptId)
        .orderBy('language');

      return results.map(this.transformDbToLocalizedPrompt);
    } catch (error) {
      console.error('Failed to get prompt localizations:', error);
      return [];
    }
  }

  /**
   * Update localized prompt
   */
  async updateLocalizedPrompt(
    id: string,
    updates: {
      text?: string;
      followUpQuestions?: string[];
      culturalAdaptations?: string[];
      status?: LocalizedPrompt['status'];
      reviewedBy?: string;
    }
  ): Promise<LocalizedPrompt | null> {
    try {
      const updateData: any = {
        updated_at: new Date(),
      };

      if (updates.text) updateData.text = updates.text;
      if (updates.followUpQuestions) updateData.follow_up_questions = JSON.stringify(updates.followUpQuestions);
      if (updates.culturalAdaptations) updateData.cultural_adaptations = JSON.stringify(updates.culturalAdaptations);
      if (updates.status) updateData.status = updates.status;
      if (updates.reviewedBy) updateData.reviewed_by = updates.reviewedBy;

      const [updated] = await this.db('localized_prompts')
        .where('id', id)
        .update(updateData)
        .returning('*');

      return updated ? this.transformDbToLocalizedPrompt(updated) : null;
    } catch (error) {
      console.error('Failed to update localized prompt:', error);
      return null;
    }
  }

  /**
   * Get localization coverage report
   */
  async getLocalizationCoverage(): Promise<{
    totalPrompts: number;
    localizedPrompts: Record<string, number>;
    coveragePercentage: Record<string, number>;
    missingLocalizations: Record<string, string[]>;
  }> {
    try {
      // Get total number of library prompts
      const totalPrompts = (await Prompt.findLibraryPrompts()).length;

      // Get localization counts by language
      const localizationCounts = await this.db('localized_prompts')
        .select('language')
        .count('* as count')
        .where('status', '!=', 'deprecated')
        .groupBy('language');

      const localizedPrompts: Record<string, number> = {};
      const coveragePercentage: Record<string, number> = {};

      localizationCounts.forEach(row => {
        const count = parseInt(row.count as string);
        localizedPrompts[row.language] = count;
        coveragePercentage[row.language] = totalPrompts > 0 ? (count / totalPrompts) * 100 : 0;
      });

      // Find missing localizations for active languages
      const missingLocalizations: Record<string, string[]> = {};
      const activeLanguages = this.getActiveLanguages();

      for (const lang of activeLanguages) {
        if (lang.code === 'en') continue; // Skip English as it's the source language

        const localizedPromptIds = await this.db('localized_prompts')
          .where('language', lang.code)
          .where('status', '!=', 'deprecated')
          .pluck('original_prompt_id');

        const allPromptIds = (await Prompt.findLibraryPrompts()).map(p => p.data.id);
        const missing = allPromptIds.filter(id => !localizedPromptIds.includes(id));
        
        missingLocalizations[lang.code] = missing;
      }

      return {
        totalPrompts,
        localizedPrompts,
        coveragePercentage,
        missingLocalizations,
      };
    } catch (error) {
      console.error('Failed to get localization coverage:', error);
      return {
        totalPrompts: 0,
        localizedPrompts: {},
        coveragePercentage: {},
        missingLocalizations: {},
      };
    }
  }

  /**
   * Get prompt in user's preferred language
   */
  async getPromptForUser(promptId: string, userLanguage: string = 'en'): Promise<{
    text: string;
    followUpQuestions: string[];
    language: string;
    isLocalized: boolean;
  }> {
    try {
      // Try to get localized version first
      if (userLanguage !== 'en') {
        const localized = await this.getLocalizedPrompt(promptId, userLanguage);
        if (localized && localized.status === 'approved') {
          return {
            text: localized.text,
            followUpQuestions: localized.followUpQuestions || [],
            language: localized.language,
            isLocalized: true,
          };
        }
      }

      // Fallback to original English prompt
      const originalPrompt = await Prompt.findById(promptId);
      if (!originalPrompt) {
        throw new Error('Prompt not found');
      }

      return {
        text: originalPrompt.data.text,
        followUpQuestions: originalPrompt.getFollowUpQuestions(),
        language: 'en',
        isLocalized: false,
      };
    } catch (error) {
      console.error('Failed to get prompt for user:', error);
      throw error;
    }
  }

  /**
   * Transform database row to LocalizedPrompt interface
   */
  private transformDbToLocalizedPrompt(row: any): LocalizedPrompt {
    return {
      id: row.id,
      originalPromptId: row.original_prompt_id,
      language: row.language,
      text: row.text,
      followUpQuestions: row.follow_up_questions ? JSON.parse(row.follow_up_questions) : [],
      culturalAdaptations: row.cultural_adaptations ? JSON.parse(row.cultural_adaptations) : [],
      translatedBy: row.translated_by,
      reviewedBy: row.reviewed_by,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export const PromptLocalizationService = new PromptLocalizationServiceClass();