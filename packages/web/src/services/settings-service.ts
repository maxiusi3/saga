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
    const token = localStorage.getItem('auth_token');
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      // If backend is not available, return mock data for development
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.warn('Backend not available, using mock data');
        return this.getMockData(endpoint) as T;
      }
      throw error;
    }
  }

  private getMockData(endpoint: string): any {
    // Mock data for when backend is not available
    if (endpoint.includes('/profile')) {
      return {
        id: 'mock-user-id',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1 (555) 123-4567',
        avatar: null,
        bio: 'Family storyteller and memory keeper'
      };
    }
    
    if (endpoint.includes('/notifications')) {
      return {
        emailNotifications: true,
        pushNotifications: true,
        storyUpdates: true,
        followUpQuestions: true,
        weeklyDigest: true,
        marketingEmails: false
      };
    }
    
    if (endpoint.includes('/accessibility')) {
      return {
        fontSize: 'standard',
        highContrast: false,
        reducedMotion: false,
        screenReader: false
      };
    }
    
    if (endpoint.includes('/audio')) {
      return {
        volume: 75,
        quality: 'high'
      };
    }
    
    if (endpoint.includes('/privacy')) {
      return {
        profileVisible: true,
        storySharing: true,
        dataAnalytics: false,
        twoFactorAuth: false
      };
    }
    
    if (endpoint.includes('/language')) {
      return {
        language: 'en',
        timezone: 'UTC'
      };
    }
    
    if (endpoint.includes('/wallet')) {
      return {
        user_id: 'mock-user-id',
        project_vouchers: 2,  // 2 remaining out of 5 (used 3)
        facilitator_seats: 1, // 1 remaining out of 4 (used 3) 
        storyteller_seats: 3  // 3 remaining out of 10 (used 7)
      };
    }
    
    return {};
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