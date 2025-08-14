export const COLORS = {
  primary: '#2563eb',
  secondary: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  
  // Grays
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  
  // Background
  background: '#ffffff',
  backgroundSecondary: '#f9fafb',
  
  // Text
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
};

export const FONTS = {
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
};

export const UPLOAD_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedAudioTypes: ['audio/mp4', 'audio/m4a', 'audio/wav'],
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/heic'],
  maxImageSize: 10 * 1024 * 1024, // 10MB
};

export const AUDIO_CONFIG = {
  maxDuration: 600, // 10 minutes in seconds
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 128000,
  format: 'mp4',
  extension: '.m4a',
  maxFileSize: UPLOAD_CONFIG.maxFileSize,
};