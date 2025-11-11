import type { SupabaseClient } from '@supabase/supabase-js'
import { createClientSupabase } from '@/lib/supabase'

// Singleton Supabase client to avoid multiple instances
let supabaseClient: SupabaseClient | null = null

// Validate that a URL string is actually a valid URL
function isValidUrl(url?: string): boolean {
  if (!url) return false
  try {
    // Will throw if invalid
    new URL(url)
    return true
  } catch {
    return false
  }
}

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (url && anonKey && isValidUrl(url)) {
      // Use centralized singleton client when configuration is valid
      supabaseClient = createClientSupabase() as SupabaseClient
    } else {
      // Provide a minimal stub client when env vars are missing or invalid to avoid runtime errors during local preview
      const stubQuery: any = {
        select: () => stubQuery,
        eq: () => stubQuery,
        single: async () => ({ data: null, error: { code: 'PGRST116', message: 'stub' } }),
        upsert: () => stubQuery,
        update: () => stubQuery,
        insert: () => stubQuery,
      }
      supabaseClient = ({
        auth: {
          getUser: async () => ({ data: { user: null } })
        },
        from: () => stubQuery
      } as unknown) as SupabaseClient
    }
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
    }

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
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.user_id,
      name: data.full_name,
      email: data.email,
      phone: data.phone_number,
      avatar: undefined,
      bio: undefined,
    }
  }

  async getNotificationSettings(): Promise<NotificationSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      // Default settings when not authenticated or stub client
      return {
        emailNotifications: false,
        pushNotifications: false,
        storyUpdates: true,
        followUpQuestions: true,
        weeklyDigest: false,
        marketingEmails: false,
      };
    }

    const { data, error } = await this.supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          emailNotifications: false,
          pushNotifications: false,
          storyUpdates: true,
          followUpQuestions: true,
          weeklyDigest: false,
          marketingEmails: false,
        };
      }
      throw error;
    }

    return {
      emailNotifications: data.email_notifications,
      pushNotifications: data.push_notifications,
      storyUpdates: data.story_updates,
      followUpQuestions: data.follow_up_questions,
      weeklyDigest: data.weekly_digest,
      marketingEmails: data.marketing_emails,
    }

  }

  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('notification_settings')
      .upsert({
        user_id: user.id,
        email_notifications: settings.emailNotifications,
        push_notifications: settings.pushNotifications,
        story_updates: settings.storyUpdates,
        follow_up_questions: settings.followUpQuestions,
        weekly_digest: settings.weeklyDigest,
        marketing_emails: settings.marketingEmails,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      emailNotifications: data.email_notifications,
      pushNotifications: data.push_notifications,
      storyUpdates: data.story_updates,
      followUpQuestions: data.follow_up_questions,
      weeklyDigest: data.weekly_digest,
      marketingEmails: data.marketing_emails,
    }
  }

  async getAccessibilitySettings(): Promise<AccessibilitySettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      // If not authenticated or using stub, attempt to load from localStorage
      const local = localStorage.getItem('accessibility_settings')
      if (local) {
        try {
          return JSON.parse(local)
        } catch {}
      }
      return {
        fontSize: 'standard',
        highContrast: false,
        reducedMotion: false,
        screenReader: false,
      }
    }

    // Remote persistence for accessibility settings is temporarily disabled
    // to avoid 404s when the table is not provisioned. We will rely on
    // localStorage for now and return sensible defaults if not present.
    const local = localStorage.getItem('accessibility_settings')
    if (local) {
      try {
        return JSON.parse(local)
      } catch {}
    }
    return {
      fontSize: 'standard',
      highContrast: false,
      reducedMotion: false,
      screenReader: false,
    }

  }

  async updateAccessibilitySettings(settings: Partial<AccessibilitySettings>): Promise<AccessibilitySettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    // Persist to localStorage (temporarily the sole persistence layer).
    const merged = { ...settings, fontSize: settings.fontSize ?? 'standard', highContrast: !!settings.highContrast, reducedMotion: !!settings.reducedMotion, screenReader: !!settings.screenReader }
    localStorage.setItem('accessibility_settings', JSON.stringify(merged))
    return merged as AccessibilitySettings
  }

  async getAudioSettings(): Promise<AudioSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      return { volume: 50, quality: 'medium' }
    }

    const { data, error } = await this.supabase
      .from('audio_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { volume: 50, quality: 'medium' }
      }
      throw error;
    }

    return { volume: data.volume ?? 50, quality: data.quality ?? 'medium' }
  }

  async updateAudioSettings(settings: Partial<AudioSettings>): Promise<AudioSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      const merged = { volume: settings.volume ?? 50, quality: settings.quality ?? 'medium' }
      localStorage.setItem('audio_settings', JSON.stringify(merged))
      return merged as AudioSettings
    }

    const { data, error } = await this.supabase
      .from('audio_settings')
      .upsert({
        user_id: user.id,
        volume: settings.volume,
        quality: settings.quality,
      })
      .select()
      .single();

    if (error) throw error;

    return { volume: data.volume ?? 50, quality: data.quality ?? 'medium' }
  }

  async getPrivacySettings(): Promise<PrivacySettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      return {
        profileVisible: true,
        storySharing: true,
        dataAnalytics: false,
        twoFactorAuth: false,
      }
    }

    const { data, error } = await this.supabase
      .from('privacy_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          profileVisible: true,
          storySharing: true,
          dataAnalytics: false,
          twoFactorAuth: false,
        }
      }
      throw error;
    }

    return {
      profileVisible: !!data.profile_visible,
      storySharing: !!data.story_sharing,
      dataAnalytics: !!data.data_analytics,
      twoFactorAuth: !!data.two_factor_auth,
    }
  }

  async updatePrivacySettings(settings: Partial<PrivacySettings>): Promise<PrivacySettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      const merged = {
        profileVisible: settings.profileVisible ?? true,
        storySharing: settings.storySharing ?? true,
        dataAnalytics: settings.dataAnalytics ?? false,
        twoFactorAuth: settings.twoFactorAuth ?? false,
      }
      localStorage.setItem('privacy_settings', JSON.stringify(merged))
      return merged as PrivacySettings
    }

    const { data, error } = await this.supabase
      .from('privacy_settings')
      .upsert({
        user_id: user.id,
        profile_visible: settings.profileVisible,
        story_sharing: settings.storySharing,
        data_analytics: settings.dataAnalytics,
        two_factor_auth: settings.twoFactorAuth,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      profileVisible: !!data.profile_visible,
      storySharing: !!data.story_sharing,
      dataAnalytics: !!data.data_analytics,
      twoFactorAuth: !!data.two_factor_auth,
    }
  }

  async getLanguageSettings(): Promise<LanguageSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      const local = localStorage.getItem('language_settings')
      if (local) {
        try { return JSON.parse(local) } catch {}
      }
      return { language: 'en', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    }

    const { data, error } = await this.supabase
      .from('language_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { language: 'en', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      }
      throw error;
    }

    return { language: data.language ?? 'en', timezone: data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone }
  }

  async updateLanguageSettings(settings: Partial<LanguageSettings>): Promise<LanguageSettings> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      const merged = { language: settings.language ?? 'en', timezone: settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone }
      localStorage.setItem('language_settings', JSON.stringify(merged))
      return merged as LanguageSettings
    }

    const { data, error } = await this.supabase
      .from('language_settings')
      .upsert({
        user_id: user.id,
        language: settings.language,
        timezone: settings.timezone,
      })
      .select()
      .single();

    if (error) throw error;

    return { language: data.language ?? 'en', timezone: data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone }
  }

  async getResourceWallet(): Promise<ResourceWallet> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      return { user_id: 'local', project_vouchers: 0, facilitator_seats: 0, storyteller_seats: 0 }
    }

    try {
      // Use API endpoint instead of direct Supabase query for better performance
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const { data: { session } } = await this.supabase.auth.getSession()
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/wallets/me', {
        credentials: 'include',
        headers
      })

      if (!response.ok) {
        console.warn('SettingsService: /api/wallets/me failed with', response.status)
        return { user_id: user.id, project_vouchers: 0, facilitator_seats: 0, storyteller_seats: 0 }
      }

      const data = await response.json()
      return {
        user_id: data.user_id,
        project_vouchers: data.project_vouchers ?? 0,
        facilitator_seats: data.facilitator_seats ?? 0,
        storyteller_seats: data.storyteller_seats ?? 0
      }
    } catch (error) {
      console.error('SettingsService: Error fetching wallet:', error)
      return { user_id: user.id, project_vouchers: 0, facilitator_seats: 0, storyteller_seats: 0 }
    }
  }

  private applyAccessibilitySettings(settings: AccessibilitySettings) {
    // Font size scaling
    const root = document.documentElement
    root.style.setProperty('--font-size-multiplier', this.getFontSizeMultiplier(settings.fontSize))

    // High contrast mode
    if (settings.highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }

    // Reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion')
    } else {
      root.classList.remove('reduced-motion')
    }

    // Screen reader optimizations
    if (settings.screenReader) {
      root.classList.add('screen-reader')
    } else {
      root.classList.remove('screen-reader')
    }
  }

  private getFontSizeMultiplier(fontSize: string): string {
    switch (fontSize) {
      case 'large':
        return '1.15'
      case 'extra-large':
        return '1.3'
      default:
        return '1.0'
    }
  }

  async loadAndApplyAccessibilitySettings(): Promise<void> {
    try {
      const settings = await this.getAccessibilitySettings()
      this.applyAccessibilitySettings(settings)
    } catch (err) {
      console.warn('Failed to load accessibility settings, using defaults', err)
      const fallback: AccessibilitySettings = { fontSize: 'standard', highContrast: false, reducedMotion: false, screenReader: false }
      this.applyAccessibilitySettings(fallback)
    }
  }

  private loadAccessibilityFromLocalStorage(): void {
    const local = localStorage.getItem('accessibility_settings')
    if (local) {
      try {
        const settings: AccessibilitySettings = JSON.parse(local)
        this.applyAccessibilitySettings(settings)
      } catch {}
    }
  }
}

export const settingsService = new SettingsService();