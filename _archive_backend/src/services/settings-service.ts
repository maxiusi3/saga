import { UserSettingsModel, UserSettings } from '@/models/user-settings';
import { UserResourceWalletModel, UserResourceWallet } from '@/models/user-resource-wallet';
import { createError } from '@/middleware/error-handler';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  bio?: string;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  storyUpdates: boolean;
  followUpQuestions: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
}

export interface AccessibilitySettings {
  fontSize: 'standard' | 'large' | 'extra-large';
  highContrast: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
}

export interface AudioSettings {
  volume: number;
  quality: 'low' | 'medium' | 'high';
}

export interface PrivacySettings {
  profileVisible: boolean;
  storySharing: boolean;
  dataAnalytics: boolean;
  twoFactorAuth: boolean;
}

export interface LanguageSettings {
  language: string;
  timezone: string;
}

export class SettingsService {
  // Profile settings
  async getUserProfile(userId: string): Promise<UserProfile> {
    // This would typically come from a users table
    // For now, return mock data - implement when users table exists
    return {
      id: userId,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1 (555) 123-4567',
      avatar: null,
      bio: 'Family storyteller and memory keeper'
    };
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    // This would update the users table
    // For now, return the updated profile - implement when users table exists
    const currentProfile = await this.getUserProfile(userId);
    return { ...currentProfile, ...updates };
  }

  // Notification settings
  async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    const settings = await UserSettingsModel.findByUserId(userId);
    
    if (!settings) {
      // Create default settings if they don't exist
      const defaultSettings = await UserSettingsModel.createForUser(userId);
      return this.mapToNotificationSettings(defaultSettings);
    }

