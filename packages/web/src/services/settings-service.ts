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
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Get token from Supabase session using singleton client
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };
    
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch (error) {
      console.error('Failed to get auth session:', error);
    }
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }



  // Profile methods
  async getUserProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/settings/profile');
  }

  async updateUserProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    return this.request<UserProfile>('/settings/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Notification methods
  async getNotificationSettings(): Promise<NotificationSettings> {
    return this.request<NotificationSettings>('/settings/notifications');
  }

  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    return this.request<NotificationSettings>('/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Accessibility methods
  async getAccessibilitySettings(): Promise<AccessibilitySettings> {
    return this.request<AccessibilitySettings>('/settings/accessibility');
  }

  async updateAccessibilitySettings(settings: Partial<AccessibilitySettings>): Promise<AccessibilitySettings> {
    const result = await this.request<AccessibilitySettings>('/settings/accessibility', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });

    // Apply settings to DOM immediately
    this.applyAccessibilitySettings(result);
    
    return result;
  }

  // Audio methods
  async getAudioSettings(): Promise<AudioSettings> {
    return this.request<AudioSettings>('/settings/audio');
  }

  async updateAudioSettings(settings: Partial<AudioSettings>): Promise<AudioSettings> {
    return this.request<AudioSettings>('/settings/audio', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Privacy methods
  async getPrivacySettings(): Promise<PrivacySettings> {
    return this.request<PrivacySettings>('/settings/privacy');
  }

  async updatePrivacySettings(settings: Partial<PrivacySettings>): Promise<PrivacySettings> {
    return this.request<PrivacySettings>('/settings/privacy', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Language methods
  async getLanguageSettings(): Promise<LanguageSettings> {
    return this.request<LanguageSettings>('/settings/language');
  }

  async updateLanguageSettings(settings: Partial<LanguageSettings>): Promise<LanguageSettings> {
    return this.request<LanguageSettings>('/settings/language', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Resource wallet methods
  async getResourceWallet(): Promise<ResourceWallet> {
    return this.request<ResourceWallet>('/settings/wallet');
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