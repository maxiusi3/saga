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
      .select('notification_preferences')
      .eq('user_id', user.id)
      .single();

    if (error || !data?.notification_preferences) {
      return {
        emailNotifications: true,
        pushNotifications: true,
        storyUpdates: true,
        followUpQuestions: true,
        weeklyDigest: true,
        marketingEmails: false,
      };
    }

    const prefs = data.notification_preferences as any;
    return {
      emailNotifications: prefs.email_notifications ?? true,
      pushNotifications: prefs.push_notifications ?? true,
      storyUpdates: prefs.story_updates ?? true,
      followUpQuestions: prefs.follow_up_questions ?? true,
      weeklyDigest: prefs.weekly_digest ?? true,
      marketingEmails: prefs.marketing_emails ?? false,
    };
  }

  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const prefs = {
      email_notifications: settings.emailNotifications,
      push_notifications: settings.pushNotifications,
      story_updates: settings.storyUpdates,
      follow_up_questions: settings.followUpQuestions,
      weekly_digest: settings.weeklyDigest,
      marketing_emails: settings.marketingEmails,
    };

    const { error } = await this.supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        notification_preferences: prefs,
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
      .select('accessibility_preferences')
      .eq('user_id', user.id)
      .single();

    if (error || !data?.accessibility_preferences) {
      return {
        fontSize: 'standard',
        highContrast: false,
        reducedMotion: false,
        screenReader: false,
      };
    }

    const prefs = data.accessibility_preferences as any;
    return {
      fontSize: prefs.font_size || 'standard',
      highContrast: prefs.high_contrast || false,
      reducedMotion: prefs.reduced_motion || false,
      screenReader: prefs.screen_reader || false,
    };
  }

  async updateAccessibilitySettings(settings: Partial<AccessibilitySettings>): Promise<AccessibilitySettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const prefs = {
      font_size: settings.fontSize,
      high_contrast: settings.highContrast,
      reduced_motion: settings.reducedMotion,
      screen_reader: settings.screenReader,
    };

    const { error } = await this.supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        accessibility_preferences: prefs,
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
      .select('audio_preferences')
      .eq('user_id', user.id)
      .single();

    if (error || !data?.audio_preferences) {
      return {
        volume: 75,
        quality: 'high',
      };
    }

    const prefs = data.audio_preferences as any;
    return {
      volume: prefs.volume || 75,
      quality: prefs.quality || 'high',
    };
  }

  async updateAudioSettings(settings: Partial<AudioSettings>): Promise<AudioSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const prefs = {
      volume: settings.volume,
      quality: settings.quality,
    };

    const { error } = await this.supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        audio_preferences: prefs,
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
      .select('privacy_preferences')
      .eq('user_id', user.id)
      .single();

    if (error || !data?.privacy_preferences) {
      return {
        profileVisible: true,
        storySharing: true,
        dataAnalytics: true,
        twoFactorAuth: false,
      };
    }

    const prefs = data.privacy_preferences as any;
    return {
      profileVisible: prefs.profile_visible ?? true,
      storySharing: prefs.story_sharing ?? true,
      dataAnalytics: prefs.data_analytics ?? true,
      twoFactorAuth: prefs.two_factor_auth ?? false,
    };
  }

  async updatePrivacySettings(settings: Partial<PrivacySettings>): Promise<PrivacySettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const prefs = {
      profile_visible: settings.profileVisible,
      story_sharing: settings.storySharing,
      data_analytics: settings.dataAnalytics,
      two_factor_auth: settings.twoFactorAuth,
    };

    const { error } = await this.supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        privacy_preferences: prefs,
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