    return this.mapToNotificationSettings(settings);
  }

  async updateNotificationSettings(userId: string, updates: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const dbUpdates: Partial<UserSettings> = {
      notification_email: updates.emailNotifications,
      notification_push: updates.pushNotifications,
      notification_story_updates: updates.storyUpdates,
      notification_follow_up_questions: updates.followUpQuestions,
      notification_weekly_digest: updates.weeklyDigest,
      notification_marketing_emails: updates.marketingEmails
    };

    // Remove undefined values
    Object.keys(dbUpdates).forEach(key => {
      if (dbUpdates[key as keyof typeof dbUpdates] === undefined) {
        delete dbUpdates[key as keyof typeof dbUpdates];
      }
    });

    const updatedSettings = await UserSettingsModel.upsertByUserId(userId, dbUpdates);
    return this.mapToNotificationSettings(updatedSettings);
  }

  // Accessibility settings
  async getAccessibilitySettings(userId: string): Promise<AccessibilitySettings> {
    const settings = await UserSettingsModel.findByUserId(userId);
    
    if (!settings) {
      const defaultSettings = await UserSettingsModel.createForUser(userId);
      return this.mapToAccessibilitySettings(defaultSettings);
    }

    return this.mapToAccessibilitySettings(settings);
  }

  async updateAccessibilitySettings(userId: string, updates: Partial<AccessibilitySettings>): Promise<AccessibilitySettings> {
    const dbUpdates: Partial<UserSettings> = {
      accessibility_font_size: updates.fontSize,
      accessibility_high_contrast: updates.highContrast,
      accessibility_reduced_motion: updates.reducedMotion,
      accessibility_screen_reader: updates.screenReader
    };

    // Remove undefined values
    Object.keys(dbUpdates).forEach(key => {
      if (dbUpdates[key as keyof typeof dbUpdates] === undefined) {
        delete dbUpdates[key as keyof typeof dbUpdates];
      }
    });

    const updatedSettings = await UserSettingsModel.upsertByUserId(userId, dbUpdates);
    return this.mapToAccessibilitySettings(updatedSettings);
  }

  // Audio settings
  async getAudioSettings(userId: string): Promise<AudioSettings> {
    const settings = await UserSettingsModel.findByUserId(userId);
    
    if (!settings) {
      const defaultSettings = await UserSettingsModel.createForUser(userId);
      return this.mapToAudioSettings(defaultSettings);
    }

    return this.mapToAudioSettings(settings);
  }

  async updateAudioSettings(userId: string, updates: Partial<AudioSettings>): Promise<AudioSettings> {
    const dbUpdates: Partial<UserSettings> = {
      audio_volume: updates.volume,
      audio_quality: updates.quality
    };

    // Remove undefined values
    Object.keys(dbUpdates).forEach(key => {
      if (dbUpdates[key as keyof typeof dbUpdates] === undefined) {
        delete dbUpdates[key as keyof typeof dbUpdates];
      }
    });

    const updatedSettings = await UserSettingsModel.upsertByUserId(userId, dbUpdates);
    return this.mapToAudioSettings(updatedSettings);
  }

  // Privacy settings
  async getPrivacySettings(userId: string): Promise<PrivacySettings> {
    const settings = await UserSettingsModel.findByUserId(userId);
    
    if (!settings) {
      const defaultSettings = await UserSettingsModel.createForUser(userId);
      return this.mapToPrivacySettings(defaultSettings);
    }

    return this.mapToPrivacySettings(settings);
  }

  async updatePrivacySettings(userId: string, updates: Partial<PrivacySettings>): Promise<PrivacySettings> {
    const dbUpdates: Partial<UserSettings> = {
      privacy_profile_visible: updates.profileVisible,
      privacy_story_sharing: updates.storySharing,
      privacy_data_analytics: updates.dataAnalytics,
      privacy_two_factor_auth: updates.twoFactorAuth
    };

    // Remove undefined values
    Object.keys(dbUpdates).forEach(key => {
      if (dbUpdates[key as keyof typeof dbUpdates] === undefined) {
        delete dbUpdates[key as keyof typeof dbUpdates];
      }
    });

    const updatedSettings = await UserSettingsModel.upsertByUserId(userId, dbUpdates);
    return this.mapToPrivacySettings(updatedSettings);
  }

  // Language settings
  async getLanguageSettings(userId: string): Promise<LanguageSettings> {
    const settings = await UserSettingsModel.findByUserId(userId);
    
    if (!settings) {
      const defaultSettings = await UserSettingsModel.createForUser(userId);
      return this.mapToLanguageSettings(defaultSettings);
    }

    return this.mapToLanguageSettings(settings);
  }

  async updateLanguageSettings(userId: string, updates: Partial<LanguageSettings>): Promise<LanguageSettings> {
    const dbUpdates: Partial<UserSettings> = {
      language: updates.language,
      timezone: updates.timezone
    };

    // Remove undefined values
    Object.keys(dbUpdates).forEach(key => {
      if (dbUpdates[key as keyof typeof dbUpdates] === undefined) {
        delete dbUpdates[key as keyof typeof dbUpdates];
      }
    });

    const updatedSettings = await UserSettingsModel.upsertByUserId(userId, dbUpdates);
    return this.mapToLanguageSettings(updatedSettings);
  }

  // Resource wallet
  async getResourceWallet(userId: string): Promise<UserResourceWallet> {
    const wallet = await UserResourceWalletModel.findByUserId(userId);
    
    if (!wallet) {
      return UserResourceWalletModel.createForUser(userId);
    }

    return wallet;
  }

  // Helper methods for mapping database fields to API format
  private mapToNotificationSettings(settings: UserSettings): NotificationSettings {
    return {
      emailNotifications: settings.notification_email,
      pushNotifications: settings.notification_push,
      storyUpdates: settings.notification_story_updates,
      followUpQuestions: settings.notification_follow_up_questions,
      weeklyDigest: settings.notification_weekly_digest,
      marketingEmails: settings.notification_marketing_emails
    };
  }

  private mapToAccessibilitySettings(settings: UserSettings): AccessibilitySettings {
    return {
      fontSize: settings.accessibility_font_size,
      highContrast: settings.accessibility_high_contrast,
      reducedMotion: settings.accessibility_reduced_motion,
      screenReader: settings.accessibility_screen_reader
    };
  }

  private mapToAudioSettings(settings: UserSettings): AudioSettings {
    return {
      volume: settings.audio_volume,
      quality: settings.audio_quality
    };
  }

  private mapToPrivacySettings(settings: UserSettings): PrivacySettings {
    return {
      profileVisible: settings.privacy_profile_visible,
      storySharing: settings.privacy_story_sharing,
      dataAnalytics: settings.privacy_data_analytics,
      twoFactorAuth: settings.privacy_two_factor_auth
    };
  }

  private mapToLanguageSettings(settings: UserSettings): LanguageSettings {
    return {
      language: settings.language,
      timezone: settings.timezone
    };
  }
}