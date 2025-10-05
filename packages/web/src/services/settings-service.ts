import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton Supabase client to avoid multiple instances
let supabaseClient: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return supabaseClient
}

// Settings service for frontend API integration
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

export interface ResourceWallet {
  user_id: string;
  project_vouchers: number;
  facilitator_seats: number;
  storyteller_seats: number;
}

class SettingsService {
  private supabase = getSupabaseClient();

  // Profile methods
  async getUserProfile(): Promise<UserProfile> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // If no settings exist, create default ones
      if (error.code === 'PGRST116') {
        const defaultProfile: UserProfile = {
          id: user.id,
          name: user.user_metadata?.name || user.email?.split('@')[0] || '',
          email: user.email || '',
          phone: user.user_metadata?.phone || undefined,
          avatar: user.user_metadata?.avatar_url || undefined,
          bio: undefined,
        };
        return defaultProfile;
      }
      throw error;
    }

    return {
      id: data.user_id,
      name: data.full_name || user.email?.split('@')[0] || '',
      email: data.email || user.email || '',
      phone: data.phone_number || undefined,
      avatar: undefined,
      bio: undefined,
    };
  }

  async updateUserProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        full_name: updates.name,
        email: updates.email,
        phone_number: updates.phone,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.user_id,
      name: data.full_name || '',
      email: data.email || '',
      phone: data.phone_number || undefined,
      avatar: undefined,
      bio: undefined,
    };
  }

  // Notification methods
  async getNotificationSettings(): Promise<NotificationSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('user_settings')
      .select('notification_email, notification_push, notification_story_updates, notification_follow_up_questions, notification_weekly_digest, notification_marketing_emails')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return {
        emailNotifications: true,
        pushNotifications: true,
        storyUpdates: true,
        followUpQuestions: true,
        weeklyDigest: true,
        marketingEmails: false,
      };
    }

    return {
      emailNotifications: data.notification_email ?? true,
      pushNotifications: data.notification_push ?? true,
      storyUpdates: data.notification_story_updates ?? true,
      followUpQuestions: data.notification_follow_up_questions ?? true,
      weeklyDigest: data.notification_weekly_digest ?? true,
      marketingEmails: data.notification_marketing_emails ?? false,
    };
  }

  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        notification_email: settings.emailNotifications,
        notification_push: settings.pushNotifications,
        notification_story_updates: settings.storyUpdates,
        notification_follow_up_questions: settings.followUpQuestions,
        notification_weekly_digest: settings.weeklyDigest,
        notification_marketing_emails: settings.marketingEmails,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return settings as NotificationSettings;
  }

  // Accessibility methods
  async getAccessibilitySettings(): Promise<AccessibilitySettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('user_settings')
      .select('accessibility_font_size, accessibility_high_contrast, accessibility_reduced_motion, accessibility_screen_reader')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      // Return defaults if no settings exist
      return {
        fontSize: 'standard',
        highContrast: false,
        reducedMotion: false,
        screenReader: false,
      };
    }

    return {
      fontSize: (data.accessibility_font_size as any) || 'standard',
      highContrast: data.accessibility_high_contrast || false,
      reducedMotion: data.accessibility_reduced_motion || false,
      screenReader: data.accessibility_screen_reader || false,
    };
  }

  async updateAccessibilitySettings(settings: Partial<AccessibilitySettings>): Promise<AccessibilitySettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        accessibility_font_size: settings.fontSize,
        accessibility_high_contrast: settings.highContrast,
        accessibility_reduced_motion: settings.reducedMotion,
        accessibility_screen_reader: settings.screenReader,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    const result = settings as AccessibilitySettings;
    this.applyAccessibilitySettings(result);
    return result;
  }

  // Audio methods
  async getAudioSettings(): Promise<AudioSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('user_settings')
      .select('audio_volume, audio_quality')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return {
        volume: 75,
        quality: 'high',
      };
    }

    return {
      volume: data.audio_volume || 75,
      quality: (data.audio_quality as any) || 'high',
    };
  }

  async updateAudioSettings(settings: Partial<AudioSettings>): Promise<AudioSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        audio_volume: settings.volume,
        audio_quality: settings.quality,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return settings as AudioSettings;
  }

  // Privacy methods
  async getPrivacySettings(): Promise<PrivacySettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('user_settings')
      .select('privacy_profile_visible, privacy_story_sharing, privacy_data_analytics, privacy_two_factor_auth')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return {
        profileVisible: true,
        storySharing: true,
        dataAnalytics: true,
        twoFactorAuth: false,
      };
    }

    return {
      profileVisible: data.privacy_profile_visible ?? true,
      storySharing: data.privacy_story_sharing ?? true,
      dataAnalytics: data.privacy_data_analytics ?? true,
      twoFactorAuth: data.privacy_two_factor_auth ?? false,
    };
  }

  async updatePrivacySettings(settings: Partial<PrivacySettings>): Promise<PrivacySettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        privacy_profile_visible: settings.profileVisible,
        privacy_story_sharing: settings.storySharing,
        privacy_data_analytics: settings.dataAnalytics,
        privacy_two_factor_auth: settings.twoFactorAuth,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return settings as PrivacySettings;
  }

  // Language methods
  async getLanguageSettings(): Promise<LanguageSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('user_settings')
      .select('language, timezone')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return {
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }

    return {
      language: data.language || 'en',
      timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  async updateLanguageSettings(settings: Partial<LanguageSettings>): Promise<LanguageSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        language: settings.language,
        timezone: settings.timezone,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return settings as LanguageSettings;
  }

  // Resource wallet methods
  async getResourceWallet(): Promise<ResourceWallet> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('user_resource_wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) throw error;

    return {
      user_id: data.user_id,
      project_vouchers: data.project_vouchers,
      facilitator_seats: data.facilitator_seats,
      storyteller_seats: data.storyteller_seats,
    };
  }

  // Apply accessibility settings to DOM (similar to accessibility toolbar)
  private applyAccessibilitySettings(settings: AccessibilitySettings) {
    const root = document.documentElement;

    // Apply font size
    const fontSizeMultiplier = this.getFontSizeMultiplier(settings.fontSize);
    root.style.setProperty('--font-size-multiplier', fontSizeMultiplier);

    // Apply high contrast
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Apply reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Apply screen reader optimizations
    if (settings.screenReader) {
      root.classList.add('screen-reader-optimized');
    } else {
      root.classList.remove('screen-reader-optimized');
    }
  }

  private getFontSizeMultiplier(fontSize: string): string {
    switch (fontSize) {
      case 'standard': return '1';
      case 'large': return '1.125';
      case 'extra-large': return '1.25';
      default: return '1';
    }
  }

  // Load and apply accessibility settings on app initialization
  async loadAndApplyAccessibilitySettings(): Promise<void> {
    try {
      const settings = await this.getAccessibilitySettings();
      this.applyAccessibilitySettings(settings);
    } catch (error) {
      console.error('Failed to load accessibility settings:', error);
      // Fallback to localStorage if API fails
      this.loadAccessibilityFromLocalStorage();
    }
  }

  private loadAccessibilityFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem('accessibility-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.applyAccessibilitySettings({
          fontSize: settings.fontSize || 'standard',
          highContrast: settings.highContrast || false,
          reducedMotion: settings.reducedMotion || false,
          screenReader: settings.screenReader || false
        });
      }
    } catch (error) {
      console.error('Error loading accessibility settings from localStorage:', error);
    }
  }
}

export const settingsService = new SettingsService();