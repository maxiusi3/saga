import { BaseModel } from './base';

export interface UserSettings {
  user_id: string;
  // Notification settings
  notification_email: boolean;
  notification_push: boolean;
  notification_story_updates: boolean;
  notification_follow_up_questions: boolean;
  notification_weekly_digest: boolean;
  notification_marketing_emails: boolean;
  // Accessibility settings
  accessibility_font_size: 'standard' | 'large' | 'extra-large';
  accessibility_high_contrast: boolean;
  accessibility_reduced_motion: boolean;
  accessibility_screen_reader: boolean;
  // Privacy settings
  privacy_profile_visible: boolean;
  privacy_story_sharing: boolean;
  privacy_data_analytics: boolean;
  privacy_two_factor_auth: boolean;
  // Audio settings
  audio_volume: number;
  audio_quality: 'low' | 'medium' | 'high';
  // Language and region
  language: string;
  timezone: string;
  created_at: Date;
  updated_at: Date;
}

export class UserSettingsModel extends BaseModel {
  protected static tableName = 'user_settings';

  static async findByUserId(userId: string): Promise<UserSettings | null> {
    return this.query.where('user_id', userId).first();
  }

  static async createForUser(userId: string, settings: Partial<UserSettings> = {}): Promise<UserSettings> {
    const defaultSettings: Partial<UserSettings> = {
      user_id: userId,
      notification_email: true,
      notification_push: true,
      notification_story_updates: true,
      notification_follow_up_questions: true,
      notification_weekly_digest: true,
      notification_marketing_emails: false,
      accessibility_font_size: 'standard',
      accessibility_high_contrast: false,
      accessibility_reduced_motion: false,
      accessibility_screen_reader: false,
      privacy_profile_visible: true,
      privacy_story_sharing: true,
      privacy_data_analytics: false,
      privacy_two_factor_auth: false,
      audio_volume: 75,
      audio_quality: 'high',
      language: 'en',
      timezone: 'UTC',
      ...settings
    };

    const [result] = await this.query.insert(defaultSettings).returning('*');
    return result;
  }

  static async updateByUserId(userId: string, settings: Partial<UserSettings>): Promise<UserSettings> {
    const [result] = await this.query
      .where('user_id', userId)
      .update({ ...settings, updated_at: new Date() })
      .returning('*');
    return result;
  }

  static async upsertByUserId(userId: string, settings: Partial<UserSettings>): Promise<UserSettings> {
    const existing = await this.findByUserId(userId);
    
    if (existing) {
      return this.updateByUserId(userId, settings);
    } else {
      return this.createForUser(userId, settings);
    }
  }
}