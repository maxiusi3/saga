export const locales = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'pt'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  'zh-CN': '🇨🇳',
  'zh-TW': '🇹🇼',
  ja: '🇯🇵',
  ko: '🇰🇷',
  es: '🇪🇸',
  fr: '🇫🇷',
  pt: '🇵🇹',
};

// Language mapping for STT service
export const sttLanguageMap: Record<Locale, string> = {
  en: 'en-US',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  ja: 'ja-JP',
  ko: 'ko-KR',
  es: 'es-ES',
  fr: 'fr-FR',
  pt: 'pt-BR',
};

// Language instructions for AI content generation
export const aiLanguageInstructions: Record<Locale, string> = {
  en: 'Generate all content in English.',
  'zh-CN': 'Generate all content in Simplified Chinese (简体中文).',
  'zh-TW': 'Generate all content in Traditional Chinese (繁體中文).',
  ja: 'Generate all content in Japanese (日本語).',
  ko: 'Generate all content in Korean (한국어).',
  es: 'Generate all content in Spanish (Español).',
  fr: 'Generate all content in French (Français).',
  pt: 'Generate all content in Portuguese (Português).',
};
